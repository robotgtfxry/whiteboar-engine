import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from ..access import require_access
from ..deps import get_current_user, get_db
from ..models import AccessLevel, Board, BoardPermission, User
from ..schemas import BoardCreate, BoardRead, BoardSummary, BoardUpdate

router = APIRouter(prefix="/boards", tags=["boards"])


def _get_or_404(db: Session, board_id: uuid.UUID) -> Board:
    board = db.get(Board, board_id)
    if board is None:
        raise HTTPException(status_code=404, detail="Tablica nie istnieje")
    return board


@router.get("", response_model=list[BoardSummary])
def list_boards(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Admin widzi wszystkie tablice; zwykły użytkownik — swoje oraz udostępnione mu."""
    stmt = select(Board).order_by(Board.updated_at.desc())
    if not user.is_admin:
        stmt = (
            select(Board)
            .outerjoin(BoardPermission, BoardPermission.board_id == Board.id)
            .where(
                or_(
                    Board.owner_id == user.id,
                    BoardPermission.user_id == user.id,
                )
            )
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


@router.get("/{board_id}", response_model=BoardRead)
def get_board(
    board_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    board = _get_or_404(db, board_id)
    require_access(db, board, user, AccessLevel.read)
    return board


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
