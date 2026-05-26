"""ResearchOS Sidecar - Vector store with sqlite-vec + FTS5 hybrid retrieval.

Architecture:
- sqlite-vec stores embeddings for dense retrieval (cosine similarity)
- FTS5 provides sparse retrieval (BM25-like full-text search)
- Reciprocal Rank Fusion (RRF) merges both result sets

Database schema (same SQLite as Electron main app):
- chunks: chunk_id, paper_id, content, page_number, chunk_index, metadata_json
- chunk_embeddings: rowid, chunk_id, embedding (sqlite-vec virtual table)
- papers_fts: FTS5 virtual table on chunk content
"""
from __future__ import annotations

import json
import logging
import os
import sqlite3
import struct
from typing import TYPE_CHECKING

import numpy as np
import sqlite_vec

from app.config import settings

if TYPE_CHECKING:
    from app.services.chunker import Chunk

logger = logging.getLogger(__name__)


def _serialize_vector(vector: np.ndarray) -> bytes:
    """Serialize a float32 vector to bytes for sqlite-vec storage."""
    return struct.pack(f"{len(vector)}f", *vector)


def _deserialize_vector(data: bytes, dim: int) -> np.ndarray:
    """Deserialize bytes back to float32 numpy array."""
    return np.array(struct.unpack(f"{dim}f", data), dtype=np.float32)


class VectorStore:
    """Hybrid vector + FTS5 retrieval engine backed by sqlite-vec."""

    def __init__(self, db_path: str | None = None) -> None:
        self.db_path = db_path or settings.db_path
        if not self.db_path:
            # Default: same directory as Electron's researchos.db
            self.db_path = os.path.join(
                os.path.expanduser("~"), ".researchos", "rag.db"
            )
        self._conn: sqlite3.Connection | None = None
        self._initialized = False

    def _get_conn(self) -> sqlite3.Connection:
        if self._conn is None:
            os.makedirs(os.path.dirname(self.db_path), exist_ok=True)
            self._conn = sqlite3.connect(self.db_path)
            self._conn.execute("PRAGMA journal_mode=WAL")
            self._conn.execute("PRAGMA foreign_keys=ON")
            # Load sqlite-vec extension
            self._conn.enable_load_extension(True)
            sqlite_vec.load(self._conn)
            self._conn.enable_load_extension(False)
            if not self._initialized:
                self._init_tables()
                self._initialized = True
        return self._conn

    def _init_tables(self) -> None:
        """Create all tables and virtual tables."""
        conn = self._get_conn()

        # Chunks table
        conn.execute("""
            CREATE TABLE IF NOT EXISTS chunks (
                chunk_id TEXT PRIMARY KEY,
                paper_id TEXT NOT NULL,
                content TEXT NOT NULL,
                page_number INTEGER,
                chunk_index INTEGER NOT NULL,
                metadata_json TEXT DEFAULT '{}',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        # Index on paper_id for fast deletion
        conn.execute("CREATE INDEX IF NOT EXISTS idx_chunks_paper_id ON chunks(paper_id)")

        # Paper metadata table (denormalized for search results)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS paper_meta (
                paper_id TEXT PRIMARY KEY,
                title TEXT DEFAULT '',
                authors TEXT DEFAULT '',
                year INTEGER
            )
        """)

        # Try to create sqlite-vec virtual table
        try:
            conn.execute(f"""
                CREATE VIRTUAL TABLE IF NOT EXISTS chunk_embeddings
                USING vec0(
                    chunk_id TEXT PRIMARY KEY,
                    embedding float[{settings.embedding_dim}]
                )
            """)
            logger.info("sqlite-vec virtual table created (dim=%d)", settings.embedding_dim)
        except sqlite3.OperationalError as e:
            logger.warning("sqlite-vec not available, falling back to JSON storage: %s", e)
            # Fallback: store embeddings as BLOB in a regular table
            conn.execute("""
                CREATE TABLE IF NOT EXISTS chunk_embeddings_fallback (
                    chunk_id TEXT PRIMARY KEY,
                    embedding BLOB NOT NULL,
                    FOREIGN KEY (chunk_id) REFERENCES chunks(chunk_id) ON DELETE CASCADE
                )
            """)
            conn.execute("CREATE INDEX IF NOT EXISTS idx_emb_fb_chunk_id ON chunk_embeddings_fallback(chunk_id)")

        # FTS5 virtual table for full-text search
        conn.execute("""
            CREATE VIRTUAL TABLE IF NOT EXISTS papers_fts
            USING fts5(
                chunk_id,
                paper_id,
                content,
                title,
                tokenize='porter unicode61'
            )
        """)

        conn.commit()

    def add_chunks(
        self,
        chunks: list["Chunk"],
        embeddings: np.ndarray,
        paper_meta: dict | None = None,
    ) -> int:
        """Insert chunks with their embeddings into the store."""
        conn = self._get_conn()
        count = 0

        for i, chunk in enumerate(chunks):
            try:
                # Insert chunk
                conn.execute(
                    """INSERT OR REPLACE INTO chunks
                       (chunk_id, paper_id, content, page_number, chunk_index, metadata_json)
                       VALUES (?, ?, ?, ?, ?, ?)""",
                    (
                        chunk.id,
                        chunk.paper_id,
                        chunk.content,
                        chunk.page_number,
                        chunk.chunk_index,
                        json.dumps(chunk.metadata),
                    ),
                )

                # Insert embedding
                emb = embeddings[i]
                if len(emb.shape) == 0:
                    continue

                try:
                    conn.execute(
                        "INSERT OR REPLACE INTO chunk_embeddings (chunk_id, embedding) VALUES (?, ?)",
                        (chunk.id, _serialize_vector(emb)),
                    )
                except sqlite3.OperationalError:
                    # Fallback table
                    conn.execute(
                        "INSERT OR REPLACE INTO chunk_embeddings_fallback (chunk_id, embedding) VALUES (?, ?)",
                        (chunk.id, _serialize_vector(emb)),
                    )

                # Insert into FTS5
                title = paper_meta.get("title", "") if paper_meta else ""
                conn.execute(
                    "INSERT INTO papers_fts (chunk_id, paper_id, content, title) VALUES (?, ?, ?, ?)",
                    (chunk.id, chunk.paper_id, chunk.content, title),
                )

                count += 1
            except sqlite3.Error as e:
                logger.error("Failed to insert chunk %s: %s", chunk.id, e)

        # Update paper metadata
        if paper_meta and chunks:
            conn.execute(
                """INSERT OR REPLACE INTO paper_meta (paper_id, title, authors, year)
                   VALUES (?, ?, ?, ?)""",
                (
                    chunks[0].paper_id,
                    paper_meta.get("title", ""),
                    paper_meta.get("authors", ""),
                    paper_meta.get("year"),
                ),
            )

        conn.commit()
        return count

    def delete_paper(self, paper_id: str) -> int:
        """Delete all chunks for a paper. Returns number of chunks deleted."""
        conn = self._get_conn()

        # Get chunk IDs first
        rows = conn.execute(
            "SELECT chunk_id FROM chunks WHERE paper_id = ?", (paper_id,)
        ).fetchall()
        chunk_ids = [r[0] for r in rows]

        if not chunk_ids:
            return 0

        # Delete from FTS5
        for cid in chunk_ids:
            conn.execute("DELETE FROM papers_fts WHERE chunk_id = ?", (cid,))

        # Delete embeddings
        for cid in chunk_ids:
            try:
                conn.execute("DELETE FROM chunk_embeddings WHERE chunk_id = ?", (cid,))
            except sqlite3.OperationalError:
                conn.execute("DELETE FROM chunk_embeddings_fallback WHERE chunk_id = ?", (cid,))

        # Delete chunks
        conn.execute("DELETE FROM chunks WHERE paper_id = ?", (paper_id,))
        conn.execute("DELETE FROM paper_meta WHERE paper_id = ?", (paper_id,))

        conn.commit()
        return len(chunk_ids)

    def search_vector(
        self,
        query_embedding: np.ndarray,
        top_k: int = 8,
        filter_paper_ids: list[str] | None = None,
    ) -> list[tuple[str, float]]:
        """Dense retrieval via cosine similarity in sqlite-vec.

        Returns list of (chunk_id, score).
        """
        conn = self._get_conn()
        results: list[tuple[str, float]] = []

        try:
            query_bytes = _serialize_vector(query_embedding)
            # sqlite-vec KNN search
            sql = """
                SELECT chunk_id, distance
                FROM chunk_embeddings
                WHERE embedding MATCH ?
                ORDER BY distance
                LIMIT ?
            """
            rows = conn.execute(sql, (query_bytes, top_k)).fetchall()
            results = [(r[0], 1.0 - r[1]) for r in rows]  # Convert distance to similarity

        except sqlite3.OperationalError:
            # Fallback: brute-force cosine similarity
            rows = conn.execute(
                "SELECT ce.chunk_id, ce.embedding FROM chunk_embeddings_fallback ce"
            ).fetchall()

            candidates = []
            for chunk_id, emb_bytes in rows:
                emb = _deserialize_vector(emb_bytes, settings.embedding_dim)
                # Cosine similarity
                norm_q = np.linalg.norm(query_embedding)
                norm_e = np.linalg.norm(emb)
                if norm_q > 0 and norm_e > 0:
                    sim = float(np.dot(query_embedding, emb) / (norm_q * norm_e))
                    candidates.append((chunk_id, sim))

            candidates.sort(key=lambda x: x[1], reverse=True)
            results = candidates[:top_k]

        # Apply paper_id filter
        if filter_paper_ids and results:
            valid_ids = set(filter_paper_ids)
            filtered = []
            for cid, score in results:
                row = conn.execute(
                    "SELECT paper_id FROM chunks WHERE chunk_id = ?", (cid,)
                ).fetchone()
                if row and row[0] in valid_ids:
                    filtered.append((cid, score))
            results = filtered

        return results

    def search_fts(
        self,
        query: str,
        top_k: int = 8,
        filter_paper_ids: list[str] | None = None,
    ) -> list[tuple[str, float]]:
        """Sparse retrieval via FTS5 BM25 ranking.

        Returns list of (chunk_id, score).
        """
        conn = self._get_conn()

        # Build filter clause
        filter_clause = ""
        params: list = [query, top_k]

        if filter_paper_ids:
            placeholders = ",".join("?" for _ in filter_paper_ids)
            filter_clause = f"AND paper_id IN ({placeholders})"
            params = [query] + filter_paper_ids + [top_k]

        sql = f"""
            SELECT chunk_id, bm25(papers_fts) as score
            FROM papers_fts
            WHERE papers_fts MATCH ?
            {filter_clause}
            ORDER BY score
            LIMIT ?
        """

        try:
            rows = conn.execute(sql, params).fetchall()
            # BM25 scores are negative (lower = better), negate for consistency
            return [(r[0], -r[1]) for r in rows]
        except sqlite3.OperationalError as e:
            logger.error("FTS5 search failed: %s", e)
            return []

    def search_hybrid(
        self,
        query: str,
        query_embedding: np.ndarray,
        top_k: int = 8,
        filter_paper_ids: list[str] | None = None,
        rrf_k: int = 60,
    ) -> list[tuple[str, float]]:
        """Hybrid retrieval: RRF fusion of vector + FTS5 results.

        Uses Reciprocal Rank Fusion to merge ranked lists.
        """
        # Get results from both methods
        vec_results = self.search_vector(query_embedding, top_k * 2, filter_paper_ids)
        fts_results = self.search_fts(query, top_k * 2, filter_paper_ids)

        # RRF fusion
        rrf_scores: dict[str, float] = {}

        for rank, (chunk_id, _score) in enumerate(vec_results):
            rrf_scores[chunk_id] = rrf_scores.get(chunk_id, 0.0) + 1.0 / (rrf_k + rank + 1)

        for rank, (chunk_id, _score) in enumerate(fts_results):
            rrf_scores[chunk_id] = rrf_scores.get(chunk_id, 0.0) + 1.0 / (rrf_k + rank + 1)

        # Sort by RRF score
        sorted_results = sorted(rrf_scores.items(), key=lambda x: x[1], reverse=True)
        return sorted_results[:top_k]

    def get_chunk(self, chunk_id: str) -> dict | None:
        """Get chunk data by ID."""
        conn = self._get_conn()
        row = conn.execute(
            """SELECT c.chunk_id, c.paper_id, c.content, c.page_number,
                      c.chunk_index, c.metadata_json,
                      pm.title, pm.authors, pm.year
               FROM chunks c
               LEFT JOIN paper_meta pm ON c.paper_id = pm.paper_id
               WHERE c.chunk_id = ?""",
            (chunk_id,),
        ).fetchone()

        if not row:
            return None

        return {
            "chunk_id": row[0],
            "paper_id": row[1],
            "content": row[2],
            "page_number": row[3],
            "chunk_index": row[4],
            "metadata": json.loads(row[5]) if row[5] else {},
            "title": row[6] or "",
            "authors": row[7] or "",
            "year": row[8],
        }

    def get_stats(self) -> dict:
        """Get database statistics."""
        conn = self._get_conn()
        try:
            chunk_count = conn.execute("SELECT COUNT(*) FROM chunks").fetchone()[0]
            paper_count = conn.execute(
                "SELECT COUNT(DISTINCT paper_id) FROM chunks"
            ).fetchone()[0]
        except sqlite3.OperationalError:
            chunk_count = 0
            paper_count = 0

        return {
            "total_chunks": chunk_count,
            "total_papers": paper_count,
            "db_path": self.db_path,
        }

    def close(self) -> None:
        if self._conn:
            self._conn.close()
            self._conn = None
