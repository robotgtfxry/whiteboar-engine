"""Warstwa konwersji formatów źródłowych → uniwersalny model (idea.md pkt 3.2).

Rejestr formatów: rozpoznaje format po TREŚCI (markery), nie po rozszerzeniu, i deleguje do
właściwego importera. Odpowiednik apps/web/packages/importers/index.ts, ale po stronie serwera
(konwersja wsadowa/bezgłowa, pkt 3.5). Obecnie import: `.excalidraw`. `.devbrd` ma własną ścieżkę
(`/boards/import`); `.svg`/`.drawio` — na razie tylko po stronie klienta (jasny komunikat tutaj).
"""

from __future__ import annotations

import json
from typing import Any

from .errors import ConvertError
from .excalidraw import convert_excalidraw, is_excalidraw
from .model import ConvertResult

__all__ = ["ConvertError", "ConvertResult", "convert_file", "convert_excalidraw", "detect_format"]

_DEV_FORMAT = "whiteboard-engine/dev"


def _strip_bom(text: str) -> str:
    return text[1:] if text and ord(text[0]) == 0xFEFF else text


def detect_format(text: str) -> str:
    """Rozpoznaje format po treści. Zwraca jeden z:
    'excalidraw' | 'dev' | 'svg' | 'drawio' | 'xml' | 'json' | 'invalid'.
    """
    head = _strip_bom(text).lstrip()
    if head.startswith("<"):
        low = head[:1024].lower()
        if "<svg" in low:
            return "svg"
        if "<mxfile" in low or "<mxgraphmodel" in low:
            return "drawio"
        return "xml"
    try:
        data: Any = json.loads(head)
    except json.JSONDecodeError:
        return "invalid"
    if isinstance(data, dict):
        if data.get("format") == _DEV_FORMAT:
            return "dev"
        if is_excalidraw(data):
            return "excalidraw"
    return "json"


def convert_file(filename: str, content: bytes | str) -> ConvertResult:
    """Rozpoznaje format i deleguje do właściwego importera. Rzuca `ConvertError`."""
    if isinstance(content, (bytes, bytearray)):
        try:
            text = content.decode("utf-8")
        except UnicodeDecodeError as exc:
            raise ConvertError("Plik nie jest tekstem w kodowaniu UTF-8.") from exc
    else:
        text = content

    fmt = detect_format(text)
    if fmt == "excalidraw":
        return convert_excalidraw(json.loads(_strip_bom(text)))
    if fmt == "dev":
        raise ConvertError("To plik natywnego formatu .devbrd — użyj POST /boards/import.")
    if fmt == "svg":
        raise ConvertError("Pliki SVG nie są jeszcze obsługiwane po stronie serwera.")
    if fmt == "drawio":
        raise ConvertError("Pliki draw.io (.drawio) nie są jeszcze obsługiwane po stronie serwera.")
    if fmt == "xml":
        raise ConvertError("Nierozpoznany format XML. Endpoint /convert przyjmuje pliki .excalidraw.")
    if fmt == "invalid":
        raise ConvertError("Plik nie jest poprawnym JSON-em ani XML-em.")
    # fmt == "json": poprawny JSON, ale nie rozpoznany jako obsługiwany format
    raise ConvertError("Nierozpoznany plik JSON. Endpoint /convert przyjmuje pliki .excalidraw.")
