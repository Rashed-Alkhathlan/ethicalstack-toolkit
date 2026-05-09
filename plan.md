## Plan: EthicalStack Kaggle Toolkit

Deliver a unified ethical AI glossary platform with a single source of truth (Excel -> JSON/CSV), a FastAPI core, Chroma-based semantic search, and multiple clients (React dashboard, browser extension, MCP tools, and 5+ demo apps) to maximize practicality, utility, and polish for the competition.

**Steps**
1. Data discovery and schema definition: open D:\Coding\Hackathons\AI Glossary - Dataset.xlsx, profile columns, identify duplicates and missing fields, and define a normalized schema (term, definition, category, source, aliases, related_terms, examples, citations). Document schema rules and create a validation checklist. Blocks all later steps.
2. Data normalization pipeline: implement a repeatable ingestion script that cleans text (trim, remove artifacts), resolves duplicates, and exports canonical JSON and CSV. Include a data version strategy (hash + timestamp) and a changelog for new runs. Depends on 1.
3. Embedding strategy and vector index: choose embedding model (local or API), generate embeddings for term + definition, store in Chroma with metadata (category, source, confidence, language), and persist the index snapshot. Add a small benchmark to validate semantic search quality. Depends on 1-2.
4. Core API design: define REST contract for term lookup, exact match, prefix search, semantic search, and annotate-text. Specify request/response schemas, pagination, top-k settings, and error codes. Depends on 1-3.
5. FastAPI implementation: build endpoints, integrate Chroma, add caching for frequent terms, configure CORS, rate limits, and OpenAPI docs. Create a health check and a version endpoint that returns dataset hash and index build time. Depends on 4.
6. Ethics metadata engine: implement text annotation that detects glossary terms, expands aliases, resolves overlaps, and returns a structured report (terms, definitions, severity/impact tags, and summary). Add confidence and explainability fields. Depends on 5.
7. MCP server: expose lookup_term, semantic_search, and annotate_text as MCP tools with clear input/output schemas and examples. Provide connection notes for common MCP clients. Depends on 5-6.
8. React dashboard UX plan: define core views (audit paste, glossary explorer, term detail, feedback), data flow, and export options (PDF/JSON). Create component map and routing. Depends on 5-6.
9. React dashboard build: implement UI with a consistent visual identity, add text analysis, term highlights, and downloadable reports. Include a demo mode with sample docs for judges. Depends on 8.
10. Browser extension UX plan: define trigger (selection or context menu), popup UI, and request flow to API. Handle errors and offline mode. Depends on 5-6.
11. Browser extension build: implement selection capture, API call, and popup rendering with definitions and related terms. Add an options page for API base URL. Depends on 10.
12. Demo project suite (5+): create lightweight apps that consume the API/MCP.
    - Academic Paper Auditor: paste abstract -> ethics summary + flagged terms
    - News Bias Scanner: article paste -> ethics context + term map
    - Course Syllabus Ethics Checker: syllabus -> missing ethics topics checklist
    - Grant Proposal Risk Lens: proposal -> risk tags + glossary grounding
    - AI Product Spec Reviewer: spec -> responsible AI gaps + recommendations
    - Model Card Builder: guided form -> glossary-backed definitions
    Parallel with steps 9-11 once API is stable.
13. Documentation package: single README and quickstart covering architecture, API endpoints, MCP tools, dashboard usage, extension install, and demo project list. Map features to competition criteria and include screenshots. Depends on 5-12.
14. Demo preparation: record short clips or gifs for each client, create a single narrative, and run a clean install test. Depends on 13.

**Relevant files**
- AI Glossary - Dataset.xlsx - glossary source to normalize

**Verification**
1. Data pipeline: ingestion produces deterministic JSON/CSV and logs dataset hash.
2. Semantic search: same query returns stable top-k results across two runs.
3. API contract: OpenAPI docs show all endpoints with example payloads.
4. Annotation correctness: known sample text returns expected term matches and summaries.
5. Dashboard E2E: paste sample text -> audit report renders and exports.
6. Extension flow: highlight a term -> popup shows correct definition + links.
7. MCP flow: run a sample MCP client call and validate tool output.

**Decisions**
- Stack: FastAPI + React, Chroma (local), MCP server enabled.
- Scope: full suite (API + dashboard + extension + 5+ demo projects).
- Data source: local Excel file at D:\Coding\Hackathons\AI Glossary - Dataset.xlsx.

**Further Considerations**
1. Embedding model: local (lower cost, slower) vs hosted (higher cost, better quality). Recommend hosted for demo polish, local for offline fallback.
2. Hosting: local-only for demo vs deploy on a public endpoint for judges. Recommend public endpoint if time allows.
3. Extension target: Chrome only vs Chrome + Edge. Recommend Chrome first, Edge if extra time.
