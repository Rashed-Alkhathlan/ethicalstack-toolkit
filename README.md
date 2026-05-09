# EthicalStack AI Glossary Toolkit

EthicalStack is a unified, ethical AI glossary platform designed to provide a single source of truth for AI terminology, definitions, and ethical implications. Built for the AI Glossary Challenge by ICAIRE, this platform normalizes a multi-lingual dataset (English, Arabic, French) and makes it accessible through a high-performance API, a Model Context Protocol (MCP) server, Command Line Interfaces (CLI), and language-specific SDKs.

## 🌟 Key Features

*   **Multi-Lingual Single Source of Truth**: Data pipeline to normalize the provided Excel dataset (English, Arabic, French) into highly-accessible JSON/CSV formats.
*   **Vector Search & Semantic Retrieval**: Local Chroma DB integration allows for deep semantic search through AI definitions, going beyond simple keyword matching.
*   **Text Annotation Engine**: Analyze strings of text to automatically identify and extract AI terminology, useful for auditing papers, specs, and news.
*   **Model Context Protocol (MCP) Server**: Seamlessly integrate the glossary into modern LLM clients like Claude Desktop, Cursor, and VS Code.
*   **FastAPI Backend**: A highly-performant REST API providing endpoints for health, metadata, search, semantic search, and bulk text annotation.
*   **Developer SDKs**: Drop-in client libraries for Python and Node.js.
*   **Lightweight CLI**: Easy-to-use Command Line Interface to query the API directly from your terminal.

## 📂 Project Structure

The project is organized into several distinct modules, each serving a specific purpose in the toolkit:

### 1. `api/` (Core REST API)
A FastAPI application that loads the normalized glossary data and powers the search and annotation features.
*   **Capabilities**: Term lookup, prefix search, vector-based semantic search, and text annotation.
*   **Tech Stack**: Python, FastAPI, Uvicorn, ChromaDB.
*   **Docs**: See [api/README.md](api/README.md) for startup instructions and endpoints.

### 2. `mcp_server/` (Model Context Protocol)
Exposes the glossary's analytical tools to LLMs locally via the Model Context Protocol.
*   **Tools**: `lookup_term`, `search`, `semantic_search`, `annotate`, `annotate_batch`, `list_terms`, `stats`.
*   **Integrations**: Claude Desktop, Cursor, VS Code.
*   **Docs**: See [mcp_server/README.md](mcp_server/README.md) for configuration and usage examples.

### 3. `scripts/` (Data Ingestion Pipeline)
Contains `ingest_glossary.py`, the core script for converting the raw `AI Glossary - Dataset.xlsx` into canonical formats.
*   **Process**: Cleans text, merges English-Arabic and English-French sheets, joins custom aliases, and generates deterministic outputs.
*   **Outputs**: `data/glossary.json`, `data/glossary.csv`, `data/dataset_meta.json`.

### 4. `cli/` (Command Line Interface)
A lightweight terminal application for interacting with the EthicalStack API without writing code.
*   **Usage**: Run health checks, lookups, semantic searches, and text annotations directly from your shell.
*   **Docs**: See [cli/README.md](cli/README.md) for usage commands and Windows installation scripts.

### 5. `sdk/` (Developer Client Libraries)
Zero-dependency drop-in clients to quickly integrate the EthicalStack API into your own projects.
*   **Python SDK**: `sdk/python/ethicalstack_client.py`
*   **JavaScript/Node.js SDK**: `sdk/js/ethicalstackClient.js`

### 6. `data/` (Knowledge Base)
The local storage for the cleaned dataset and the Chroma vector embeddings. Generated via the ingestion script.

## 🚀 Quickstart

Follow these steps to get the API and the core system up and running:

### Step 1: Data Ingestion (Optional)
If you need to regenerate the dataset from the Excel source:
```bash
python scripts/ingest_glossary.py
```
*This will populate the `data/` directory with `glossary.json` and `glossary.csv`.*

### Step 2: Start the REST API
The API is the core engine required by the CLI and SDKs.
```bash
cd api
pip install -r requirements.txt
uvicorn app.main:app --reload
```
*The API will be available at `http://localhost:8000`. The first run will automatically build the Chroma DB vector index.*

### Step 3: Try the CLI
Open a new terminal window:
```bash
cd cli
python ethicalstack_cli.py --base-url http://localhost:8000 lookup "Abduction"
python ethicalstack_cli.py --base-url http://localhost:8000 semantic-search "bias in data" --limit 3
```

### Step 4: Configure the MCP Server (For Claude/Cursor)
To give your AI assistant access to the ethical glossary, add this to your MCP configuration file (e.g., `claude_desktop_config.json`):
```json
{
   "mcpServers": {
      "ethicalstack": {
         "command": "python",
         "args": ["server.py"],
         "cwd": "/absolute/path/to/AI-Glossary-Challenge-by-ICAIRE/mcp_server"
      }
   }
}
```
*(Make sure to adjust the `cwd` to match your local absolute path).*

### 7. `dashboard/` (Hub / Home Base)
A single-page web hub served from the API at `/dashboard/`. Includes the **Ethical &amp; Cultural Risk Auditor** (paste papers → full audit report), glossary explorer with autocomplete, tool downloads, live demos, and contribution docs.
*   **Docs**: See [dashboard/HUB.md](dashboard/HUB.md) for full architecture, endpoint additions, and risk taxonomy.

## 🔮 Roadmap (Next Steps)
- **LLM-augmented audit**: optional pass that turns the structured audit into prose recommendations.
- **Public deployment**: host the API + dashboard on a single endpoint for judges.
- **Edge browser support**: the extension targets Chrome MV3 today; Edge is a small port.

---
*Built for the Ethical AI Glossary Hackathon.*
