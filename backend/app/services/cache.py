from __future__ import annotations

import json
import logging
from typing import Any

from redis import Redis
from redis.exceptions import RedisError

from app.core.config import settings

logger = logging.getLogger(__name__)


class RedisCache:
    def __init__(self) -> None:
        self._client: Redis | None = None
        self._enabled = settings.redis_enabled and bool(settings.redis_url.strip())
        if not self._enabled:
            return

        try:
            self._client = Redis.from_url(
                settings.redis_url,
                decode_responses=True,
                socket_connect_timeout=1,
                socket_timeout=1,
            )
        except Exception as exc:  # noqa: BLE001
            self._enabled = False
            logger.warning("Redis cache disabled: %s", exc)

    @property
    def enabled(self) -> bool:
        return self._enabled and self._client is not None

    def ping(self) -> bool:
        if not self.enabled:
            return False
        try:
            return bool(self._client.ping())
        except RedisError:
            return False

    def get_json(self, key: str) -> Any | None:
        if not self.enabled:
            return None
        try:
            value = self._client.get(key)
            if value is None:
                return None
            return json.loads(value)
        except (RedisError, json.JSONDecodeError):
            return None

    def set_json(self, key: str, value: Any, ttl_seconds: int) -> bool:
        if not self.enabled:
            return False
        try:
            self._client.setex(key, max(1, int(ttl_seconds)), json.dumps(value, ensure_ascii=False))
            return True
        except (RedisError, TypeError, ValueError):
            return False

    def delete_many(self, *keys: str) -> None:
        if not self.enabled:
            return
        valid_keys = [item for item in keys if item]
        if not valid_keys:
            return
        try:
            self._client.delete(*valid_keys)
        except RedisError:
            return

    def increment_with_ttl(self, key: str, ttl_seconds: int) -> int:
        """
        Returns current counter value after increment.
        """
        if not self.enabled:
            return 0
        try:
            with self._client.pipeline() as pipeline:
                pipeline.incr(key)
                pipeline.expire(key, max(1, int(ttl_seconds)))
                count, _ = pipeline.execute()
            return int(count or 0)
        except RedisError:
            return 0


cache = RedisCache()

