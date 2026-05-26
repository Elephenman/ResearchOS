import React, { useState, useEffect } from 'react';
import { Tag, Input, Typography, Empty, Spin, Modal } from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { useTagStore } from '../stores/useTagStore';

const { Text } = Typography;

const TAG_COLORS = [
  '#1677ff', '#52c41a', '#722ed1', '#fa8c16', '#eb2f96',
  '#13c2c2', '#f5222d', '#2f54eb', '#a0d911', '#faad14',
];

const TagCloud: React.FC = () => {
  const { tags, loading, fetchTags, createTag, deleteTag } = useTagStore();
  const [showInput, setShowInput] = useState(false);
  const [newTagName, setNewTagName] = useState('');

  useEffect(() => {
    fetchTags();
  }, []);

  const handleAdd = () => {
    if (newTagName.trim()) {
      const color = TAG_COLORS[tags.length % TAG_COLORS.length];
      createTag(newTagName.trim(), color);
      setNewTagName('');
      setShowInput(false);
    }
  };

  const handleDelete = (id: string, name: string) => {
    Modal.confirm({
      title: '删除标签',
      content: `确定删除标签「${name}」？`,
      okText: '删除',
      cancelText: '取消',
      okButtonProps: { danger: true },
      onOk: () => deleteTag(id),
    });
  };

  return (
    <div style={{ padding: '8px 0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 12px 8px' }}>
        <Text type="secondary" style={{ fontSize: 12, fontWeight: 500 }}>标签</Text>
        <PlusOutlined
          style={{ color: '#8c8c8c', cursor: 'pointer', fontSize: 12 }}
          onClick={() => setShowInput(true)}
        />
      </div>

      {loading ? (
        <Spin size="small" style={{ display: 'block', margin: '8px auto' }} />
      ) : tags.length === 0 ? (
        <div style={{ padding: '4px 12px' }}>
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={<Text type="secondary" style={{ fontSize: 11 }}>暂无标签</Text>} />
        </div>
      ) : (
        <div style={{ padding: '0 12px', display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {tags.map(tag => (
            <Tag
              key={tag.id}
              color={tag.color || undefined}
              closable
              onClose={() => handleDelete(tag.id, tag.name)}
              style={{ margin: 0, cursor: 'pointer', fontSize: 11 }}
            >
              {tag.name}
            </Tag>
          ))}
        </div>
      )}

      {showInput && (
        <div style={{ padding: '4px 12px' }}>
          <Input
            size="small"
            placeholder="标签名称"
            value={newTagName}
            onChange={e => setNewTagName(e.target.value)}
            onPressEnter={handleAdd}
            onBlur={() => { if (newTagName.trim()) handleAdd(); else setShowInput(false); }}
            autoFocus
          />
        </div>
      )}
    </div>
  );
};

export default TagCloud;
