# EthicalStack Glossary API

## Quickstart

1. Install dependencies:

   - `pip install -r requirements.txt`

2. Run the API:

   - `uvicorn app.main:app --reload`

The API expects the glossary JSON at `../data/glossary.json`.

First semantic search will download the embedding model. Set `HF_TOKEN` for faster Hugging Face downloads if needed.

## Endpoints

- `GET /health` -> service status
- `GET /version` -> dataset metadata
- `GET /terms/{term}` -> exact term lookup (case-insensitive)
- `GET /terms` -> list terms with filters and pagination
- `GET /search?q=...` -> search in term/definition (filters + pagination)
- `GET /semantic-search?q=...` -> vector search (filters + pagination)
- `POST /annotate` -> annotate text with glossary terms
- `POST /annotate/batch` -> annotate multiple texts
- `GET /metrics` -> basic request timing and counts

### Filters and pagination

Supported query params:

- `limit` (default varies)
- `offset` (default 0)
- `has_alias` (true/false)
- `language` (english/arabic/french)
- `source` (matches sheet name)
