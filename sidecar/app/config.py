"""ResearchOS Sidecar - Configuration"""
import os
from dataclasses import dataclass, field


@dataclass
class Settings:
    """Application settings — all overridable via env vars."""

    # Server
    host: str = field(default_factory=lambda: os.getenv("SIDECAR_HOST", "127.0.0.1"))
    port: int = field(default_factory=lambda: int(os.getenv("SIDECAR_PORT", "9527")))
    log_level: str = field(default_factory=lambda: os.getenv("SIDECAR_LOG_LEVEL", "info"))

    # Database
    db_path: str = field(default_factory=lambda: os.getenv("SIDECAR_DB_PATH", ""))

    # Embedding
    embedding_provider: str = field(default_factory=lambda: os.getenv("SIDECAR_EMBEDDING_PROVIDER", "ollama"))
    embedding_model: str = field(default_factory=lambda: os.getenv("SIDECAR_EMBEDDING_MODEL", "nomic-embed-text"))
    embedding_dim: int = field(default_factory=lambda: int(os.getenv("SIDECAR_EMBEDDING_DIM", "768")))
    ollama_base_url: str = field(default_factory=lambda: os.getenv("OLLAMA_BASE_URL", "http://127.0.0.1:11434"))

    # OpenAI fallback (optional)
    openai_api_key: str = field(default_factory=lambda: os.getenv("OPENAI_API_KEY", ""))
    openai_base_url: str = field(default_factory=lambda: os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1"))
    openai_model: str = field(default_factory=lambda: os.getenv("SIDECAR_OPENAI_MODEL", "text-embedding-3-small"))

    # Chunking
    chunk_size: int = 512
    chunk_overlap: int = 64

    # Search
    default_top_k: int = 8
    rerank_enabled: bool = True
    rrf_k: int = 60  # Reciprocal Rank Fusion constant


settings = Settings()
