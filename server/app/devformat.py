"""Serwerowa obsługa natywnego formatu `.devbrd` (lustro apps/web/src/format/dev.ts).

Kontener JSON: nagłówek `format`, `version` schematu, `meta` oraz `document` (uniwersalny model).
Docelowo wspólna definicja trafi do packages/core (idea.md pkt 3.7 / 5.1).
"""

import datetime as dt
from typing import Any

DEV_FORMAT = "whiteboard-engine/dev"
DEV_VERSION = 1
GENERATOR = "whiteboard-engine api 0.1.0"


def build_dev(board) -> dict[str, Any]:
    doc = board.document if isinstance(board.document, dict) else {"version": 1, "nodes": []}
    nodes = doc.get("nodes", []) if isinstance(doc, dict) else []
    return {
        "format": DEV_FORMAT,
        "version": DEV_VERSION,
        "meta": {
            "id": str(board.id),
            "title": board.title,
            "exportedAt": dt.datetime.now(dt.timezone.utc).isoformat(),
            "generator": GENERATOR,
            "nodeCount": len(nodes),
        },
        "document": doc,
    }


def parse_dev(payload: dict[str, Any]) -> tuple[dict[str, Any], str | None]:
    """Waliduje kontener `.devbrd` i zwraca (document, tytuł). Rzuca ValueError przy niezgodności."""
    if not isinstance(payload, dict):
        raise ValueError("Nieprawidłowa treść pliku .devbrd.")
    if payload.get("format") != DEV_FORMAT:
        raise ValueError("To nie jest plik formatu .devbrd (brak nagłówka formatu).")
    version = payload.get("version")
    if not isinstance(version, int):
        raise ValueError("Plik .devbrd bez numeru wersji schematu.")
    if version > DEV_VERSION:
        raise ValueError(
            f"Wersja formatu .devbrd ({version}) jest nowsza niż obsługiwana ({DEV_VERSION})."
        )
    document = payload.get("document")
    if not isinstance(document, dict) or not isinstance(document.get("nodes"), list):
        raise ValueError("Plik .devbrd nie zawiera poprawnego dokumentu.")
    meta = payload.get("meta")
    title = meta.get("title") if isinstance(meta, dict) else None
    return document, title
