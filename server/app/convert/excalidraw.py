"""Importer .excalidraw → uniwersalny model (idea.md pkt 3.2).

Poziom wierności 1 (natywny, otwarty JSON — pkt 2). Bogatszy odpowiednik
apps/web/src/convert/excalidraw.ts. Ponad wersję kliencką dokłada:

- scalanie etykiet: tekst dowiązany do kształtu (`containerId`) wraca jako `text`
  kontenera, a nie osobny, źle umiejscowiony węzeł tekstowy;
- grupy: zachowanie `groupIds` (idea.md pkt 3.1);
- dowiązania strzałek: `startBinding`/`endBinding` → `start`/`end` (punkty zaczepienia
  krawędzi — istotne dla round-tripu i przyszłego draw.io, pkt 3.1);
- opaque: nierozpoznane elementy (image/frame/embeddable/iframe…) zachowują pełne dane
  źródłowe w `source`, żeby dało się je odtworzyć przy eksporcie wstecznym (pkt 3.1);
- bogatsze style: opacity, strokeStyle, fillStyle, roughness, fontFamily, textAlign, angle, link;
- walidacja wejścia i zbierane ostrzeżenia (`warnings`) o utracie/degradacji danych.
"""

from __future__ import annotations

from typing import Any

from .errors import ConvertError
from .model import ConvertResult, UniNode, make_document, prune

# Excalidraw type → typ uniwersalnego modelu. Brak w mapie = "unknown" (opaque).
_TYPE_MAP: dict[str, str] = {
    "rectangle": "rect",
    "ellipse": "ellipse",
    "diamond": "diamond",
    "text": "text",
    "line": "line",
    "arrow": "arrow",
    "freedraw": "draw",
}

# Excalidraw koduje czcionkę liczbą; mapujemy znane rodziny na czytelne nazwy.
_FONT_FAMILY: dict[int, str] = {
    1: "hand-drawn",  # Virgil
    2: "normal",  # Helvetica
    3: "code",  # Cascadia
    5: "excalifont",
    6: "nunito",
    7: "lilita",
    8: "comic",
}

_LINEAR_TYPES = {"line", "arrow"}


def is_excalidraw(data: Any) -> bool:
    """Czy dane wyglądają na scenę Excalidraw (po nagłówku lub obecności `elements`)."""
    return isinstance(data, dict) and (
        data.get("type") == "excalidraw" or isinstance(data.get("elements"), list)
    )


def _num(v: Any, default: float = 0.0) -> float:
    return float(v) if isinstance(v, (int, float)) and not isinstance(v, bool) else default


def _opt_num(v: Any) -> float | None:
    return float(v) if isinstance(v, (int, float)) and not isinstance(v, bool) else None


def _color(v: Any) -> str | None:
    return v if isinstance(v, str) and v and v != "transparent" else None


def _points(el: dict[str, Any]) -> list[list[float]] | None:
    raw = el.get("points")
    if not isinstance(raw, list):
        return None
    out: list[list[float]] = []
    for p in raw:
        if isinstance(p, (list, tuple)) and len(p) >= 2:
            out.append([_num(p[0]), _num(p[1])])
    return out or None


def _binding_target(binding: Any) -> str | None:
    """Zwraca id elementu, do którego dowiązany jest koniec strzałki (albo None)."""
    if isinstance(binding, dict):
        eid = binding.get("elementId")
        return eid if isinstance(eid, str) else None
    return None


def _font_family(v: Any) -> str | None:
    if isinstance(v, int):
        return _FONT_FAMILY.get(v, str(v))
    return v if isinstance(v, str) and v else None


def _apply_label(node: dict[str, Any], label: dict[str, Any]) -> None:
    """Wnosi tekst dowiązanej etykiety do węzła kontenera."""
    text = label.get("text")
    if isinstance(text, str) and text:
        node["text"] = text
    node["fontSize"] = _opt_num(label.get("fontSize"))
    node["fontFamily"] = _font_family(label.get("fontFamily"))
    align = label.get("textAlign")
    if align in {"center", "right"}:  # "left" = domyślny, pomijamy
        node["textAlign"] = align
    color = _color(label.get("strokeColor"))
    if color is not None:  # kolor tekstu bywa inny niż kolor obrysu kontenera
        node["textColor"] = color


def convert_excalidraw(data: Any) -> ConvertResult:
    """Konwertuje scenę .excalidraw (już sparsowany JSON) na uniwersalny dokument."""
    if not is_excalidraw(data):
        raise ConvertError("To nie wygląda na plik .excalidraw (brak tablicy 'elements').")

    warnings: list[str] = []
    declared = data.get("type")
    if declared not in (None, "excalidraw"):
        warnings.append(f"Plik nie deklaruje type=excalidraw (znaleziono: {declared!r}).")

    raw_elements = data.get("elements")
    elements: list[dict[str, Any]] = [
        e for e in raw_elements if isinstance(e, dict) and not e.get("isDeleted")
    ] if isinstance(raw_elements, list) else []

    by_id: dict[str, dict[str, Any]] = {
        e["id"]: e for e in elements if isinstance(e.get("id"), str)
    }

    # Etykiety dowiązane do kształtów: tekst z `containerId` scalamy z kontenerem,
    # zamiast emitować jako osobny (mylnie umiejscowiony) węzeł tekstowy.
    labels: dict[str, dict[str, Any]] = {}
    consumed_ids: set[str] = set()
    for e in elements:
        if e.get("type") == "text":
            cid = e.get("containerId")
            if isinstance(cid, str) and cid in by_id and cid != e.get("id"):
                labels[cid] = e
                if isinstance(e.get("id"), str):
                    consumed_ids.add(e["id"])

    nodes: list[UniNode] = []
    group_ids: set[str] = set()
    opaque = 0
    image_count = 0

    for i, e in enumerate(elements):
        eid = e["id"] if isinstance(e.get("id"), str) else f"n{i}"
        if eid in consumed_ids:
            continue  # etykieta scalona z kontenerem

        etype = e.get("type", "")
        ntype = _TYPE_MAP.get(etype, "unknown")

        node: dict[str, Any] = {
            "id": eid,
            "type": ntype,
            "x": _num(e.get("x")),
            "y": _num(e.get("y")),
            "width": _num(e.get("width")),
            "height": _num(e.get("height")),
            "angle": _opt_num(e.get("angle")) or None,  # 0 pomijamy
            "stroke": _color(e.get("strokeColor")),
            "fill": _color(e.get("backgroundColor")),
            "strokeWidth": _opt_num(e.get("strokeWidth")),
            "sourceType": etype or None,
        }

        # Nieprzezroczystość (Excalidraw 0..100) → 0..1; pomijamy pełne 100.
        opacity = _opt_num(e.get("opacity"))
        if opacity is not None and opacity < 100:
            node["opacity"] = round(max(opacity, 0.0) / 100, 3)

        # Styl linii i wypełnienia (tylko warianty inne niż domyślne / znaczące).
        if e.get("strokeStyle") in {"dashed", "dotted"}:
            node["strokeStyle"] = e["strokeStyle"]
        if node["fill"] is not None and isinstance(e.get("fillStyle"), str):
            node["fillStyle"] = e["fillStyle"]
        roughness = _opt_num(e.get("roughness"))
        if roughness is not None and roughness != 1:  # 1 = domyślny
            node["roughness"] = roughness
        if isinstance(e.get("link"), str) and e["link"]:
            node["link"] = e["link"]

        # Grupy.
        gids = e.get("groupIds")
        if isinstance(gids, list):
            valid = [g for g in gids if isinstance(g, str)]
            if valid:
                node["groupIds"] = valid
                group_ids.update(valid)

        # Tekst.
        if ntype == "text":
            node["text"] = e.get("text") if isinstance(e.get("text"), str) else None
            node["fontSize"] = _opt_num(e.get("fontSize"))
            node["fontFamily"] = _font_family(e.get("fontFamily"))
            if e.get("textAlign") in {"center", "right"}:
                node["textAlign"] = e["textAlign"]

        # Linie/strzałki: punkty + dowiązania końców (punkty zaczepienia krawędzi).
        if ntype in _LINEAR_TYPES or ntype == "draw":
            node["points"] = _points(e)
        if ntype in _LINEAR_TYPES:
            node["start"] = _binding_target(e.get("startBinding"))
            node["end"] = _binding_target(e.get("endBinding"))

        # Etykieta dowiązana do tego kształtu.
        label = labels.get(eid)
        if label is not None and ntype != "text":
            _apply_label(node, label)

        # Opaque: zachowaj pełne dane źródłowe do eksportu wstecznego.
        if ntype == "unknown":
            opaque += 1
            node["source"] = e
            if etype == "image":
                image_count += 1

        nodes.append(prune(node))  # type: ignore[arg-type]

    if not nodes:
        warnings.append("Plik nie zawiera obsługiwanych elementów.")
    if consumed_ids:
        warnings.append(f"Scalono {len(consumed_ids)} etykiet z kształtami-kontenerami.")
    if opaque:
        warnings.append(
            f"{opaque} element(ów) nierozpoznanych zachowano jako opaque (dane źródłowe zachowane)."
        )
    if image_count:
        warnings.append(
            f"{image_count} obraz(ów): dane binarne nie są osadzane (zachowano fileId w danych źródłowych)."
        )

    stats: dict[str, Any] = {
        "nodes": len(nodes),
        "opaque": opaque,
        "groups": len(group_ids),
        "mergedLabels": len(consumed_ids),
        "images": image_count,
        "sourceVersion": data.get("version"),
    }

    return {
        "document": make_document("excalidraw", 1, nodes),
        "source": "excalidraw",
        "fidelity": 1,
        "warnings": warnings,
        "stats": stats,
    }
