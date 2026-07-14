import { type PointerEvent as ReactPointerEvent, useCallback, useEffect, useRef, useState } from "react";

import { api, type Board } from "@whiteboard/api-client";
import { bounds, isUniDoc, translateNodes, type UniDoc } from "@whiteboard/core";
import { exportDev } from "@whiteboard/importers";

import { BoardCanvas, type ViewBox } from "./BoardCanvas";
import { convertFilePreferServer } from "./convertService";
import { downloadText, safeFilename } from "./download";

const EMPTY: UniDoc = { version: 1, nodes: [] };

function asDoc(board: Board): UniDoc {
  return isUniDoc(board.document) ? (board.document as unknown as UniDoc) : EMPTY;
}

// Dopasowuje viewBox do zawartości (lub domyślnie), z zachowaniem proporcji kontenera.
function fitViewBox(doc: UniDoc, w: number, h: number): ViewBox {
  const pad = 40;
  let box: ViewBox;
  if (doc.nodes.length) {
    const b = bounds(doc.nodes);
    box = { x: b.minX - pad, y: b.minY - pad, w: b.maxX - b.minX + pad * 2, h: b.maxY - b.minY + pad * 2 };
  } else {
    box = { x: 0, y: 0, w: w || 1200, h: h || 800 };
  }
  const target = (w || 1200) / (h || 800);
  if (box.w / box.h < target) {
    const nw = box.h * target;
    box.x -= (nw - box.w) / 2;
    box.w = nw;
  } else {
    const nh = box.w / target;
    box.y -= (nh - box.h) / 2;
    box.h = nh;
  }
  return box;
}

type Mode = { kind: "none" } | { kind: "pan" } | { kind: "move"; id: string };

export function BoardView({ boardId, onClose }: { boardId: string; onClose: () => void }) {
  const [board, setBoard] = useState<Board | null>(null);
  const [doc, setDoc] = useState<UniDoc>(EMPTY);
  const [view, setView] = useState<ViewBox | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const areaRef = useRef<HTMLDivElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const mode = useRef<Mode>({ kind: "none" });

  useEffect(() => {
    api
      .getBoard(boardId)
      .then((b) => {
        setBoard(b);
        setDoc(asDoc(b));
        setError(null);
      })
      .catch((e) => setError((e as Error).message));
  }, [boardId]);

  // Jednorazowa inicjalizacja viewportu po załadowaniu tablicy i zmierzeniu obszaru.
  useEffect(() => {
    if (view || !board || !areaRef.current) return;
    const r = areaRef.current.getBoundingClientRect();
    setView(fitViewBox(asDoc(board), r.width, r.height));
  }, [board, view]);

  const svgEl = () => areaRef.current?.querySelector("svg") ?? null;

  function screenToCanvas(clientX: number, clientY: number): { x: number; y: number } | null {
    const svg = svgEl();
    const ctm = svg?.getScreenCTM();
    if (!svg || !ctm) return null;
    const p = svg.createSVGPoint();
    p.x = clientX;
    p.y = clientY;
    const c = p.matrixTransform(ctm.inverse());
    return { x: c.x, y: c.y };
  }

  // przelicznik CSS px -> jednostki canvasu (z aktualnego CTM)
  function scale(): { sx: number; sy: number } {
    const ctm = svgEl()?.getScreenCTM();
    return { sx: ctm?.a || 1, sy: ctm?.d || 1 };
  }

  async function importFiles(files: FileList, at: { x: number; y: number }) {
    let next = doc;
    let total = 0;
    let step = 0;
    let warned = 0;
    for (const file of Array.from(files)) {
      try {
        const { doc: inc, warnings } = await convertFilePreferServer(file);
        warned += warnings.length;
        const ib = bounds(inc.nodes);
        const cx = (ib.minX + ib.maxX) / 2;
        const cy = (ib.minY + ib.maxY) / 2;
        const moved = translateNodes(inc.nodes, at.x - cx + step * 24, at.y - cy + step * 24).map(
          (n, i) => ({ ...n, id: `imp${Date.now()}-${step}-${i}-${n.id}` }),
        );
        next = {
          ...next,
          source: next.source ?? inc.source,
          fidelity: next.fidelity ?? inc.fidelity,
          nodes: [...next.nodes, ...moved],
        };
        total += moved.length;
        step += 1;
      } catch (e) {
        setError(`Nie udało się skonwertować ${file.name}: ${(e as Error).message}`);
      }
    }
    if (total > 0) {
      setDoc(next);
      setDirty(true);
      const warnSuffix = warned > 0 ? ` · ${warned} ostrzeżeń konwersji` : "";
      setInfo(`Zaimportowano ${total} obiektów w miejscu upuszczenia${warnSuffix}.`);
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    if (!e.dataTransfer.files.length) return;
    const at = screenToCanvas(e.clientX, e.clientY) ?? { x: 0, y: 0 };
    importFiles(e.dataTransfer.files, at);
  }

  // ---- pan / move / select ----
  function onNodePointerDown(id: string, e: ReactPointerEvent) {
    e.stopPropagation();
    setSelectedId(id);
    mode.current = { kind: "move", id };
    areaRef.current?.setPointerCapture(e.pointerId);
  }

  function onAreaPointerDown(e: ReactPointerEvent) {
    if (e.button !== 0) return;
    setSelectedId(null);
    mode.current = { kind: "pan" };
    areaRef.current?.setPointerCapture(e.pointerId);
  }

  function onAreaPointerMove(e: ReactPointerEvent) {
    const m = mode.current;
    if (m.kind === "none") return;
    const { sx, sy } = scale();
    const dx = e.movementX / sx;
    const dy = e.movementY / sy;
    if (m.kind === "pan") {
      setView((v) => (v ? { ...v, x: v.x - dx, y: v.y - dy } : v));
    } else if (m.kind === "move") {
      setDoc((d) => ({
        ...d,
        nodes: d.nodes.map((n) => (n.id === m.id ? { ...n, x: n.x + dx, y: n.y + dy } : n)),
      }));
      setDirty(true);
    }
  }

  function onAreaPointerUp(e: ReactPointerEvent) {
    mode.current = { kind: "none" };
    areaRef.current?.releasePointerCapture?.(e.pointerId);
  }

  // ---- zoom (kółko) — natywny listener, żeby móc preventDefault ----
  const zoomAt = useCallback((clientX: number, clientY: number, factor: number) => {
    const cur = screenToCanvas(clientX, clientY);
    setView((v) => {
      if (!v) return v;
      const c = cur ?? { x: v.x + v.w / 2, y: v.y + v.h / 2 };
      return {
        x: c.x - (c.x - v.x) * factor,
        y: c.y - (c.y - v.y) * factor,
        w: v.w * factor,
        h: v.h * factor,
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const area = areaRef.current;
    if (!area) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      zoomAt(e.clientX, e.clientY, e.deltaY > 0 ? 1.1 : 1 / 1.1);
    };
    area.addEventListener("wheel", onWheel, { passive: false });
    return () => area.removeEventListener("wheel", onWheel);
  }, [zoomAt]);

  // ---- usuwanie zaznaczonego (Delete) ----
  const deleteSelected = useCallback(() => {
    setSelectedId((id) => {
      if (id) {
        setDoc((d) => ({ ...d, nodes: d.nodes.filter((n) => n.id !== id) }));
        setDirty(true);
      }
      return null;
    });
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Delete") deleteSelected();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [deleteSelected]);

  function fit() {
    const r = areaRef.current?.getBoundingClientRect();
    if (r) setView(fitViewBox(doc, r.width, r.height));
  }

  function zoomButton(factor: number) {
    const r = areaRef.current?.getBoundingClientRect();
    if (r) zoomAt(r.left + r.width / 2, r.top + r.height / 2, factor);
  }

  async function save() {
    try {
      const updated = await api.updateBoard(boardId, {
        document: doc as unknown as Record<string, unknown>,
      });
      setBoard(updated);
      setDirty(false);
      setInfo("Zapisano tablicę.");
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  function copyLink() {
    navigator.clipboard?.writeText(window.location.href).then(
      () => setInfo("Skopiowano link do tablicy."),
      () => setError("Nie udało się skopiować linku."),
    );
  }

  function exportBoard() {
    const text = exportDev(doc, { id: boardId, title: board?.title });
    downloadText(safeFilename(board?.title ?? "tablica", "devbrd"), text);
    setInfo(`Wyeksportowano ${doc.nodes.length} obiektów do formatu .devbrd.`);
  }

  const unknownCount = doc.nodes.filter((n) => n.type === "unknown").length;

  // Brak dostępu / nie istnieje — czytelny komunikat zamiast pustej tablicy.
  if (error && !board) {
    return (
      <div className="board-full">
        <div className="board-bar">
          <button className="ghost" onClick={onClose}>
            ← Wstecz
          </button>
          <strong>Tablica</strong>
        </div>
        <div className="board-area">
          <div className="board-hint">
            {error}
            <br />
            (Zaloguj się jako ktoś z dostępem albo poproś właściciela o nadanie uprawnień.)
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="board-full">
      <div className="board-bar">
        <div className="row">
          <button className="ghost" onClick={onClose}>
            ← Wstecz
          </button>
          <strong>{board?.title ?? "…"}</strong>
          <button className="ghost" onClick={copyLink} title="Skopiuj link do tej tablicy">
            Kopiuj link
          </button>
          {dirty && (
            <span className="badge" style={{ borderColor: "#e8590c", color: "#e8590c" }}>
              niezapisane
            </span>
          )}
        </div>
        <div className="row">
          <span className="badge">obiektów: {doc.nodes.length}</span>
          {doc.fidelity && <span className="badge">wierność: {doc.fidelity}</span>}
          {unknownCount > 0 && <span className="badge">opaque: {unknownCount}</span>}
          <button className="ghost" onClick={() => zoomButton(1 / 1.2)} title="Powiększ">
            +
          </button>
          <button className="ghost" onClick={() => zoomButton(1.2)} title="Pomniejsz">
            −
          </button>
          <button className="ghost" onClick={fit} title="Dopasuj do zawartości">
            Dopasuj
          </button>
          <button className="ghost" onClick={deleteSelected} disabled={!selectedId}>
            Usuń obiekt
          </button>
          <button onClick={() => fileInput.current?.click()}>Wgraj plik</button>
          <button className="ghost" onClick={exportBoard} disabled={doc.nodes.length === 0}>
            Eksport .devbrd
          </button>
          <button onClick={save} disabled={!dirty}>
            Zapisz
          </button>
        </div>
      </div>

      <div
        ref={areaRef}
        className={"board-area" + (dragOver ? " over" : "")}
        onPointerDown={onAreaPointerDown}
        onPointerMove={onAreaPointerMove}
        onPointerUp={onAreaPointerUp}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={(e) => {
          if (e.currentTarget === e.target) setDragOver(false);
        }}
        onDrop={onDrop}
      >
        <BoardCanvas
          doc={doc}
          height="100%"
          viewBox={view ?? undefined}
          selectedId={selectedId}
          onNodePointerDown={onNodePointerDown}
        />
        {doc.nodes.length === 0 && !dragOver && (
          <div className="board-hint">
            Przeciągnij plik <b>.excalidraw</b> lub <b>.svg</b> w dowolne miejsce tablicy.
          </div>
        )}
        {dragOver && <div className="board-drop">Upuść — obiekty pojawią się w tym miejscu</div>}
      </div>

      <input
        ref={fileInput}
        type="file"
        multiple
        accept=".excalidraw,.json,.svg,.devbrd,application/json,image/svg+xml"
        style={{ display: "none" }}
        onChange={(e) => {
          const r = areaRef.current?.getBoundingClientRect();
          const at = r ? screenToCanvas(r.left + r.width / 2, r.top + r.height / 2) : null;
          if (e.target.files) importFiles(e.target.files, at ?? { x: 0, y: 0 });
        }}
      />

      <div className="board-status">
        {error ? (
          <span className="error">{error}</span>
        ) : (
          <span className="sub">
            {info ?? "Kółko = zoom · przeciągnij tło = przesuń · klik obiekt = zaznacz · przeciągnij = przesuń · Delete = usuń"}
          </span>
        )}
      </div>
    </div>
  );
}
