# EthicalStack JS Client

A lightweight Node.js module for calling the EthicalStack REST API.

This is a simple local library (a single .js file) that you can import in your scripts. It is not published to npm, but we can package it later if you want.

## Usage

```js
const { EthicalStackClient } = require("./ethicalstackClient");

const client = new EthicalStackClient("http://localhost:8000");

(async () => {
  console.log(await client.health());
  console.log(await client.lookupTerm("Abduction"));
  console.log(await client.search("fairness", 3));
  console.log(await client.semanticSearch("bias in data", 3));
  console.log(await client.annotate("We used A/B Testing to evaluate fairness metrics."));
})();
```

## Notes

- Uses Node 18+ built-in `fetch`.
- Adjust the base URL to match your API host.
