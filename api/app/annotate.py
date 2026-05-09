from __future__ import annotations

import re
from typing import List, Tuple

from .models import AnnotationMatch, GlossaryEntry


def annotate_text(text: str, entries: List[GlossaryEntry]) -> List[AnnotationMatch]:
    if not text.strip():
        return []

    candidates: List[AnnotationMatch] = []
    for entry in entries:
        term = entry.english_term
        if not term:
            continue
        alias_values = [term] + (entry.aliases or [])
        unique_aliases = []
        seen = set()
        for alias in alias_values:
            key = alias.lower().strip()
            if not key or key in seen:
                continue
            unique_aliases.append(alias)
            seen.add(key)

        for alias in unique_aliases:
            pattern = re.compile(r"\b" + re.escape(alias) + r"\b", re.IGNORECASE)
            for match in pattern.finditer(text):
                candidates.append(
                    AnnotationMatch(
                        term=term,
                        start=match.start(),
                        end=match.end(),
                        matched_text=match.group(0),
                        definition=entry.english_def,
                    )
                )

    candidates.sort(key=lambda m: (-(m.end - m.start), m.start))
    selected: List[AnnotationMatch] = []
    occupied: List[Tuple[int, int]] = []

    for match in candidates:
        overlaps = any(
            not (match.end <= start or match.start >= end) for start, end in occupied
        )
        if overlaps:
            continue
        selected.append(match)
        occupied.append((match.start, match.end))

    selected.sort(key=lambda m: (m.start, m.end))
    return selected
