from __future__ import annotations

import json
import os
import sys
import time
from collections import defaultdict, deque
from pathlib import Path
from typing import Any, Dict, List, Optional

from mcp.server.fastmcp import FastMCP

ROOT = Path(__file__).resolve().parents[1]
API_ROOT = ROOT / "api"
DATA_DIR = ROOT / "data"
META_PATH = DATA_DIR / "dataset_meta.json"

# Add the api directory to path so we can import the shared 'app' package
if str(API_ROOT) not in sys.path:
    sys.path.insert(0, str(API_ROOT))

from api.app.annotate import annotate_text
from api.app.store import GlossaryStore

mcp = FastMCP("EthicalStack Glossary")
store = GlossaryStore()
API_KEY_ENV = "ETHICALSTACK_API_KEY"
RATE_LIMIT_ENV = "ETHICALSTACK_RATE_LIMIT_PER_MIN"
LOG_LEVEL_ENV = "ETHICALSTACK_LOG_LEVEL"
DEFAULT_RATE_LIMIT = 120

request_history: dict[str, deque[float]] = defaultdict(deque)


def ensure_loaded() -> None:
    if not store.entries:
        store.load()


def require_api_key(api_key: Optional[str]) -> None:
    expected = os.getenv(API_KEY_ENV)
    if not expected:
        return
    if not api_key or api_key != expected:
        raise ValueError("Invalid API key")


def rate_limit(tool_name: str) -> None:
    limit_raw = os.getenv(RATE_LIMIT_ENV)
    if limit_raw is None:
        limit = DEFAULT_RATE_LIMIT
    else:
        try:
            limit = int(limit_raw)
        except ValueError as exc:
            raise ValueError("Invalid rate limit") from exc

    if limit <= 0:
        return

    window_seconds = 60.0
    now = time.time()
    history = request_history[tool_name]
    while history and now - history[0] > window_seconds:
        history.popleft()

    if len(history) >= limit:
        raise ValueError("Rate limit exceeded")

    history.append(now)


def log_event(tool: str, duration_ms: float, status: str) -> None:
    level = os.getenv(LOG_LEVEL_ENV, "info").lower()
    if level == "off":
        return

    payload = {
        "tool": tool,
        "status": status,
        "duration_ms": round(duration_ms, 2),
    }
    print(json.dumps(payload, ensure_ascii=False))


def get_dataset_meta() -> Optional[Dict[str, Any]]:
    if not META_PATH.exists():
        return None
    return json.loads(META_PATH.read_text(encoding="utf-8"))


def to_dict(entry: Any) -> Dict[str, Any]:
    if hasattr(entry, "model_dump"):
        return entry.model_dump()
    if isinstance(entry, dict):
        return entry
    return entry.__dict__


def filter_entries(
    entries: List[Any],
    has_alias: Optional[bool],
    language: Optional[str],
) -> List[Any]:
    results = entries
    if has_alias is not None:
        results = [
            entry
            for entry in results
            if bool(entry.aliases) == has_alias
        ]

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

    return results


@mcp.tool()
def health(api_key: Optional[str] = None) -> Dict[str, Any]:
    start = time.monotonic()
    try:
        require_api_key(api_key)
        rate_limit("health")
        ensure_loaded()
        return {
            "status": "ok",
            "entry_count": len(store.entries),
            "dataset_meta": get_dataset_meta(),
        }
    finally:
        log_event("health", (time.monotonic() - start) * 1000, "ok")


@mcp.tool()
def version(api_key: Optional[str] = None) -> Dict[str, Any]:
    start = time.monotonic()
    try:
        require_api_key(api_key)
        rate_limit("version")
        return {"dataset_meta": get_dataset_meta()}
    finally:
        log_event("version", (time.monotonic() - start) * 1000, "ok")


@mcp.tool()
def lookup_term(term: str, api_key: Optional[str] = None) -> Dict[str, Any]:
    start = time.monotonic()
    try:
        require_api_key(api_key)
        rate_limit("lookup_term")
        ensure_loaded()
        entry = store.get_exact(term)
        if not entry:
            return {"found": False, "term": term}
        return {"found": True, "entry": to_dict(entry)}
    finally:
        log_event("lookup_term", (time.monotonic() - start) * 1000, "ok")


@mcp.tool()
def search(q: str, limit: int = 25, api_key: Optional[str] = None) -> Dict[str, Any]:
    start = time.monotonic()
    try:
        require_api_key(api_key)
        rate_limit("search")
        ensure_loaded()
        results = store.search(q, limit=limit)
        return {"query": q, "total": len(results), "results": [to_dict(r) for r in results]}
    finally:
        log_event("search", (time.monotonic() - start) * 1000, "ok")


@mcp.tool()
def semantic_search(
    q: str,
    limit: int = 10,
    api_key: Optional[str] = None,
) -> Dict[str, Any]:
    start = time.monotonic()
    try:
        require_api_key(api_key)
        rate_limit("semantic_search")
        ensure_loaded()
        hits = store.semantic_search(q, limit=limit)
        results = [
            {"score": score, "entry": to_dict(entry)} for entry, score in hits
        ]
        return {"query": q, "total": len(results), "results": results}
    finally:
        log_event("semantic_search", (time.monotonic() - start) * 1000, "ok")


@mcp.tool()
def annotate(text: str, api_key: Optional[str] = None) -> Dict[str, Any]:
    start = time.monotonic()
    try:
        require_api_key(api_key)
        rate_limit("annotate")
        ensure_loaded()
        matches = annotate_text(text, store.entries)
        return {
            "text": text,
            "match_count": len(matches),
            "matches": [to_dict(m) for m in matches],
        }
    finally:
        log_event("annotate", (time.monotonic() - start) * 1000, "ok")


@mcp.tool()
def annotate_batch(texts: List[str], api_key: Optional[str] = None) -> Dict[str, Any]:
    start = time.monotonic()
    try:
        require_api_key(api_key)
        rate_limit("annotate_batch")
        ensure_loaded()
        results = []
        for text in texts:
            matches = annotate_text(text, store.entries)
            results.append(
                {
                    "text": text,
                    "match_count": len(matches),
                    "matches": [to_dict(m) for m in matches],
                }
            )
        return {"total": len(results), "results": results}
    finally:
        log_event("annotate_batch", (time.monotonic() - start) * 1000, "ok")


@mcp.tool()
def list_terms(
    limit: int = 50,
    offset: int = 0,
    has_alias: Optional[bool] = None,
    language: Optional[str] = None,
    api_key: Optional[str] = None,
) -> Dict[str, Any]:
    start = time.monotonic()
    try:
        require_api_key(api_key)
        rate_limit("list_terms")
        ensure_loaded()
        entries = filter_entries(store.entries, has_alias, language)
        total = len(entries)
        sliced = entries[offset : offset + limit]
        return {
            "total": total,
            "offset": offset,
            "limit": limit,
            "results": [to_dict(entry) for entry in sliced],
        }
    finally:
        log_event("list_terms", (time.monotonic() - start) * 1000, "ok")


@mcp.tool()
def stats(api_key: Optional[str] = None) -> Dict[str, Any]:
    start = time.monotonic()
    try:
        require_api_key(api_key)
        rate_limit("stats")
        ensure_loaded()
        return {
            "total_entries": len(store.entries),
            "with_aliases": sum(1 for entry in store.entries if entry.aliases),
            "with_arabic": sum(
                1
                for entry in store.entries
                if entry.arabic_term or entry.arabic_def
            ),
            "with_french": sum(
                1
                for entry in store.entries
                if entry.french_term or entry.french_def
            ),
        }
    finally:
        log_event("stats", (time.monotonic() - start) * 1000, "ok")


if __name__ == "__main__":
    mcp.run()
