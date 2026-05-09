"""Text extractors for the auditor.

Used by the /audit/url and /audit/file endpoints so the auditor can score
arbitrary web pages and uploaded documents (txt / md / html / pdf / json).
"""
from __future__ import annotations

import io
import json
import re
from html.parser import HTMLParser
from typing import Tuple
from urllib.parse import urlparse
from urllib.request import Request, urlopen

MAX_BYTES = 100 * 1024 * 1024  # 4 MB upper bound on remote / uploaded payloads
USER_AGENT = "EthicalStackAuditor/0.1 (+https://github.com/Qasim-11/AI-Glossary-Challenge-by-ICAIRE)"


class _HTMLTextExtractor(HTMLParser):
    """Minimal HTML → text extractor — drops <script>/<style> blocks."""

    SKIP_TAGS = {"script", "style", "noscript", "svg", "head", "nav", "footer"}
    BLOCK_TAGS = {
        "p", "div", "br", "li", "h1", "h2", "h3", "h4", "h5", "h6",
        "section", "article", "header", "tr", "td", "th",
    }

    def __init__(self) -> None:
        super().__init__()
        self._chunks: list[str] = []
        self._skip_depth = 0

    def handle_starttag(self, tag: str, attrs) -> None:  # noqa: ANN001
        if tag in self.SKIP_TAGS:
            self._skip_depth += 1
        elif tag in self.BLOCK_TAGS:
            self._chunks.append("\n")

    def handle_endtag(self, tag: str) -> None:
        if tag in self.SKIP_TAGS and self._skip_depth > 0:
            self._skip_depth -= 1

    def handle_data(self, data: str) -> None:
        if self._skip_depth == 0 and data.strip():
            self._chunks.append(data)

    def text(self) -> str:
        joined = "".join(self._chunks)
        # Collapse runs of whitespace, preserve paragraph breaks.
        joined = re.sub(r"[ \t]+", " ", joined)
        joined = re.sub(r"\n{2,}", "\n\n", joined)
        return joined.strip()


def html_to_text(html: str) -> str:
    parser = _HTMLTextExtractor()
    try:
        parser.feed(html)
    except Exception:
        # Fallback to brute-force tag stripping if the parser chokes.
        return re.sub(r"<[^>]+>", " ", html).strip()
    return parser.text()


def fetch_url(url: str) -> Tuple[str, str]:
    """Fetch a URL and return (text, content_type). Raises ValueError on bad URLs."""
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https"):
        raise ValueError("Only http(s) URLs are supported.")
    if not parsed.netloc:
        raise ValueError("URL is missing a host.")

    req = Request(url, headers={"User-Agent": USER_AGENT, "Accept": "*/*"})
    with urlopen(req, timeout=20) as resp:  # noqa: S310 - validated above
        content_type = (resp.headers.get("Content-Type") or "").lower()
        raw = resp.read(MAX_BYTES + 1)
    if len(raw) > MAX_BYTES:
        raise ValueError(f"Remote document exceeds {MAX_BYTES // (1024 * 1024)} MB limit.")

    if "pdf" in content_type or url.lower().endswith(".pdf"):
        return extract_pdf(raw), "application/pdf"

    encoding = "utf-8"
    match = re.search(r"charset=([\w\-]+)", content_type)
    if match:
        encoding = match.group(1)
    try:
        body = raw.decode(encoding, errors="replace")
    except LookupError:
        body = raw.decode("utf-8", errors="replace")

    if "html" in content_type or "<html" in body[:1024].lower():
        return html_to_text(body), "text/html"
    if "json" in content_type:
        try:
            return json.dumps(json.loads(body), ensure_ascii=False, indent=2), "application/json"
        except json.JSONDecodeError:
            return body, "text/plain"
    return body, content_type or "text/plain"


def extract_pdf(raw: bytes) -> str:
    try:
        from pypdf import PdfReader
    except ImportError as exc:  # pragma: no cover
        raise ValueError("PDF support requires pypdf. Run `pip install pypdf`.") from exc
    reader = PdfReader(io.BytesIO(raw))
    pages = []
    for page in reader.pages:
        try:
            pages.append(page.extract_text() or "")
        except Exception:
            continue
    return "\n\n".join(p.strip() for p in pages if p.strip())


def extract_file(filename: str, raw: bytes) -> str:
    """Decode an uploaded file (txt / md / html / pdf / json) to plain text."""
    if len(raw) > MAX_BYTES:
        raise ValueError(f"File exceeds {MAX_BYTES // (1024 * 1024)} MB limit.")

    name = (filename or "").lower()
    if name.endswith(".pdf") or raw[:4] == b"%PDF":
        return extract_pdf(raw)

    try:
        body = raw.decode("utf-8")
    except UnicodeDecodeError:
        body = raw.decode("utf-8", errors="replace")

    if name.endswith((".html", ".htm")) or "<html" in body[:1024].lower():
        return html_to_text(body)
    if name.endswith(".json"):
        try:
            return json.dumps(json.loads(body), ensure_ascii=False, indent=2)
        except json.JSONDecodeError:
            return body
    return body
