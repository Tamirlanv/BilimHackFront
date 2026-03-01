from __future__ import annotations

from datetime import datetime, timezone


def ping_worker() -> dict[str, str]:
    return {"status": "ok", "ts": datetime.now(timezone.utc).isoformat()}

