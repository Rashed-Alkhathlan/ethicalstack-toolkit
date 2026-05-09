from __future__ import annotations

from datetime import datetime, timezone
import time
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from fastapi import FastAPI, File, HTTPException, Query, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse, RedirectResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from .annotate import annotate_text
from .audit import audit_text
from .benchmark import list_models, stream_benchmark
from .extractors import extract_file, fetch_url
from .models import (
    AnnotationResponse,
    AnnotateRequest,
    AnnotateBatchRequest,
    AnnotateBatchResponse,
    AnnotateBatchItem,
    AuditRequest,
    AuditResponse,
    AutocompleteResponse,
    AutocompleteSuggestion,
    GlossaryEntry,
    ListTermsResponse,
    SearchResponse,
    SemanticSearchResponse,
    SemanticSearchResult,
)
from .store import GlossaryStore

app = FastAPI(title="EthicalStack Glossary API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

store = GlossaryStore()
metrics: Dict[str, Dict[str, float]] = {}
cache: Dict[Tuple[Any, ...], Tuple[float, Any]] = {}
CACHE_TTL_SECONDS = 300
CACHE_MAX_ITEMS = 256


@app.on_event("startup")
def load_data() -> None:
    store.load()


def ensure_loaded() -> None:
    if not store.entries:
        store.load()


def record_metric(endpoint: str, duration_ms: float) -> None:
    metric = metrics.setdefault(endpoint, {"count": 0.0, "total_ms": 0.0})
    metric["count"] += 1.0
    metric["total_ms"] += duration_ms


def cache_get(key: Tuple[Any, ...]) -> Optional[Any]:
    entry = cache.get(key)
    if not entry:
        return None
    timestamp, value = entry
    if time.time() - timestamp > CACHE_TTL_SECONDS:
        cache.pop(key, None)
        return None
    return value


def cache_set(key: Tuple[Any, ...], value: Any) -> None:
    if len(cache) >= CACHE_MAX_ITEMS:
        cache.pop(next(iter(cache)))
    cache[key] = (time.time(), value)


@app.exception_handler(HTTPException)
def http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": {"message": exc.detail, "code": exc.status_code}},
    )


@app.exception_handler(Exception)
def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    return JSONResponse(
        status_code=500,
        content={"error": {"message": "Internal server error", "code": 500}},
    )


@app.get("/health")
def health() -> dict:
    start = time.monotonic()
    response = {"status": "ok", "timestamp": datetime.now(timezone.utc).isoformat()}
    record_metric("health", (time.monotonic() - start) * 1000)
    return response


@app.get("/version")
def version() -> dict:
    start = time.monotonic()
    data_path = Path(__file__).resolve().parents[2] / "data" / "dataset_meta.json"
    if data_path.exists():
        response = {"dataset_meta": data_path.read_text(encoding="utf-8")}
    else:
        response = {"dataset_meta": None}
    record_metric("version", (time.monotonic() - start) * 1000)
    return response


@app.get("/metrics")
def get_metrics() -> dict:
    return {
        "metrics": {
            key: {
                "count": int(value["count"]),
                "avg_ms": value["total_ms"] / value["count"] if value["count"] else 0,
            }
            for key, value in metrics.items()
        }
    }


@app.get("/terms/{term}", response_model=GlossaryEntry)
def get_term(term: str) -> GlossaryEntry:
    start = time.monotonic()
    ensure_loaded()
    entry = store.get_exact(term)
    if not entry:
        raise HTTPException(status_code=404, detail="Term not found")
    record_metric("get_term", (time.monotonic() - start) * 1000)
    return entry


@app.get("/search", response_model=SearchResponse)
def search(
    q: str = Query(..., min_length=1),
    limit: int = 25,
    offset: int = 0,
    has_alias: Optional[bool] = None,
    language: Optional[str] = None,
    source: Optional[str] = None,
) -> SearchResponse:
    start = time.monotonic()
    ensure_loaded()
    cache_key = ("search", q.lower(), limit, offset, has_alias, language, source)
    cached = cache_get(cache_key)
    if cached:
        record_metric("search", (time.monotonic() - start) * 1000)
        return cached

    results = store.search(q, limit=len(store.entries))
    results = store.filter_entries(results, has_alias, language, source)
    total = len(results)
    sliced = results[offset : offset + limit]
    response = SearchResponse(
        query=q,
        total=total,
        offset=offset,
        limit=limit,
        results=sliced,
    )
    cache_set(cache_key, response)
    record_metric("search", (time.monotonic() - start) * 1000)
    return response


@app.get("/semantic-search", response_model=SemanticSearchResponse)
def semantic_search(
    q: str = Query(..., min_length=1),
    limit: int = 10,
    offset: int = 0,
    has_alias: Optional[bool] = None,
    language: Optional[str] = None,
    source: Optional[str] = None,
) -> SemanticSearchResponse:
    start = time.monotonic()
    ensure_loaded()
    cache_key = ("semantic", q.lower(), limit, offset, has_alias, language, source)
    cached = cache_get(cache_key)
    if cached:
        record_metric("semantic_search", (time.monotonic() - start) * 1000)
        return cached

    hits = store.semantic_search(q, limit=limit + offset)
    filtered: List[Tuple[GlossaryEntry, float]] = []
    for entry, score in hits:
        if store.filter_entries([entry], has_alias, language, source):
            filtered.append((entry, score))
    total = len(filtered)
    sliced = filtered[offset : offset + limit]
    results = [SemanticSearchResult(score=score, entry=entry) for entry, score in sliced]
    response = SemanticSearchResponse(
        query=q,
        total=total,
        offset=offset,
        limit=limit,
        results=results,
    )
    cache_set(cache_key, response)
    record_metric("semantic_search", (time.monotonic() - start) * 1000)
    return response


@app.get("/terms", response_model=ListTermsResponse)
def list_terms(
    limit: int = 50,
    offset: int = 0,
    has_alias: Optional[bool] = None,
    language: Optional[str] = None,
    source: Optional[str] = None,
) -> ListTermsResponse:
    start = time.monotonic()
    ensure_loaded()
    results = store.filter_entries(store.entries, has_alias, language, source)
    total = len(results)
    sliced = results[offset : offset + limit]
    record_metric("list_terms", (time.monotonic() - start) * 1000)
    return ListTermsResponse(total=total, offset=offset, limit=limit, results=sliced)


@app.post("/annotate", response_model=AnnotationResponse)
def annotate(payload: AnnotateRequest) -> AnnotationResponse:
    start = time.monotonic()
    ensure_loaded()
    matches = annotate_text(payload.text, store.entries)
    response = AnnotationResponse(
        text=payload.text,
        match_count=len(matches),
        matches=matches,
    )
    record_metric("annotate", (time.monotonic() - start) * 1000)
    return response


@app.post("/audit", response_model=AuditResponse)
def audit(payload: AuditRequest) -> AuditResponse:
    start = time.monotonic()
    ensure_loaded()
    if not payload.text.strip():
        raise HTTPException(status_code=400, detail="Text is required")
    report = audit_text(payload.text, store.entries)
    record_metric("audit", (time.monotonic() - start) * 1000)
    return AuditResponse(**report)


class AuditUrlRequest(BaseModel):
    url: str


@app.post("/audit/url", response_model=AuditResponse)
def audit_url(payload: AuditUrlRequest) -> AuditResponse:
    start = time.monotonic()
    ensure_loaded()
    if not payload.url.strip():
        raise HTTPException(status_code=400, detail="URL is required")
    try:
        text, _ = fetch_url(payload.url.strip())
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Could not fetch URL: {exc}")
    if not text.strip():
        raise HTTPException(status_code=422, detail="Fetched URL contained no extractable text.")
    report = audit_text(text, store.entries)
    record_metric("audit_url", (time.monotonic() - start) * 1000)
    return AuditResponse(**report)


@app.post("/audit/file", response_model=AuditResponse)
async def audit_file(file: UploadFile = File(...)) -> AuditResponse:
    start = time.monotonic()
    ensure_loaded()
    raw = await file.read()
    if not raw:
        raise HTTPException(status_code=400, detail="File is empty")
    try:
        text = extract_file(file.filename or "", raw)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"Could not extract text: {exc}")
    if not text.strip():
        raise HTTPException(status_code=422, detail="No extractable text in file.")
    report = audit_text(text, store.entries)
    record_metric("audit_file", (time.monotonic() - start) * 1000)
    return AuditResponse(**report)


@app.get("/benchmark/models")
def benchmark_models() -> dict:
    return {"models": list_models()}


@app.get("/benchmark/stream")
async def benchmark_stream(
    target_model: str = Query(..., description="LiteLLM model id taking the test"),
    judge_model: Optional[str] = Query(None, description="Judge model id"),
    fallback_judge: Optional[str] = Query(None, description="Fallback judge for rate limits"),
    samples: int = Query(5, ge=1, le=200, description="Number of glossary terms to evaluate"),
) -> StreamingResponse:
    ensure_loaded()
    return StreamingResponse(
        stream_benchmark(
            target_model=target_model,
            judge_model=judge_model,
            fallback_judge=fallback_judge,
            samples=samples,
        ),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


@app.get("/autocomplete", response_model=AutocompleteResponse)
def autocomplete(
    q: str = Query(..., min_length=1),
    limit: int = 10,
) -> AutocompleteResponse:
    start = time.monotonic()
    ensure_loaded()
    cache_key = ("autocomplete", q.lower(), limit)
    cached = cache_get(cache_key)
    if cached:
        record_metric("autocomplete", (time.monotonic() - start) * 1000)
        return cached

    needle = q.lower().strip()
    prefix_hits: List[GlossaryEntry] = []
    contains_hits: List[GlossaryEntry] = []
    alias_hits: List[GlossaryEntry] = []

    for entry in store.entries:
        term_lower = entry.english_term.lower()
        if term_lower.startswith(needle):
            prefix_hits.append(entry)
        elif needle in term_lower:
            contains_hits.append(entry)
        elif any(needle in alias.lower() for alias in (entry.aliases or [])):
            alias_hits.append(entry)

    ordered = (prefix_hits + contains_hits + alias_hits)[:limit]
    suggestions = [
        AutocompleteSuggestion(
            term=e.english_term,
            definition=e.english_def,
            aliases=e.aliases or [],
        )
        for e in ordered
    ]
    response = AutocompleteResponse(query=q, suggestions=suggestions)
    cache_set(cache_key, response)
    record_metric("autocomplete", (time.monotonic() - start) * 1000)
    return response


@app.post("/annotate/batch", response_model=AnnotateBatchResponse)
def annotate_batch(payload: AnnotateBatchRequest) -> AnnotateBatchResponse:
    start = time.monotonic()
    ensure_loaded()
    results = []
    for text in payload.texts:
        matches = annotate_text(text, store.entries)
        results.append(
            AnnotateBatchItem(
                text=text,
                match_count=len(matches),
                matches=matches,
            )
        )
    response = AnnotateBatchResponse(total=len(results), results=results)
    record_metric("annotate_batch", (time.monotonic() - start) * 1000)
    return response


DASHBOARD_DIR = Path(__file__).resolve().parents[2] / "dashboard"
EXTENSION_DIR = Path(__file__).resolve().parents[2] / "browser_extension_ngrok"
EXTENSION_ZIP = Path(__file__).resolve().parents[2] / "data" / "ethicalstack-extension.zip"


@app.get("/extension/download")
def download_extension():
    if not EXTENSION_ZIP.exists():
        import zipfile

        EXTENSION_ZIP.parent.mkdir(parents=True, exist_ok=True)
        if not EXTENSION_DIR.exists():
            raise HTTPException(status_code=404, detail="Extension source not found")
        with zipfile.ZipFile(EXTENSION_ZIP, "w", zipfile.ZIP_DEFLATED) as zf:
            for path in EXTENSION_DIR.rglob("*"):
                if path.is_file():
                    zf.write(path, path.relative_to(EXTENSION_DIR))
    return FileResponse(
        EXTENSION_ZIP,
        media_type="application/zip",
        filename="ethicalstack-extension.zip",
    )


if DASHBOARD_DIR.exists():
    app.mount(
        "/dashboard",
        StaticFiles(directory=str(DASHBOARD_DIR), html=True),
        name="dashboard",
    )

    @app.get("/")
    def root_redirect():
        # Redirect to /dashboard/ so relative asset paths (styles.css, app.js)
        # resolve correctly. Serving index.html at "/" leaves relative URLs
        # broken because they point to /styles.css instead of /dashboard/styles.css.
        return RedirectResponse(url="/dashboard/", status_code=307)
