import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..access import require_access
from ..deps import get_current_user, get_db
from ..models import AccessLevel, Board, BoardPermission, User
from ..schemas import PermissionCreate, PermissionRead, PermissionUpdate

router = APIRouter(prefix="/boards/{board_id}/permissions", tags=["permissions"])


def _board_or_404(db: Session, board_id: uuid.UUID) -> Board:
    board = db.get(Board, board_id)
    if board is None:
        raise HTTPException(status_code=404, detail="Tablica nie istnieje")
    return board


@router.get("", response_model=list[PermissionRead])
def list_permissions(
    board_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    board = _board_or_404(db, board_id)
    require_access(db, board, user, AccessLevel.read)
    return db.scalars(
        select(BoardPermission).where(BoardPermission.board_id == board_id)
    ).all()


@router.post("", response_model=PermissionRead, status_code=201)
def grant_permission(
    board_id: uuid.UUID,
    payload: PermissionCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    board = _board_or_404(db, board_id)
    require_access(db, board, user, AccessLevel.owner)

    if db.get(User, payload.user_id) is None:
        raise HTTPException(status_code=404, detail="Użytkownik nie istnieje")

    existing = db.scalars(
        select(BoardPermission).where(
            BoardPermission.board_id == board_id,
            BoardPermission.user_id == payload.user_id,
        )
    ).first()
    if existing:
        # Ponowne nadanie = aktualizacja poziomu (idempotentnie).
        existing.level = payload.level
        db.commit()
        db.refresh(existing)
        return existing

    perm = BoardPermission(board_id=board_id, user_id=payload.user_id, level=payload.level)
    db.add(perm)
    db.commit()
    db.refresh(perm)
    return perm


@router.put("/{user_id}", response_model=PermissionRead)
def update_permission(
    board_id: uuid.UUID,
    user_id: uuid.UUID,
    payload: PermissionUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    board = _board_or_404(db, board_id)
    require_access(db, board, user, AccessLevel.owner)
    perm = db.scalars(
        select(BoardPermission).where(
            BoardPermission.board_id == board_id,
            BoardPermission.user_id == user_id,
        )
    ).first()
    if perm is None:
        raise HTTPException(status_code=404, detail="Taki dostęp nie istnieje")
    perm.level = payload.level
    db.commit()
    db.refresh(perm)
    return perm


@router.delete("/{user_id}", status_code=204)
def revoke_permission(
    board_id: uuid.UUID,
    user_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    board = _board_or_404(db, board_id)
    require_access(db, board, user, AccessLevel.owner)
    perm = db.scalars(
        select(BoardPermission).where(
            BoardPermission.board_id == board_id,
            BoardPermission.user_id == user_id,
        )
    ).first()
    if perm is None:
        raise HTTPException(status_code=404, detail="Taki dostęp nie istnieje")
    db.delete(perm)
    db.commit()
