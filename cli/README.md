# EthicalStack CLI

A lightweight CLI for calling the EthicalStack REST API.

## Usage

```bash
python ethicalstack_cli.py --base-url http://localhost:8000 health
python ethicalstack_cli.py --base-url http://localhost:8000 version
python ethicalstack_cli.py --base-url http://localhost:8000 lookup "Abduction"
python ethicalstack_cli.py --base-url http://localhost:8000 search "fairness" --limit 3
python ethicalstack_cli.py --base-url http://localhost:8000 semantic-search "bias in data" --limit 3
python ethicalstack_cli.py --base-url http://localhost:8000 annotate "We used A/B Testing."
python ethicalstack_cli.py --base-url http://localhost:8000 health --format json
```

### Windows launcher

```bash
ethicalstack.cmd --base-url http://localhost:8000 health
```

### Add to PATH (Windows)

```powershell
./install.ps1
```

## Notes

- Uses only the Python standard library.
- The API must be running.
