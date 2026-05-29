# Changelog

## [1.0.0] - 2025-05-29

### Added
- Electron 33 + React 18 跨平台桌面框架
- 文献库管理（导入 PDF、PubMed/Crossref 检索、Zotero 一键导入）
- 内置 PDF 阅读器（高亮标注、笔记系统）
- AI 对话助手（支持 OpenAI / DeepSeek / Anthropic / Moonshot / Zhipu）
- 引文生成（APA / MLA / Chicago / GB-T 7714）
- Python Sidecar RAG 引擎（OpenAI 兼容嵌入 + sqlite-vec 向量存储）
- 语义搜索（FTS5 全文 + 向量混合检索、RRF 融合）
- 设置页嵌入 API 配置（DeepSeek / Moonshot / Zhipu / SiliconFlow）

### Fixed
- sqlite-vec 扩展加载问题（`sqlite_vec.load()` 显式加载）
- Windows 构建图标尺寸（256x256）

### Removed
- Ollama 本地嵌入依赖（全面转向 OpenAI 兼容 API）

---

## [Unreleased]

### Planned
- Word / WPS 插件引文插入
- RAG 上下文增强 AI 对话
- 知识图谱可视化（文献共引网络）
- 批量文献深度解读 + 综述自动生成
