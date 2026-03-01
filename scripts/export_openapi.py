#!/usr/bin/env python3
from __future__ import annotations

import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
BACKEND_DIR = ROOT / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.main import app  # noqa: E402


def main() -> None:
    contracts_dir = ROOT / "contracts"
    contracts_dir.mkdir(parents=True, exist_ok=True)
    output = contracts_dir / "openapi.json"
    output.write_text(json.dumps(app.openapi(), ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"OpenAPI exported to: {output}")


if __name__ == "__main__":
    main()

