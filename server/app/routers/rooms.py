"""Pokoje (sesje) — publiczny uchwyt tablicy. To id pokoju trafia do URL (`/room/<id>`).

Tablica ma prywatny sekret; pokój jest tym, co udostępniasz linkiem. Endpoint tłumaczy
publiczny id pokoju na tablicę (z kontrolą dostępu jak dla samej tablicy).
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..access import require_access
from ..deps import get_current_user, get_db
from ..models import AccessLevel, Board, Room, User
from ..schemas import BoardRead

router = APIRouter(prefix="/rooms", tags=["rooms"])


@router.get("/{room_id}", response_model=BoardRead)
def get_room(
    room_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Otwiera tablicę po publicznym id pokoju (wymaga dostępu read do tablicy)."""
    room = db.get(Room, room_id)
    if room is None:
        raise HTTPException(status_code=404, detail="Pokój nie istnieje")
    board = db.get(Board, room.board_id)
    if board is None:
        raise HTTPException(status_code=404, detail="Tablica pokoju nie istnieje")
    require_access(db, board, user, AccessLevel.read)
    return board
