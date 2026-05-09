const { URL, URLSearchParams } = require("url");

class EthicalStackClient {
    constructor(baseUrl) {
        this.baseUrl = baseUrl.replace(/\/+$/, "");
    }

    async _get(path, params = null) {
        const url = new URL(`${this.baseUrl}${path}`);
        if (params) {
            url.search = new URLSearchParams(params).toString();
        }
        const response = await fetch(url, { method: "GET" });
        return this._handle(response);
    }

    async _post(path, payload) {
        const url = new URL(`${this.baseUrl}${path}`);
        const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });
        return this._handle(response);
    }

    async _handle(response) {
        const text = await response.text();
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${text}`);
        }
        return JSON.parse(text);
    }

    health() {
        return this._get("/health");
    }

    version() {
        return this._get("/version");
    }

    lookupTerm(term) {
        return this._get(`/terms/${encodeURIComponent(term)}`);
    }

    search(query, limit = 25) {
        return this._get("/search", { q: query, limit });
    }

    semanticSearch(query, limit = 10) {
        return this._get("/semantic-search", { q: query, limit });
    }

    annotate(text) {
        return this._post("/annotate", { text });
    }
}

module.exports = { EthicalStackClient };
