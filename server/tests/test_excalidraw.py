"""Testy importera .excalidraw (app/convert/excalidraw.py) — czyste, bez bazy/HTTP."""

import pytest

from app.convert import ConvertError, convert_file, detect_format
from app.convert.excalidraw import convert_excalidraw


def _nodes_by_id(result):
    return {n["id"]: n for n in result["document"]["nodes"]}


def test_basic_shapes_and_header():
    scene = {
        "type": "excalidraw",
        "version": 2,
        "elements": [
            {"id": "r", "type": "rectangle", "x": 1, "y": 2, "width": 3, "height": 4,
             "strokeColor": "#111", "backgroundColor": "#eee", "strokeWidth": 2},
            {"id": "e", "type": "ellipse", "x": 0, "y": 0, "width": 10, "height": 10,
             "backgroundColor": "transparent"},
        ],
    }
    result = convert_excalidraw(scene)
    assert result["source"] == "excalidraw"
    assert result["fidelity"] == 1
    assert result["document"]["version"] == 1
    nodes = _nodes_by_id(result)
    assert nodes["r"]["type"] == "rect"
    assert nodes["r"]["fill"] == "#eee"
    # transparent → brak fill
    assert "fill" not in nodes["e"]
    assert result["stats"]["sourceVersion"] == 2


def test_deleted_elements_are_skipped():
    scene = {"elements": [
        {"id": "keep", "type": "rectangle", "x": 0, "y": 0, "width": 1, "height": 1},
        {"id": "gone", "type": "rectangle", "x": 0, "y": 0, "width": 1, "height": 1, "isDeleted": True},
    ]}
    nodes = _nodes_by_id(convert_excalidraw(scene))
    assert "keep" in nodes and "gone" not in nodes


def test_bound_label_is_merged_into_container():
    scene = {"elements": [
        {"id": "box", "type": "rectangle", "x": 0, "y": 0, "width": 100, "height": 50,
         "boundElements": [{"id": "t", "type": "text"}]},
        {"id": "t", "type": "text", "x": 5, "y": 5, "width": 90, "height": 20,
         "text": "Etykieta", "fontSize": 18, "fontFamily": 1, "textAlign": "center",
         "strokeColor": "#333333", "containerId": "box"},
    ]}
    result = convert_excalidraw(scene)
    nodes = _nodes_by_id(result)
    assert "t" not in nodes, "dowiązana etykieta nie powinna być osobnym węzłem"
    assert nodes["box"]["text"] == "Etykieta"
    assert nodes["box"]["fontSize"] == 18
    assert nodes["box"]["fontFamily"] == "hand-drawn"
    assert nodes["box"]["textAlign"] == "center"
    assert nodes["box"]["textColor"] == "#333333"
    assert result["stats"]["mergedLabels"] == 1


def test_orphan_bound_text_stays_standalone():
    # containerId wskazuje na nieistniejący element → tekst zostaje samodzielnym węzłem
    scene = {"elements": [
        {"id": "t", "type": "text", "x": 0, "y": 0, "width": 10, "height": 10,
         "text": "sierota", "containerId": "nie-ma"},
    ]}
    nodes = _nodes_by_id(convert_excalidraw(scene))
    assert nodes["t"]["type"] == "text" and nodes["t"]["text"] == "sierota"


def test_arrow_bindings_preserved():
    scene = {"elements": [
        {"id": "a", "type": "rectangle", "x": 0, "y": 0, "width": 10, "height": 10},
        {"id": "b", "type": "rectangle", "x": 100, "y": 0, "width": 10, "height": 10},
        {"id": "arr", "type": "arrow", "x": 10, "y": 5, "width": 90, "height": 0,
         "points": [[0, 0], [90, 0]],
         "startBinding": {"elementId": "a", "focus": 0, "gap": 4},
         "endBinding": {"elementId": "b", "focus": 0, "gap": 4}},
    ]}
    nodes = _nodes_by_id(convert_excalidraw(scene))
    assert nodes["arr"]["type"] == "arrow"
    assert nodes["arr"]["start"] == "a"
    assert nodes["arr"]["end"] == "b"
    assert nodes["arr"]["points"] == [[0, 0], [90, 0]]


def test_groups_collected():
    scene = {"elements": [
        {"id": "x", "type": "rectangle", "x": 0, "y": 0, "width": 1, "height": 1, "groupIds": ["g1"]},
        {"id": "y", "type": "ellipse", "x": 0, "y": 0, "width": 1, "height": 1, "groupIds": ["g1"]},
    ]}
    result = convert_excalidraw(scene)
    nodes = _nodes_by_id(result)
    assert nodes["x"]["groupIds"] == ["g1"]
    assert result["stats"]["groups"] == 1


def test_unknown_type_kept_as_opaque_with_source():
    scene = {"elements": [
        {"id": "img", "type": "image", "x": 0, "y": 0, "width": 10, "height": 10, "fileId": "f1"},
    ]}
    result = convert_excalidraw(scene)
    node = _nodes_by_id(result)["img"]
    assert node["type"] == "unknown"
    assert node["sourceType"] == "image"
    assert node["source"]["fileId"] == "f1", "opaque musi zachować dane źródłowe (round-trip)"
    assert result["stats"]["opaque"] == 1
    assert result["stats"]["images"] == 1
    assert any("opaque" in w for w in result["warnings"])


def test_richer_styles():
    scene = {"elements": [
        {"id": "s", "type": "rectangle", "x": 0, "y": 0, "width": 10, "height": 10,
         "backgroundColor": "#eee", "opacity": 40, "strokeStyle": "dashed",
         "fillStyle": "solid", "roughness": 0, "link": "https://example.com"},
    ]}
    node = _nodes_by_id(convert_excalidraw(scene))["s"]
    assert node["opacity"] == 0.4
    assert node["strokeStyle"] == "dashed"
    assert node["fillStyle"] == "solid"
    assert node["roughness"] == 0
    assert node["link"] == "https://example.com"


def test_solid_stroke_and_full_opacity_are_omitted():
    scene = {"elements": [
        {"id": "s", "type": "rectangle", "x": 0, "y": 0, "width": 10, "height": 10,
         "opacity": 100, "strokeStyle": "solid", "roughness": 1},
    ]}
    node = _nodes_by_id(convert_excalidraw(scene))["s"]
    assert "opacity" not in node
    assert "strokeStyle" not in node
    assert "roughness" not in node


def test_convert_file_dispatch_and_errors():
    ok = convert_file("scene.excalidraw", b'{"type":"excalidraw","elements":[{"type":"rectangle","x":0,"y":0,"width":1,"height":1}]}')
    assert ok["stats"]["nodes"] == 1

    with pytest.raises(ConvertError, match="JSON"):
        convert_file("x.excalidraw", b"{nope")
    with pytest.raises(ConvertError, match=r"\.devbrd"):
        convert_file("x.json", '{"format":"whiteboard-engine/dev","version":1}')
    with pytest.raises(ConvertError, match="SVG"):
        convert_file("x.svg", "<svg></svg>")
    with pytest.raises(ConvertError, match="draw.io"):
        convert_file("x.drawio", "<mxfile><diagram/></mxfile>")
    with pytest.raises(ConvertError, match="XML"):
        convert_file("x.xml", "<html></html>")
    with pytest.raises(ConvertError, match="Nierozpoznany"):
        convert_file("x.json", '{"foo":1}')


def test_format_detection():
    assert detect_format('{"type":"excalidraw","elements":[]}') == "excalidraw"
    assert detect_format('{"elements":[]}') == "excalidraw"
    assert detect_format('{"format":"whiteboard-engine/dev","version":1}') == "dev"
    assert detect_format('<svg xmlns="http://www.w3.org/2000/svg"></svg>') == "svg"
    assert detect_format('<?xml version="1.0"?>\n<svg></svg>') == "svg"
    assert detect_format('<mxfile><diagram id="a"/></mxfile>') == "drawio"
    assert detect_format("<html><body></body></html>") == "xml"
    assert detect_format('{"foo": 1}') == "json"
    assert detect_format("{nope not json") == "invalid"
    # BOM na początku nie może psuć rozpoznania
    assert detect_format(chr(0xFEFF) + '{"type":"excalidraw","elements":[]}') == "excalidraw"


def test_non_excalidraw_raises():
    with pytest.raises(ConvertError):
        convert_excalidraw({"type": "drawio", "foo": "bar"})
