import React, { useState, useEffect } from 'react';
import { Card, Form, Input, Select, Button, Space, Typography, Divider, Switch, message, Tabs, Alert, Progress, Tag } from 'antd';
import { SaveOutlined, ApiOutlined, GlobalOutlined, TranslationOutlined, BellOutlined, ImportOutlined, RobotOutlined, DatabaseOutlined } from '@ant-design/icons';

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;

const AI_PROVIDERS = [
  { value: 'openai', label: 'OpenAI', desc: 'GPT-4o / GPT-4o-mini' },
  { value: 'deepseek', label: 'DeepSeek', desc: 'DeepSeek-V3 / Chat' },
  { value: 'anthropic', label: 'Anthropic', desc: 'Claude 3 系列' },
  { value: 'moonshot', label: 'Moonshot', desc: 'Kimi' },
  { value: 'zhipu', label: 'Zhipu', desc: 'GLM-4' },
  { value: 'custom', label: '自定义 (OpenAI 兼容)', desc: '任何 OpenAI 兼容 API' },
];

const AI_MODELS: Record<string, string[]> = {
  openai: ['gpt-4o-mini', 'gpt-4o', 'gpt-4-turbo'],
  deepseek: ['deepseek-chat', 'deepseek-reasoner'],
  anthropic: ['claude-3-haiku-20240307', 'claude-3-sonnet-20240229', 'claude-3-opus-20240229'],
  moonshot: ['moonshot-v1-8k', 'moonshot-v1-32k'],
  zhipu: ['glm-4', 'glm-4-flash'],
  custom: [],
};

const EMBEDDING_MODELS = [
  { value: 'text-embedding-3-small', label: 'text-embedding-3-small (OpenAI, 1536维)', dim: 1536 },
  { value: 'text-embedding-3-large', label: 'text-embedding-3-large (OpenAI, 3072维)', dim: 3072 },
  { value: 'text-embedding-ada-002', label: 'text-embedding-ada-002 (OpenAI, 1536维)', dim: 1536 },
  { value: 'embedding-3', label: 'embedding-3 (DeepSeek)', dim: 2048 },
  { value: 'custom', label: '自定义模型', dim: 0 },
];

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
  const [aiProvider, setAiProvider] = useState('openai');
  const [ragStatus, setRagStatus] = useState<Record<string, unknown> | null>(null);
  const [zoteroDir, setZoteroDir] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [embedModel, setEmbedModel] = useState('text-embedding-3-small');
  const [embedProvider, setEmbedProvider] = useState('openai');

  useEffect(() => {
    loadSettings();
    checkRagStatus();
    checkZoteroDir();
  }, []);

  const loadSettings = async () => {
    try {
      const settings = await window.electronAPI.getAllSettings();
      form.setFieldsValue({
        aiProvider: settings['ai.provider'] || 'openai',
        aiModel: settings['ai.model'] || 'gpt-4o-mini',
        openaiApiKey: settings['ai.openai.apiKey'] || '',
        openaiBaseUrl: settings['ai.openai.baseUrl'] || 'https://api.openai.com',
        anthropicApiKey: settings['ai.anthropic.apiKey'] || '',
        citationStyle: settings['citation.style'] || 'apa',
        language: settings['app.language'] || 'zh-CN',
        autoBackup: settings['app.autoBackup'] !== 'false',
        maxBackups: settings['app.maxBackups'] || '5',
        embedProvider: settings['rag.embed.provider'] || 'openai',
        embedApiKey: settings['rag.embed.apiKey'] || '',
        embedBaseUrl: settings['rag.embed.baseUrl'] || 'https://api.openai.com/v1',
        embedModel: settings['rag.embed.model'] || 'text-embedding-3-small',
        embedCustomModel: settings['rag.embed.customModel'] || '',
      });
      setAiProvider(settings['ai.provider'] || 'openai');
      setEmbedProvider(settings['rag.embed.provider'] || 'openai');
      setEmbedModel(settings['rag.embed.model'] || 'text-embedding-3-small');
    } catch { /* ignore */ }
  };

  const checkRagStatus = async () => {
    try {
      const status = await window.electronAPI.ragStatus();
      setRagStatus(status as Record<string, unknown>);
    } catch {
      setRagStatus({ status: 'offline' });
    }
  };

  const checkZoteroDir = async () => {
    try {
      const dir = await window.electronAPI.zoteroFindDataDir();
      setZoteroDir(dir);
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
      // RAG embedding settings
      await window.electronAPI.setSetting('rag.embed.provider', values.embedProvider);
      if (values.embedApiKey) await window.electronAPI.setSetting('rag.embed.apiKey', values.embedApiKey);
      await window.electronAPI.setSetting('rag.embed.baseUrl', values.embedBaseUrl);
      await window.electronAPI.setSetting('rag.embed.model', values.embedModel === 'custom' ? values.embedCustomModel : values.embedModel);
      message.success('设置已保存');
    } catch {
      message.error('保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleZoteroImport = async () => {
    const dir = zoteroDir || await window.electronAPI.zoteroSelectDir();
    if (!dir) return;

    setImporting(true);
    try {
      const result = await window.electronAPI.zoteroImport(dir);
      if (result.errors.length > 0) {
        message.warning(`导入完成：${result.imported} 篇成功，${result.skipped} 篇跳过，${result.errors.length} 个错误`);
      } else {
        message.success(`导入完成：${result.imported} 篇成功，${result.skipped} 篇跳过`);
      }
    } catch (err) {
      message.error('导入失败：' + (err as Error).message);
    } finally {
      setImporting(false);
    }
  };

  const handleSelectZoteroDir = async () => {
    const dir = await window.electronAPI.zoteroSelectDir();
    if (dir) setZoteroDir(dir);
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
                  💡 推荐使用 DeepSeek 或 Moonshot 等国内 API，延迟低且性价比高。嵌入模型请在「RAG 引擎」标签页单独配置。
                </Paragraph>
              </Card>
            ),
          },
          {
            key: 'rag',
            label: <span><RobotOutlined /> RAG 引擎</span>,
            children: (
              <Card style={{ background: '#1f1f1f', border: '1px solid #303030' }}>
                <Space direction="vertical" style={{ width: '100%' }} size="middle">
                  {/* Status */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text strong style={{ color: '#e0e0e0' }}>引擎状态</Text>
                    <Tag color={ragStatus?.status === 'ok' || ragStatus?.status === 'running' ? 'green' : ragStatus?.status === 'not_configured' ? 'orange' : 'red'}>
                      {ragStatus?.status === 'ok' || ragStatus?.status === 'running' ? '运行中' : ragStatus?.status === 'not_configured' ? '未配置' : '离线'}
                    </Tag>
                  </div>

                  {ragStatus?.status === 'ok' || ragStatus?.status === 'running' ? (
                    <Alert
                      type="success"
                      message="RAG 引擎运行中"
                      description={
                        <div>
                          <div>嵌入模型：{String(ragStatus?.embedding_provider || '')} / {String(ragStatus?.embedding_model || '')}</div>
                          <div>已索引：{String(ragStatus?.total_chunks || 0)} 个片段，{String(ragStatus?.total_papers || 0)} 篇文献</div>
                        </div>
                      }
                    />
                  ) : ragStatus?.status === 'not_configured' ? (
                    <Alert
                      type="warning"
                      message="嵌入模型未配置"
                      description="请先在下方配置嵌入模型 API Key，然后重启 Sidecar。"
                    />
                  ) : (
                    <Alert
                      type="warning"
                      message="RAG 引擎未启动"
                      description={
                        <div>
                          <div>语义搜索功能需要 Python Sidecar 运行。</div>
                          <div style={{ marginTop: 8 }}>
                            <Text code>cd sidecar && pip install -r requirements.txt</Text>
                          </div>
                          <div>
                            <Text code>python -m app.main</Text>
                          </div>
                        </div>
                      }
                    />
                  )}

                  <Divider style={{ borderColor: '#303030' }} />

                  {/* Embedding API Config */}
                  <Title level={5} style={{ color: '#e0e0e0' }}>嵌入模型配置</Title>
                  <Paragraph type="secondary" style={{ fontSize: 12 }}>
                    配置 OpenAI 兼容的嵌入 API。支持 OpenAI、DeepSeek、Moonshot、Zhipu、SiliconFlow 等任何 OpenAI 兼容接口。
                  </Paragraph>

                  <Form.Item name="embedProvider" label="API 提供商">
                    <Select onChange={(v) => {
                      setEmbedProvider(v);
                      const urls: Record<string, string> = {
                        openai: 'https://api.openai.com/v1',
                        deepseek: 'https://api.deepseek.com/v1',
                        moonshot: 'https://api.moonshot.cn/v1',
                        zhipu: 'https://open.bigmodel.cn/api/paas/v4',
                        siliconflow: 'https://api.siliconflow.cn/v1',
                        custom: '',
                      };
                      form.setFieldsValue({ embedBaseUrl: urls[v] || '' });
                    }}>
                      <Option value="openai">OpenAI</Option>
                      <Option value="deepseek">DeepSeek</Option>
                      <Option value="moonshot">Moonshot (Kimi)</Option>
                      <Option value="zhipu">Zhipu (GLM)</Option>
                      <Option value="siliconflow">SiliconFlow</Option>
                      <Option value="custom">自定义</Option>
                    </Select>
                  </Form.Item>

                  <Form.Item name="embedApiKey" label="API Key">
                    <Input.Password placeholder="sk-..." />
                  </Form.Item>

                  <Form.Item name="embedBaseUrl" label="API Base URL">
                    <Input placeholder="https://api.openai.com/v1" />
                  </Form.Item>

                  <Form.Item name="embedModel" label="嵌入模型">
                    <Select onChange={(v) => setEmbedModel(v)}>
                      {EMBEDDING_MODELS.map(m => (
                        <Option key={m.value} value={m.value}>{m.label}</Option>
                      ))}
                    </Select>
                  </Form.Item>

                  {embedModel === 'custom' && (
                    <Form.Item name="embedCustomModel" label="自定义模型名称">
                      <Input placeholder="my-embedding-model" />
                    </Form.Item>
                  )}

                  <Button icon={<RobotOutlined />} onClick={checkRagStatus}>
                    刷新状态
                  </Button>
                </Space>
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
            key: 'zotero',
            label: <span><DatabaseOutlined /> Zotero 导入</span>,
            children: (
              <Card style={{ background: '#1f1f1f', border: '1px solid #303030' }}>
                <Space direction="vertical" style={{ width: '100%' }}>
                  <Paragraph type="secondary">
                    从 Zotero 数据库导入文献元数据、集合、标签。不会修改 Zotero 原始数据。
                  </Paragraph>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Text style={{ color: '#e0e0e0' }}>数据目录：</Text>
                    <Text code>{zoteroDir || '未检测到'}</Text>
                    <Button size="small" onClick={handleSelectZoteroDir}>选择目录</Button>
                  </div>

                  <Button
                    type="primary"
                    icon={<ImportOutlined />}
                    onClick={handleZoteroImport}
                    loading={importing}
                    disabled={!zoteroDir}
                  >
                    {importing ? '导入中...' : '从 Zotero 导入'}
                  </Button>

                  {!zoteroDir && (
                    <Alert
                      type="info"
                      message="未检测到 Zotero 数据目录"
                      description="请确认已安装 Zotero 并创建过文献库，或手动选择 Zotero 数据目录。"
                    />
                  )}
                </Space>
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
