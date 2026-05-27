import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Card, Select, Button, Space, Typography, Empty, Slider, message, Tag } from 'antd';
import { ApartmentOutlined, NodeIndexOutlined, TeamOutlined, TagOutlined, ReloadOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;
const { Option } = Select;

const GRAPH_TYPES = [
  { key: 'citation', label: '引用关系图', icon: <ApartmentOutlined style={{ fontSize: 32, color: '#1677ff' }} />, desc: '论文之间的引用与被引用关系' },
  { key: 'cokeyword', label: '关键词共现图', icon: <TagOutlined style={{ fontSize: 32, color: '#52c41a' }} />, desc: '论文关键词的共现网络' },
  { key: 'coauthor', label: '作者合作图', icon: <TeamOutlined style={{ fontSize: 32, color: '#722ed1' }} />, desc: '作者之间的合作关系网络' },
];

interface GraphNode {
  id: string;
  label: string;
  x: number;
  y: number;
  type: string;
  size: number;
}

interface GraphEdge {
  source: string;
  target: string;
}

const GraphPage: React.FC = () => {
  const [graphType, setGraphType] = useState<string>('citation');
  const [depth, setDepth] = useState<number>(2);
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [edges, setEdges] = useState<GraphEdge[]>([]);
  const [loading, setLoading] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 900, height: 440 });

  const loadGraph = async () => {
    setLoading(true);
    try {
      let result: any;
      if (graphType === 'citation') {
        // Use first paper from library as seed
        const papers = await window.electronAPI.getPapers({ page: 1, pageSize: 1 });
        if (papers.data.length > 0) {
          result = await window.electronAPI.getCitationGraph(papers.data[0].id, depth);
        }
      } else if (graphType === 'coauthor') {
        result = await window.electronAPI.getCoAuthorGraph('');
      } else {
        result = await window.electronAPI.getKeywordGraph('');
      }

      if (result?.nodes?.length > 0) {
        // Simple force-directed layout
        const cw = canvasSize.width || 900;
        const ch = canvasSize.height || 440;
        const graphNodes = result.nodes.map((n: any, i: number) => ({
          id: n.id,
          label: n.label,
          x: cw / 2 + Math.cos(i * 2.4) * (cw * 0.2 + Math.random() * cw * 0.1),
          y: ch / 2 + Math.sin(i * 2.4) * (ch * 0.2 + Math.random() * ch * 0.1),
          type: n.type,
          size: n.size || 20,
        }));
        setNodes(graphNodes);
        setEdges(result.edges || []);
      } else {
        setNodes([]);
        setEdges([]);
      }
    } catch (err) {
      console.error('Failed to load graph:', err);
      setNodes([]);
      setEdges([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (nodes.length > 0) {
      drawGraph();
    }
  }, [nodes, edges, canvasSize]);

  // ResizeObserver for canvas container
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(entries => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          setCanvasSize({ width: Math.floor(width), height: Math.floor(height) });
        }
      }
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [nodes.length > 0]);

  const drawGraph = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    // Draw edges
    ctx.strokeStyle = '#434343';
    ctx.lineWidth = 1;
    for (const edge of edges) {
      const src = nodes.find(n => n.id === edge.source);
      const tgt = nodes.find(n => n.id === edge.target);
      if (src && tgt) {
        ctx.beginPath();
        ctx.moveTo(src.x, src.y);
        ctx.lineTo(tgt.x, tgt.y);
        ctx.stroke();
      }
    }

    // Draw nodes
    for (const node of nodes) {
      const color = node.type === 'paper' ? '#1677ff'
        : node.type === 'author' ? '#722ed1'
        : '#52c41a';

      ctx.beginPath();
      ctx.arc(node.x, node.y, node.size / 2, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = '#1f1f1f';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Label
      ctx.fillStyle = '#d9d9d9';
      ctx.font = '10px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(node.label.slice(0, 20), node.x, node.y + node.size / 2 + 14);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ color: '#e0e0e0', margin: 0 }}>文献图谱</Title>
        <Space>
          <Text type="secondary">图谱类型：</Text>
          <Select value={graphType} onChange={setGraphType} style={{ width: 160 }}>
            {GRAPH_TYPES.map(t => (
              <Option key={t.key} value={t.key}>{t.label}</Option>
            ))}
          </Select>
          <Text type="secondary">深度：</Text>
          <Slider min={1} max={5} value={depth} onChange={setDepth} style={{ width: 100 }} />
          <Button icon={<ReloadOutlined />} onClick={loadGraph} loading={loading}>加载</Button>
        </Space>
      </div>

      <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
        {GRAPH_TYPES.map(t => (
          <Card
            key={t.key}
            hoverable
            style={{
              flex: 1, background: graphType === t.key ? '#1677ff10' : '#1f1f1f',
              border: graphType === t.key ? '1px solid #1677ff' : '1px solid #303030',
              cursor: 'pointer',
            }}
            onClick={() => setGraphType(t.key)}
          >
            <Space direction="vertical" align="center" style={{ width: '100%' }}>
              {t.icon}
              <Text strong style={{ color: '#e0e0e0' }}>{t.label}</Text>
              <Text type="secondary" style={{ fontSize: 12 }}>{t.desc}</Text>
            </Space>
          </Card>
        ))}
      </div>

      <Card style={{ background: '#1f1f1f', border: '1px solid #303030', minHeight: 480 }}>
        {nodes.length === 0 ? (
          <div style={{ height: 440, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Empty
              image={<NodeIndexOutlined style={{ fontSize: 64, color: '#434343' }} />}
              description={<Text type="secondary">点击「加载」从文献库生成图谱</Text>}
            />
          </div>
        ) : (
          <div ref={containerRef} style={{ width: '100%', height: 440 }}>
            <canvas
              ref={canvasRef}
              width={canvasSize.width}
              height={canvasSize.height}
              style={{ width: '100%', height: '100%', background: '#0d0d0d', borderRadius: 8 }}
            />
          </div>
        )}
      </Card>

      {nodes.length > 0 && (
        <Card style={{ background: '#1f1f1f', border: '1px solid #303030', marginTop: 16 }}>
          <Space>
            <Tag color="blue">论文 ({nodes.filter(n => n.type === 'paper').length})</Tag>
            <Tag color="purple">作者 ({nodes.filter(n => n.type === 'author').length})</Tag>
            <Tag color="green">关键词 ({nodes.filter(n => n.type === 'keyword').length})</Tag>
            <Tag>关系 ({edges.length})</Tag>
          </Space>
        </Card>
      )}
    </div>
  );
};

export default GraphPage;
