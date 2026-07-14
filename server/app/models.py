import uuid
from datetime import datetime
from enum import Enum

from sqlalchemy import (
    Boolean,
    DateTime,
    Enum as SAEnum,
    ForeignKey,
    String,
    UniqueConstraint,
    Uuid,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


class AccessLevel(str, Enum):
    """Poziomy dostępu do tablicy (pkt 3.11 / 4A.3 idea.md)."""

    read = "read"
    edit = "edit"
    owner = "owner"


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    display_name: Mapped[str] = mapped_column(String(255))
    hashed_password: Mapped[str | None] = mapped_column(String(255), nullable=True)
    is_admin: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class Board(Base):
    __tablename__ = "boards"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    title: Mapped[str] = mapped_column(String(255))
    owner_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    # Treść tablicy jako dowolny JSON (docelowo uniwersalny model z packages/core).
    # Na tym etapie serwer nie waliduje struktury — patrz idea.md pkt 5.1 (wersjonowanie schematu).
    document: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)
    # Prywatny, tajny identyfikator tablicy (32 znaki hex) — NIE pojawia się w URL.
    # Publiczny/współdzielony jest id pokoju (Room); tablica żyje w pokoju.
    secret: Mapped[str | None] = mapped_column(String(64), unique=True, index=True, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    permissions: Mapped[list["BoardPermission"]] = relationship(
        back_populates="board", cascade="all, delete-orphan"
    )
    room: Mapped["Room | None"] = relationship(
        back_populates="board", uselist=False, cascade="all, delete-orphan"
    )

    @property
    def room_id(self) -> str | None:
        """Publiczny id pokoju (w URL). None gdy tablica nie ma jeszcze pokoju."""
        return self.room.id if self.room else None


class BoardPermission(Base):
    __tablename__ = "board_permissions"
    __table_args__ = (UniqueConstraint("board_id", "user_id", name="uq_board_user"),)

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    board_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("boards.id", ondelete="CASCADE"), index=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    level: Mapped[AccessLevel] = mapped_column(
        SAEnum(AccessLevel, name="access_level"), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    board: Mapped["Board"] = relationship(back_populates="permissions")


class BoardVersion(Base):
    """Snapshot stanu tablicy (historia wersji). Tworzony przy zapisie i ręcznie.

    Osobna tabela (nie zmienia istniejących) — historia rośnie niezależnie od bieżącej tablicy.
    """

    __tablename__ = "board_versions"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    board_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("boards.id", ondelete="CASCADE"), index=True
    )
    title: Mapped[str] = mapped_column(String(255))
    document: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)
    note: Mapped[str | None] = mapped_column(String(255), nullable=True)
    device: Mapped[str | None] = mapped_column(String(255), nullable=True)  # z którego urządzenia
    created_by: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class Room(Base):
    """Pokój (sesja) — publiczny, współdzielony uchwyt tablicy. To jego id trafia do URL.

    Tablica (Board) ma prywatny sekret; pokój jest tym, co udostępniasz linkiem. 1 pokój → 1 tablica.
    """

    __tablename__ = "rooms"

    id: Mapped[str] = mapped_column(String(32), primary_key=True)  # publiczny id pokoju (w URL)
    board_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("boards.id", ondelete="CASCADE"), unique=True, index=True
    )
    owner_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    board: Mapped["Board"] = relationship(back_populates="room")
