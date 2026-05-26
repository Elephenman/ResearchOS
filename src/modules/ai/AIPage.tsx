import React, { useState, useRef, useEffect } from 'react';
import { Card, Input, Button, Space, Typography, Avatar, Tag, Spin, Empty, Select, message } from 'antd';
import { RobotOutlined, UserOutlined, SendOutlined, ThunderboltOutlined, ReadOutlined, TranslationOutlined, SettingOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

const QUICK_ACTIONS = [
  { key: 'summarize', label: '摘要总结', icon: <ReadOutlined /> },
  { key: 'keyfindings', label: '关键发现', icon: <ThunderboltOutlined /> },
  { key: 'translate', label: '翻译摘要', icon: <TranslationOutlined /> },
];

const AI_PROVIDERS = [
  { value: 'ollama', label: 'Ollama (本地)' },
  { value: 'openai', label: 'OpenAI' },
  { value: 'anthropic', label: 'Anthropic' },
];

const AI_MODELS: Record<string, string[]> = {
  ollama: ['llama3.2', 'llama3.1', 'qwen2.5', 'gemma2', 'mistral', 'phi3'],
  openai: ['gpt-4o-mini', 'gpt-4o', 'gpt-4-turbo'],
  anthropic: ['claude-3-haiku-20240307', 'claude-3-sonnet-20240229', 'claude-3-opus-20240229'],
};

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

const AIPage: React.FC = () => {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [provider, setProvider] = useState('ollama');
  const [model, setModel] = useState('llama3.2');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Load saved settings
    loadAISettings();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadAISettings = async () => {
    try {
      const savedProvider = await window.electronAPI.getSetting('ai.provider');
      const savedModel = await window.electronAPI.getSetting('ai.model');
      if (savedProvider) setProvider(savedProvider);
      if (savedModel) setModel(savedModel);
    } catch { /* ignore */ }
  };

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMsg: ChatMessage = { role: 'user', content: input };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const response = await window.electronAPI.chat(
        [...messages, userMsg].map(m => ({
          id: Date.now().toString(),
          conversationId: '1',
          ...m,
          timestamp: new Date().toISOString(),
        })),
        { provider, model, temperature: 0.7 }
      );
      setMessages(prev => [...prev, { role: 'assistant', content: response }]);
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'AI 回复失败，请检查网络或模型配置' }]);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickAction = async (key: string) => {
    const prompts: Record<string, string> = {
      summarize: '请总结当前论文的核心内容，包括研究背景、方法、主要发现和结论',
      keyfindings: '请提取当前论文的3-5个关键发现，每个发现用一行表示',
      translate: '请翻译当前论文的摘要为中文，保持学术风格',
    };
    setInput(prompts[key] || '');
  };

  const handleProviderChange = async (newProvider: string) => {
    setProvider(newProvider);
    const models = AI_MODELS[newProvider] || [];
    if (models.length > 0) setModel(models[0]);
    try {
      await window.electronAPI.setSetting('ai.provider', newProvider);
      if (models.length > 0) await window.electronAPI.setSetting('ai.model', models[0]);
    } catch { /* ignore */ }
  };

  const handleModelChange = async (newModel: string) => {
    setModel(newModel);
    try {
      await window.electronAPI.setSetting('ai.model', newModel);
    } catch { /* ignore */ }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ color: '#e0e0e0', margin: 0 }}>AI 助手</Title>
        <Space>
          <Select value={provider} onChange={handleProviderChange} style={{ width: 140 }} size="small"
            options={AI_PROVIDERS} />
          <Select value={model} onChange={handleModelChange} style={{ width: 180 }} size="small"
            options={(AI_MODELS[provider] || []).map(m => ({ value: m, label: m }))} />
          <Button size="small" icon={<SettingOutlined />} onClick={() => navigate('/settings')} />
        </Space>
      </div>

      <Card style={{ flex: 1, background: '#1f1f1f', border: '1px solid #303030', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
        styles={{ body: { flex: 1, display: 'flex', flexDirection: 'column', padding: 0 } }}>
        <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
          {messages.length === 0 ? (
            <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
              <RobotOutlined style={{ fontSize: 48, color: '#1677ff' }} />
              <Text type="secondary">向 AI 助手提问任何学术问题</Text>
              <Text type="secondary" style={{ fontSize: 12 }}>当前模型: {provider} / {model}</Text>
              <Space wrap>
                {QUICK_ACTIONS.map(a => (
                  <Tag key={a.key} color="blue" style={{ cursor: 'pointer' }} onClick={() => handleQuickAction(a.key)}>
                    {a.icon} {a.label}
                  </Tag>
                ))}
              </Space>
            </div>
          ) : (
            <div>
              {messages.map((msg, i) => (
                <div key={i} style={{
                  display: 'flex', gap: 12, marginBottom: 16,
                  justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                }}>
                  {msg.role === 'assistant' && <Avatar icon={<RobotOutlined />} style={{ background: '#1677ff', flexShrink: 0 }} />}
                  <div style={{
                    maxWidth: '70%', padding: '10px 16px', borderRadius: 12,
                    background: msg.role === 'user' ? '#1677ff' : '#2a2a2a',
                    color: msg.role === 'user' ? '#fff' : '#e0e0e0',
                  }}>
                    <Paragraph style={{ margin: 0, color: 'inherit', whiteSpace: 'pre-wrap', fontSize: 14 }}>{msg.content}</Paragraph>
                  </div>
                  {msg.role === 'user' && <Avatar icon={<UserOutlined />} style={{ background: '#595959', flexShrink: 0 }} />}
                </div>
              ))}
              {loading && (
                <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
                  <Avatar icon={<RobotOutlined />} style={{ background: '#1677ff', flexShrink: 0 }} />
                  <Spin size="small" />
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        <div style={{ padding: 16, borderTop: '1px solid #303030' }}>
          <Space.Compact style={{ width: '100%' }}>
            <TextArea
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder={`向 ${model} 提问...`}
              autoSize={{ minRows: 1, maxRows: 4 }}
              onPressEnter={e => { if (!e.shiftKey) { e.preventDefault(); handleSend(); } }}
              style={{ background: '#2a2a2a', borderColor: '#434343', color: '#e0e0e0' }}
            />
            <Button type="primary" icon={<SendOutlined />} onClick={handleSend} loading={loading}>
              发送
            </Button>
          </Space.Compact>
        </div>
      </Card>
    </div>
  );
};

export default AIPage;
