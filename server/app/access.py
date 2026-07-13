"""Logika kontroli dostępu do tablic — jedno miejsce prawdy dla wszystkich routerów."""

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from .models import AccessLevel, Board, BoardPermission, User

# Porządek poziomów — do porównań „czy wystarczający".
_ORDER = {AccessLevel.read: 1, AccessLevel.edit: 2, AccessLevel.owner: 3}


def effective_level(db: Session, board: Board, user: User) -> AccessLevel | None:
    """Efektywny poziom dostępu użytkownika do tablicy, albo None gdy brak dostępu."""
    if user.is_admin:
        return AccessLevel.owner
    if board.owner_id == user.id:
        return AccessLevel.owner
    perm = db.scalars(
        select(BoardPermission).where(
            BoardPermission.board_id == board.id,
            BoardPermission.user_id == user.id,
        )
    ).first()
    return perm.level if perm else None


def require_access(db: Session, board: Board, user: User, minimum: AccessLevel) -> AccessLevel:
    """Rzuca 403, jeśli użytkownik nie ma co najmniej `minimum` dostępu do tablicy."""
    level = effective_level(db, board, user)
    if level is None or _ORDER[level] < _ORDER[minimum]:
        raise HTTPException(status_code=403, detail="Brak wystarczających uprawnień do tej tablicy")
    return level
