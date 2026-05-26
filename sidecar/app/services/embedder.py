"""ResearchOS Sidecar - Embedding service.

Supports:
1. Ollama (local, default) — nomic-embed-text / mxbai-embed-large
2. OpenAI (cloud fallback) — text-embedding-3-small
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
    """Unified embedding service with Ollama and OpenAI backends."""

    def __init__(self) -> None:
        self._client = httpx.Client(timeout=60.0)

    def embed(self, texts: list[str]) -> np.ndarray:
        """Embed a list of texts. Returns array of shape (len(texts), dim)."""
        if not texts:
            return np.array([])

        if settings.embedding_provider == "ollama":
            return self._embed_ollama(texts)
        elif settings.embedding_provider == "openai":
            return self._embed_openai(texts)
        else:
            raise ValueError(f"Unknown embedding provider: {settings.embedding_provider}")

    def embed_query(self, query: str) -> np.ndarray:
        """Embed a single query string. Returns 1D array of shape (dim,)."""
        result = self.embed([query])
        return result[0] if len(result) > 0 else result

    def _embed_ollama(self, texts: list[str]) -> np.ndarray:
        """Embed texts using Ollama API."""
        embeddings: list[list[float]] = []

        # Batch embedding via Ollama
        for text in texts:
            try:
                resp = self._client.post(
                    f"{settings.ollama_base_url}/api/embed",
                    json={"model": settings.embedding_model, "input": text},
                    timeout=30.0,
                )
                resp.raise_for_status()
                data = resp.json()
                # Ollama returns {"embeddings": [[...]]}
                if "embeddings" in data:
                    embeddings.append(data["embeddings"][0])
                elif "embedding" in data:
                    embeddings.append(data["embedding"])
                else:
                    logger.warning("Unexpected Ollama response format: %s", list(data.keys()))
                    # Fallback: zero vector
                    embeddings.append([0.0] * settings.embedding_dim)
            except httpx.HTTPError as e:
                logger.error("Ollama embedding failed: %s", e)
                embeddings.append([0.0] * settings.embedding_dim)

        return np.array(embeddings, dtype=np.float32)

    def _embed_openai(self, texts: list[str]) -> np.ndarray:
        """Embed texts using OpenAI API."""
        headers = {
            "Authorization": f"Bearer {settings.openai_api_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "model": settings.openai_model,
            "input": texts,
        }

        try:
            resp = self._client.post(
                f"{settings.openai_base_url}/embeddings",
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
        except httpx.HTTPError as e:
            logger.error("OpenAI embedding failed: %s", e)
            return np.zeros((len(texts), settings.embedding_dim), dtype=np.float32)

    def check_health(self) -> dict:
        """Check if the embedding backend is healthy."""
        if settings.embedding_provider == "ollama":
            try:
                resp = self._client.get(f"{settings.ollama_base_url}/api/tags", timeout=5.0)
                if resp.status_code == 200:
                    models = resp.json().get("models", [])
                    model_names = [m.get("name", "") for m in models]
                    return {
                        "status": "ok",
                        "provider": "ollama",
                        "model": settings.embedding_model,
                        "available_models": model_names,
                        "model_loaded": any(settings.embedding_model in n for n in model_names),
                    }
            except httpx.HTTPError:
                return {
                    "status": "error",
                    "provider": "ollama",
                    "message": f"Cannot connect to Ollama at {settings.ollama_base_url}",
                }
        elif settings.embedding_provider == "openai":
            if settings.openai_api_key:
                return {"status": "ok", "provider": "openai", "model": settings.openai_model}
            return {"status": "error", "provider": "openai", "message": "No API key configured"}

        return {"status": "unknown", "provider": settings.embedding_provider}

    def close(self) -> None:
        self._client.close()
