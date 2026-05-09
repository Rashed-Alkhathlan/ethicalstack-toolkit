from __future__ import annotations

import argparse
import json
from typing import Any, Dict, Optional
from urllib import request
from urllib.error import HTTPError
from urllib.parse import urlencode


def build_url(base_url: str, path: str, params: Optional[Dict[str, Any]] = None) -> str:
    url = f"{base_url.rstrip('/')}{path}"
    if params:
        url = f"{url}?{urlencode(params)}"
    return url


def send_get(url: str) -> Dict[str, Any]:
    req = request.Request(url, method="GET")
    return send_request(req)


def send_post(url: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    data = json.dumps(payload).encode("utf-8")
    req = request.Request(
        url,
        data=data,
        method="POST",
        headers={"Content-Type": "application/json"},
    )
    return send_request(req)


def send_request(req: request.Request) -> Dict[str, Any]:
    try:
        with request.urlopen(req, timeout=15) as response:
            body = response.read().decode("utf-8")
    except HTTPError as exc:
        body = exc.read().decode("utf-8")
        raise RuntimeError(f"HTTP {exc.code}: {body}") from exc
    return json.loads(body)


def print_json(data: Dict[str, Any], pretty: bool) -> None:
    if pretty:
        print(json.dumps(data, ensure_ascii=False, indent=2))
    else:
        print(json.dumps(data, ensure_ascii=False, separators=(",", ":")))


def main() -> None:
    parser = argparse.ArgumentParser(description="EthicalStack CLI")
    parser.add_argument(
        "--base-url",
        default="http://localhost:8000",
        help="API base URL (default: http://localhost:8000)",
    )
    parser.add_argument(
        "--format",
        choices=["pretty", "json"],
        default="pretty",
        help="Output format (pretty or json)",
    )

    subparsers = parser.add_subparsers(dest="command", required=True)

    subparsers.add_parser("health", help="Check API health")
    subparsers.add_parser("version", help="Get dataset metadata")

    lookup = subparsers.add_parser("lookup", help="Lookup a term")
    lookup.add_argument("term")

    search = subparsers.add_parser("search", help="Search terms")
    search.add_argument("query")
    search.add_argument("--limit", type=int, default=25)

    semantic = subparsers.add_parser("semantic-search", help="Semantic search")
    semantic.add_argument("query")
    semantic.add_argument("--limit", type=int, default=10)

    annotate = subparsers.add_parser("annotate", help="Annotate text")
    annotate.add_argument("text")

    args = parser.parse_args()
    base_url = args.base_url
    pretty = args.format == "pretty"

    if args.command == "health":
        print_json(send_get(build_url(base_url, "/health")), pretty)
        return

    if args.command == "version":
        print_json(send_get(build_url(base_url, "/version")), pretty)
        return

    if args.command == "lookup":
        print_json(send_get(build_url(base_url, f"/terms/{args.term}")), pretty)
        return

    if args.command == "search":
        print_json(
            send_get(build_url(base_url, "/search", {"q": args.query, "limit": args.limit})),
            pretty,
        )
        return

    if args.command == "semantic-search":
        print_json(
            send_get(
                build_url(
                    base_url,
                    "/semantic-search",
                    {"q": args.query, "limit": args.limit},
                )
            ),
            pretty,
        )
        return

    if args.command == "annotate":
        print_json(
            send_post(build_url(base_url, "/annotate"), {"text": args.text}),
            pretty,
        )
        return

    raise RuntimeError("Unknown command")


if __name__ == "__main__":
    main()
