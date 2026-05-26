import React, { useState } from 'react';
import { Modal, Form, Input, InputNumber, Select, Typography, Tag, Space, Alert } from 'antd';
import { CheckCircleOutlined } from '@ant-design/icons';
import type { Paper } from '../types/electron';

interface EditPaperModalProps {
  open: boolean;
  paper: Paper | null;
  onClose: () => void;
  onUpdate: (id: string, updates: Record<string, unknown>) => Promise<void>;
}

const statusOptions = [
  { value: 'unread', label: '未读' },
  { value: 'reading', label: '阅读中' },
  { value: 'read', label: '已读' },
  { value: 'cited', label: '已引用' },
];

const EditPaperModal: React.FC<EditPaperModalProps> = ({ open, paper, onClose, onUpdate }) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  React.useEffect(() => {
    if (open && paper) {
      form.setFieldsValue({
        title: paper.title,
        authors: paper.authors?.map(a => a.name).join(', ') || '',
        year: paper.year,
        journal: paper.journal,
        doi: paper.doi,
        pmid: paper.pmid,
        abstract: paper.abstract,
        status: paper.status,
        rating: paper.rating,
        notes: paper.notes,
      });
    }
  }, [open, paper]);

  const handleSubmit = async () => {
    if (!paper) return;
    try {
      const values = await form.validateFields();
      setLoading(true);

      const updates: Record<string, unknown> = {
        title: values.title,
        year: values.year,
        journal: values.journal,
        doi: values.doi,
        pmid: values.pmid,
        abstract: values.abstract,
        status: values.status,
        rating: values.rating,
        notes: values.notes,
      };

      await onUpdate(paper.id, updates);
      form.resetFields();
      onClose();
    } catch (err) {
      console.error('Form validation failed:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    form.resetFields();
    onClose();
  };

  return (
    <Modal
      title="编辑文献"
      open={open}
      onOk={handleSubmit}
      onCancel={handleCancel}
      confirmLoading={loading}
      okText="保存"
      width={640}
      destroyOnClose
    >
      <Form form={form} layout="vertical">
        <Form.Item name="title" label="标题" rules={[{ required: true, message: '请输入标题' }]}>
          <Input placeholder="论文标题" />
        </Form.Item>

        <Form.Item name="authors" label="作者">
          <Input placeholder="逗号分隔" disabled style={{ color: '#b0b0b0' }} />
        </Form.Item>

        <Space style={{ width: '100%' }} size={16}>
          <Form.Item name="year" label="年份" style={{ width: 120 }}>
            <InputNumber min={1900} max={2099} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="status" label="状态" style={{ width: 140 }}>
            <Select options={statusOptions} />
          </Form.Item>
          <Form.Item name="rating" label="评分" style={{ width: 100 }}>
            <InputNumber min={0} max={5} />
          </Form.Item>
        </Space>

        <Space style={{ width: '100%' }} size={16}>
          <Form.Item name="journal" label="期刊" style={{ flex: 1 }}>
            <Input placeholder="期刊名" />
          </Form.Item>
          <Form.Item name="doi" label="DOI" style={{ flex: 1 }}>
            <Input placeholder="10.1234/xxxxx" />
          </Form.Item>
        </Space>

        <Form.Item name="pmid" label="PMID">
          <Input placeholder="PubMed ID" />
        </Form.Item>

        <Form.Item name="abstract" label="摘要">
          <Input.TextArea rows={3} placeholder="论文摘要..." />
        </Form.Item>

        <Form.Item name="notes" label="笔记">
          <Input.TextArea rows={2} placeholder="你的笔记..." />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default EditPaperModal;
