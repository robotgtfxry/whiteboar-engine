"""Haszowanie haseł (bcrypt) i tokeny JWT. Docelowo część modułu `auth` (idea.md pkt 3.5)."""

import datetime as dt

import bcrypt
import jwt

from .config import settings

_ALG = "HS256"


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(password: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode(), hashed.encode())
    except ValueError:
        return False


def create_access_token(subject: str) -> str:
    now = dt.datetime.now(dt.timezone.utc)
    payload = {
        "sub": subject,
        "iat": now,
        "exp": now + dt.timedelta(minutes=settings.jwt_expire_minutes),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=_ALG)


def decode_token(token: str) -> str | None:
    """Zwraca `sub` (id użytkownika) albo None gdy token nieprawidłowy/wygasły."""
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[_ALG])
        return payload.get("sub")
    except jwt.PyJWTError:
        return None
