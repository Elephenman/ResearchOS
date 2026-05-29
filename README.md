<p align="center">
  <img src="resources/icon.svg" alt="ResearchOS Logo" width="120" height="120" />
</p>

<h1 align="center">ResearchOS</h1>

<p align="center">
  <b>模块化 AI 科研桌面工作台</b><br />
  <i>面向中国高校理工科研究生的下一代文献管理与知识发现工具</i>
</p>

<p align="center">
  <a href="https://github.com/Elephenman/ResearchOS/releases">
    <img src="https://img.shields.io/github/v/release/Elephenman/ResearchOS?color=%231677ff&style=for-the-badge" alt="Latest Release" />
  </a>
  <a href="https://github.com/Elephenman/ResearchOS/blob/main/LICENSE">
    <img src="https://img.shields.io/github/license/Elephenman/ResearchOS?color=%231677ff&style=for-the-badge" alt="License" />
  </a>
  <img src="https://img.shields.io/static/v1?label=platform&message=Windows%20%7C%20macOS%20%7C%20Linux&color=1677ff&style=for-the-badge" alt="Platform" />
  <img src="https://img.shields.io/badge/Electron-33.x-%2347848F?style=for-the-badge&logo=electron" alt="Electron" />
  <img src="https://img.shields.io/badge/React-18.x-%2361DAFB?style=for-the-badge&logo=react" alt="React" />
</p>

<p align="center">
  <img src="https://img.shields.io/badge/TypeScript-5.x-%233178C6?style=flat-square&logo=typescript" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Python-3.12%2B-%233776AB?style=flat-square&logo=python" alt="Python" />
  <img src="https://img.shields.io/badge/RAG-sqlite--vec-%2300B265?style=flat-square" alt="RAG Engine" />
  <img src="https://img.shields.io/badge/Zotero-compatible-%23CC2936?style=flat-square&logo=zotero" alt="Zotero" />
</p>

---

> **ResearchOS** 把文献管理、AI 对话、语义搜索、论文阅读、引文生成、文献综述六件事合为一体。内置 Python Sidecar RAG 引擎，支持 OpenAI / DeepSeek / Moonshot 兼容的嵌入 API，数据库兼容 Zotero 一键导入。

---

## ✨ 为什么选择 ResearchOS？

科研工作流默认是割裂的——Zotero 管文献、Obsidian 管笔记、GPT 管对话、Word 管引文。**ResearchOS 把它们全部带到一个桌面上，用本地优先 + 模块化架构实现统一体验。**

- 🔍 **语义搜索 (RAG)** — 基于 OpenAI 兼容嵌入 + sqlite-vec 向量存储，支持 FTS5 全文 + 向量混合检索、RRF 结果融合，搜到的不只是关键词，而是"意思相近"
- 📚 **文献库管理** — 批量导入 PDF、PubMed/Crossref 在线检索、Zotero 数据库无缝导入（含集合/标签/作者），本地 SQLite 存储
- 🤖 **AI 对话助手** — 与论文内容深度对话，AI 上下文自动注入相关文献片段，支持 OpenAI / DeepSeek / Anthropic / Moonshot / Zhipu
- 📖 **论文阅读器** — 内建 PDF 阅读、高亮标注、笔记系统
- 📝 **引文生成** — APA / MLA / Chicago / GB-T 7714 格式，CrossRef 自动补全，Word/WPS 插件（开发中）
- 📊 **文献综述辅助** — AI 驱动的批量文献解读、方法与结果矩阵提取，论文骨架自动生成
- 🧩 **模块化架构** — 8 个独立功能模块，按需使用，自由组合

---

## 🏗️ 架构概览

```
┌──────────────────────────────────────────────────────────┐
│                   Electron Shell                          │
│  ┌────────────────────────────────────────────────────┐  │
│  │              React Frontend (SPA)                    │  │
│  │  Home │ Library │ Reader │ AI │ Citation │ ...      │  │
│  └───────────────┬────────────────────────────────────┘  │
│                  │ IPC (preload bridge)                   │
│  ┌───────────────┴────────────────────────────────────┐  │
│  │              Main Process Services                  │  │
│  │  Database │ Search │ Sidecar │ AI │ Zotero         │  │
│  └───────┬───────┬───────┬───────┬──────┴─────────────┘  │
│          │       │       │       │                        │
└──────────┼───────┼───────┼───────┼────────────────────────┘
           │       │       │       │
    ┌──────┴──┐ ┌──┴───┐   │   ┌───┴──────┐
    │ SQLite  │ │FTS5  │   │   │ OpenAI / │
    │ (better │ │Search│   │   │Claude API│
    │ -sqlite3│ └──────┘   │   └──────────┘
    └─────────┘            │
                    ┌──────┴──────────────┐
                    │  Python Sidecar     │
                    │  localhost:9527     │
                    │  ┌──────────────┐   │
                    │  │ Chunker       │   │
                    │  │ Embedder      │   │
                    │  │ VectorStore   │   │
                    │  │  (sqlite-vec) │   │
                    │  └──────────────┘   │
                    └─────────────────────┘
```

---

## 🚀 快速开始

### 前提条件

- **Node.js** ≥ 22.x
- **Python** ≥ 3.12
- （可选）OpenAI 兼容嵌入 API Key（用于 RAG 语义搜索）

### 安装

```bash
# 1. 克隆仓库
git clone https://github.com/Elephenman/ResearchOS.git
cd ResearchOS

# 2. 安装前端 & Electron 依赖
npm install

# 3. 安装 Python Sidecar 依赖
cd sidecar
pip install -r requirements.txt
cd ..
```

### 启动开发模式

```bash
# 同时启动 Vite 前端 + Electron 主进程
npm run dev
```

### 启动 Python Sidecar（RAG 引擎）

```bash
cd sidecar
python -m app.main
# FastAPI 将在 http://127.0.0.1:9527 启动
```

验证 Sidecar 是否正常：

```bash
curl http://127.0.0.1:9527/api/v1/status
# { "status": "running", "embedding_provider": "openai-compatible", ... }
```

### 构建安装包

```bash
# Windows (NSIS)
npm run dist

# macOS (DMG)
npm run dist

# Linux (AppImage)
npm run dist
```

构建产物在 `dist-build/` 目录。

---

## ⚙️ 配置

### 嵌入模型（RAG 引擎）

在设置页 → RAG 引擎标签页配置：

| 提供商 | Base URL | 模型示例 |
|--------|----------|----------|
| OpenAI | `https://api.openai.com/v1` | `text-embedding-3-small` |
| DeepSeek | `https://api.deepseek.com/v1` | `embedding-3` |
| Moonshot | `https://api.moonshot.cn/v1` | `moonshot-v1-8k` |
| Zhipu | `https://open.bigmodel.cn/api/paas/v4` | `embedding-3` |
| SiliconFlow | `https://api.siliconflow.cn/v1` | `BAAI/bge-large-zh-v1.5` |

也可通过环境变量配置（优先级高于设置页）：

```bash
export SIDECAR_EMBEDDING_API_KEY="sk-..."
export SIDECAR_EMBEDDING_BASE_URL="https://api.openai.com/v1"
export SIDECAR_EMBEDDING_MODEL="text-embedding-3-small"
```

### AI 对话模型

在设置页 → AI 配置标签页选择模型提供商并填入 API Key。

---

## 📁 项目结构

```
ResearchOS/
├── electron/               # Electron 主进程
│   ├── main.ts             # 入口 & 生命周期
│   ├── preload.ts          # IPC 桥接
│   ├── ipc/register.ts     # 所有 IPC handler 注册
│   └── services/
│       ├── ai.ts           # AI 对话服务
│       ├── database.ts     # SQLite (better-sqlite3)
│       ├── search.ts       # FTS5 全文搜索
│       ├── sidecar.ts      # Python Sidecar 进程管理
│       └── zotero-import.ts # Zotero 数据库导入
├── sidecar/                # Python RAG 引擎
│   ├── app/
│   │   ├── main.py         # FastAPI 入口
│   │   ├── config.py       # 配置（env vars 驱动）
│   │   ├── schemas.py      # Pydantic 数据模型
│   │   ├── routers/rag.py  # RAG API 路由
│   │   └── services/
│   │       ├── chunker.py      # PDF/文本分块 (PyMuPDF)
│   │       ├── embedder.py     # OpenAI 兼容嵌入 API
│   │       └── vectorstore.py  # sqlite-vec 向量存储 + FTS5
│   └── requirements.txt
├── src/                    # React 前端
│   ├── modules/
│   │   ├── home/           # 首页 & 工作台概览
│   │   ├── library/        # 文献库管理
│   │   ├── reader/         # PDF 阅读器
│   │   ├── ai/             # AI 对话
│   │   ├── search/         # 在线检索
│   │   ├── citation/       # 引文生成
│   │   ├── graph/          # 知识图谱
│   │   ├── review/         # 文献综述
│   │   └── settings/       # 设置（含 Zotero 导入）
│   ├── components/         # 共享组件
│   ├── stores/             # Zustand 状态管理
│   └── types/              # TypeScript 类型声明
├── resources/              # 图标 & 资源
├── package.json
├── vite.config.ts
└── electron-builder.yml
```

---

## 🧪 技术栈

| 层级 | 技术 | 说明 |
|------|------|------|
| **桌面框架** | Electron 33 + Vite | 跨平台桌面应用 |
| **前端** | React 18 + TypeScript 5 + Ant Design 5 | 暗色主题 SPA |
| **状态管理** | Zustand 5 | 轻量级响应式状态 |
| **本地数据库** | better-sqlite3 | 文献元数据 & 全文索引 |
| **RAG 引擎** | Python (FastAPI + PyMuPDF + sqlite-vec) | Sidecar 进程，本地向量检索 |
| **嵌入 API** | OpenAI 兼容 `/v1/embeddings` | 支持多提供商 |
| **PDF 渲染** | pdfjs-dist + react-pdf | 内建阅读器 |
| **打包** | electron-builder | NSIS / DMG / AppImage |
| **搜索** | FTS5 全文 + 向量混合 + RRF 融合 | 语义+关键词双路检索 |

---

## 🗺️ 开发路线

### V1 — ✅ 已完成
- [x] Electron + React 桌面框架搭建
- [x] 文献库 CRUD（导入 / 检索 / 分类 / 标签）
- [x] PDF 阅读器
- [x] 基础 AI 对话
- [x] 引文生成（4 种格式）
- [x] 8 个功能模块骨架

### V2 — ✅ 已完成
- [x] Python Sidecar RAG 引擎（chunk → embed → search）
- [x] 语义搜索（向量 + 关键词混合检索 RRF）
- [x] Zotero 数据库一键导入
- [x] OpenAI 兼容嵌入 API（DeepSeek / Moonshot / Zhipu）
- [x] sqlite-vec 向量存储

### V2.1 — ✅ 已完成
- [x] 嵌入服务重构：移除 Ollama 依赖，全面转向 OpenAI 兼容 API
- [x] 修复 sqlite-vec 扩展加载问题（`sqlite_vec.load()` 显式加载）
- [x] 设置页新增嵌入 API 配置表单（提供商 / Key / BaseURL / 模型）
- [x] Sidecar 启动参数传递嵌入配置环境变量

### V3 — 🚧 开发中
- [ ] Word / WPS 插件引文插入
- [ ] RAG 上下文增强 AI 对话
- [ ] 知识图谱可视化（文献共引网络）
- [ ] 批量文献深度解读 + 综述自动生成
- [ ] 实验笔记 / 组会 PPT 一键生成

### 未来规划
- [ ] Obsidian 双向同步
- [ ] 团队协作共享库
- [ ] 多模态文献支持（图表 OCR + 理解）
- [ ] 论文写作辅助（LaTeX / Word 模板）

---

## 🤝 贡献

欢迎提交 Issue 和 PR！

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feat/amazing-feature`)
3. 提交更改 (`git commit -m 'feat: add amazing feature'`)
4. 推送到分支 (`git push origin feat/amazing-feature`)
5. 提交 Pull Request

提交信息请遵循 [Conventional Commits](https://www.conventionalcommits.org/) 规范。

---

## 📄 许可证

[MIT License](LICENSE) © 2025 ResearchOS

---

## 🙏 致谢

ResearchOS 的诞生离不开以下开源项目：

- [Electron](https://www.electronjs.org/) — 跨平台桌面框架
- [React](https://react.dev/) & [Ant Design](https://ant.design/) — UI 框架
- [PyMuPDF](https://pymupdf.readthedocs.io/) — PDF 处理引擎
- [sqlite-vec](https://github.com/asg017/sqlite-vec) — SQLite 向量扩展
- [Zustand](https://zustand.design/) — 状态管理
- [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) — Node.js SQLite 绑定

---

<p align="center">
  <sub>Built with ❤️ by <a href="https://github.com/Elephenman">@Elephenman</a> for researchers everywhere.</sub>
</p>
