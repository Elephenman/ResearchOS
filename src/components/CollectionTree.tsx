import React, { useState, useEffect } from 'react';
import { Tree, Input, Dropdown, Modal, Typography, Empty, Spin } from 'antd';
import {
  FolderOutlined, FolderOpenOutlined, PlusOutlined,
  EditOutlined, DeleteOutlined, FolderAddOutlined,
} from '@ant-design/icons';
import type { Collection } from '../types/electron';
import { useCollectionStore } from '../stores/useCollectionStore';
import { useLibraryStore } from '../stores/useLibraryStore';

const { Text } = Typography;

const CollectionTree: React.FC = () => {
  const { collections, loading, fetchCollections, createCollection, deleteCollection, selectedCollectionId, setSelectedCollectionId } = useCollectionStore();
  const { setCollectionFilter, fetchPapers } = useLibraryStore();
  const [newFolderName, setNewFolderName] = useState('');
  const [showInput, setShowInput] = useState(false);
  const [parentId, setParentId] = useState<string | undefined>();

  useEffect(() => {
    fetchCollections();
  }, [fetchCollections]);

  const handleSelect = (selectedKeys: React.Key[]) => {
    const key = selectedKeys[0] as string;
    setSelectedCollectionId(key || null);
    setCollectionFilter(key || '');
    fetchPapers();
  };

  const handleAddFolder = (pId?: string) => {
    setParentId(pId);
    setShowInput(true);
    setNewFolderName('');
  };

  const handleConfirmAdd = async () => {
    if (newFolderName.trim()) {
      await createCollection(newFolderName.trim(), parentId);
      setNewFolderName('');
      setShowInput(false);
    }
  };

  const handleDelete = (id: string, name: string) => {
    Modal.confirm({
      title: '删除收藏夹',
      content: `确定删除「${name}」？其中的文献不会被删除。`,
      okText: '删除',
      cancelText: '取消',
      okButtonProps: { danger: true },
      onOk: () => deleteCollection(id),
    });
  };

  // Build tree data from flat collection list
  const buildTreeData = (items: Collection[], parentKey?: string): any[] => {
    return items
      .filter(item => (parentKey ? item.parentId === parentKey : !item.parentId))
      .map(item => ({
        key: item.id,
        title: (
          <Dropdown
            trigger={['contextMenu']}
            menu={{
              items: [
                { key: 'add', icon: <FolderAddOutlined />, label: '新建子收藏夹', onClick: () => handleAddFolder(item.id) },
                { key: 'delete', icon: <DeleteOutlined />, label: '删除', danger: true, onClick: () => handleDelete(item.id, item.name) },
              ],
            }}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <FolderOutlined style={{ color: item.color || '#faad14', fontSize: 13 }} />
              <Text style={{ color: '#d9d9d9', fontSize: 13 }}>{item.name}</Text>
              <Text type="secondary" style={{ fontSize: 11 }}>({item.count || 0})</Text>
            </span>
          </Dropdown>
        ),
        icon: ({ expanded }: { expanded: boolean }) => expanded ? <FolderOpenOutlined style={{ color: item.color || '#faad14' }} /> : <FolderOutlined style={{ color: item.color || '#faad14' }} />,
        children: buildTreeData(items, item.id),
      }));
  };

  const treeData = buildTreeData(collections);

  return (
    <div style={{ padding: '8px 0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 12px 8px' }}>
        <Text type="secondary" style={{ fontSize: 12, fontWeight: 500 }}>收藏夹</Text>
        <PlusOutlined
          style={{ color: '#8c8c8c', cursor: 'pointer', fontSize: 12 }}
          onClick={() => handleAddFolder()}
        />
      </div>

      {loading ? (
        <Spin size="small" style={{ display: 'block', margin: '8px auto' }} />
      ) : collections.length === 0 ? (
        <div style={{ padding: '8px 12px' }}>
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={<Text type="secondary" style={{ fontSize: 11 }}>暂无收藏夹</Text>} />
        </div>
      ) : (
        <Tree
          showIcon
          blockNode
          selectedKeys={selectedCollectionId ? [selectedCollectionId] : []}
          treeData={treeData}
          onSelect={handleSelect}
          style={{ background: 'transparent', fontSize: 13 }}
        />
      )}

      {showInput && (
        <div style={{ padding: '4px 12px' }}>
          <Input
            size="small"
            placeholder="收藏夹名称"
            value={newFolderName}
            onChange={e => setNewFolderName(e.target.value)}
            onPressEnter={handleConfirmAdd}
            onBlur={handleConfirmAdd}
            autoFocus
          />
        </div>
      )}
    </div>
  );
};

export default CollectionTree;
