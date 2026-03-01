from __future__ import annotations

import logging
import sys

from app.core.config import settings


def configure_logging() -> None:
    root = logging.getLogger()
    root.handlers.clear()
    root.setLevel(settings.log_level.upper())

    stream_handler = logging.StreamHandler(sys.stdout)
    stream_handler.setLevel(settings.log_level.upper())

    formatter = _build_formatter()
    stream_handler.setFormatter(formatter)
    root.addHandler(stream_handler)


def _build_formatter() -> logging.Formatter:
    try:
        from pythonjsonlogger.json import JsonFormatter

        return JsonFormatter(
            "%(asctime)s %(levelname)s %(name)s %(message)s",
            rename_fields={
                "asctime": "ts",
                "levelname": "level",
                "name": "logger",
                "message": "msg",
            },
        )
    except Exception:
        return logging.Formatter(
            fmt="%(asctime)s %(levelname)s [%(name)s] %(message)s",
            datefmt="%Y-%m-%dT%H:%M:%S%z",
        )

