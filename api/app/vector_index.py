from __future__ import annotations

from pathlib import Path
from typing import Iterable, List, Tuple

import chromadb
from sentence_transformers import SentenceTransformer

from .models import GlossaryEntry

ROOT = Path(__file__).resolve().parents[2]
PERSIST_DIR = ROOT / "data" / "chroma"
COLLECTION_NAME = "glossary_terms"
MODEL_NAME = "sentence-transformers/all-MiniLM-L6-v2"


class GlossaryVectorIndex:
    def __init__(self) -> None:
        self.client = chromadb.PersistentClient(path=str(PERSIST_DIR))
        self.collection = self.client.get_or_create_collection(
            name=COLLECTION_NAME,
            metadata={"hnsw:space": "cosine"},
        )
        self.model = SentenceTransformer(MODEL_NAME)

    def ensure_index(self, entries: Iterable[GlossaryEntry]) -> None:
        if self.collection.count() > 0:
            return

        entry_list = list(entries)
        if not entry_list:
            return

        ids: List[str] = []
        documents: List[str] = []
        metadatas: List[dict] = []

        for entry in entry_list:
            term = entry.english_term
            text = entry.english_def or entry.english_term
            ids.append(term.lower())
            documents.append(text)
            metadatas.append({"english_term": term})

        embeddings = self.model.encode(documents, normalize_embeddings=True).tolist()
        self.collection.add(
            ids=ids,
            documents=documents,
            metadatas=metadatas,
            embeddings=embeddings,
        )

    def search(self, query: str, limit: int = 10) -> List[Tuple[str, float]]:
        if not query.strip():
            return []

        embedding = self.model.encode([query], normalize_embeddings=True).tolist()
        results = self.collection.query(
            query_embeddings=embedding,
            n_results=limit,
        )

        terms = results.get("metadatas", [[]])[0]
        distances = results.get("distances", [[]])[0]
        output: List[Tuple[str, float]] = []
        for metadata, distance in zip(terms, distances, strict=False):
            term = metadata.get("english_term") if metadata else None
            if term:
                output.append((term, float(distance)))
        return output
