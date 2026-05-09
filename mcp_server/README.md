# EthicalStack MCP Server

This MCP server exposes the glossary tools for term lookup and text annotation.

## Setup

1. Install dependencies:

   - `pip install -r requirements.txt`

2. Run the server:

   - `python server.py`

## Optional API Key

Set `ETHICALSTACK_API_KEY` to require a key for all MCP tools. If unset, tools are open.

Example (PowerShell):

```powershell
$env:ETHICALSTACK_API_KEY = "your-key"
```

## Logging and Rate Limits

- `ETHICALSTACK_LOG_LEVEL`: `info` (default) or `off`.
- `ETHICALSTACK_RATE_LIMIT_PER_MIN`: max calls per tool per minute (default: 120). Set to `0` to disable.

Example (PowerShell):

```powershell
$env:ETHICALSTACK_LOG_LEVEL = "info"
$env:ETHICALSTACK_RATE_LIMIT_PER_MIN = "120"
```

## Tools

- `health()`
- `version()`
- `lookup_term(term)`
- `search(q, limit=25)`
- `semantic_search(q, limit=10)`
- `annotate(text)`
- `annotate_batch(texts)`
- `list_terms(limit=50, offset=0, has_alias=null, language=null)`
- `stats()`

The server reads glossary data from `../data/glossary.json` and uses the existing API logic.

## Tool Examples

### lookup_term

Request:

```json
{
   "tool": "lookup_term",
   "args": {
      "term": "Abduction",
      "api_key": "your-key"
   }
}
```

Response:

```json
{
   "found": true,
   "entry": {
      "english_term": "Abduction",
      "english_def": "See \"Abductive Reasoning.\"",
      "arabic_term": "استخلاص",
      "arabic_def": "انظر \"استدلال استخلاصي\".",
      "french_term": "Abduction",
      "french_def": "Voir \"Raisonnement abductif\".",
      "aliases": [],
      "sources": ["English - Arabic", "English - French"]
   }
}
```

### search

Request:

```json
{
   "tool": "search",
   "args": {
      "q": "fairness",
      "limit": 3
   }
}
```

Response:

```json
{
   "query": "fairness",
   "total": 3,
   "results": [
      {"english_term": "Fairness Metric", "english_def": "..."}
   ]
}
```

### semantic_search

Request:

```json
{
   "tool": "semantic_search",
   "args": {
      "q": "bias in data",
      "limit": 3
   }
}
```

Response:

```json
{
   "query": "bias in data",
   "total": 3,
   "results": [
      {"score": 0.12, "entry": {"english_term": "Bias", "english_def": "..."}}
   ]
}
```

### annotate

Request:

```json
{
   "tool": "annotate",
   "args": {
      "text": "We used A/B Testing to evaluate fairness metrics."
   }
}
```

Response:

```json
{
   "text": "We used A/B Testing to evaluate fairness metrics.",
   "match_count": 2,
   "matches": [
      {
         "term": "A/B Testing",
         "start": 8,
         "end": 18,
         "matched_text": "A/B Testing",
         "definition": "..."
      }
   ]
}
```

### annotate_batch

Request:

```json
{
   "tool": "annotate_batch",
   "args": {
      "texts": [
         "We used A/B Testing.",
         "The model was trained for fairness."
      ]
   }
}
```

Response:

```json
{
   "total": 2,
   "results": [
      {"text": "We used A/B Testing.", "match_count": 1, "matches": ["..."]},
      {"text": "The model was trained for fairness.", "match_count": 1, "matches": ["..."]}
   ]
}
```

### list_terms

Request:

```json
{
   "tool": "list_terms",
   "args": {
      "limit": 5,
      "offset": 0,
      "has_alias": false,
      "language": "english"
   }
}
```

Response:

```json
{
   "total": 1242,
   "offset": 0,
   "limit": 5,
   "results": [
      {"english_term": "A/B Testing", "english_def": "..."}
   ]
}
```

### stats

Request:

```json
{
   "tool": "stats",
   "args": {}
}
```

Response:

```json
{
   "total_entries": 1242,
   "with_aliases": 0,
   "with_arabic": 1242,
   "with_french": 1242
}
```

## Client Config Snippets

### VS Code MCP (settings.json)

```json
{
   "mcp.servers": {
      "ethicalstack": {
         "command": "python",
         "args": ["server.py"],
         "cwd": "d:/Coding/Hackathons/AI glossary hackathon/mcp"
      }
   }
}
```

### Claude Desktop (claude_desktop_config.json)

```json
{
   "mcpServers": {
      "ethicalstack": {
         "command": "python",
         "args": ["server.py"],
         "cwd": "d:/Coding/Hackathons/AI glossary hackathon/mcp"
      }
   }
}
```

### Cursor (mcp.json)

```json
{
   "mcpServers": {
      "ethicalstack": {
         "command": "python",
         "args": ["server.py"],
         "cwd": "d:/Coding/Hackathons/AI glossary hackathon/mcp"
      }
   }
}
```
