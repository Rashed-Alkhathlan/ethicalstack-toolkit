from __future__ import annotations

import json
from pathlib import Path
from typing import Dict, List, Optional

from .models import GlossaryEntry
from .vector_index import GlossaryVectorIndex

ROOT = Path(__file__).resolve().parents[2]
DATA_PATH = ROOT / "data" / "glossary.json"


class GlossaryStore:
    def __init__(self) -> None:
        self.entries: List[GlossaryEntry] = []
        self.by_term_lower: Dict[str, GlossaryEntry] = {}
        self.vector_index = GlossaryVectorIndex()

    def load(self) -> None:
        if not DATA_PATH.exists():
            raise FileNotFoundError(f"Missing glossary data: {DATA_PATH}")
        data = json.loads(DATA_PATH.read_text(encoding="utf-8"))
        self.entries = [GlossaryEntry(**row) for row in data]
        self.by_term_lower = {e.english_term.lower(): e for e in self.entries}
        self.vector_index.ensure_index(self.entries)

    def get_exact(self, term: str) -> GlossaryEntry | None:
        return self.by_term_lower.get(term.lower())

    def search(self, query: str, limit: int = 25) -> List[GlossaryEntry]:
        query_lower = query.lower()
        results = [
            entry
            for entry in self.entries
            if query_lower in entry.english_term.lower()
            or (entry.english_def and query_lower in entry.english_def.lower())
            or any(query_lower in alias.lower() for alias in (entry.aliases or []))
        ]
        return results[:limit]

    def filter_entries(
        self,
        entries: List[GlossaryEntry],
        has_alias: Optional[bool] = None,
        language: Optional[str] = None,
        source: Optional[str] = None,
    ) -> List[GlossaryEntry]:
        results = entries
        if has_alias is not None:
            results = [entry for entry in results if bool(entry.aliases) == has_alias]

        if language:
            lang = language.lower()
            if lang == "arabic":
                results = [
                    entry
                    for entry in results
                    if entry.arabic_term or entry.arabic_def
                ]
            elif lang == "french":
                results = [
                    entry
                    for entry in results
                    if entry.french_term or entry.french_def
                ]
            elif lang == "english":
                results = [entry for entry in results if entry.english_term]

        if source:
            source_lower = source.lower()
            results = [
                entry
                for entry in results
                if any(source_lower in src.lower() for src in entry.sources)
            ]

        return results

    def semantic_search(self, query: str, limit: int = 10) -> List[tuple[GlossaryEntry, float]]:
        hits = self.vector_index.search(query, limit=limit)
        results: List[tuple[GlossaryEntry, float]] = []
        for term, score in hits:
            entry = self.by_term_lower.get(term.lower())
            if entry:
                results.append((entry, score))
        return results
