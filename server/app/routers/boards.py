import json
import os
import re
import uuid
from typing import Any

from fastapi import APIRouter, Body, Depends, File, Header, HTTPException, UploadFile
from fastapi.responses import Response
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from ..access import require_access
from ..convert import ConvertError, convert_file
from ..deps import get_current_user, get_db
from ..devformat import build_dev, parse_dev
from ..models import AccessLevel, Board, BoardPermission, BoardVersion, User
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


def _snapshot(
    db: Session,
    board: Board,
    user: User,
    note: str | None = None,
    device: str | None = None,
) -> BoardVersion:
    """Zapisuje bieżący stan tablicy jako wersję w historii (bez commitu)."""
    version = BoardVersion(
        board_id=board.id,
        title=board.title,
        document=board.document,
        note=note,
        device=device,
        created_by=user.id,
    )
    db.add(version)
    return version


@router.get("", response_model=list[BoardSummary])
def list_boards(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Admin widzi wszystkie tablice; zwykły użytkownik — swoje oraz udostępnione mu."""
    stmt = select(Board).order_by(Board.updated_at.desc())
    if not user.is_admin:
        stmt = (
            select(Board)
            .outerjoin(BoardPermission, BoardPermission.board_id == Board.id)
            .where(or_(Board.owner_id == user.id, BoardPermission.user_id == user.id))
            .distinct()
            .order_by(Board.updated_at.desc())
        )
    return db.scalars(stmt).all()


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
    x_device: str | None = Header(default=None),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    board = _get_or_404(db, board_id)
    require_access(db, board, user, AccessLevel.edit)
    data = payload.model_dump(exclude_unset=True)
    if data:
        _snapshot(db, board, user, device=x_device)  # poprzedni stan → historia (kto/urządzenie)
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


# ---------- Historia wersji (audyt: kto / urządzenie / co / kiedy) ----------
def _version_summary(version: BoardVersion, author_name: str | None) -> dict[str, Any]:
    doc = version.document if isinstance(version.document, dict) else {}
    nodes = doc.get("nodes") if isinstance(doc, dict) else []
    return {
        "id": version.id,
        "board_id": version.board_id,
        "title": version.title,
        "note": version.note,
        "device": version.device,
        "created_by": version.created_by,
        "created_by_name": author_name,
        "node_count": len(nodes) if isinstance(nodes, list) else 0,
        "created_at": version.created_at,
    }


@router.get("/{board_id}/versions", response_model=list[BoardVersionSummary])
def list_versions(
    board_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Historia wersji (najnowsze pierwsze) z autorem i urządzeniem, bez treści dokumentu."""
    board = _get_or_404(db, board_id)
    require_access(db, board, user, AccessLevel.read)
    rows = db.execute(
        select(BoardVersion, User.display_name)
        .outerjoin(User, User.id == BoardVersion.created_by)
        .where(BoardVersion.board_id == board_id)
        .order_by(BoardVersion.created_at.desc())
    ).all()
    return [_version_summary(version, name) for version, name in rows]


@router.get("/{board_id}/versions/{version_id}", response_model=BoardVersionRead)
def get_version(
    board_id: uuid.UUID,
    version_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Pełna wersja z treścią dokumentu (do podglądu / eksportu do .devbrd)."""
    board = _get_or_404(db, board_id)
    require_access(db, board, user, AccessLevel.read)
    version = db.get(BoardVersion, version_id)
    if version is None or version.board_id != board_id:
        raise HTTPException(status_code=404, detail="Wersja nie istnieje")
    author = db.get(User, version.created_by) if version.created_by else None
    return {
        **_version_summary(version, author.display_name if author else None),
        "document": version.document,
    }


@router.post("/{board_id}/versions", response_model=BoardVersionRead, status_code=201)
def save_version(
    board_id: uuid.UUID,
    payload: VersionCreate,
    x_device: str | None = Header(default=None),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Ręczny snapshot bieżącego stanu (z notatką i urządzeniem). Wymaga edit."""
    board = _get_or_404(db, board_id)
    require_access(db, board, user, AccessLevel.edit)
    version = _snapshot(db, board, user, payload.note or "ręczny zapis", device=x_device)
    db.commit()
    db.refresh(version)
    return {**_version_summary(version, user.display_name), "document": version.document}


@router.post("/{board_id}/versions/{version_id}/restore", response_model=BoardRead)
def restore_version(
    board_id: uuid.UUID,
    version_id: uuid.UUID,
    x_device: str | None = Header(default=None),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Przywraca tablicę do wybranej wersji (bieżący stan trafia najpierw do historii). Wymaga edit."""
    board = _get_or_404(db, board_id)
    require_access(db, board, user, AccessLevel.edit)
    version = db.get(BoardVersion, version_id)
    if version is None or version.board_id != board_id:
        raise HTTPException(status_code=404, detail="Wersja nie istnieje")
    _snapshot(db, board, user, "przed przywróceniem wersji", device=x_device)
    board.title = version.title
    board.document = version.document
    db.commit()
    db.refresh(board)
    return board
