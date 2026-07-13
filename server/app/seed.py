from sqlalchemy import select
from sqlalchemy.orm import Session

from .config import settings
from .models import User
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
