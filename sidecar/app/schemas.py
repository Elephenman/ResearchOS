"""ResearchOS Sidecar - Pydantic schemas for API request/response."""
from __future__ import annotations

from pydantic import BaseModel, Field


# --- Ingest ---

class IngestRequest(BaseModel):
    """Request to ingest a document into the RAG index."""
    paper_id: str = Field(..., description="Paper ID in ResearchOS database")
    file_path: str = Field(..., description="Absolute path to the PDF file")
    title: str = Field(default="", description="Paper title")
    authors: str = Field(default="", description="Comma-separated authors")
    year: int | None = Field(default=None, description="Publication year")


class IngestResponse(BaseModel):
    paper_id: str
    chunks_created: int
    status: str = "ok"
    message: str = ""


class BatchIngestRequest(BaseModel):
    """Batch ingest multiple documents."""
    documents: list[IngestRequest]


class BatchIngestResponse(BaseModel):
    total: int
    success: int
    failed: int
    details: list[IngestResponse]


# --- Query ---

class QueryRequest(BaseModel):
    """Semantic search query."""
    query: str = Field(..., min_length=1, description="Search query text")
    top_k: int = Field(default=8, ge=1, le=50, description="Number of results")
    filter_paper_ids: list[str] | None = Field(default=None, description="Restrict to these paper IDs")
    use_rerank: bool = Field(default=True, description="Enable RRF reranking with FTS5")


class ChunkResult(BaseModel):
    """A single retrieved chunk."""
    chunk_id: str
    paper_id: str
    title: str
    content: str
    score: float
    page_number: int | None = None
    metadata: dict = Field(default_factory=dict)


class QueryResponse(BaseModel):
    query: str
    results: list[ChunkResult]
    total: int
    elapsed_ms: float


# --- Status ---

class StatusResponse(BaseModel):
    status: str = "running"
    version: str = "1.0.0"
    embedding_provider: str = ""
    embedding_model: str = ""
    total_chunks: int = 0
    total_papers: int = 0
    db_path: str = ""


# --- Delete ---

class DeleteRequest(BaseModel):
    paper_id: str


class DeleteResponse(BaseModel):
    paper_id: str
    chunks_deleted: int
    status: str = "ok"
