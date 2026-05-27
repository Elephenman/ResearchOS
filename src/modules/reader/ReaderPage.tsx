import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { Button, Space, Slider, Typography, Tooltip, Divider, Tabs, Input, List, Tag, Empty, Spin, message } from 'antd';
import {
  ZoomInOutlined, ZoomOutOutlined, FullscreenOutlined, FullscreenExitOutlined,
  RobotOutlined, HighlightOutlined, FormOutlined,
  LeftOutlined, RightOutlined, FileTextOutlined,
  TranslationOutlined, ThunderboltOutlined, ReadOutlined,
  SendOutlined, WarningOutlined,
} from '@ant-design/icons';
import { useParams } from 'react-router-dom';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// Configure PDF.js worker — local file for offline reliability
pdfjs.GlobalWorkerOptions.workerSrc = new URL('/pdf.worker.min.mjs', window.location.origin).href;

const { Text, Paragraph } = Typography;

interface Annotation {
  id: string;
  pageNumber: number;
  content: string;
  type: string;
  color: string;
  createdAt: string;
}

interface Note {
  id: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

const ReaderPage: React.FC = () => {
  const { paperId } = useParams<{ paperId: string }>();
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [zoom, setZoom] = useState(100);
  const [showAIPanel, setShowAIPanel] = useState(false);
  const [pdfPath, setPdfPath] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [aiInput, setAiInput] = useState('');
  const [aiMessages, setAiMessages] = useState<Array<{ role: string; content: string; isError?: boolean }>>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [selectedText, setSelectedText] = useState('');
  const [highlightMode, setHighlightMode] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Load paper info
  useEffect(() => {
    if (paperId) {
      loadPaperInfo();
      loadAnnotations();
      loadNotes();
    }
  }, [paperId]);

  const loadPaperInfo = async () => {
    try {
      const paper = await window.electronAPI.getPaperById(paperId!);
      if (paper && (paper as any).filePath) {
        setPdfPath((paper as any).filePath);
      }
      setLoading(false);
    } catch (err) {
      console.error('Failed to load paper info:', err);
      setLoading(false);
    }
  };

  const loadAnnotations = async () => {
    try {
      const anns = await window.electronAPI.getAnnotations(paperId!);
      setAnnotations(anns as Annotation[]);
    } catch { /* ignore */ }
  };

  const loadNotes = async () => {
    try {
      const n = await window.electronAPI.getNotes(paperId!);
      setNotes(n as Note[]);
    } catch { /* ignore */ }
  };

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setLoading(false);
  };

  const onDocumentLoadError = (error: Error) => {
    console.error('PDF load error:', error);
    setLoading(false);
  };

  // AI chat
  const handleAISend = async () => {
    if (!aiInput.trim()) return;
    const userMsg = { role: 'user', content: aiInput };
    setAiMessages(prev => [...prev, userMsg]);
    setAiInput('');
    setAiLoading(true);

    try {
      const response = await window.electronAPI.chat(
        aiMessages.concat([userMsg]).map(m => ({
          id: Date.now().toString(),
          conversationId: paperId || '1',
          role: m.role as 'user' | 'assistant' | 'system',
          content: m.content,
          timestamp: new Date().toISOString(),
        })),
        { provider: 'ollama', model: 'llama3.2' }
      );
      setAiMessages(prev => [...prev, { role: 'assistant', content: response }]);
    } catch {
      setAiMessages(prev => [...prev, { role: 'assistant', content: 'AI 回复失败，请检查 Ollama 是否运行', isError: true }]);
    } finally {
      setAiLoading(false);
    }
  };

  // Quick AI actions
  const handleQuickAction = async (action: string) => {
    const prompts: Record<string, string> = {
      summarize: '请总结这篇论文的核心内容',
      keyfindings: '请提取这篇论文的关键发现',
      translate: '请翻译论文摘要为中文',
    };
    setAiInput(prompts[action] || '');
  };

  const handleAddNote = async () => {
    const content = `笔记 - 第 ${pageNumber} 页`;
    try {
      await window.electronAPI.addNote({ paperId: paperId!, content });
      loadNotes();
      message.success('笔记已添加');
    } catch {
      message.error('添加笔记失败');
    }
  };

  const goToPage = (page: number) => {
    if (page >= 1 && page <= numPages) setPageNumber(page);
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  };

  useEffect(() => {
    const handler = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  const handleHighlight = () => {
    const selection = window.getSelection();
    const text = selection?.toString().trim();
    if (!text) {
      setHighlightMode(prev => !prev);
      return;
    }
    // Save selection as annotation
    window.electronAPI.addAnnotation({
      paperId: paperId!,
      pageNumber,
      content: text,
      type: 'highlight',
      color: '#ffe066',
    }).then(() => {
      loadAnnotations();
      message.success('高亮已保存');
      selection?.removeAllRanges();
    }).catch(() => message.error('保存高亮失败'));
  };

  return (
    <div style={{ display: 'flex', height: '100%', gap: 0 }}>
      {/* PDF Viewer Area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {/* Toolbar */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '8px 16px', background: '#1f1f1f', borderBottom: '1px solid #303030',
        }}>
          <Space>
            <Tooltip title="缩小"><Button type="text" icon={<ZoomOutOutlined />} onClick={() => setZoom(Math.max(50, zoom - 10))} /></Tooltip>
            <Slider min={50} max={200} value={zoom} onChange={setZoom} style={{ width: 120 }} />
            <Tooltip title="放大"><Button type="text" icon={<ZoomInOutlined />} onClick={() => setZoom(Math.min(200, zoom + 10))} /></Tooltip>
            <Text type="secondary">{zoom}%</Text>
            <Divider type="vertical" />
            <Tooltip title="上一页"><Button type="text" icon={<LeftOutlined />} onClick={() => goToPage(pageNumber - 1)} disabled={pageNumber <= 1} /></Tooltip>
            <Text type="secondary">{pageNumber} / {numPages}</Text>
            <Tooltip title="下一页"><Button type="text" icon={<RightOutlined />} onClick={() => goToPage(pageNumber + 1)} disabled={pageNumber >= numPages} /></Tooltip>
          </Space>
          <Space>
            <Tooltip title={highlightMode ? '取消高亮模式' : '选中文本后高亮'}>
              <Button type={highlightMode ? 'primary' : 'text'} icon={<HighlightOutlined />} onClick={handleHighlight} />
            </Tooltip>
            <Tooltip title="添加笔记"><Button type="text" icon={<FormOutlined />} onClick={handleAddNote} /></Tooltip>
            <Divider type="vertical" />
            <Tooltip title="AI 助手">
              <Button type={showAIPanel ? 'primary' : 'text'} icon={<RobotOutlined />}
                onClick={() => setShowAIPanel(!showAIPanel)} />
            </Tooltip>
            <Tooltip title={isFullscreen ? '退出全屏' : '全屏'}>
              <Button type="text" icon={isFullscreen ? <FullscreenExitOutlined /> : <FullscreenOutlined />} onClick={toggleFullscreen} />
            </Tooltip>
          </Space>
        </div>

        {/* PDF Content */}
        <div style={{ flex: 1, overflow: 'auto', display: 'flex', justifyContent: 'center', alignItems: 'flex-start', padding: 24, background: '#0d0d0d' }}>
          {pdfPath ? (
            <Document
              file={pdfPath}
              onLoadSuccess={onDocumentLoadSuccess}
              onLoadError={onDocumentLoadError}
              loading={<Spin size="large" tip="加载 PDF 中..." />}
            >
              <Page
                pageNumber={pageNumber}
                scale={zoom / 100}
                renderTextLayer={true}
                renderAnnotationLayer={true}
              />
            </Document>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
              <FileTextOutlined style={{ fontSize: 64, color: '#434343', marginBottom: 16 }} />
              <Text type="secondary">
                {paperId ? '该文献未关联 PDF 文件' : '请从文献库选择一篇文献阅读'}
              </Text>
              {paperId && (
                <Button type="primary" style={{ marginTop: 16 }}
                  onClick={() => window.location.hash = '/library'}>
                  返回文献库
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* AI Side Panel */}
      {showAIPanel && (
        <div style={{
          width: 360, background: '#1f1f1f', borderLeft: '1px solid #303030',
          display: 'flex', flexDirection: 'column',
        }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid #303030' }}>
            <Text strong style={{ color: '#e0e0e0' }}>
              <RobotOutlined style={{ marginRight: 8 }} />AI 助手
            </Text>
          </div>

          {/* Quick actions */}
          <div style={{ padding: '8px 12px', borderBottom: '1px solid #303030', display: 'flex', gap: 6 }}>
            <Tag color="blue" style={{ cursor: 'pointer' }} onClick={() => handleQuickAction('summarize')}>
              <ReadOutlined /> 摘要总结
            </Tag>
            <Tag color="purple" style={{ cursor: 'pointer' }} onClick={() => handleQuickAction('keyfindings')}>
              <ThunderboltOutlined /> 关键发现
            </Tag>
            <Tag color="green" style={{ cursor: 'pointer' }} onClick={() => handleQuickAction('translate')}>
              <TranslationOutlined /> 翻译摘要
            </Tag>
          </div>

          <Tabs defaultActiveKey="chat" size="small" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}
            items={[
              {
                key: 'chat', label: '对话', children: (
                  <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                    <div style={{ flex: 1, overflow: 'auto', padding: '8px 12px' }}>
                      {aiMessages.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: 24 }}>
                          <RobotOutlined style={{ fontSize: 32, color: '#434343', marginBottom: 8 }} />
                          <br />
                          <Text type="secondary" style={{ fontSize: 12 }}>向 AI 提问关于这篇论文的问题</Text>
                        </div>
                      ) : (
                        aiMessages.map((msg, i) => (
                          <div key={i} style={{
                            marginBottom: 12, padding: '8px 12px', borderRadius: 8,
                            background: msg.role === 'user' ? '#1677ff' : '#2a2a2a',
                            color: msg.role === 'user' ? '#fff' : '#e0e0e0',
                            marginLeft: msg.role === 'user' ? 40 : 0,
                            marginRight: msg.role === 'user' ? 0 : 40,
                            border: msg.isError ? '1px solid #ff4d4f' : 'none',
                          }}>
                            {msg.isError && <Tag color="error" style={{ marginBottom: 4, fontSize: 11 }}>失败</Tag>}
                            <Paragraph style={{ margin: 0, color: 'inherit', fontSize: 13, whiteSpace: 'pre-wrap' }}>
                              {msg.content}
                            </Paragraph>
                          </div>
                        ))
                      )}
                      {aiLoading && <Spin size="small" style={{ marginLeft: 12 }} />}
                    </div>
                    <div style={{ padding: '8px 12px', borderTop: '1px solid #303030' }}>
                      <Space.Compact style={{ width: '100%' }}>
                        <Input.TextArea
                          value={aiInput}
                          onChange={e => setAiInput(e.target.value)}
                          placeholder="输入问题..."
                          autoSize={{ minRows: 1, maxRows: 3 }}
                          onPressEnter={e => { if (!e.shiftKey) { e.preventDefault(); handleAISend(); } }}
                        />
                        <Button type="primary" icon={<SendOutlined />} onClick={handleAISend} loading={aiLoading} />
                      </Space.Compact>
                    </div>
                  </div>
                ),
              },
              {
                key: 'annotations', label: `批注 (${annotations.length})`, children: (
                  <div style={{ padding: '8px 12px' }}>
                    {annotations.length === 0 ? (
                      <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={<Text type="secondary" style={{ fontSize: 12 }}>暂无批注</Text>} />
                    ) : (
                      <List size="small" dataSource={annotations} renderItem={a => (
                        <List.Item style={{ padding: '6px 0' }}>
                          <Text style={{ fontSize: 12, color: '#d9d9d9' }}>
                            P{a.pageNumber}: {a.content || '(标注)'}
                          </Text>
                        </List.Item>
                      )} />
                    )}
                  </div>
                ),
              },
              {
                key: 'notes', label: `笔记 (${notes.length})`, children: (
                  <div style={{ padding: '8px 12px' }}>
                    {notes.length === 0 ? (
                      <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={<Text type="secondary" style={{ fontSize: 12 }}>暂无笔记</Text>} />
                    ) : (
                      <List size="small" dataSource={notes} renderItem={n => (
                        <List.Item style={{ padding: '6px 0' }}>
                          <Text style={{ fontSize: 12, color: '#d9d9d9' }}>{n.content}</Text>
                        </List.Item>
                      )} />
                    )}
                  </div>
                ),
              },
            ]}
          />
        </div>
      )}
    </div>
  );
};

export default ReaderPage;
