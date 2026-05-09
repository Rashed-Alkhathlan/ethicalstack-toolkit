# EthicalStack Hub — Dashboard & Toolkit Reference

The **EthicalStack Hub** is the home base for the ICAIRE AI &amp; Data Glossary Challenge submission. It is a single-page dashboard that unifies every tool we built around the multilingual glossary — audit, search, autocomplete, browser extension, MCP server, CLI, SDKs, and demo apps — and serves them from the same FastAPI backend.

Open it at: **http://localhost:8000/** (after starting the API).

---

## 1. What's in the hub

| Section          | Purpose                                                                                              |
| ---------------- | ---------------------------------------------------------------------------------------------------- |
| Hero + autocomplete | Global search across 1,242 normalized terms, with prefix + alias suggestions in &lt; 200ms.          |
| **Ethical &amp; Cultural Risk Auditor** | Paste full papers / docs → backend maps detected glossary terms to **10 risk categories**, scores coverage, flags gaps, and lets you download a JSON report. |
| Glossary Explorer | Paginated browse with keyword OR semantic search, language filters, alias display.                  |
| Tools &amp; Downloads | One-click access to: Browser Extension `.zip`, FastAPI docs, MCP config snippet, CLI commands, Python &amp; JS SDKs. |
| Live Demos       | Six pre-canned scenarios that pipe sample text through the auditor: paper, news, syllabus, grant, product spec, model card. |
| Glossary Data &amp; Contributing | Dataset metadata, ingestion pipeline, and step-by-step contribution flow.                |

---

## 2. The Ethical &amp; Cultural Risk Auditor

This is the centerpiece. It implements the "Ethical Audit" report described in the challenge brief.

### Pipeline

1. The user pastes free-form text into the hub.
2. The frontend POSTs to `/audit` (CORS-enabled).
3. The backend runs the existing **annotation engine** ([api/app/annotate.py](../api/app/annotate.py)) to detect every glossary term + alias mentioned in the text (boundary-respecting regex, longest-match wins).
4. For each detected term, we look at the term + definition + aliases and map it to one or more **risk categories** ([api/app/audit.py](../api/app/audit.py)) using a curated keyword taxonomy.
5. We compute:
   - per-category score (capped at 1.0 by 3+ matches),
   - overall **coverage_score** = `categories with at least one match ÷ total categories`,
   - **term_density** = `match_count ÷ word_count`,
   - **overall_severity** ∈ `{low, medium, high}` based on coverage thresholds,
   - **gaps** (categories with zero matches) and **strengths** (categories with ≥1 match).
6. The frontend renders a colored summary, a per-category grid, and exposes a `Download report (JSON)` button for sharing/auditing.

### The 10 risk categories

| Key                  | Label                                | Probes for                                                 |
| -------------------- | ------------------------------------ | ---------------------------------------------------------- |
| `bias_fairness`      | Bias &amp; Fairness                  | discrimination, demographic parity, disparate impact       |
| `privacy`            | Privacy &amp; Data Protection        | PII, consent, GDPR, anonymization, differential privacy    |
| `transparency`       | Transparency &amp; Explainability    | XAI, SHAP, LIME, model cards, datasheets                   |
| `accountability`     | Accountability &amp; Governance      | audit, compliance, regulation, stewardship                 |
| `safety_robustness`  | Safety &amp; Robustness              | adversarial, alignment, OOD, hallucination, red-teaming    |
| `human_oversight`    | Human Oversight &amp; Autonomy       | HITL, override, contestability                             |
| `cultural_linguistic`| Cultural &amp; Linguistic Risks      | multilingual, low-resource, dialect, localization          |
| `environmental`      | Environmental Impact                 | carbon, energy, sustainability, footprint                  |
| `misuse_dualuse`     | Misuse &amp; Dual-Use                | deepfakes, manipulation, weaponization, fraud              |
| `data_quality`       | Data Quality &amp; Provenance        | sampling, drift, labeling, ground truth, lineage           |

The taxonomy lives in `RISK_CATEGORIES` inside [api/app/audit.py](../api/app/audit.py) — easy to extend.

### Why this design

- **No external LLM dependency at runtime.** The audit is grounded in the glossary itself, so judges can run it offline. The architecture also leaves a clean integration point — swap `audit_text()` for an LLM call if you want richer prose explanations.
- **Explainable.** Every flag points to a specific glossary term in the text — there are no opaque scores.
- **Reproducible.** Same input → same report. The dataset hash is exposed via `/version`.

---

## 3. Backend endpoints (added for the hub)

These complement the existing search / annotate / semantic-search endpoints.

| Method | Path                  | Purpose                                                       |
| ------ | --------------------- | ------------------------------------------------------------- |
| `POST` | `/audit`              | Full ethical &amp; cultural risk report for a text blob.      |
| `GET`  | `/autocomplete?q=`    | Prefix + contains + alias suggestions (cached, &lt;5ms typical). |
| `GET`  | `/extension/download` | Streams a freshly-zipped browser extension package.           |
| `GET`  | `/dashboard/`         | Static SPA mount (HTML/CSS/JS).                               |
| `GET`  | `/`                   | Redirects to the dashboard if mounted, else returns API info. |

CORS is now wide-open (`allow_origins=["*"]`) so the SPA, the browser extension, and external SDK clients can all hit the same API without proxying.

---

## 4. Project layout (after the hub)

```
.
├── api/                  FastAPI backend (now also serves the dashboard)
│   └── app/
│       ├── audit.py      NEW: ethical-risk taxonomy + scoring
│       ├── main.py       UPDATED: /audit, /autocomplete, /extension/download, CORS, static mount
│       ├── models.py     UPDATED: AuditRequest/Response, AutocompleteResponse
│       └── ...
├── dashboard/            NEW: single-page hub
│   ├── index.html
│   ├── styles.css
│   ├── app.js
│   └── HUB.md            ← you're reading this
├── browser_extension/    Chrome/Edge MV3 extension (downloadable from the hub)
├── cli/                  Terminal client
├── data/                 Glossary JSON/CSV, dataset_meta.json, Chroma index
├── evals/                Benchmark suite for semantic search quality
├── mcp_server/           MCP server for Claude Desktop / Cursor / VS Code
├── scripts/              Ingestion pipeline (Excel → JSON/CSV)
├── sdk/                  Python &amp; JS SDKs
└── README.md             Top-level overview
```

---

## 5. Quickstart

```bash
# 1. Install API deps
cd api
pip install -r requirements.txt

# 2. (Optional) Regenerate dataset
python ../scripts/ingest_glossary.py

# 3. Start the API + hub
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Open <http://localhost:8000/dashboard/>.

The Chroma vector index builds on first start (one-time, &lt;30s for 1.2k entries).

---

## 6. Tool inventory shown on the hub

Each tile on the **Tools** section maps to a real artifact in the repo:

| Tile               | Source                                                       | Action on the hub                       |
| ------------------ | ------------------------------------------------------------ | --------------------------------------- |
| Browser Extension  | [browser_extension/](../browser_extension/)                  | Click "Download .zip" → `/extension/download` builds &amp; serves it |
| FastAPI Backend    | [api/](../api/)                                              | Open `/docs` (Swagger UI) or `/health`  |
| MCP Server         | [mcp_server/](../mcp_server/)                                | Copy a ready-to-paste `mcpServers` JSON |
| CLI                | [cli/ethicalstack_cli.py](../cli/ethicalstack_cli.py)        | Copy a sample command                   |
| Python SDK         | [sdk/python/ethicalstack_client.py](../sdk/python/ethicalstack_client.py) | Code snippet display       |
| JS / Node SDK      | [sdk/js/ethicalstackClient.js](../sdk/js/ethicalstackClient.js) | Code snippet display                 |

---

## 7. Demos (one click each)

Every demo button drops a tailored sample into the auditor and runs it. They share the same `/audit` endpoint — they are genuinely live, not screenshots.

| Demo                       | Stress-tests                                  |
| -------------------------- | --------------------------------------------- |
| Academic Paper Auditor     | Bias, fairness, IRB / consent gaps            |
| News Bias Scanner          | Surveillance, transparency, demographic harm  |
| Syllabus Ethics Checker    | Coverage gaps in teaching material            |
| Grant Proposal Risk Lens   | Privacy + clinical-deployment risk tags       |
| AI Product Spec Reviewer   | Hiring-AI specific responsible-AI gaps        |
| Model Card Builder         | Limitations, out-of-scope, language coverage  |

---

## 8. Autocomplete — UX details

- Debounced 120ms after each keystroke.
- Three-tier ranking: **prefix matches → substring matches → alias matches**.
- Keyboard navigation: ↑/↓ to move, Enter to select, Esc to close.
- Selecting a suggestion auto-scrolls to the Glossary Explorer and prefills the filter.
- Backed by `/autocomplete`, with an in-memory TTL cache on the server.

---

## 9. Contributing to the glossary

1. Edit `AI Glossary - Dataset.xlsx` (or add aliases to `data/aliases.json`).
2. Re-run `python scripts/ingest_glossary.py` — this rewrites `data/glossary.json`, `data/glossary.csv`, and `data/dataset_meta.json` (which contains a fresh dataset hash + timestamp).
3. Restart the API. The first request rebuilds the Chroma vector index automatically.
4. (Optional) Run `python evals/run_benchmark.py` to confirm semantic-search quality didn't regress.
5. Open a PR — diff the dataset hash to make the change auditable.

---

## 10. What changed in this iteration

- **Added**: `dashboard/` SPA (`index.html`, `styles.css`, `app.js`, `HUB.md`).
- **Added**: `api/app/audit.py` — risk taxonomy + scoring.
- **Updated**: `api/app/main.py` — `/audit`, `/autocomplete`, `/extension/download`, CORS, static-file mount, root redirect.
- **Updated**: `api/app/models.py` — `AuditRequest/Response`, `AutocompleteResponse`, `AuditCategory`.

No existing endpoints were broken. The dashboard is purely additive; the CLI, MCP server, SDKs, and extension continue to work unchanged.
