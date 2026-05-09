"""Live benchmark runner backing the dashboard Evaluator page.

Wraps `evals/evaluator.py::LLMEvaluator` and streams per-item progress to the
browser as Server-Sent Events so the user can pick a model and watch the score
land in real time.
"""
from __future__ import annotations

import asyncio
import json
import os
import sys
import time
from pathlib import Path
from typing import Any, AsyncIterator, Dict, List, Optional

ROOT = Path(__file__).resolve().parents[2]
EVALS_DIR = ROOT / "evals"
GLOSSARY_PATH = ROOT / "data" / "glossary.json"

if str(EVALS_DIR) not in sys.path:
    sys.path.insert(0, str(EVALS_DIR))


# Curated catalogue surfaced in the dashboard. Mirrors the model strings the
# `evals/run_benchmark.py` CLI accepts via --target-model / --judge-model.
AVAILABLE_MODELS: List[Dict[str, Any]] = [
    {
        "id": "groq/openai/gpt-oss-safeguard-20b",
        "label": "Groq · GPT-OSS Safeguard 20B",
        "provider": "groq",
        "env": "GROQ_API_KEY",
        "default": True,
    },
    {
        "id": "groq/llama-3.1-8b-instant",
        "label": "Groq · Llama 3.1 8B Instant",
        "provider": "groq",
        "env": "GROQ_API_KEY",
    },
    {
        "id": "groq/llama-3.3-70b-versatile",
        "label": "Groq · Llama 3.3 70B Versatile",
        "provider": "groq",
        "env": "GROQ_API_KEY",
    },
    {
        "id": "groq/mixtral-8x7b-32768",
        "label": "Groq · Mixtral 8x7B",
        "provider": "groq",
        "env": "GROQ_API_KEY",
    },
    {
        "id": "gemini/gemini-2.5-flash",
        "label": "Gemini · 2.5 Flash",
        "provider": "gemini",
        "env": "GEMINI_API_KEY",
    },
    {
        "id": "gemini/gemini-2.5-pro",
        "label": "Gemini · 2.5 Pro",
        "provider": "gemini",
        "env": "GEMINI_API_KEY",
    },
    {
        "id": "gemini/gemini-3.1-flash-lite-preview",
        "label": "Gemini · 3.1 Flash Lite Preview",
        "provider": "gemini",
        "env": "GEMINI_API_KEY",
    },
    {
        "id": "gemini/gemma-3-27b",
        "label": "Gemini · Gemma 3 27B",
        "provider": "gemini",
        "env": "GEMINI_API_KEY",
    },
    {
        "id": "openai/gpt-4o-mini",
        "label": "OpenAI · GPT-4o mini",
        "provider": "openai",
        "env": "OPENAI_API_KEY",
    },
    {
        "id": "openai/gpt-4o",
        "label": "OpenAI · GPT-4o",
        "provider": "openai",
        "env": "OPENAI_API_KEY",
    },
    {
        "id": "anthropic/claude-haiku-4-5-20251001",
        "label": "Anthropic · Claude Haiku 4.5",
        "provider": "anthropic",
        "env": "ANTHROPIC_API_KEY",
    },
    {
        "id": "anthropic/claude-sonnet-4-5-20250929",
        "label": "Anthropic · Claude Sonnet 4.5",
        "provider": "anthropic",
        "env": "ANTHROPIC_API_KEY",
    },
]

DEFAULT_JUDGE = "gemini/gemini-2.5-flash"


def list_models() -> List[Dict[str, Any]]:
    """Return the catalogue annotated with whether each model's API key is set."""
    return [
        {
            **model,
            "available": bool(os.environ.get(model.get("env", ""))) if model.get("env") else True,
        }
        for model in AVAILABLE_MODELS
    ]


def _load_dataset(samples: int) -> List[Dict[str, Any]]:
    if not GLOSSARY_PATH.exists():
        raise FileNotFoundError(f"Glossary dataset missing: {GLOSSARY_PATH}")
    data = json.loads(GLOSSARY_PATH.read_text(encoding="utf-8"))
    eligible = [
        item for item in data
        if (item.get("english_term") or "").strip()
        and (item.get("arabic_def") or "").strip()
    ]
    if samples and samples > 0:
        return eligible[:samples]
    return eligible


def _sse(event: Dict[str, Any]) -> bytes:
    return f"data: {json.dumps(event, ensure_ascii=False)}\n\n".encode("utf-8")


async def stream_benchmark(
    target_model: str,
    judge_model: Optional[str] = None,
    fallback_judge: Optional[str] = None,
    samples: int = 5,
) -> AsyncIterator[bytes]:
    """Yield Server-Sent Events for a live benchmark run."""

    judge_model = judge_model or DEFAULT_JUDGE
    samples = max(1, min(samples or 5, 200))

    try:
        from evaluator import LLMEvaluator  # type: ignore[import-not-found]
    except ImportError as exc:
        yield _sse({
            "type": "error",
            "message": f"Cannot import evals.evaluator: {exc}. Install evals/requirements.txt.",
        })
        return

    try:
        dataset = _load_dataset(samples)
    except Exception as exc:
        yield _sse({"type": "error", "message": str(exc)})
        return

    if not dataset:
        yield _sse({"type": "error", "message": "Dataset is empty after filtering."})
        return

    evaluator = LLMEvaluator(
        target_model=target_model,
        judge_model=judge_model,
        fallback_judge_model=fallback_judge,
    )

    started = time.monotonic()
    yield _sse({
        "type": "started",
        "target_model": target_model,
        "judge_model": judge_model,
        "fallback_judge": fallback_judge,
        "total": len(dataset),
    })

    results: List[Dict[str, Any]] = []
    for index, item in enumerate(dataset):
        term = (item.get("english_term") or "").strip()
        ground_truth = (item.get("arabic_def") or "").strip()

        yield _sse({"type": "item_start", "index": index, "term": term})

        try:
            explanation = await asyncio.to_thread(evaluator.generate_explanation, term)
            score = await asyncio.to_thread(
                evaluator.score_explanation, term, explanation, ground_truth
            )
        except Exception as exc:
            yield _sse({
                "type": "item_error",
                "index": index,
                "term": term,
                "message": str(exc),
            })
            results.append({
                "term": term,
                "ground_truth": ground_truth,
                "generated_explanation": "",
                "score": -1,
                "error": str(exc),
            })
            continue

        result = {
            "term": term,
            "ground_truth": ground_truth,
            "generated_explanation": explanation,
            "score": int(score) if isinstance(score, (int, float)) else -1,
        }
        results.append(result)
        yield _sse({
            "type": "item_done",
            "index": index,
            "total": len(dataset),
            "term": term,
            "ground_truth": ground_truth,
            "explanation": explanation,
            "score": result["score"],
        })

    valid_scores = [r["score"] for r in results if r["score"] > 0]
    avg = sum(valid_scores) / len(valid_scores) if valid_scores else 0.0
    histogram = {n: 0 for n in range(1, 6)}
    for s in valid_scores:
        histogram[s] = histogram.get(s, 0) + 1

    yield _sse({
        "type": "done",
        "target_model": target_model,
        "judge_model": judge_model,
        "total": len(results),
        "scored": len(valid_scores),
        "average_score": round(avg, 3),
        "histogram": histogram,
        "duration_seconds": round(time.monotonic() - started, 2),
        "results": results,
    })
