import React, { useState, useEffect } from 'react';
import { Card, Steps, Button, Space, Typography, Input, List, Tag, Empty, Spin, Result, Checkbox, message } from 'antd';
import { FileSearchOutlined, FileTextOutlined, EditOutlined, ExportOutlined, PlusOutlined, DeleteOutlined, DownloadOutlined } from '@ant-design/icons';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

const STEPS = [
  { title: '选择文献', icon: <FileSearchOutlined /> },
  { title: '生成大纲', icon: <FileTextOutlined /> },
  { title: '撰写综述', icon: <EditOutlined /> },
  { title: '导出文档', icon: <ExportOutlined /> },
];

interface OutlineSection {
  id: string;
  title: string;
  description: string;
}

interface PaperOption {
  id: string;
  title: string;
  authors: string;
  year: number;
}

const ReviewPage: React.FC = () => {
  const [current, setCurrent] = useState(0);
  const [selectedPaperIds, setSelectedPaperIds] = useState<string[]>([]);
  const [papers, setPapers] = useState<PaperOption[]>([]);
  const [topic, setTopic] = useState('');
  const [outline, setOutline] = useState<OutlineSection[]>([]);
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState('');
  const [newSectionTitle, setNewSectionTitle] = useState('');

  useEffect(() => {
    loadPapers();
  }, []);

  const loadPapers = async () => {
    try {
      const result = await window.electronAPI.getPapers({ page: 1, pageSize: 50 });
      const paperOptions = result.data.map((p: any) => ({
        id: p.id,
        title: p.title,
        authors: p.authors?.map((a: any) => a.name).join(', ') || '',
        year: p.year || 0,
      }));
      setPapers(paperOptions);
    } catch { /* ignore */ }
  };

  const handleGenerateOutline = async () => {
    if (!topic.trim()) { message.warning('请输入综述主题'); return; }
    if (selectedPaperIds.length === 0) { message.warning('请至少选择一篇文献'); return; }

    setLoading(true);
    try {
      // Generate outline using AI
      const paperTitles = papers
        .filter(p => selectedPaperIds.includes(p.id))
        .map(p => p.title)
        .join('\n- ');

      const prompt = `我正在撰写一篇关于「${topic}」的文献综述，请根据以下文献生成一个综述大纲，包含4-6个章节，每个章节有标题和简要描述。格式：每个章节一行，标题和描述用|分隔。\n\n文献列表：\n- ${paperTitles}`;

      const response = await window.electronAPI.chat(
        [{ id: '1', conversationId: '1', role: 'user' as const, content: prompt, timestamp: new Date().toISOString() }],
        { provider: 'ollama', model: 'llama3.2' }
      );

      // Parse outline from AI response
      const sections: OutlineSection[] = response.split('\n')
        .filter((line: string) => line.trim())
        .map((line: string, i: number) => {
          const parts = line.replace(/^\d+[\.\)、]\s*/, '').split('|');
          return {
            id: `section-${i}`,
            title: (parts[0] || '').trim(),
            description: (parts[1] || '').trim(),
          };
        })
        .filter((s: OutlineSection) => s.title);

      if (sections.length === 0) {
        // Fallback outline
        setOutline([
          { id: '1', title: '引言', description: '研究背景与意义' },
          { id: '2', title: '研究方法', description: '主要方法与技术路线' },
          { id: '3', title: '结果与讨论', description: '核心发现与比较分析' },
          { id: '4', title: '结论与展望', description: '总结与未来方向' },
        ]);
      } else {
        setOutline(sections);
      }
      setCurrent(1);
    } catch {
      // Fallback
      setOutline([
        { id: '1', title: '引言', description: '研究背景与意义' },
        { id: '2', title: '研究方法', description: '主要方法与技术路线' },
        { id: '3', title: '结果与讨论', description: '核心发现与比较分析' },
        { id: '4', title: '结论与展望', description: '总结与未来方向' },
      ]);
      setCurrent(1);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateDraft = async () => {
    setLoading(true);
    try {
      const sectionTitles = outline.map((s, i) => `${i + 1}. ${s.title}: ${s.description}`).join('\n');
      const prompt = `请根据以下综述大纲，撰写一篇关于「${topic}」的文献综述正文。每个章节写2-3段。\n\n大纲：\n${sectionTitles}`;

      const response = await window.electronAPI.chat(
        [{ id: '1', conversationId: '1', role: 'user' as const, content: prompt, timestamp: new Date().toISOString() }],
        { provider: 'ollama', model: 'llama3.2' }
      );
      setDraft(response);
      setCurrent(2);
    } catch {
      setDraft('综述内容生成失败，请检查 AI 服务是否可用。你可以手动编辑此内容。');
      setCurrent(2);
    } finally {
      setLoading(false);
    }
  };

  const addSection = () => {
    if (!newSectionTitle.trim()) return;
    setOutline(prev => [...prev, {
      id: `section-${prev.length + 1}`,
      title: newSectionTitle.trim(),
      description: '',
    }]);
    setNewSectionTitle('');
  };

  const removeSection = (id: string) => {
    setOutline(prev => prev.filter(s => s.id !== id));
  };

  const handleExport = (format: string) => {
    const content = `# ${topic}\n\n${draft}`;
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${topic.replace(/\s+/g, '_')}.${format === 'md' ? 'md' : 'txt'}`;
    a.click();
    URL.revokeObjectURL(url);
    message.success('导出成功');
  };

  const togglePaper = (id: string) => {
    setSelectedPaperIds(prev =>
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    );
  };

  const renderStepContent = () => {
    switch (current) {
      case 0:
        return (
          <Card style={{ background: '#1f1f1f', border: '1px solid #303030' }}>
            <Space direction="vertical" style={{ width: '100%' }} size={16}>
              <div>
                <Text type="secondary">综述主题：</Text>
                <Input placeholder="例如：深度学习在蛋白质结构预测中的应用" value={topic}
                  onChange={e => setTopic(e.target.value)} style={{ marginTop: 8 }} />
              </div>
              <div>
                <Text type="secondary">选择文献（{selectedPaperIds.length} 篇已选）：</Text>
                <div style={{ marginTop: 8, maxHeight: 300, overflow: 'auto' }}>
                  {papers.length === 0 ? (
                    <Empty description={<Text type="secondary">文献库为空</Text>} image={Empty.PRESENTED_IMAGE_SIMPLE} />
                  ) : (
                    <List size="small" dataSource={papers}
                      renderItem={(p) => (
                        <List.Item style={{ padding: '4px 8px', cursor: 'pointer', background: selectedPaperIds.includes(p.id) ? '#1677ff10' : 'transparent' }}
                          onClick={() => togglePaper(p.id)}>
                          <Space>
                            <Checkbox checked={selectedPaperIds.includes(p.id)} />
                            <Text style={{ color: '#d9d9d9', fontSize: 13 }}>{p.title}</Text>
                            {p.year > 0 && <Tag style={{ fontSize: 11 }}>{p.year}</Tag>}
                          </Space>
                        </List.Item>
                      )}
                    />
                  )}
                </div>
              </div>
              <Button type="primary" onClick={handleGenerateOutline} loading={loading}
                disabled={!topic.trim() || selectedPaperIds.length === 0}>
                生成大纲
              </Button>
            </Space>
          </Card>
        );
      case 1:
        return (
          <Card style={{ background: '#1f1f1f', border: '1px solid #303030' }}>
            <Space direction="vertical" style={{ width: '100%' }} size={12}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text strong style={{ color: '#e0e0e0' }}>综述大纲</Text>
                <Space>
                  <Input placeholder="新章节标题" value={newSectionTitle}
                    onChange={e => setNewSectionTitle(e.target.value)} style={{ width: 200 }}
                    onPressEnter={addSection} size="small" />
                  <Button type="dashed" icon={<PlusOutlined />} size="small" onClick={addSection}>添加</Button>
                </Space>
              </div>
              <List
                dataSource={outline}
                renderItem={(item, idx) => (
                  <List.Item
                    actions={[
                      <Button type="text" icon={<DeleteOutlined />} size="small" danger onClick={() => removeSection(item.id)} />,
                    ]}
                    style={{ border: '1px solid #303030', borderRadius: 6, padding: '8px 16px', marginBottom: 4 }}
                  >
                    <Space>
                      <Tag color="blue">{idx + 1}</Tag>
                      <div>
                        <Text strong style={{ color: '#e0e0e0' }}>{item.title}</Text>
                        <br />
                        <Text type="secondary" style={{ fontSize: 12 }}>{item.description}</Text>
                      </div>
                    </Space>
                  </List.Item>
                )}
              />
              <Button type="primary" onClick={handleGenerateDraft} loading={loading}>
                开始撰写
              </Button>
            </Space>
          </Card>
        );
      case 2:
        return (
          <Card style={{ background: '#1f1f1f', border: '1px solid #303030' }}>
            <Space direction="vertical" style={{ width: '100%' }} size={12}>
              <Text strong style={{ color: '#e0e0e0' }}>综述正文</Text>
              <TextArea value={draft} onChange={e => setDraft(e.target.value)}
                autoSize={{ minRows: 16, maxRows: 30 }}
                style={{ background: '#2a2a2a', borderColor: '#434343', color: '#e0e0e0' }} />
              <Button type="primary" onClick={() => setCurrent(3)}>
                完成撰写
              </Button>
            </Space>
          </Card>
        );
      case 3:
        return (
          <Card style={{ background: '#1f1f1f', border: '1px solid #303030', textAlign: 'center', padding: 48 }}>
            <Result
              status="success"
              title="综述生成完成"
              subTitle="你可以导出为 Markdown / 纯文本格式"
              extra={[
                <Button type="primary" key="md" icon={<DownloadOutlined />} onClick={() => handleExport('md')}>导出 Markdown</Button>,
                <Button key="txt" icon={<DownloadOutlined />} onClick={() => handleExport('txt')}>导出纯文本</Button>,
              ]}
            />
          </Card>
        );
      default:
        return null;
    }
  };

  return (
    <div>
      <Title level={4} style={{ color: '#e0e0e0', marginBottom: 16 }}>综述生成</Title>
      <Steps current={current} items={STEPS} style={{ marginBottom: 24 }} />
      {renderStepContent()}
    </div>
  );
};

export default ReviewPage;
