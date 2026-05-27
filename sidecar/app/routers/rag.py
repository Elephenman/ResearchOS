"""ResearchOS Sidecar - API routes for RAG operations."""
from __future__ import annotations

import logging
import time

from fastapi import APIRouter, HTTPException

from app.schemas import (
    BatchIngestRequest,
    BatchIngestResponse,
    ChunkResult,
    DeleteRequest,
    DeleteResponse,
    IngestRequest,
    IngestResponse,
    QueryRequest,
    QueryResponse,
    StatusResponse,
)

logger = logging.getLogger(__name__)
router = APIRouter()


def _get_services():
    """Lazy access to services (initialized in main.py lifespan)."""
    from app.main import _services
    return _services


@router.get("/status", response_model=StatusResponse)
async def get_status():
    """Check sidecar health and stats."""
    svc = _get_services()
    embedder = svc["embedder"]
    store = svc["store"]

    embed_health = embedder.check_health()
    stats = store.get_stats()

    return StatusResponse(
        status=embed_health.get("status", "unknown"),
        version="1.0.0",
        embedding_provider=embed_health.get("provider", ""),
        embedding_model=embed_health.get("model", ""),
        total_chunks=stats["total_chunks"],
        total_papers=stats["total_papers"],
        db_path=stats["db_path"],
    )


@router.post("/ingest", response_model=IngestResponse)
async def ingest_document(req: IngestRequest):
    """Ingest a single PDF document into the RAG index."""
    import os

    if not os.path.exists(req.file_path):
        raise HTTPException(status_code=400, detail=f"File not found: {req.file_path}")

    svc = _get_services()
    from app.services.chunker import chunk_pdf

    try:
        # 1. Extract and chunk
        chunks = chunk_pdf(req.file_path, req.paper_id)
        if not chunks:
            return IngestResponse(
                paper_id=req.paper_id,
                chunks_created=0,
                status="skipped",
                message="No text extracted from PDF",
            )

        # 2. Embed
        texts = [c.content for c in chunks]
        embeddings = svc["embedder"].embed(texts)

        # 3. Store
        paper_meta = {
            "title": req.title,
            "authors": req.authors,
            "year": req.year,
        }
        count = svc["store"].add_chunks(chunks, embeddings, paper_meta)

        return IngestResponse(
            paper_id=req.paper_id,
            chunks_created=count,
            status="ok",
        )
    except Exception as e:
        logger.error("Ingest failed for %s: %s", req.paper_id, e)
        raise HTTPException(status_code=500, detail="Ingest failed — check sidecar logs for details")


@router.post("/ingest/batch", response_model=BatchIngestResponse)
async def ingest_batch(req: BatchIngestRequest):
    """Batch ingest multiple documents."""
    results: list[IngestResponse] = []
    success = 0
    failed = 0

    for doc in req.documents:
        try:
            resp = await ingest_document(doc)
            results.append(resp)
            if resp.status == "ok":
                success += 1
            else:
                failed += 1
        except Exception as e:
            results.append(
                IngestResponse(
                    paper_id=doc.paper_id,
                    chunks_created=0,
                    status="error",
                    message=str(e),
                )
            )
            failed += 1

    return BatchIngestResponse(
        total=len(req.documents),
        success=success,
        failed=failed,
        details=results,
    )


@router.post("/query", response_model=QueryResponse)
async def query_rag(req: QueryRequest):
    """Semantic search across the RAG index."""
    svc = _get_services()
    start = time.time()

    try:
        # 1. Embed query
        query_embedding = svc["embedder"].embed_query(req.query)

        # 2. Search
        if req.use_rerank:
            # Hybrid: vector + FTS5 with RRF
            results = svc["store"].search_hybrid(
                query=req.query,
                query_embedding=query_embedding,
                top_k=req.top_k,
                filter_paper_ids=req.filter_paper_ids,
            )
        else:
            # Dense only
            results = svc["store"].search_vector(
                query_embedding=query_embedding,
                top_k=req.top_k,
                filter_paper_ids=req.filter_paper_ids,
            )

        # 3. Build response
        chunk_results: list[ChunkResult] = []
        for chunk_id, score in results:
            chunk_data = svc["store"].get_chunk(chunk_id)
            if chunk_data:
                chunk_results.append(
                    ChunkResult(
                        chunk_id=chunk_id,
                        paper_id=chunk_data["paper_id"],
                        title=chunk_data["title"],
                        content=chunk_data["content"],
                        score=round(score, 4),
                        page_number=chunk_data.get("page_number"),
                        metadata=chunk_data.get("metadata", {}),
                    )
                )

        elapsed = (time.time() - start) * 1000
        return QueryResponse(
            query=req.query,
            results=chunk_results,
            total=len(chunk_results),
            elapsed_ms=round(elapsed, 1),
        )
    except Exception as e:
        logger.error("Query failed: %s", e)
        raise HTTPException(status_code=500, detail="Search query failed — check sidecar logs for details")


@router.delete("/paper/{paper_id}", response_model=DeleteResponse)
async def delete_paper(paper_id: str):
    """Remove all chunks and embeddings for a paper."""
    svc = _get_services()
    try:
        count = svc["store"].delete_paper(paper_id)
        return DeleteResponse(paper_id=paper_id, chunks_deleted=count)
    except Exception as e:
        logger.error("Delete failed for %s: %s", paper_id, e)
        raise HTTPException(status_code=500, detail="Delete operation failed — check sidecar logs for details")
