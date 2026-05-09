# EthicalStack Python Client

A lightweight Python module for calling the EthicalStack REST API.

This is a simple local library (a single .py file) that you can import in your scripts. It is not published to PyPI, but we can package it later if you want.

## Usage

```python
from ethicalstack_client import EthicalStackClient

client = EthicalStackClient("http://localhost:8000")

print(client.health())
print(client.lookup_term("Abduction"))
print(client.search("fairness", limit=3))
print(client.semantic_search("bias in data", limit=3))
print(client.annotate("We used A/B Testing to evaluate fairness metrics."))
```

## Notes

- Uses only the Python standard library (no extra dependencies).
- Adjust the base URL to match your API host.
