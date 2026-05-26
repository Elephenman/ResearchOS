import React, { useState, useEffect } from 'react';
import { Card, Form, Input, Select, Button, Space, Typography, Divider, Switch, message, Tabs } from 'antd';
import { SaveOutlined, ApiOutlined, GlobalOutlined, TranslationOutlined, BellOutlined } from '@ant-design/icons';

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;

const AI_PROVIDERS = [
  { value: 'ollama', label: 'Ollama (本地)', desc: '免费，需本地安装 Ollama' },
  { value: 'openai', label: 'OpenAI', desc: 'GPT-4o / GPT-4o-mini' },
  { value: 'anthropic', label: 'Anthropic', desc: 'Claude 3 系列' },
];

const AI_MODELS: Record<string, string[]> = {
  ollama: ['llama3.2', 'llama3.1', 'qwen2.5', 'gemma2', 'mistral', 'phi3'],
  openai: ['gpt-4o-mini', 'gpt-4o', 'gpt-4-turbo'],
  anthropic: ['claude-3-haiku-20240307', 'claude-3-sonnet-20240229', 'claude-3-opus-20240229'],
};

const CITATION_STYLES = [
  { value: 'apa', label: 'APA 7th' },
  { value: 'mla', label: 'MLA 9th' },
  { value: 'gb-t', label: 'GB/T 7714-2015' },
  { value: 'vancouver', label: 'Vancouver' },
  { value: 'chicago', label: 'Chicago 17th' },
];

const SettingsPage: React.FC = () => {
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const [aiProvider, setAiProvider] = useState('ollama');

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const settings = await window.electronAPI.getAllSettings();
      form.setFieldsValue({
        aiProvider: settings['ai.provider'] || 'ollama',
        aiModel: settings['ai.model'] || 'llama3.2',
        openaiApiKey: settings['ai.openai.apiKey'] || '',
        openaiBaseUrl: settings['ai.openai.baseUrl'] || 'https://api.openai.com',
        anthropicApiKey: settings['ai.anthropic.apiKey'] || '',
        citationStyle: settings['citation.style'] || 'apa',
        language: settings['app.language'] || 'zh-CN',
        autoBackup: settings['app.autoBackup'] !== 'false',
        maxBackups: settings['app.maxBackups'] || '5',
      });
      setAiProvider(settings['ai.provider'] || 'ollama');
    } catch { /* ignore */ }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const values = form.getFieldsValue();
      await window.electronAPI.setSetting('ai.provider', values.aiProvider);
      await window.electronAPI.setSetting('ai.model', values.aiModel);
      if (values.openaiApiKey) await window.electronAPI.setSetting('ai.openai.apiKey', values.openaiApiKey);
      if (values.openaiBaseUrl) await window.electronAPI.setSetting('ai.openai.baseUrl', values.openaiBaseUrl);
      if (values.anthropicApiKey) await window.electronAPI.setSetting('ai.anthropic.apiKey', values.anthropicApiKey);
      await window.electronAPI.setSetting('citation.style', values.citationStyle);
      await window.electronAPI.setSetting('app.language', values.language);
      await window.electronAPI.setSetting('app.autoBackup', values.autoBackup ? 'true' : 'false');
      await window.electronAPI.setSetting('app.maxBackups', values.maxBackups);
      message.success('设置已保存');
    } catch {
      message.error('保存失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ color: '#e0e0e0', margin: 0 }}>设置</Title>
        <Button type="primary" icon={<SaveOutlined />} onClick={handleSave} loading={saving}>保存设置</Button>
      </div>

      <Form form={form} layout="vertical">
        <Tabs items={[
          {
            key: 'ai',
            label: <span><ApiOutlined /> AI 配置</span>,
            children: (
              <Card style={{ background: '#1f1f1f', border: '1px solid #303030' }}>
                <Form.Item name="aiProvider" label="AI 提供商">
                  <Select onChange={(v) => setAiProvider(v)}>
                    {AI_PROVIDERS.map(p => (
                      <Option key={p.value} value={p.value}>
                        {p.label} <Text type="secondary" style={{ fontSize: 11 }}>- {p.desc}</Text>
                      </Option>
                    ))}
                  </Select>
                </Form.Item>
                <Form.Item name="aiModel" label="模型">
                  <Select>
                    {(AI_MODELS[aiProvider] || []).map(m => (
                      <Option key={m} value={m}>{m}</Option>
                    ))}
                  </Select>
                </Form.Item>

                {aiProvider === 'openai' && (
                  <>
                    <Form.Item name="openaiApiKey" label="OpenAI API Key">
                      <Input.Password placeholder="sk-..." />
                    </Form.Item>
                    <Form.Item name="openaiBaseUrl" label="API Base URL">
                      <Input placeholder="https://api.openai.com" />
                    </Form.Item>
                  </>
                )}

                {aiProvider === 'anthropic' && (
                  <Form.Item name="anthropicApiKey" label="Anthropic API Key">
                    <Input.Password placeholder="sk-ant-..." />
                  </Form.Item>
                )}

                <Divider />
                <Paragraph type="secondary" style={{ fontSize: 12 }}>
                  💡 Ollama 免费且本地运行，推荐配置 GPU 以获得更好性能。安装 Ollama 后运行：<code>ollama pull llama3.2</code>
                </Paragraph>
              </Card>
            ),
          },
          {
            key: 'citation',
            label: <span><GlobalOutlined /> 引文 & 语言</span>,
            children: (
              <Card style={{ background: '#1f1f1f', border: '1px solid #303030' }}>
                <Form.Item name="citationStyle" label="默认引文格式">
                  <Select>
                    {CITATION_STYLES.map(s => (
                      <Option key={s.value} value={s.value}>{s.label}</Option>
                    ))}
                  </Select>
                </Form.Item>
                <Form.Item name="language" label="界面语言">
                  <Select>
                    <Option value="zh-CN">简体中文</Option>
                    <Option value="en-US">English</Option>
                  </Select>
                </Form.Item>
              </Card>
            ),
          },
          {
            key: 'data',
            label: <span><BellOutlined /> 数据 & 备份</span>,
            children: (
              <Card style={{ background: '#1f1f1f', border: '1px solid #303030' }}>
                <Form.Item name="autoBackup" label="自动备份" valuePropName="checked">
                  <Switch />
                </Form.Item>
                <Form.Item name="maxBackups" label="最大备份数">
                  <Input type="number" placeholder="5" />
                </Form.Item>
              </Card>
            ),
          },
        ]} />
      </Form>
    </div>
  );
};

export default SettingsPage;
