import React, { useState } from 'react';
import { Modal, Form, Input, InputNumber, Select, Space, Button, Typography, Alert } from 'antd';
import { PlusOutlined, CheckCircleOutlined } from '@ant-design/icons';
import type { Paper, Tag } from '../types/electron';

interface AddPaperModalProps {
  open: boolean;
  onClose: () => void;
  onAdd: (paper: Record<string, unknown>) => Promise<Record<string, unknown> | null>;
  onCheckDuplicates: (paper: Record<string, unknown>) => Promise<Paper[]>;
  tags: Tag[];
  onAddTagToPaper: (paperId: string, tagId: string) => Promise<void>;
}

const statusOptions = [
  { value: 'unread', label: '未读' },
  { value: 'reading', label: '阅读中' },
  { value: 'read', label: '已读' },
  { value: 'cited', label: '已引用' },
];

const AddPaperModal: React.FC<AddPaperModalProps> = ({
  open, onClose, onAdd, onCheckDuplicates, tags, onAddTagToPaper,
}) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [duplicates, setDuplicates] = useState<Paper[]>([]);
  const [addedPaperId, setAddedPaperId] = useState<string | null>(null);

  const handleCheckDuplicates = async () => {
    const values = form.getFieldsValue();
    const dupeCheck: Record<string, unknown> = {};
    if (values.doi) dupeCheck.doi = values.doi;
    if (values.title) dupeCheck.title = values.title;
    const dupes = await onCheckDuplicates(dupeCheck);
    setDuplicates(dupes);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);

      const paper: Record<string, unknown> = {
        title: values.title,
        year: values.year,
        journal: values.journal,
        doi: values.doi,
        pmid: values.pmid,
        abstract: values.abstract,
        status: values.status || 'unread',
        rating: 0,
      };

      // Parse authors from comma-separated string
      if (values.authors) {
        paper.authors = values.authors.split(',').map((a: string, i: number) => ({
          name: a.trim(),
          order: i,
        }));
      }

      const result = await onAdd(paper);
      if (result) {
        setAddedPaperId(result.id as string);
        // Add tags if selected
        if (values.tagIds) {
          for (const tagId of values.tagIds) {
            await onAddTagToPaper(result.id as string, tagId);
          }
        }
      }

      setTimeout(() => {
        form.resetFields();
        setDuplicates([]);
        setAddedPaperId(null);
        onClose();
      }, 1200);
    } catch (err) {
      console.error('Form validation failed:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    form.resetFields();
    setDuplicates([]);
    setAddedPaperId(null);
    onClose();
  };

  return (
    <Modal
      title="添加文献"
      open={open}
      onOk={handleSubmit}
      onCancel={handleCancel}
      confirmLoading={loading}
      okText={addedPaperId ? '已添加' : '添加'}
      width={640}
      destroyOnClose
    >
      {addedPaperId && (
        <Alert
          type="success"
          icon={<CheckCircleOutlined />}
          message="文献添加成功"
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}

      {duplicates.length > 0 && (
        <Alert
          type="warning"
          message={`检测到 ${duplicates.length} 篇可能的重复文献`}
          description={duplicates.map(d => d.title).join('；')}
          showIcon
          closable
          onClose={() => setDuplicates([])}
          style={{ marginBottom: 16 }}
        />
      )}

      <Form
        form={form}
        layout="vertical"
        initialValues={{ status: 'unread' }}
      >
        <Form.Item name="title" label="标题" rules={[{ required: true, message: '请输入文献标题' }]}>
          <Input placeholder="论文标题" />
        </Form.Item>

        <Space style={{ width: '100%' }} size={16}>
          <Form.Item name="authors" label="作者" style={{ flex: 1 }}>
            <Input placeholder="逗号分隔，如：张三, 李四" />
          </Form.Item>
          <Form.Item name="year" label="年份" style={{ width: 120 }}>
            <InputNumber placeholder="2024" min={1900} max={2099} style={{ width: '100%' }} />
          </Form.Item>
        </Space>

        <Space style={{ width: '100%' }} size={16}>
          <Form.Item name="journal" label="期刊" style={{ flex: 1 }}>
            <Input placeholder="Nature, Science..." />
          </Form.Item>
          <Form.Item name="status" label="状态" style={{ width: 140 }}>
            <Select options={statusOptions} />
          </Form.Item>
        </Space>

        <Space style={{ width: '100%' }} size={16}>
          <Form.Item name="doi" label="DOI" style={{ flex: 1 }}>
            <Input placeholder="10.1234/xxxxx" />
          </Form.Item>
          <Form.Item name="pmid" label="PMID" style={{ width: 160 }}>
            <Input placeholder="PubMed ID" />
          </Form.Item>
        </Space>

        <Form.Item name="abstract" label="摘要">
          <Input.TextArea rows={3} placeholder="论文摘要..." />
        </Form.Item>

        {tags.length > 0 && (
          <Form.Item name="tagIds" label="标签">
            <Select mode="multiple" placeholder="选择标签" options={tags.map(t => ({ value: t.id, label: t.name }))} />
          </Form.Item>
        )}

        <Space>
          <Button icon={<PlusOutlined />} size="small" onClick={handleCheckDuplicates}>
            检查重复
          </Button>
        </Space>
      </Form>
    </Modal>
  );
};

export default AddPaperModal;
