"""ResearchOS Sidecar - Embedding service.

Uses OpenAI-compatible API for embeddings.
Supports any provider that follows the OpenAI /v1/embeddings format:
- OpenAI (text-embedding-3-small, text-embedding-3-large, etc.)
- DeepSeek, Moonshot, Zhipu, SiliconFlow, Ollama OpenAI-compat, etc.

User provides their own API key + base_url + model name via Settings page.
"""
from __future__ import annotations

import logging
from typing import TYPE_CHECKING

import httpx
import numpy as np

from app.config import settings

if TYPE_CHECKING:
    pass

logger = logging.getLogger(__name__)


class EmbeddingService:
    """Embedding service using OpenAI-compatible API."""

    def __init__(self) -> None:
        self._client = httpx.Client(timeout=60.0)

    def embed(self, texts: list[str]) -> np.ndarray:
        """Embed a list of texts. Returns array of shape (len(texts), dim)."""
        if not texts:
            return np.array([])

        if not settings.embedding_api_key:
            raise ValueError("No embedding API key configured — please set it in Settings")

        return self._embed_openai_compat(texts)

    def embed_query(self, query: str) -> np.ndarray:
        """Embed a single query string. Returns 1D array of shape (dim,)."""
        result = self.embed([query])
        return result[0] if len(result) > 0 else result

    def _embed_openai_compat(self, texts: list[str]) -> np.ndarray:
        """Embed texts using OpenAI-compatible /v1/embeddings API.

        This works with:
        - OpenAI: https://api.openai.com/v1
        - DeepSeek: https://api.deepseek.com/v1
        - Moonshot: https://api.moonshot.cn/v1
        - Zhipu: https://open.bigmodel.cn/api/paas/v4
        - SiliconFlow: https://api.siliconflow.cn/v1
        - Ollama (OpenAI compat): http://127.0.0.1:11434/v1
        - Any other OpenAI-compatible provider
        """
        headers = {
            "Authorization": f"Bearer {settings.embedding_api_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "model": settings.embedding_model,
            "input": texts,
        }

        try:
            resp = self._client.post(
                f"{settings.embedding_base_url}/embeddings",
                headers=headers,
                json=payload,
                timeout=30.0,
            )
            resp.raise_for_status()
            data = resp.json()

            # Sort by index to ensure correct order
            embeddings_data = sorted(data["data"], key=lambda x: x["index"])
            embeddings = [item["embedding"] for item in embeddings_data]
            return np.array(embeddings, dtype=np.float32)

        except httpx.HTTPStatusError as e:
            logger.error("Embedding API error %d: %s", e.response.status_code, e.response.text[:200])
            raise RuntimeError(f"Embedding API returned HTTP {e.response.status_code}") from e
        except httpx.HTTPError as e:
            logger.error("Embedding request failed: %s", e)
            raise RuntimeError(f"Embedding request failed: {e}") from e

    def check_health(self) -> dict:
        """Check if the embedding API is configured and reachable."""
        if not settings.embedding_api_key:
            return {
                "status": "not_configured",
                "provider": "openai-compatible",
                "model": settings.embedding_model,
                "message": "请先在设置中配置嵌入模型 API Key",
            }

        # Quick test: try a single embedding
        try:
            result = self.embed(["test"])
            if result.shape[0] > 0 and np.any(result[0] != 0):
                return {
                    "status": "ok",
                    "provider": "openai-compatible",
                    "model": settings.embedding_model,
                    "base_url": settings.embedding_base_url,
                }
            else:
                return {
                    "status": "error",
                    "provider": "openai-compatible",
                    "model": settings.embedding_model,
                    "message": "嵌入返回零向量，请检查 API Key 和模型名称",
                }
        except Exception as e:
            return {
                "status": "error",
                "provider": "openai-compatible",
                "model": settings.embedding_model,
                "message": f"连接失败: {e}",
            }

    def close(self) -> None:
        self._client.close()
