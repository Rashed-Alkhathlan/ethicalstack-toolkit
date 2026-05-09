from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app.store import GlossaryStore


def main() -> None:
    store = GlossaryStore()
    store.load()
    print(f"Indexed {len(store.entries)} entries")


if __name__ == "__main__":
    main()
