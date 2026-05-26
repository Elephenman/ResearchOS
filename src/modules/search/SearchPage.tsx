import React, { useState, useCallback } from 'react';
import {
  Card, Input, Button, Space, Checkbox, Typography, Tag, List, Spin, message, Empty, Divider,
} from 'antd';
import {
  SearchOutlined, DownloadOutlined, BookOutlined, PlusOutlined,
  HistoryOutlined, FilePdfOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import type { SearchResult } from '../../types/electron';

const { Title, Text, Paragraph } = Typography;

const SEARCH_SOURCES = [
  { key: 'pubmed', label: 'PubMed', icon: '🧬' },
  { key: 'crossref', label: 'Crossref', icon: '📚' },
  { key: 'semantic-scholar', label: 'Semantic Scholar', icon: '🤖' },
];

const sourceColorMap: Record<string, string> = {
  'PubMed': 'green',
  'Crossref': 'blue',
  'Semantic Scholar': 'purple',
};

const SearchPage: React.FC = () => {
  const navigate = useNavigate();
  const [keyword, setKeyword] = useState('');
  const [selectedSources, setSelectedSources] = useState<string[]>(['pubmed', 'crossref']);
  const [yearFrom, setYearFrom] = useState<number | undefined>();
  const [yearTo, setYearTo] = useState<number | undefined>();
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [addingIds, setAddingIds] = useState<Set<string>>(new Set());
  const [downloadingIds, setDownloadingIds] = useState<Set<string>>(new Set());

  const handleSearch = useCallback(async () => {
    if (!keyword.trim()) { message.warning('请输入关键词'); return; }
    if (selectedSources.length === 0) { message.warning('请至少选择一个数据源'); return; }

    setLoading(true);
    setSearched(true);
    setResults([]);

    try {
      const data = await window.electronAPI.searchPapers({
        keyword: keyword.trim(),
        sources: selectedSources,
        yearFrom,
        yearTo,
        page: 1,
        pageSize: 20,
      });
      setResults(data);
    } catch (err) {
      console.error('Search failed:', err);
      message.error('搜索失败，请检查网络连接');
    } finally {
      setLoading(false);
    }
  }, [keyword, selectedSources, yearFrom, yearTo]);

  const handleAddToLibrary = async (item: SearchResult) => {
    const id = item.id;
    setAddingIds(prev => new Set(prev).add(id));
    try {
      await window.electronAPI.addPaper({
        title: item.title,
        authors: item.authors.map((name, i) => ({ name, order: i })),
        year: item.year,
        journal: item.journal,
        doi: item.doi,
        pmid: item.pmid,
        abstract: item.abstract,
        status: 'unread',
        rating: 0,
      });
      message.success(`已添加「${item.title.slice(0, 30)}...」到文献库`);
    } catch (err) {
      message.error('添加失败，可能已存在');
    } finally {
      setAddingIds(prev => { const s = new Set(prev); s.delete(id); return s; });
    }
  };

  const handleDownloadPDF = async (item: SearchResult) => {
    if (!item.doi) {
      message.warning('该文献无 DOI，无法查找开放获取版本');
      return;
    }
    const id = item.id;
    setDownloadingIds(prev => new Set(prev).add(id));
    try {
      const pdfUrl = await window.electronAPI.downloadPaper(item.doi);
      if (pdfUrl) {
        message.success('找到开放获取版本，正在下载...');
        const fileName = `${item.title.slice(0, 50).replace(/[^a-zA-Z0-9\u4e00-\u9fff]/g, '_')}.pdf`;
        await window.electronAPI.downloadFile(pdfUrl, fileName);
        message.success('PDF 下载完成');
      } else {
        message.info('未找到开放获取版本');
      }
    } catch (err) {
      message.error('下载失败');
    } finally {
      setDownloadingIds(prev => { const s = new Set(prev); s.delete(id); return s; });
    }
  };

  const isAdding = (id: string) => addingIds.has(id);
  const isDownloading = (id: string) => downloadingIds.has(id);

  return (
    <div>
      <Title level={4} style={{ color: '#e0e0e0', marginBottom: 16 }}>文献检索</Title>

      <Card style={{ background: '#1f1f1f', border: '1px solid #303030', marginBottom: 16 }}>
        <Space direction="vertical" style={{ width: '100%' }} size={12}>
          <Input.Search
            placeholder="输入关键词、DOI、标题..."
            value={keyword}
            onChange={e => setKeyword(e.target.value)}
            onSearch={handleSearch}
            enterButton={<Button type="primary" icon={<SearchOutlined />} loading={loading}>搜索</Button>}
            size="large"
            allowClear
          />
          <Space wrap>
            <Text type="secondary">数据源：</Text>
            <Checkbox.Group
              options={SEARCH_SOURCES.map(s => ({ label: `${s.icon} ${s.label}`, value: s.key }))}
              value={selectedSources}
              onChange={v => setSelectedSources(v as string[])}
            />
          </Space>
          <Space>
            <Text type="secondary">年份：</Text>
            <Input type="number" placeholder="起始" style={{ width: 80 }} value={yearFrom} onChange={e => setYearFrom(e.target.value ? Number(e.target.value) : undefined)} />
            <Text type="secondary">—</Text>
            <Input type="number" placeholder="结束" style={{ width: 80 }} value={yearTo} onChange={e => setYearTo(e.target.value ? Number(e.target.value) : undefined)} />
          </Space>
        </Space>
      </Card>

      {loading && (
        <Card style={{ background: '#1f1f1f', border: '1px solid #303030', textAlign: 'center', padding: 48 }}>
          <Spin size="large" />
          <div style={{ marginTop: 16 }}>
            <Text type="secondary">正在从 {selectedSources.length} 个数据源检索...</Text>
          </div>
        </Card>
      )}

      {!loading && searched && results.length === 0 && (
        <Card style={{ background: '#1f1f1f', border: '1px solid #303030', textAlign: 'center', padding: 48 }}>
          <Empty description={<Text type="secondary">未找到结果，请尝试其他关键词或数据源</Text>} />
        </Card>
      )}

      {!loading && results.length > 0 && (
        <>
          <div style={{ marginBottom: 12 }}>
            <Text type="secondary">找到 {results.length} 篇相关文献</Text>
          </div>
          <List
            dataSource={results}
            renderItem={(item) => (
              <Card style={{ background: '#1f1f1f', border: '1px solid #303030', marginBottom: 8, borderRadius: 8 }}>
                <Space direction="vertical" style={{ width: '100%' }} size={6}>
                  <div>
                    <Text strong style={{ color: '#e0e0e0', fontSize: 15 }}>{item.title}</Text>
                  </div>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {item.authors.slice(0, 5).join(', ')}{item.authors.length > 5 ? ' et al.' : ''}
                  </Text>
                  <Space size={6} wrap>
                    {item.journal && <Tag style={{ fontSize: 11 }}>{item.journal}</Tag>}
                    {item.year > 0 && <Tag style={{ fontSize: 11 }}>{item.year}</Tag>}
                    <Tag color={sourceColorMap[item.source] || 'default'} style={{ fontSize: 11 }}>{item.source}</Tag>
                    {item.citedCount !== undefined && item.citedCount > 0 && (
                      <Tag color="orange" style={{ fontSize: 11 }}>引用 {item.citedCount}</Tag>
                    )}
                    {item.doi && <Tag style={{ fontSize: 11, color: '#8c8c8c' }}>DOI: {item.doi}</Tag>}
                  </Space>
                  {item.abstract && (
                    <Paragraph type="secondary" ellipsis={{ rows: 2, expandable: true, symbol: '展开' }} style={{ fontSize: 12, marginBottom: 0 }}>
                      {item.abstract}
                    </Paragraph>
                  )}
                  <Space>
                    <Button
                      size="small"
                      icon={<PlusOutlined />}
                      onClick={() => handleAddToLibrary(item)}
                      loading={isAdding(item.id)}
                    >
                      加入文献库
                    </Button>
                    <Button
                      size="small"
                      icon={<FilePdfOutlined />}
                      onClick={() => handleDownloadPDF(item)}
                      loading={isDownloading(item.id)}
                      disabled={!item.doi}
                    >
                      下载 PDF
                    </Button>
                    <Button
                      size="small"
                      icon={<BookOutlined />}
                      onClick={() => navigate('/library')}
                    >
                      查看文献库
                    </Button>
                  </Space>
                </Space>
              </Card>
            )}
          />
        </>
      )}
    </div>
  );
};

export default SearchPage;
