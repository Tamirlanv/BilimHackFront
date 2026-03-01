from datetime import datetime, timedelta, timezone
import hashlib
from typing import Any

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.core.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


class TokenError(Exception):
    pass


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)


def create_access_token(subject: str | int, session_id: str | None = None, expires_delta: timedelta | None = None) -> str:
    if expires_delta is None:
        expires_delta = timedelta(minutes=settings.access_token_expire_minutes)
    expire = datetime.now(timezone.utc) + expires_delta
    payload: dict[str, Any] = {"sub": str(subject), "exp": expire, "type": "access"}
    if session_id:
        payload["sid"] = session_id
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


def decode_access_token(token: str) -> dict[str, Any]:
    try:
        payload = jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
        if payload.get("type") not in {None, "access"}:
            raise TokenError("Некорректный тип токена")
        return payload
    except JWTError as exc:
        raise TokenError("Некорректный токен") from exc


def create_refresh_token(subject: str | int, session_id: str, expires_delta: timedelta | None = None) -> str:
    if expires_delta is None:
        expires_delta = timedelta(days=settings.refresh_token_expire_days)
    expire = datetime.now(timezone.utc) + expires_delta
    payload: dict[str, Any] = {"sub": str(subject), "sid": session_id, "exp": expire, "type": "refresh"}
    return jwt.encode(payload, settings.jwt_refresh_secret, algorithm=settings.jwt_algorithm)


def decode_refresh_token(token: str) -> dict[str, Any]:
    try:
        payload = jwt.decode(token, settings.jwt_refresh_secret, algorithms=[settings.jwt_algorithm])
        if payload.get("type") != "refresh":
            raise TokenError("Некорректный тип токена")
        return payload
    except JWTError as exc:
        raise TokenError("Некорректный refresh токен") from exc


def hash_refresh_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()
