import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Select, Button, Space, Typography, Table, Tag, Empty, Tabs, message, Tooltip } from 'antd';
import { CopyOutlined, LinkOutlined, CheckCircleOutlined, FileTextOutlined, BookOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { Paper } from '../../types/electron';

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;

const CITATION_STYLES = [
  { key: 'apa', label: 'APA 7th', desc: 'American Psychological Association' },
  { key: 'mla', label: 'MLA 9th', desc: 'Modern Language Association' },
  { key: 'gb-t', label: 'GB/T 7714-2015', desc: '中国国家标准' },
  { key: 'vancouver', label: 'Vancouver', desc: 'ICMJE 推荐' },
  { key: 'chicago', label: 'Chicago 17th', desc: 'Chicago Manual of Style' },
];

interface CitationEntry {
  id: string;
  title: string;
  authors: string;
  year: number;
  journal: string;
  doi: string;
  formatted: string;
}

/**
 * Format a citation in the specified style
 */
function formatCitation(paper: CitationEntry, style: string): string {
  const { authors, year, title, journal, doi } = paper;
  const authorList = authors.split(',').map(a => a.trim());
  const authorStr = authorList.length > 2
    ? `${authorList[0]} et al.`
    : authorList.join(' & ');

  switch (style) {
    case 'apa':
      return `${authorStr} (${year}). ${title}. ${journal}${doi ? `, https://doi.org/${doi}` : '.'}`;

    case 'mla':
      return `${authorList.length > 0 ? authorList[0] : ''}, et al. "${title}." ${journal} (${year})${doi ? `, doi:${doi}` : ''}.`;

    case 'gb-t':
      return `${authorList.join(', ')}. ${title}[J]. ${journal}, ${year}${doi ? `. DOI:${doi}` : '.'}`;

    case 'vancouver':
      return `${authorList.join(', ')}. ${title}. ${journal}. ${year}${doi ? `. doi: ${doi}` : ''}.`;

    case 'chicago':
      return `${authorList.join(', ')}. "${title}." ${journal} (${year})${doi ? `. https://doi.org/${doi}` : ''}.`;

    default:
      return `${authorStr} (${year}). ${title}. ${journal}.`;
  }
}

const CitationPage: React.FC = () => {
  const [selectedStyle, setSelectedStyle] = useState<string>('apa');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [entries, setEntries] = useState<CitationEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    loadPapers();
  }, [selectedStyle]);

  const loadPapers = async () => {
    setLoading(true);
    try {
      const result = await window.electronAPI.getPapers({ page: 1, pageSize: 100, status: 'cited' });
      const cited = result.data as any[];
      const formatted = cited.map((p: any) => {
        const entry: CitationEntry = {
          id: p.id,
          title: p.title || '',
          authors: p.authors?.map((a: any) => a.name).join(', ') || '',
          year: p.year || 0,
          journal: p.journal || '',
          doi: p.doi || '',
          formatted: '',
        };
        entry.formatted = formatCitation(entry, selectedStyle);
        return entry;
      });
      setEntries(formatted);
    } catch (err) {
      console.error('Failed to load papers:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(id);
      message.success('已复制到剪贴板');
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  const handleCopyAll = () => {
    const allCitations = entries.map(e => e.formatted).join('\n\n');
    navigator.clipboard.writeText(allCitations).then(() => {
      message.success(`已复制 ${entries.length} 条引文`);
    });
  };

  const columns: ColumnsType<CitationEntry> = [
    { title: '标题', dataIndex: 'title', key: 'title', ellipsis: true, width: 250 },
    { title: '作者', dataIndex: 'authors', key: 'authors', width: 140, ellipsis: true },
    { title: '年份', dataIndex: 'year', key: 'year', width: 70 },
    {
      title: '引用格式',
      dataIndex: 'formatted',
      key: 'formatted',
      render: (text: string, record: CitationEntry) => (
        <Space>
          <Text style={{ color: '#e0e0e0', fontSize: 12 }}>{text}</Text>
          <Tooltip title="复制">
            <Button type="text" size="small"
              icon={copiedId === record.id ? <CheckCircleOutlined style={{ color: '#52c41a' }} /> : <CopyOutlined />}
              onClick={() => handleCopy(text, record.id)} />
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ color: '#e0e0e0', margin: 0 }}>引文管理</Title>
        <Space>
          <Text type="secondary">引用格式：</Text>
          <Select value={selectedStyle} onChange={setSelectedStyle} style={{ width: 200 }}>
            {CITATION_STYLES.map(s => (
              <Option key={s.key} value={s.key}>{s.label}</Option>
            ))}
          </Select>
          <Button icon={<CopyOutlined />} onClick={handleCopyAll} disabled={entries.length === 0}>
            复制全部
          </Button>
        </Space>
      </div>

      <Card style={{ background: '#1f1f1f', border: '1px solid #303030', marginBottom: 16 }}>
        <Tabs items={CITATION_STYLES.map(s => ({
          key: s.key,
          label: s.label,
          children: (
            <div>
              <Text type="secondary">{s.desc}</Text>
              <Paragraph style={{ marginTop: 8, color: '#8c8c8c', fontSize: 12 }}>
                在文献库中将论文标记为「已引用」后，引文将按此格式自动生成。
              </Paragraph>
            </div>
          ),
        }))} />
      </Card>

      <Card style={{ background: '#1f1f1f', border: '1px solid #303030' }}>
        {entries.length === 0 ? (
          <Empty description={
            <Space direction="vertical">
              <Text type="secondary">从文献库添加论文并标记为「已引用」后，引文将自动生成</Text>
              <Button type="primary" icon={<BookOutlined />} onClick={() => navigate('/library')}>
                前往文献库
              </Button>
            </Space>
          } />
        ) : (
          <Table dataSource={entries} columns={columns} rowKey="id" size="small" loading={loading} />
        )}
      </Card>
    </div>
  );
};

export default CitationPage;
