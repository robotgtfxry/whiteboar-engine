import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from .models import AccessLevel


# ---------- Auth ----------
class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


# ---------- Users ----------
class UserCreate(BaseModel):
    email: EmailStr
    display_name: str = Field(min_length=1, max_length=255)
    password: str = Field(min_length=6, max_length=128)
    is_admin: bool = False


class UserUpdate(BaseModel):
    display_name: str | None = Field(default=None, min_length=1, max_length=255)
    is_admin: bool | None = None


class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    # str, nie EmailStr — na wyjściu nie walidujemy (dopuszczamy np. wewnętrzny admin@local).
    email: str
    display_name: str
    is_admin: bool
    created_at: datetime


# ---------- Boards ----------
class BoardCreate(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    document: dict[str, Any] = Field(default_factory=dict)


class BoardUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    document: dict[str, Any] | None = None


class BoardRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    title: str
    owner_id: uuid.UUID
    document: dict[str, Any]
    created_at: datetime
    updated_at: datetime


class BoardSummary(BaseModel):
    """Lekki wariant listy — bez treści dokumentu."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    title: str
    owner_id: uuid.UUID
    created_at: datetime
    updated_at: datetime


# ---------- Board versions ----------
class VersionCreate(BaseModel):
    note: str | None = Field(default=None, max_length=255)


class BoardVersionSummary(BaseModel):
    """Pozycja historii — bez treści dokumentu."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    board_id: uuid.UUID
    title: str
    note: str | None = None
    created_by: uuid.UUID | None = None
    created_at: datetime


class BoardVersionRead(BoardVersionSummary):
    document: dict[str, Any]


# ---------- Convert ----------
class ConvertResult(BaseModel):
    """Wynik konwersji formatu źródłowego na uniwersalny model (podgląd, bez zapisu)."""

    document: dict[str, Any]
    source: str | None = None
    fidelity: int | None = None  # poziom wierności (idea.md pkt 2)
    warnings: list[str] = Field(default_factory=list)
    stats: dict[str, Any] = Field(default_factory=dict)


# ---------- Permissions ----------
class PermissionCreate(BaseModel):
    user_id: uuid.UUID
    level: AccessLevel


class PermissionUpdate(BaseModel):
    level: AccessLevel


class PermissionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    board_id: uuid.UUID
    user_id: uuid.UUID
    level: AccessLevel
    created_at: datetime
