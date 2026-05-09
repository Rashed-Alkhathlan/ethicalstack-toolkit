"""Ethical AI Usage Auditor.

Audits whether AI is being used ethically and responsibly in a concrete
real-world context (research paper, model card, product spec, deployment
plan, syllabus, grant proposal). Grounded in the ICAIRE multilingual
ethical-AI glossary — the auditor reasons over the glossary concepts
present in the text and flags ethical concerns that are silently missing.

Backed by Gemini 3.1 Flash Lite Preview via the official ``google-genai``
SDK when ``GEMINI_API_KEY`` is set, with a deterministic keyword fallback
otherwise so the endpoint always returns a valid report.
"""

from __future__ import annotations

import json
import logging
import os
from typing import Any, Dict, List, Optional
from dotenv import load_dotenv

from .annotate import annotate_text
from .models import GlossaryEntry

log = logging.getLogger(__name__)

# Lazy import — keeps the API importable when the SDK isn't installed yet.
try:  # pragma: no cover - import guard
    from google import genai as _genai
    from google.genai import types as _genai_types
except ImportError:  # pragma: no cover
    _genai = None
    _genai_types = None


# ---- Audit dimensions -------------------------------------------------------
# Ethical & responsible AI-usage dimensions, aligned with the ICAIRE
# multilingual ethical-AI glossary. Each dimension asks: "is this AI being
# used ethically and responsibly along this axis, in this concrete context?"

AUDIT_DIMENSIONS: Dict[str, Dict[str, Any]] = {
    "bias_fairness": {
        "label": "Bias & Fairness",
        "description": "Does the use account for disparate impact, demographic parity, and discriminatory outcomes against protected or vulnerable groups?",
        "keywords": [
            "bias", "fairness", "discrimination", "disparate", "equity",
            "demographic", "parity", "stereotype", "imbalance", "minority",
            "protected attribute", "equal opportunity",
        ],
    },
    "privacy_data_protection": {
        "label": "Privacy & Data Protection",
        "description": "Are PII handling, consent, anonymization, and applicable regulations (GDPR/PDPL/etc.) addressed for this real-world use?",
        "keywords": [
            "privacy", "anonym", "differential privacy", "pii", "consent",
            "gdpr", "pdpl", "data protection", "pseudonym", "confidential",
            "leakage", "membership inference", "encryption",
        ],
    },
    "transparency_explainability": {
        "label": "Transparency & Explainability",
        "description": "Is the system's behaviour disclosed and explainable to users, regulators, and affected people — model cards, datasheets, decision rationale?",
        "keywords": [
            "explain", "interpret", "transparen", "black-box", "black box",
            "xai", "shap", "lime", "saliency", "feature importance",
            "model card", "datasheet", "disclos",
        ],
    },
    "accountability_governance": {
        "label": "Accountability & Governance",
        "description": "Who is responsible if it goes wrong, and how is the use audited, governed, and brought into compliance with applicable standards?",
        "keywords": [
            "accountab", "governance", "audit", "compliance", "regulat",
            "responsib", "stewardship", "policy", "standard", "iso",
            "ownership",
        ],
    },
    "human_oversight": {
        "label": "Human Oversight & Autonomy",
        "description": "Where humans review, override, or contest the system, and whether affected people retain meaningful agency over outcomes that concern them.",
        "keywords": [
            "human-in-the-loop", "human in the loop", "oversight",
            "human control", "autonomy", "override", "contest", "appeal",
            "review", "decision support",
        ],
    },
    "safety_robustness": {
        "label": "Safety & Robustness",
        "description": "Adversarial robustness, alignment, reliability under distribution shift, and the failure modes acknowledged for this use case.",
        "keywords": [
            "safety", "robust", "adversarial", "alignment", "reliab",
            "perturbation", "attack", "jailbreak", "red team", "stress test",
            "out-of-distribution", "ood", "hallucinat",
        ],
    },
    "cultural_linguistic_inclusivity": {
        "label": "Cultural & Linguistic Inclusivity",
        "description": "Multilingual coverage, low-resource languages, cultural framing, translation fidelity, and representation of non-English and non-Western contexts.",
        "keywords": [
            "language", "multilingual", "translat", "low-resource",
            "low resource", "culture", "cultural", "representation",
            "localization", "dialect", "underrepresented", "arabic",
        ],
    },
    "misuse_dual_use": {
        "label": "Misuse & Dual-Use Risk",
        "description": "Plausible abuse vectors — deepfakes, manipulation, deception, weaponization, fraud — and what mitigations are described for this deployment.",
        "keywords": [
            "misuse", "deepfake", "manipulat", "deception", "disinformation",
            "abuse", "weaponiz", "malicious", "fraud", "guardrail",
        ],
    },
    "stakeholder_impact": {
        "label": "Stakeholder Impact & Inclusion",
        "description": "Who is affected, power asymmetries, opt-out paths, and impact on vulnerable groups, with mechanisms for redress.",
        "keywords": [
            "user", "stakeholder", "affected", "impact", "vulnerable",
            "opt-out", "redress", "harm", "consent", "community",
        ],
    },
    "sustainability_lifecycle": {
        "label": "Sustainability & Lifecycle",
        "description": "Environmental footprint of training and inference, plus retraining cadence, ownership, sunset criteria, and post-deployment monitoring over the system's lifetime.",
        "keywords": [
            "carbon", "energy", "sustainab", "footprint", "compute cost",
            "green ai", "efficien", "retrain", "version", "update",
            "sunset", "deprecat", "monitor",
        ],
    },
}


# ---- Gemini integration -----------------------------------------------------

load_dotenv()

GEMINI_MODEL = os.environ.get("GEMINI_MODEL", "gemini-3.1-flash-lite-preview")
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
GEMINI_TIMEOUT = float(os.environ.get("GEMINI_TIMEOUT", "300"))

# Cache the client — google-genai's Client is cheap but reusing avoids redoing
# auth handshakes per call.
_client: Optional["_genai.Client"] = None


def _get_client() -> Optional["_genai.Client"]:
    global _client
    if not GEMINI_API_KEY or _genai is None:
        return None
    if _client is None:
        _client = _genai.Client(api_key=GEMINI_API_KEY)
    return _client


SYSTEM_PROMPT = """You are an Ethical AI Usage Auditor for the ICAIRE ethical-AI glossary project. You audit whether AI is being used ethically and responsibly in a concrete real-world context — research papers, model cards, product specs, deployment plans, syllabi, grant proposals — NOT abstract ethics theory.

Your reasoning is GROUNDED in the multilingual ICAIRE ethical-AI glossary. The user message will include a list of glossary terms detected in the text. Treat those terms as your primary evidence anchors: if a term from a glossary entry appears in the text, the corresponding ethical concept is at least named, and you should reason about HOW WELL it is actually addressed (not just whether the word appears). If a glossary concept is conspicuously absent given the use case, flag it as a gap.

Score the text ONLY on the evidence present in it. Reward concrete, falsifiable claims about responsible usage; penalize hand-waving, ethics-washing, and silence on dimensions that clearly apply to this use case.

For EACH of the 10 dimensions return:
- present (bool): whether the text engages with this dimension at all
- score (float 0.0-1.0): how ethically/responsibly this dimension is handled (0 = absent or harmful, 1 = exemplary)
- evidence (list of <=3 short quoted phrases from the text)
- glossary_terms (list of <=4 glossary terms from the provided list that are relevant to this dimension — exact strings from the list, or [])
- gaps (list of <=2 short specific gaps, one sentence each, tied to THIS text)
- recommendation (one concrete change tied to THIS text — name the responsible-AI practice the user should adopt; no generic advice)

Output STRICT JSON, no prose, no markdown fences, with this exact shape:

{
  "summary": "2-3 sentences referring to specifics in the text and naming the most important ethical concerns for this use case",
  "overall_severity": "low" | "medium" | "high",
  "coverage_score": 0.0-1.0,
  "dimensions": {
    "<dimension_key>": {"present": bool, "score": 0.0-1.0, "evidence": [str], "glossary_terms": [str], "gaps": [str], "recommendation": str}
  }
}

Severity guide:
- low  = AI is being used responsibly with minor gaps a reviewer can note in passing
- medium = significant ethical gaps a reviewer should flag before approval
- high = ethically problematic, unsafe, or undocumented in ways a reviewer must escalate before this use proceeds

The dimension keys are EXACTLY: bias_fairness, privacy_data_protection, transparency_explainability, accountability_governance, human_oversight, safety_robustness, cultural_linguistic_inclusivity, misuse_dual_use, stakeholder_impact, sustainability_lifecycle."""


def _build_user_message(text: str, matched_terms: List[str]) -> str:
    if matched_terms:
        glossary_block = "\n".join(f"- {t}" for t in matched_terms)
        glossary_section = (
            "Glossary terms detected in the text (use these as evidence anchors):\n"
            f"{glossary_block}\n\n"
        )
    else:
        glossary_section = (
            "Glossary terms detected in the text: (none — note this in your "
            "summary; an ethical-AI use case that names zero glossary concepts "
            "is itself a coverage signal)\n\n"
        )
    return (
        f"{glossary_section}"
        "Audit the following text for ethical & responsible AI usage:\n\n"
        f"{text}"
    )


def _call_gemini(text: str, matched_terms: List[str]) -> Optional[Dict[str, Any]]:
    """Call Gemini via the official google-genai SDK.

    Returns parsed JSON dict, or None on any failure so the caller can fall
    back to the keyword scan.
    """
    client = _get_client()
    if client is None or _genai_types is None:
        return None

    config = _genai_types.GenerateContentConfig(
        system_instruction=SYSTEM_PROMPT,
        temperature=0.2,
        response_mime_type="application/json",
        max_output_tokens=2048,
        http_options=_genai_types.HttpOptions(timeout=int(GEMINI_TIMEOUT * 1000)),
    )
    try:
        response = client.models.generate_content(
            model=GEMINI_MODEL,
            contents=_build_user_message(text, matched_terms),
            config=config,
        )
    except Exception as exc:  # google-genai surfaces multiple error types
        log.warning("Gemini call failed: %s", exc)
        return None

    raw = getattr(response, "text", None)
    if not raw:
        log.warning("Gemini returned empty response")
        return None
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError as exc:
        log.warning("Gemini JSON parse failed: %s", exc)
        return None
    if not isinstance(parsed, dict) or "dimensions" not in parsed:
        log.warning("Gemini response missing 'dimensions'")
        return None
    return parsed


# ---- Heuristic fallback -----------------------------------------------------

def _keyword_dimension_scan(text: str) -> Dict[str, Dict[str, Any]]:
    lower = text.lower()
    out: Dict[str, Dict[str, Any]] = {}
    for key, meta in AUDIT_DIMENSIONS.items():
        hits = [kw for kw in meta["keywords"] if kw in lower]
        present = bool(hits)
        score = min(1.0, len(hits) / 3.0) if present else 0.0
        out[key] = {
            "present": present,
            "score": round(score, 3),
            "evidence": hits[:3],
            "glossary_terms": [],
            "gaps": []
            if present
            else [f"{meta['label']} is not addressed in the text."],
            "recommendation": (
                f"Strengthen the discussion of {meta['label'].lower()} with concrete details from this use case."
                if present
                else f"Add a section addressing {meta['label'].lower()} — currently absent given this use case."
            ),
        }
    return out


def _severity_for(score: float) -> str:
    if score >= 0.6:
        return "low"
    if score >= 0.3:
        return "medium"
    return "high"


# ---- Public API -------------------------------------------------------------

def audit_text(text: str, entries: List[GlossaryEntry]) -> Dict[str, Any]:
    matches = annotate_text(text, entries)
    matched_terms_unique: List[str] = []
    seen = set()
    for m in matches:
        if m.term not in seen:
            matched_terms_unique.append(m.term)
            seen.add(m.term)

    llm_result = _call_gemini(text, matched_terms_unique)
    backend = "gemini" if llm_result else "keyword"

    if llm_result:
        dimensions = llm_result.get("dimensions", {})
        summary = llm_result.get("summary") or ""
        overall_severity = llm_result.get("overall_severity") or ""
        coverage_score = float(llm_result.get("coverage_score") or 0.0)
    else:
        dimensions = _keyword_dimension_scan(text)
        present_count = sum(1 for d in dimensions.values() if d.get("present"))
        coverage_score = present_count / len(AUDIT_DIMENSIONS)
        overall_severity = _severity_for(coverage_score)
        if _genai is None:
            reason = "google-genai SDK not installed (`pip install google-genai`)"
        elif not GEMINI_API_KEY:
            reason = "GEMINI_API_KEY not set"
        else:
            reason = "Gemini call failed — see server logs"
        summary = (
            f"Heuristic audit ({reason}). The text engages with "
            f"{present_count}/{len(AUDIT_DIMENSIONS)} ethical-AI usage dimensions. "
            f"Configure {GEMINI_MODEL} for evidence-grounded scoring."
        )

    categories_out: List[Dict[str, Any]] = []
    for key, meta in AUDIT_DIMENSIONS.items():
        d = dimensions.get(key) or {}
        present = bool(d.get("present"))
        score = float(d.get("score") or 0.0)
        evidence = list(d.get("evidence") or [])[:3]
        cat_gaps = list(d.get("gaps") or [])[:2]
        recommendation = d.get("recommendation") or ""

        if score >= 0.6:
            severity = "ok"
        elif score >= 0.3:
            severity = "warn"
        else:
            severity = "gap"

        # Glossary terms tied to this dimension. Prefer what the LLM picked
        # (it has read the text), then fill in any keyword-matched glossary
        # terms whose definitions intersect this dimension's keywords.
        llm_terms = list(d.get("glossary_terms") or [])
        keyword_terms: List[str] = []
        for m in matches:
            entry = next(
                (e for e in entries if e.english_term.lower() == m.term.lower()),
                None,
            )
            if not entry:
                continue
            haystack = " ".join(
                filter(None, [entry.english_term, entry.english_def, " ".join(entry.aliases or [])])
            ).lower()
            if any(kw in haystack for kw in meta["keywords"]):
                if m.term not in keyword_terms:
                    keyword_terms.append(m.term)

        merged_terms: List[str] = []
        for t in llm_terms + keyword_terms:
            if t and t not in merged_terms:
                merged_terms.append(t)

        categories_out.append(
            {
                "key": key,
                "label": meta["label"],
                "description": meta["description"],
                "matched_terms": merged_terms,
                "match_count": len(merged_terms),
                "present": present,
                "score": round(score, 3),
                "severity": severity,
                "recommendation": recommendation,
                "evidence": evidence,
                "category_gaps": cat_gaps,
            }
        )

    word_count = len(text.split()) or 1
    density = len(matches) / word_count
    gaps = [c["label"] for c in categories_out if not c["present"]]
    strengths = [c["label"] for c in categories_out if c["present"]]

    if not summary:
        summary = (
            f"Ethical AI usage audit: {len(strengths)}/{len(categories_out)} "
            f"dimensions addressed. Overall severity: {overall_severity or 'medium'}."
        )
    if not overall_severity:
        overall_severity = _severity_for(coverage_score)

    return {
        "summary": summary,
        "overall_severity": overall_severity,
        "coverage_score": round(coverage_score, 3),
        "term_density": round(density, 4),
        "word_count": word_count,
        "match_count": len(matches),
        "matches": [m.model_dump() for m in matches],
        "categories": categories_out,
        "gaps": gaps,
        "strengths": strengths,
        "backend": backend,
        "model": GEMINI_MODEL if backend == "gemini" else None,
    }
