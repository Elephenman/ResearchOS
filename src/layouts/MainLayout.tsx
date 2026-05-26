import React, { useState, useEffect } from 'react';
import { Layout, Menu, Divider, Typography, Tooltip } from 'antd';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  HomeOutlined, SearchOutlined, BookOutlined, RobotOutlined,
  LinkOutlined, ApartmentOutlined, FileTextOutlined, SettingOutlined,
  MinusOutlined, BorderOutlined, CloseOutlined,
} from '@ant-design/icons';
import CollectionTree from '../components/CollectionTree';
import TagCloud from '../components/TagCloud';

const { Sider, Content } = Layout;
const { Text } = Typography;

interface MainLayoutProps { children: React.ReactNode; }

const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);

  const menuItems = [
    { key: '/', icon: <HomeOutlined />, label: '首页' },
    { key: '/search', icon: <SearchOutlined />, label: '文献检索' },
    { key: '/library', icon: <BookOutlined />, label: '文献库' },
    { key: '/ai', icon: <RobotOutlined />, label: 'AI 助手' },
    { key: '/citation', icon: <LinkOutlined />, label: '引文管理' },
    { key: '/graph', icon: <ApartmentOutlined />, label: '文献图谱' },
    { key: '/review', icon: <FileTextOutlined />, label: '综述生成' },
    { key: '/settings', icon: <SettingOutlined />, label: '设置' },
  ];

  // Window control buttons (Electron IPC)
  const handleMinimize = () => window.electronAPI?.invoke?.('window:minimize');
  const handleMaximize = () => window.electronAPI?.invoke?.('window:maximize');
  const handleClose = () => window.electronAPI?.invoke?.('window:close');

  return (
    <Layout style={{ height: '100vh' }}>
      {/* Custom title bar with window controls */}
      <div style={{
        height: 36, background: '#1a1a1a',
        ...({ WebkitAppRegion: 'drag' } as React.CSSProperties),
        display: 'flex', alignItems: 'center',
        borderBottom: '1px solid #303030', userSelect: 'none', flexShrink: 0,
      }}>
        <div style={{
          marginLeft: 12, fontSize: 13, fontWeight: 600,
          color: '#e0e0e0', letterSpacing: 0.5,
        }}>
          ResearchOS
        </div>
        <span style={{ marginLeft: 8, fontSize: 11, color: '#8c8c8c' }}>
          模块化 AI 科研桌面工作台
        </span>

        {/* Window control buttons */}
        <div
          style={{ marginLeft: 'auto', display: 'flex', height: '100%', ...({ WebkitAppRegion: 'no-drag' } as React.CSSProperties) }}
          onPointerDown={e => e.stopPropagation()}
        >
          <button className="win-btn" onClick={handleMinimize} title="最小化">
            <MinusOutlined style={{ fontSize: 10 }} />
          </button>
          <button className="win-btn" onClick={handleMaximize} title="最大化">
            <BorderOutlined style={{ fontSize: 10 }} />
          </button>
          <button className="win-btn win-btn-close" onClick={handleClose} title="关闭">
            <CloseOutlined style={{ fontSize: 10 }} />
          </button>
        </div>
      </div>
      <Layout>
        <Sider
          collapsible
          collapsed={collapsed}
          onCollapse={setCollapsed}
          theme="dark"
          width={240}
          style={{
            background: '#1a1a1a',
            borderRight: '1px solid #303030',
            overflow: 'auto',
          }}
        >
          <Menu
            theme="dark"
            mode="inline"
            selectedKeys={[location.pathname]}
            items={menuItems}
            onClick={({ key }) => navigate(key)}
            style={{ background: 'transparent', borderRight: 'none', marginTop: 8 }}
          />

          {/* Collection Tree and Tag Cloud in sidebar (only when expanded) */}
          {!collapsed && (
            <>
              <Divider style={{ margin: '8px 0', borderColor: '#303030' }} />
              <CollectionTree />
              <Divider style={{ margin: '8px 0', borderColor: '#303030' }} />
              <TagCloud />
            </>
          )}
        </Sider>
        <Layout>
          <Content className="ros-content" style={{ padding: 24, overflow: 'auto', background: '#141414' }}>
            {children}
          </Content>
          {/* Status bar */}
          <div style={{
            height: 24, background: '#1a1a1a', borderTop: '1px solid #303030',
            display: 'flex', alignItems: 'center', padding: '0 12px',
            color: '#8c8c8c', fontSize: 11, gap: 16, flexShrink: 0,
          }}>
            <span>就绪</span><span>v1.0.0</span>
            <span style={{ marginLeft: 'auto' }}>ResearchOS</span>
          </div>
        </Layout>
      </Layout>
    </Layout>
  );
};

export default MainLayout;
