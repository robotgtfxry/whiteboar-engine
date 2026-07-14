import json
import os
import re
import uuid
from typing import Any

from fastapi import APIRouter, Body, Depends, File, HTTPException, UploadFile
from fastapi.responses import Response
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from ..access import require_access
from ..convert import ConvertError, convert_file
from ..deps import get_current_user, get_db
from ..devformat import build_dev, parse_dev
from ..models import (
    AccessLevel,
    Board,
    BoardArchive,
    BoardPermission,
    BoardVersion,
    User,
)
from ..schemas import (
    BoardCreate,
    BoardRead,
    BoardSummary,
    BoardUpdate,
    BoardVersionRead,
    BoardVersionSummary,
    VersionCreate,
)

MAX_UPLOAD_BYTES = 25 * 1024 * 1024

router = APIRouter(prefix="/boards", tags=["boards"])


def _get_or_404(db: Session, board_id: uuid.UUID) -> Board:
    board = db.get(Board, board_id)
    if board is None:
        raise HTTPException(status_code=404, detail="Tablica nie istnieje")
    return board


def _snapshot(db: Session, board: Board, user: User, note: str | None = None) -> BoardVersion:
    """Zapisuje bieżący stan tablicy jako wersję w historii (bez commitu)."""
    version = BoardVersion(
        board_id=board.id,
        title=board.title,
        document=board.document,
        note=note,
        created_by=user.id,
    )
    db.add(version)
    return version


@router.get("", response_model=list[BoardSummary])
def list_boards(
    archived: bool = False,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Admin widzi wszystkie tablice; zwykły użytkownik — swoje oraz udostępnione mu.

    Domyślnie pomija zarchiwizowane; `?archived=true` zwraca wyłącznie archiwum.
    """
    stmt = select(Board)
    if not user.is_admin:
        stmt = (
            select(Board)
            .outerjoin(BoardPermission, BoardPermission.board_id == Board.id)
            .where(or_(Board.owner_id == user.id, BoardPermission.user_id == user.id))
            .distinct()
        )
    archived_ids = select(BoardArchive.board_id)
    stmt = stmt.where(Board.id.in_(archived_ids) if archived else Board.id.not_in(archived_ids))
    return db.scalars(stmt.order_by(Board.updated_at.desc())).all()


@router.post("", response_model=BoardRead, status_code=201)
def create_board(
    payload: BoardCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    board = Board(title=payload.title, document=payload.document, owner_id=user.id)
    db.add(board)
    db.commit()
    db.refresh(board)
    return board


@router.post("/import", response_model=BoardRead, status_code=201)
def import_dev(
    payload: dict[str, Any] = Body(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Tworzy nową tablicę z wgranego kontenera `.devbrd` (właścicielem jest zalogowany użytkownik)."""
    try:
        document, title = parse_dev(payload)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    board = Board(title=title or "Import .devbrd", document=document, owner_id=user.id)
    db.add(board)
    db.commit()
    db.refresh(board)
    return board


@router.post("/import-file", response_model=BoardRead, status_code=201)
async def import_file(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Konwertuje wgrany plik źródłowy (np. `.excalidraw`) i tworzy z niego nową tablicę.

    Konwersja idzie przez wspólny importer serwerowy (app/convert) — patrz też
    bezstanowy podgląd `POST /convert`. Tytuł tablicy bierzemy z nazwy pliku.
    """
    raw = await file.read()
    if len(raw) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="Plik jest za duży (limit 25 MB).")
    try:
        result = convert_file(file.filename or "", raw)
    except ConvertError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    title = os.path.splitext(os.path.basename(file.filename or ""))[0] or "Import"
    board = Board(title=title, document=result["document"], owner_id=user.id)
    db.add(board)
    db.commit()
    db.refresh(board)
    return board


@router.get("/{board_id}", response_model=BoardRead)
def get_board(
    board_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    board = _get_or_404(db, board_id)
    require_access(db, board, user, AccessLevel.read)
    return board


@router.get("/{board_id}/export")
def export_dev(
    board_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Pobiera tablicę jako plik `.devbrd` (wymaga dostępu read)."""
    board = _get_or_404(db, board_id)
    require_access(db, board, user, AccessLevel.read)
    dev = build_dev(board)
    safe = re.sub(r"[^\w\-]+", "_", board.title or "tablica").strip("_") or "tablica"
    content = json.dumps(dev, ensure_ascii=False, indent=2)
    return Response(
        content=content,
        media_type="application/json",
        headers={"Content-Disposition": f'attachment; filename="{safe}.devbrd"'},
    )


@router.put("/{board_id}", response_model=BoardRead)
def update_board(
    board_id: uuid.UUID,
    payload: BoardUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    board = _get_or_404(db, board_id)
    require_access(db, board, user, AccessLevel.edit)
    data = payload.model_dump(exclude_unset=True)
    if data:
        _snapshot(db, board, user)  # zachowaj poprzedni stan w historii przed nadpisaniem
    for field, value in data.items():
        setattr(board, field, value)
    db.commit()
    db.refresh(board)
    return board


@router.delete("/{board_id}", status_code=204)
def delete_board(
    board_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    board = _get_or_404(db, board_id)
    require_access(db, board, user, AccessLevel.owner)
    db.delete(board)
    db.commit()


# ---------- Archiwizacja ----------
@router.post("/{board_id}/archive", status_code=204)
def archive_board(
    board_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Archiwizuje tablicę (ukrywa z domyślnej listy, bez usuwania). Wymaga owner."""
    board = _get_or_404(db, board_id)
    require_access(db, board, user, AccessLevel.owner)
    if db.get(BoardArchive, board_id) is None:
        db.add(BoardArchive(board_id=board_id, archived_by=user.id))
        db.commit()


@router.post("/{board_id}/unarchive", status_code=204)
def unarchive_board(
    board_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Przywraca tablicę z archiwum. Wymaga owner."""
    board = _get_or_404(db, board_id)
    require_access(db, board, user, AccessLevel.owner)
    row = db.get(BoardArchive, board_id)
    if row is not None:
        db.delete(row)
        db.commit()


# ---------- Historia wersji ----------
@router.get("/{board_id}/versions", response_model=list[BoardVersionSummary])
def list_versions(
    board_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Lista wersji tablicy (najnowsze pierwsze), bez treści dokumentu."""
    board = _get_or_404(db, board_id)
    require_access(db, board, user, AccessLevel.read)
    stmt = (
        select(BoardVersion)
        .where(BoardVersion.board_id == board_id)
        .order_by(BoardVersion.created_at.desc())
    )
    return db.scalars(stmt).all()


@router.get("/{board_id}/versions/{version_id}", response_model=BoardVersionRead)
def get_version(
    board_id: uuid.UUID,
    version_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Pełna wersja z treścią dokumentu (do podglądu/eksportu do .devbrd)."""
    board = _get_or_404(db, board_id)
    require_access(db, board, user, AccessLevel.read)
    version = db.get(BoardVersion, version_id)
    if version is None or version.board_id != board_id:
        raise HTTPException(status_code=404, detail="Wersja nie istnieje")
    return version


@router.post("/{board_id}/versions", response_model=BoardVersionRead, status_code=201)
def save_version(
    board_id: uuid.UUID,
    payload: VersionCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Ręczny snapshot bieżącego stanu tablicy (z opcjonalną notatką). Wymaga edit."""
    board = _get_or_404(db, board_id)
    require_access(db, board, user, AccessLevel.edit)
    version = _snapshot(db, board, user, payload.note or "ręczny zapis")
    db.commit()
    db.refresh(version)
    return version


@router.post("/{board_id}/versions/{version_id}/restore", response_model=BoardRead)
def restore_version(
    board_id: uuid.UUID,
    version_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Przywraca tablicę do wybranej wersji (bieżący stan trafia najpierw do historii). Wymaga edit."""
    board = _get_or_404(db, board_id)
    require_access(db, board, user, AccessLevel.edit)
    version = db.get(BoardVersion, version_id)
    if version is None or version.board_id != board_id:
        raise HTTPException(status_code=404, detail="Wersja nie istnieje")
    _snapshot(db, board, user, "przed przywróceniem wersji")
    board.title = version.title
    board.document = version.document
    db.commit()
    db.refresh(board)
    return board
