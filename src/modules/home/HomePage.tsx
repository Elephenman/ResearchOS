import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Statistic, Typography, Space, Button, List } from 'antd';
import {
  SearchOutlined, BookOutlined, RobotOutlined, FileTextOutlined,
  PlusOutlined, ArrowUpOutlined, ClockCircleOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';

const { Title, Text } = Typography;

const quickActions = [
  { title: '检索文献', desc: '从 PubMed / Crossref 搜索论文', icon: <SearchOutlined style={{ fontSize: 28, color: '#1677ff' }} />, path: '/search' },
  { title: '导入 PDF', desc: '本地 PDF 批量导入文献库', icon: <BookOutlined style={{ fontSize: 28, color: '#52c41a' }} />, path: '/library' },
  { title: 'AI 对话', desc: '与 AI 讨论论文内容', icon: <RobotOutlined style={{ fontSize: 28, color: '#722ed1' }} />, path: '/ai' },
  { title: '综述生成', desc: 'AI 辅助撰写文献综述', icon: <FileTextOutlined style={{ fontSize: 28, color: '#fa8c16' }} />, path: '/review' },
];

interface HomeStats {
  totalPapers: number;
  readingThisWeek: number;
  aiConversations: number;
  citationsGenerated: number;
  recentPapers: { id: string; title: string; dateAdded: string }[];
}

const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState<HomeStats>({
    totalPapers: 0, readingThisWeek: 0, aiConversations: 0, citationsGenerated: 0,
    recentPapers: [],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      // Fetch real stats from Electron API
      const papersResult = await window.electronAPI.getPapers({ page: 1, pageSize: 1 });
      const totalPapers = papersResult.total;

      // Get recently added papers
      const recentResult = await window.electronAPI.getPapers({ page: 1, pageSize: 5 });
      const recentPapers = recentResult.data.map((p: any) => ({
        id: p.id,
        title: p.title,
        dateAdded: p.dateAdded || p.date_added || '',
      }));

      // Count reading this week (status = 'reading')
      const readingResult = await window.electronAPI.getPapers({ page: 1, pageSize: 1, status: 'reading' });
      const readingThisWeek = readingResult.total;

      // Get AI conversations count from settings
      const aiConvCount = await window.electronAPI.getSetting('stats.aiConversations');

      setStats({
        totalPapers,
        readingThisWeek,
        aiConversations: aiConvCount ? parseInt(aiConvCount, 10) : 0,
        citationsGenerated: 0,
        recentPapers,
      });
    } catch (err) {
      console.error('Failed to load stats:', err);
      // Fallback to zeros - Electron API not available (browser-only mode)
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <Title level={4} style={{ color: '#e0e0e0', marginBottom: 4 }}>欢迎回来</Title>
        <Text type="secondary">ResearchOS — 你的模块化 AI 科研桌面工作台</Text>
      </div>

      {/* Quick Actions */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        {quickActions.map((action) => (
          <Col xs={12} sm={12} md={6} key={action.path}>
            <Card
              hoverable
              style={{ background: '#1f1f1f', border: '1px solid #303030', cursor: 'pointer' }}
              onClick={() => navigate(action.path)}
            >
              <Space direction="vertical" size={4} style={{ width: '100%' }}>
                {action.icon}
                <Text strong style={{ color: '#e0e0e0' }}>{action.title}</Text>
                <Text type="secondary" style={{ fontSize: 12 }}>{action.desc}</Text>
              </Space>
            </Card>
          </Col>
        ))}
      </Row>

      {/* Stats */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} md={6}>
          <Card style={{ background: '#1f1f1f', border: '1px solid #303030' }}>
            <Statistic title={<Text type="secondary">文献总数</Text>} value={stats.totalPapers} suffix="篇"
              valueStyle={{ color: '#1677ff' }} loading={loading} />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card style={{ background: '#1f1f1f', border: '1px solid #303030' }}>
            <Statistic title={<Text type="secondary">阅读中</Text>} value={stats.readingThisWeek} suffix="篇"
              valueStyle={{ color: '#52c41a' }} prefix={<ArrowUpOutlined />} loading={loading} />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card style={{ background: '#1f1f1f', border: '1px solid #303030' }}>
            <Statistic title={<Text type="secondary">AI 对话</Text>} value={stats.aiConversations} suffix="次"
              valueStyle={{ color: '#722ed1' }} loading={loading} />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card style={{ background: '#1f1f1f', border: '1px solid #303030' }}>
            <Statistic title={<Text type="secondary">引文引用</Text>} value={stats.citationsGenerated} suffix="条"
              valueStyle={{ color: '#fa8c16' }} loading={loading} />
          </Card>
        </Col>
      </Row>

      {/* Recent Papers */}
      {stats.recentPapers.length > 0 && (
        <Card
          title={<Text style={{ color: '#e0e0e0' }}>最近添加</Text>}
          style={{ background: '#1f1f1f', border: '1px solid #303030' }}
          styles={{ header: { borderBottom: '1px solid #303030' } }}
        >
          <List
            dataSource={stats.recentPapers}
            renderItem={(item) => (
              <List.Item
                style={{ cursor: 'pointer', padding: '8px 0' }}
                onClick={() => navigate(`/reader/${item.id}`)}
              >
                <List.Item.Meta
                  avatar={<ClockCircleOutlined style={{ color: '#8c8c8c', fontSize: 16, marginTop: 4 }} />}
                  title={<Text style={{ color: '#d9d9d9', fontSize: 13 }}>{item.title}</Text>}
                  description={<Text type="secondary" style={{ fontSize: 11 }}>{item.dateAdded}</Text>}
                />
              </List.Item>
            )}
          />
        </Card>
      )}
    </div>
  );
};

export default HomePage;
