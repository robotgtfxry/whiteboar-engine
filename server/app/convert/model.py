"""Serwerowy mirror uniwersalnego modelu (apps/web/src/model.ts).

Importery operują wyłącznie na tym modelu — bez zależności od bazy, UI czy sieci
(idea.md pkt 3.1/3.10). Docelowo wspólna definicja trafi do packages/core.

Węzły to zwykłe słowniki JSON (klucze jak w model.ts) — od razu zdatne do zapisu
w kolumnie JSONB `Board.document` i do serializacji w odpowiedzi API.
"""

from __future__ import annotations

from typing import Any, TypedDict

MODEL_VERSION = 1

# Typy węzłów, które renderuje klient (apps/web/src/BoardCanvas.tsx). Wszystko poza tym
# zbiorem trafia jako "unknown" = opaque, z zachowaniem danych źródłowych (idea.md pkt 3.1).
KNOWN_NODE_TYPES: frozenset[str] = frozenset(
    {"rect", "ellipse", "diamond", "text", "line", "arrow", "draw"}
)


class UniNode(TypedDict, total=False):
    """Węzeł uniwersalnego modelu. Pola opcjonalne pomijamy, gdy puste (patrz `prune`)."""

    id: str
    type: str
    x: float
    y: float
    width: float
    height: float
    angle: float
    points: list[list[float]]  # dla line/arrow/draw — względem (x, y)
    text: str
    fontSize: float
    stroke: str
    fill: str
    strokeWidth: float
    sourceType: str  # oryginalny typ ze źródła (round-trip / opaque)
    # --- rozszerzenia importera serwerowego (bogatsza wierność vs. wersja kliencka) ---
    opacity: float  # 0..1 (znormalizowane)
    strokeStyle: str  # "dashed" | "dotted" (solid pomijamy jako domyślny)
    fillStyle: str  # "hachure" | "cross-hatch" | "solid" | "zigzag"
    roughness: float
    fontFamily: str
    textAlign: str
    textColor: str  # kolor etykiety scalonej w kształt (osobny od koloru obrysu kształtu)
    link: str
    groupIds: list[str]  # przynależność do grup (idea.md pkt 3.1)
    start: str  # id elementu dowiązanego do początku strzałki (punkt zaczepienia)
    end: str  # id elementu dowiązanego do końca strzałki
    source: dict[str, Any]  # oryginalny element źródłowy (opaque round-trip, idea.md pkt 3.1)


class UniDoc(TypedDict, total=False):
    version: int
    source: str
    fidelity: int
    nodes: list[UniNode]


class ConvertResult(TypedDict):
    """Wynik konwersji: dokument + diagnostyka (ostrzeżenia i statystyki)."""

    document: UniDoc
    source: str
    fidelity: int
    warnings: list[str]
    stats: dict[str, Any]


def prune(node: dict[str, Any]) -> dict[str, Any]:
    """Usuwa puste pola (None / [] / "") — jak `undefined` pomijane przez JSON.stringify po stronie web.

    Zera i wartości False pozostają (np. width=0 jest znaczące).
    """
    return {k: v for k, v in node.items() if not (v is None or v == [] or v == "")}


def make_document(source: str, fidelity: int, nodes: list[UniNode]) -> UniDoc:
    return {"version": MODEL_VERSION, "source": source, "fidelity": fidelity, "nodes": nodes}
