import React, { useState, useEffect, useCallback } from 'react';
import {
  Table, Input, Button, Space, Tag, Select, Card, Typography, Modal, message,
  Dropdown, Tooltip, Badge, Divider,
} from 'antd';
import {
  PlusOutlined, ImportOutlined, ExportOutlined, DeleteOutlined,
  SearchOutlined, StarOutlined, StarFilled,
  EyeOutlined, ReadOutlined, MoreOutlined, EditOutlined,
  FilePdfOutlined, InboxOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { Paper } from '../../types/electron';
import { useLibraryStore } from '../../stores/useLibraryStore';
import { useTagStore } from '../../stores/useTagStore';
import AddPaperModal from '../../components/AddPaperModal';
import EditPaperModal from '../../components/EditPaperModal';

const { Title, Text } = Typography;
const { Option } = Select;

const statusMap: Record<string, { color: string; label: string }> = {
  unread: { color: 'default', label: '未读' },
  reading: { color: 'processing', label: '阅读中' },
  read: { color: 'success', label: '已读' },
  cited: { color: 'warning', label: '已引用' },
};

const LibraryPage: React.FC = () => {
  const {
    papers, total, loading, keyword, statusFilter,
    page, pageSize, selectedIds,
    fetchPapers, setKeyword, setStatusFilter,
    setPage, setPageSize, setSelectedIds,
    addPaper, updatePaper, deletePaper, importPapers, checkDuplicates,
  } = useLibraryStore();
  const { tags, fetchTags, addTagToPaper } = useTagStore();

  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingPaper, setEditingPaper] = useState<Paper | null>(null);

  useEffect(() => {
    fetchPapers();
    fetchTags();
  }, [keyword, statusFilter, page, pageSize]);

  // Auto-search with debounce
  const [searchTimer, setSearchTimer] = useState<ReturnType<typeof setTimeout> | null>(null);
  const handleSearchChange = (value: string) => {
    if (searchTimer) clearTimeout(searchTimer);
    const timer = setTimeout(() => {
      setKeyword(value);
    }, 300);
    setSearchTimer(timer);
  };

  const handleImport = async () => {
    try {
      // In Electron, use dialog.showOpenDialog via IPC
      const result = await window.electronAPI.importPapers([]);
      if (result > 0) {
        message.success(`成功导入 ${result} 篇文献`);
      } else {
        message.info('未选择文件');
      }
    } catch {
      message.error('导入失败');
    }
  };

  const handleExport = async () => {
    if (selectedIds.length === 0) {
      message.warning('请先选择要导出的文献');
      return;
    }
    try {
      const result = await window.electronAPI.exportPapers(selectedIds, 'bib');
      if (result) {
        message.success(`成功导出 ${selectedIds.length} 篇文献`);
      }
    } catch {
      message.error('导出失败');
    }
  };

  const handleAction = (action: string, paper: Paper) => {
    switch (action) {
      case 'read':
        // Navigate to reader
        window.location.hash = `/reader/${paper.id}`;
        break;
      case 'edit':
        setEditingPaper(paper);
        setEditModalOpen(true);
        break;
      case 'cite':
        window.electronAPI.formatCitation(paper.id, 'apa').then(citation => {
          navigator.clipboard.writeText(citation);
          message.success('引文已复制到剪贴板');
        });
        break;
      case 'delete':
        Modal.confirm({
          title: '确认删除',
          content: `确定删除「${paper.title}」？此操作不可撤销。`,
          okText: '删除',
          cancelText: '取消',
          okButtonProps: { danger: true },
          onOk: () => {
            deletePaper(paper.id);
            message.success('已删除');
          },
        });
        break;
      default:
        break;
    }
  };

  const handleRating = (paper: Paper, rating: number) => {
    updatePaper(paper.id, { rating });
  };

  const handleStatusChange = (paper: Paper, status: string) => {
    updatePaper(paper.id, { status });
  };

  const columns: ColumnsType<Paper> = [
    {
      title: '标题',
      dataIndex: 'title',
      key: 'title',
      ellipsis: true,
      render: (text: string, record: Paper) => (
        <Button type="link" style={{ padding: 0, textAlign: 'left', color: '#d9d9d9' }}
          onClick={() => { window.location.hash = `/reader/${record.id}`; }}>
          {text}
        </Button>
      ),
    },
    {
      title: '作者',
      dataIndex: 'authors',
      key: 'authors',
      width: 180,
      ellipsis: true,
      render: (authors: Paper['authors']) => authors?.map(a => a.name).join(', ') || '-',
    },
    {
      title: '年份',
      dataIndex: 'year',
      key: 'year',
      width: 80,
      sorter: true,
    },
    {
      title: '期刊',
      dataIndex: 'journal',
      key: 'journal',
      width: 160,
      ellipsis: true,
      render: (text: string) => text || '-',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 110,
      render: (status: string, record: Paper) => {
        const s = statusMap[status] || statusMap.unread;
        return (
          <Select
            size="small"
            value={status}
            onChange={(val) => handleStatusChange(record, val)}
            style={{ width: 90 }}
            options={Object.entries(statusMap).map(([k, v]) => ({ value: k, label: v.label }))}
            variant="borderless"
          />
        );
      },
    },
    {
      title: '评分',
      dataIndex: 'rating',
      key: 'rating',
      width: 120,
      render: (rating: number, record: Paper) => (
        <Space size={2}>
          {Array.from({ length: 5 }, (_, i) => (
            i < (rating || 0)
              ? <StarFilled key={i} style={{ color: '#faad14', fontSize: 12, cursor: 'pointer' }} onClick={() => handleRating(record, i + 1)} />
              : <StarOutlined key={i} style={{ color: '#434343', fontSize: 12, cursor: 'pointer' }} onClick={() => handleRating(record, i + 1)} />
          ))}
        </Space>
      ),
    },
    {
      title: '标签',
      dataIndex: 'tags',
      key: 'tags',
      width: 150,
      render: (tags: Paper['tags']) => tags?.length > 0
        ? tags.slice(0, 2).map(t => <Tag key={t.id} color="blue" style={{ fontSize: 11 }}>{t.name}</Tag>)
        : <Text type="secondary" style={{ fontSize: 11 }}>-</Text>,
    },
    {
      title: '操作',
      key: 'actions',
      width: 80,
      render: (_: unknown, record: Paper) => (
        <Dropdown menu={{
          items: [
            { key: 'read', icon: <ReadOutlined />, label: '阅读' },
            { key: 'edit', icon: <EditOutlined />, label: '编辑' },
            { key: 'cite', icon: <EyeOutlined />, label: '复制引文' },
            { type: 'divider' as const },
            { key: 'delete', icon: <DeleteOutlined />, label: '删除', danger: true },
          ],
          onClick: ({ key }) => handleAction(key, record),
        }}>
          <Button type="text" icon={<MoreOutlined />} size="small" />
        </Dropdown>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ color: '#e0e0e0', margin: 0 }}>文献库</Title>
        <Space>
          <Button icon={<ImportOutlined />} onClick={handleImport}>导入</Button>
          <Button icon={<ExportOutlined />} onClick={handleExport} disabled={selectedIds.length === 0}>
            导出{selectedIds.length > 0 ? ` (${selectedIds.length})` : ''}
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setAddModalOpen(true)}>添加文献</Button>
        </Space>
      </div>

      <Card style={{ background: '#1f1f1f', border: '1px solid #303030', marginBottom: 16 }}>
        <Space wrap>
          <Input
            placeholder="搜索标题、作者、DOI..."
            prefix={<SearchOutlined />}
            defaultValue={keyword}
            onChange={e => handleSearchChange(e.target.value)}
            style={{ width: 320 }}
            allowClear
          />
          <Select placeholder="状态筛选" style={{ width: 120 }} allowClear
            value={statusFilter || undefined} onChange={v => setStatusFilter(v || '')}>
            {Object.entries(statusMap).map(([k, v]) => (
              <Option key={k} value={k}>{v.label}</Option>
            ))}
          </Select>
          {total > 0 && <Text type="secondary">共 {total} 篇</Text>}
        </Space>
      </Card>

      <Card style={{ background: '#1f1f1f', border: '1px solid #303030' }}>
        <Table
          dataSource={papers}
          columns={columns}
          loading={loading}
          rowKey="id"
          size="small"
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: true,
            showTotal: t => `共 ${t} 篇`,
            onChange: (p, ps) => { setPage(p); setPageSize(ps); },
          }}
          rowSelection={{
            selectedRowKeys: selectedIds,
            onChange: keys => setSelectedIds(keys as string[]),
          }}
          locale={{
            emptyText: (
              <div style={{ padding: 40, textAlign: 'center' }}>
                <InboxOutlined style={{ fontSize: 48, color: '#434343', marginBottom: 12 }} />
                <br />
                <Text type="secondary">文献库为空，点击「添加文献」或「导入」开始</Text>
              </div>
            ),
          }}
        />
      </Card>

      <AddPaperModal
        open={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        onAdd={addPaper}
        onCheckDuplicates={checkDuplicates}
        tags={tags}
        onAddTagToPaper={addTagToPaper}
      />

      <EditPaperModal
        open={editModalOpen}
        paper={editingPaper}
        onClose={() => { setEditModalOpen(false); setEditingPaper(null); }}
        onUpdate={updatePaper}
      />
    </div>
  );
};

export default LibraryPage;
