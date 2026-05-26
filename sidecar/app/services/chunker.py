"""ResearchOS Sidecar - PDF text extraction and chunking service."""
from __future__ import annotations

import re
import uuid
from dataclasses import dataclass

from app.config import settings


@dataclass
class Chunk:
    """A text chunk from a document."""
    id: str
    paper_id: str
    content: str
    page_number: int | None
    chunk_index: int
    metadata: dict


def extract_text_from_pdf(file_path: str) -> list[tuple[int, str]]:
    """Extract text from PDF, return list of (page_number, text)."""
    import fitz  # PyMuPDF

    pages: list[tuple[int, str]] = []
    doc = fitz.open(file_path)
    for page_num in range(len(doc)):
        page = doc[page_num]
        text = page.get_text("text")
        if text.strip():
            pages.append((page_num + 1, text))
    doc.close()
    return pages


def clean_text(text: str) -> str:
    """Clean extracted text: normalize whitespace, remove control chars."""
    # Remove control characters except newline and tab
    text = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]", "", text)
    # Normalize whitespace
    text = re.sub(r"[ \t]+", " ", text)
    # Remove excessive newlines
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def chunk_text(
    text: str,
    chunk_size: int = settings.chunk_size,
    chunk_overlap: int = settings.chunk_overlap,
) -> list[str]:
    """Split text into overlapping chunks by character count.

    Respects sentence boundaries when possible.
    """
    if len(text) <= chunk_size:
        return [text]

    chunks: list[str] = []
    start = 0

    while start < len(text):
        end = start + chunk_size

        # If not at the end, try to break at a sentence boundary
        if end < len(text):
            # Look for sentence-ending punctuation within a window
            search_window = text[end - min(100, chunk_overlap * 2) : end + 50]
            # Try to find period, question mark, or exclamation followed by space or newline
            sentence_end = re.search(r"[.!?][\s\n]", search_window)
            if sentence_end:
                end = end - min(100, chunk_overlap * 2) + sentence_end.end()
        else:
            end = len(text)

        chunk = text[start:end].strip()
        if chunk:
            chunks.append(chunk)

        # Move forward, accounting for overlap
        start = end - chunk_overlap if end < len(text) else end

    return chunks


def chunk_pdf(file_path: str, paper_id: str) -> list[Chunk]:
    """Full pipeline: extract PDF text → clean → chunk.

    Returns a list of Chunk objects ready for embedding.
    """
    pages = extract_text_from_pdf(file_path)
    all_chunks: list[Chunk] = []

    for page_num, raw_text in pages:
        text = clean_text(raw_text)
        if not text:
            continue

        text_chunks = chunk_text(text)
        for idx, chunk_content in enumerate(text_chunks):
            chunk = Chunk(
                id=str(uuid.uuid4()),
                paper_id=paper_id,
                content=chunk_content,
                page_number=page_num,
                chunk_index=len(all_chunks),
                metadata={
                    "source": "pdf",
                    "page": page_num,
                },
            )
            all_chunks.append(chunk)

    return all_chunks
