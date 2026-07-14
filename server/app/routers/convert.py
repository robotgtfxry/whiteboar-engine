"""Endpoint konwersji formatów źródłowych → uniwersalny model (idea.md pkt 3.2/3.5).

Bezstanowy podgląd: przyjmuje wgrany plik (np. `.excalidraw`) i zwraca uniwersalny
dokument wraz z diagnostyką (ostrzeżenia o utracie/degradacji danych, statystyki).
Utworzenie tablicy z pliku: patrz `POST /boards/import-file`.
"""

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile

from ..convert import ConvertError, convert_file
from ..deps import get_current_user
from ..models import User
from ..schemas import ConvertResult

router = APIRouter(prefix="/convert", tags=["convert"])

# Zabezpieczenie przed nadmiernie dużym wsadem (dataURL-e w .excalidraw potrafią puchnąć).
MAX_UPLOAD_BYTES = 25 * 1024 * 1024


@router.post("", response_model=ConvertResult)
async def convert(
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
) -> ConvertResult:
    raw = await file.read()
    if len(raw) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="Plik jest za duży (limit 25 MB).")
    try:
        result = convert_file(file.filename or "", raw)
    except ConvertError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return result
