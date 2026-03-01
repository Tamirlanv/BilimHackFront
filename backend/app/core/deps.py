from collections.abc import Generator
from datetime import datetime, timedelta, timezone
from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import TokenError, decode_access_token
from app.db.session import SessionLocal
from app.models import User, UserRole, UserSession

_token_url = f"{settings.api_prefix_normalized}/auth/login" if settings.api_prefix_normalized else "/auth/login"
oauth2_scheme = OAuth2PasswordBearer(tokenUrl=_token_url)


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


DBSession = Annotated[Session, Depends(get_db)]


def get_current_user(db: DBSession, token: Annotated[str, Depends(oauth2_scheme)]) -> User:
    try:
        payload = decode_access_token(token)
    except TokenError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Неверные учетные данные") from exc

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Неверные учетные данные")

    session_id = payload.get("sid")
    if isinstance(session_id, str) and session_id:
        session = db.get(UserSession, session_id)
        if session and session.user_id == int(user_id) and session.revoked_at is None:
            now = datetime.now(timezone.utc)
            # Avoid committing on every request; update heartbeat roughly once per minute.
            if session.last_used_at <= now - timedelta(seconds=60):
                session.last_used_at = now
                db.commit()

    user = db.get(User, int(user_id))
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Пользователь не найден")
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]


def require_role(*roles: UserRole):
    def _checker(current_user: CurrentUser) -> User:
        if current_user.role not in roles:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Недостаточно прав доступа")
        return current_user

    return _checker
