"""ResearchOS Sidecar - FastAPI application entry point.

The sidecar runs as a Python HTTP server alongside the Electron app.
Electron spawns this process and communicates via HTTP.
"""
from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers.rag import router as rag_router
from app.services.embedder import EmbeddingService
from app.services.vectorstore import VectorStore

logger = logging.getLogger(__name__)

# Global service instances (set during lifespan)
_services: dict = {}


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan: startup → yield → shutdown."""
    # --- Startup ---
    logger.info("ResearchOS Sidecar starting...")
    logger.info("Embedding: openai-compatible / model: %s / base: %s", settings.embedding_model, settings.embedding_base_url)

    embedder = EmbeddingService()
    store = VectorStore()

    # Health check
    health = embedder.check_health()
    logger.info("Embedding health: %s", health)

    _services["embedder"] = embedder
    _services["store"] = store

    logger.info("Sidecar ready on %s:%d", settings.host, settings.port)

    yield

    # --- Shutdown ---
    logger.info("ResearchOS Sidecar shutting down...")
    embedder.close()
    store.close()


app = FastAPI(
    title="ResearchOS Sidecar",
    description="RAG Engine — semantic search for your local literature library",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS: allow Electron's localhost to call the sidecar
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Sidecar is local-only, safe to allow all
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routes
app.include_router(rag_router, prefix="/api/v1", tags=["RAG"])


@app.get("/")
async def root():
    return {"name": "ResearchOS Sidecar", "version": "1.0.0", "status": "running"}


if __name__ == "__main__":
    import uvicorn

    logging.basicConfig(
        level=getattr(logging, settings.log_level.upper(), logging.INFO),
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    )

    uvicorn.run(
        "app.main:app",
        host=settings.host,
        port=settings.port,
        log_level=settings.log_level,
    )
