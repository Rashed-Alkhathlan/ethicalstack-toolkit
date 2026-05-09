from __future__ import annotations

import json
from typing import Any, Dict, Optional
from urllib import request
from urllib.error import HTTPError
from urllib.parse import urlencode


class EthicalStackClient:
    def __init__(self, base_url: str) -> None:
        self.base_url = base_url.rstrip("/")

    def _get(self, path: str, params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        url = f"{self.base_url}{path}"
        if params:
            url = f"{url}?{urlencode(params)}"
        req = request.Request(url, method="GET")
        return self._send(req)

    def _post(self, path: str, payload: Dict[str, Any]) -> Dict[str, Any]:
        url = f"{self.base_url}{path}"
        data = json.dumps(payload).encode("utf-8")
        req = request.Request(
            url,
            data=data,
            method="POST",
            headers={"Content-Type": "application/json"},
        )
        return self._send(req)

    @staticmethod
    def _send(req: request.Request) -> Dict[str, Any]:
        try:
            with request.urlopen(req, timeout=15) as response:
                body = response.read().decode("utf-8")
        except HTTPError as exc:
            body = exc.read().decode("utf-8")
            raise RuntimeError(f"HTTP {exc.code}: {body}") from exc
        return json.loads(body)

    def health(self) -> Dict[str, Any]:
        return self._get("/health")

    def version(self) -> Dict[str, Any]:
        return self._get("/version")

    def lookup_term(self, term: str) -> Dict[str, Any]:
        return self._get(f"/terms/{term}")

    def search(self, query: str, limit: int = 25) -> Dict[str, Any]:
        return self._get("/search", {"q": query, "limit": limit})

    def semantic_search(self, query: str, limit: int = 10) -> Dict[str, Any]:
        return self._get("/semantic-search", {"q": query, "limit": limit})

    def annotate(self, text: str) -> Dict[str, Any]:
        return self._post("/annotate", {"text": text})
