# EthicalStack — A Toolkit Built On The ICAIRE AI & Data Glossary

## Subtitle (one sentence, < 140 characters)

A toolkit built on the ICAIRE trilingual ethical-AI glossary: API, MCP server, browser extension, dashboard auditor, CLI, and SDKs.

*(130 characters)*

---

## Executive Summary

EthicalStack turns the ICAIRE AI & Data Glossary into a usable infrastructure layer for ethical AI: searchable APIs, semantic retrieval, browser integration, LLM tooling via the Model Context Protocol (MCP), an ethical-risk auditor, SDKs, and a multilingual evaluation benchmark.

Built around 1,242 normalized glossary entries in English, Arabic, and French, it makes ethical-AI terminology directly accessible inside dashboards, IDEs, terminals, browsers, and AI assistants — and lets an LLM client answer questions about those terms from the glossary itself instead of relying on the model's parametric memory.

---

## Why It Matters

- **Reduces hallucinated and inconsistent AI definitions** by giving LLM clients a grounded, retrieval-backed source through MCP.
- **Improves Arabic ethical-AI terminology coverage** in language models, and provides a benchmark to measure it.
- **Bridges policy, education, and engineering tooling** — the same dataset feeds a regulator-friendly audit report, a student-facing dashboard, and a developer-facing SDK.
- **Enables offline and reproducible auditing**: every run is tied to a SHA-256 dataset hash, and the auditor has a deterministic mode that needs no API key.
- **Meets practitioners where they already work** — a web page, a terminal, an IDE, an LLM client — instead of asking them to learn a new tool.

---

## What's In The Project

**Ethical & Cultural Risk Auditor (`api/app/audit.py` + dashboard).** Paste a research abstract, model card, syllabus, grant proposal, or product spec into the dashboard and the auditor returns a structured report scored across **ten ethical risk dimensions**: Bias & Fairness, Privacy & Data Protection, Transparency & Explainability, Accountability & Governance, Safety & Robustness, Human Oversight & Autonomy, Cultural & Linguistic Risks, Environmental Impact, Misuse & Dual-Use, and Data Quality & Provenance. Two modes: when a `GEMINI_API_KEY` is provided it calls Gemini 3.1 Flash Lite for richer narrative findings; without a key it falls back to a deterministic, glossary-grounded scorer that runs offline. Every flag in the report is tied to a specific glossary term that appeared in the input — no opaque scores.

**MCP Server (`mcp_server/`).** A Model Context Protocol server that exposes nine glossary tools (`lookup_term`, `search`, `semantic_search`, `annotate`, `annotate_batch`, `list_terms`, `stats`, `health`, `version`) to compatible LLM clients — Claude Desktop, Cursor, VS Code. *This lets an LLM client answer questions about ethical-AI terms directly from the ICAIRE glossary instead of relying on the model's parametric memory.* Optional API-key auth and per-tool rate limiting are built in.

**Multilingual Evaluation Benchmark (`evals/`).** An **LLM-as-a-judge** framework for measuring how accurately language models explain ethical-AI concepts in Arabic against the glossary's ground-truth Arabic definitions. For each English term, a configurable *target model* (default `gemini/gemini-2.5-flash`, but any LiteLLM-compatible model works — Groq, OpenAI, etc.) is asked to explain the concept in Arabic; a *judge model* (default `gemini-3.1-flash-lite`, with `gemma-3-27b` as a rate-limit fallback) then scores the answer 1–5 against the ground truth on semantic similarity and accuracy. Results are written to `evals/results/` as CSV or JSON. The benchmark gives a measurable signal for how well current LLMs handle ethical-AI terminology in a lower-resource language — the underlying inaccuracy problem the ICAIRE glossary exists to address.

**Browser Extension (`browser_extension/`).** A Chrome / Edge MV3 extension. Highlight any term on any web page, right-click, and get the trilingual definition, aliases, and source sheet for the matched term. Includes a "did you mean" fallback when there is no exact match, and an options page for the API base URL.

**Dashboard (`dashboard/`).** A single-page web hub mounted at `/dashboard/` on the same FastAPI process. It hosts the auditor UI, a paginated glossary explorer with autocomplete, a downloadable JSON report button, and six pre-loaded sample texts that exercise the auditor against different document types (academic paper, news article, syllabus, grant proposal, AI product spec, model card).

**FastAPI Backend (`api/`).** The shared engine behind every other component. REST endpoints for term lookup, prefix search, alias-aware search, semantic vector search (backed by a local **ChromaDB** index), bulk text annotation, autocomplete, the auditor, and a `/version` endpoint that exposes the current dataset hash. CORS-enabled so the dashboard, the extension, and external SDK clients all hit the same API.

**Data Ingestion Pipeline (`scripts/ingest_glossary.py`).** A repeatable script that reads the source Excel workbook, merges the *English – Arabic* and *English – French* sheets, cleans formatting artifacts, joins an optional alias file, and writes deterministic outputs (`glossary.json`, `glossary.csv`, `dataset_meta.json`). Each run records a SHA-256 hash and UTC timestamp, so any audit report, MCP response, or extension popup can be traced back to the exact snapshot of the glossary it was generated from.

**CLI and SDKs (`cli/`, `sdk/python/`, `sdk/js/`).** A small terminal client and zero-dependency drop-in libraries for Python and JavaScript / Node.js, intended to be copied into a project so any backend, notebook, or CI pipeline can hit the API in a few lines of code.

---

## Scope And Key Facts

- **Languages:** English, Arabic, French.
- **Entries after ingestion:** 1,242.
- **Risk dimensions in the auditor:** 10.
- **MCP tools exposed:** 9.
- **Audit modes:** Gemini-augmented (when an API key is set) and offline-deterministic (always available).
- **Dataset versioning:** SHA-256 hash + UTC timestamp per ingestion run.

---

## Limitations

- The deterministic auditor uses a keyword-based mapping from glossary terms to risk dimensions. It will not catch ethical concerns expressed in language that does not overlap with the glossary vocabulary. The Gemini-backed mode mitigates this but requires an API key and network access.
- Coverage of the toolkit is bounded by the source dataset; any gap or inconsistency in the glossary is inherited by every downstream tool.
- The browser extension targets Chrome MV3. It runs on Edge unchanged but has not been packaged for Firefox.
- The evaluation framework currently scores Arabic explanations only; a French equivalent would be a straightforward extension but is not implemented.
- The semantic search index uses Chroma's default embedding function; swapping in a higher-quality embedding model would likely improve retrieval but was kept default so the project runs without an embedding API key.
