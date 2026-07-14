import secrets

from sqlalchemy import select
from sqlalchemy.orm import Session

from .config import settings
from .models import Board, Room, User
from .security import hash_password


def seed_admin(db: Session) -> User:
    """Zakłada konto admina przy pierwszym starcie (login: admin_email / admin_password)."""
    admin = db.scalars(select(User).where(User.is_admin.is_(True))).first()
    if admin is None:
        admin = User(
            email=settings.admin_email,
            display_name=settings.admin_name,
            hashed_password=hash_password(settings.admin_password),
            is_admin=True,
        )
        db.add(admin)
        db.commit()
        db.refresh(admin)
    elif not admin.hashed_password:
        # Admin z wcześniejszej wersji bez hasła — ustaw hasło z konfiguracji.
        admin.hashed_password = hash_password(settings.admin_password)
        db.commit()
    return admin


def backfill_boards(db: Session) -> None:
    """Dorabia prywatny sekret i publiczny pokój tablicom sprzed tej funkcji (idempotentnie)."""
    changed = False
    for board in db.scalars(select(Board)).all():
        if not board.secret:
            board.secret = secrets.token_hex(16)
            changed = True
        if db.scalar(select(Room).where(Room.board_id == board.id)) is None:
            db.add(Room(id=secrets.token_urlsafe(9), board_id=board.id, owner_id=board.owner_id))
            changed = True
    if changed:
        db.commit()
