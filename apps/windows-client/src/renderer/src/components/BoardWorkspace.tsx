import { type PointerEvent as ReactPointerEvent, useCallback, useEffect, useRef, useState } from "react";

import { api, type Board } from "@whiteboard/api-client";
import { bounds, isUniDoc, translateNodes, type UniDoc, type UniNode } from "@whiteboard/core";
import { exportDev } from "@whiteboard/importers";

import { BoardCanvas } from "../lib/canvas/BoardCanvas";
import {
  DEFAULT_STYLE,
  isTooSmall,
  KEY_TO_TOOL,
  shapeFromDrag,
  textNode,
  type Tool,
  TOOLS,
} from "../lib/canvas/tools";
import { ctmScale, fitViewBox, screenToCanvas, type ViewBox } from "../lib/canvas/viewbox";
import { copyText } from "../lib/clipboard";
import { convertFilePreferServer } from "../lib/convertService";
import { IMPORT_EXTENSIONS, openFiles, saveTextFile } from "../lib/desktopFiles";
import { safeFilename } from "../lib/download";
import { useMenuAction } from "../lib/useMenu";
import { HistoryPanel } from "./panels/HistoryPanel";
import { SharePanel } from "./panels/SharePanel";
import { Icon, type IconName } from "./ui/Icon";
import { useToast } from "./ui/Toast";

const EMPTY: UniDoc = { version: 1, nodes: [] };

function asDoc(board: Board): UniDoc {
  return isUniDoc(board.document) ? (board.document as unknown as UniDoc) : EMPTY;
}

type Dock = "history" | "share" | null;
type Mode =
  | { kind: "none" }
  | { kind: "pan" }
  | { kind: "move"; id: string }
  | { kind: "draw"; start: { x: number; y: number } };

const TOOL_ICON: Record<Tool, IconName> = {
  select: "select",
  rect: "rect",
  ellipse: "ellipse",
  diamond: "diamond",
  text: "text",
  arrow: "arrow",
  line: "line",
};

export function BoardWorkspace({ roomId, onClose }: { roomId: string; onClose: () => void }) {
  const toast = useToast();
  const [board, setBoard] = useState<Board | null>(null);
  const [doc, setDoc] = useState<UniDoc>(EMPTY);
  const [view, setView] = useState<ViewBox | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tool, setTool] = useState<Tool>("select");
  const [preview, setPreview] = useState<UniNode | null>(null);
  const [dirty, setDirty] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [dock, setDock] = useState<Dock>("share");
  const [title, setTitle] = useState("");
  const [loadError, setLoadError] = useState<string | null>(null);

  const areaRef = useRef<HTMLDivElement>(null);
  const mode = useRef<Mode>({ kind: "none" });
  const docRef = useRef(doc);
  const toolRef = useRef(tool);
  const past = useRef<UniDoc[]>([]);
  const future = useRef<UniDoc[]>([]);
  const movePending = useRef(false);

  useEffect(() => {
    docRef.current = doc;
  }, [doc]);
  useEffect(() => {
    toolRef.current = tool;
  }, [tool]);

  // ---- ładowanie tablicy po publicznym id pokoju ----
  useEffect(() => {
    api
      .getRoom(roomId)
      .then((b) => {
        setBoard(b);
        setDoc(asDoc(b));
        setTitle(b.title);
        past.current = [];
        future.current = [];
        setLoadError(null);
      })
      .catch((e) => setLoadError((e as Error).message));
  }, [roomId]);

  // Jednorazowa inicjalizacja viewportu po zmierzeniu obszaru.
  useEffect(() => {
    if (view || !board || !areaRef.current) return;
    const r = areaRef.current.getBoundingClientRect();
    setView(fitViewBox(asDoc(board), r.width, r.height));
  }, [board, view]);

  const svgEl = () => areaRef.current?.querySelector("svg") ?? null;

  // ---- cofnij / ponów ----
  const pushUndo = useCallback(() => {
    past.current.push(docRef.current);
    if (past.current.length > 120) past.current.shift();
    future.current = [];
  }, []);
  const undo = useCallback(() => {
    const prev = past.current.pop();
    if (prev === undefined) return;
    future.current.push(docRef.current);
    setDoc(prev);
    setDirty(true);
    setSelectedId(null);
  }, []);
  const redo = useCallback(() => {
    const next = future.current.pop();
    if (next === undefined) return;
    past.current.push(docRef.current);
    setDoc(next);
    setDirty(true);
    setSelectedId(null);
  }, []);

  function addNode(node: UniNode) {
    pushUndo();
    setDoc((d) => ({ ...d, nodes: [...d.nodes, node] }));
    setSelectedId(node.id);
    setDirty(true);
  }

  // ---- interakcja wskaźnikiem: pan / move / draw ----
  function onNodePointerDown(id: string, e: ReactPointerEvent) {
    if (toolRef.current !== "select") return; // narzędzia rysowania: pozwól zdarzeniu dojść do obszaru
    e.stopPropagation();
    setSelectedId(id);
    movePending.current = true;
    mode.current = { kind: "move", id };
    areaRef.current?.setPointerCapture(e.pointerId);
  }

  function onAreaPointerDown(e: ReactPointerEvent) {
    if (e.button !== 0) return;
    const t = toolRef.current;
    if (t === "select") {
      setSelectedId(null);
      mode.current = { kind: "pan" };
      areaRef.current?.setPointerCapture(e.pointerId);
      return;
    }
    const p = screenToCanvas(svgEl(), e.clientX, e.clientY);
    if (!p) return;
    setSelectedId(null);
    if (t === "text") {
      const text = window.prompt("Tekst:");
      if (text && text.trim()) addNode(textNode(p, text, DEFAULT_STYLE));
      return;
    }
    mode.current = { kind: "draw", start: p };
    areaRef.current?.setPointerCapture(e.pointerId);
  }

  function onAreaPointerMove(e: ReactPointerEvent) {
    const m = mode.current;
    if (m.kind === "none") return;
    if (m.kind === "pan") {
      const { sx, sy } = ctmScale(svgEl());
      setView((v) => (v ? { ...v, x: v.x - e.movementX / sx, y: v.y - e.movementY / sy } : v));
    } else if (m.kind === "move") {
      if (movePending.current) {
        pushUndo();
        movePending.current = false;
      }
      const { sx, sy } = ctmScale(svgEl());
      const dx = e.movementX / sx;
      const dy = e.movementY / sy;
      setDoc((d) => ({
        ...d,
        nodes: d.nodes.map((n) => (n.id === m.id ? { ...n, x: n.x + dx, y: n.y + dy } : n)),
      }));
      setDirty(true);
    } else if (m.kind === "draw") {
      const cur = screenToCanvas(svgEl(), e.clientX, e.clientY);
      if (cur) setPreview(shapeFromDrag(toolRef.current, m.start, cur, DEFAULT_STYLE));
    }
  }

  function onAreaPointerUp(e: ReactPointerEvent) {
    const m = mode.current;
    if (m.kind === "draw") {
      const cur = screenToCanvas(svgEl(), e.clientX, e.clientY);
      setPreview(null);
      if (cur) {
        const shape = shapeFromDrag(toolRef.current, m.start, cur, DEFAULT_STYLE);
        if (shape && !isTooSmall(shape)) addNode(shape);
      }
    }
    movePending.current = false;
    mode.current = { kind: "none" };
    areaRef.current?.releasePointerCapture?.(e.pointerId);
  }

  // ---- zoom kółkiem (natywny listener, by móc preventDefault) ----
  const zoomAt = useCallback((clientX: number, clientY: number, factor: number) => {
    const cur = screenToCanvas(areaRef.current?.querySelector("svg") ?? null, clientX, clientY);
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

  const fit = useCallback(() => {
    const r = areaRef.current?.getBoundingClientRect();
    if (r) setView(fitViewBox(docRef.current, r.width, r.height));
  }, []);

  function zoomButton(factor: number) {
    const r = areaRef.current?.getBoundingClientRect();
    if (r) zoomAt(r.left + r.width / 2, r.top + r.height / 2, factor);
  }

  const deleteSelected = useCallback(() => {
    setSelectedId((id) => {
      if (id) {
        pushUndo();
        setDoc((d) => ({ ...d, nodes: d.nodes.filter((n) => n.id !== id) }));
        setDirty(true);
      }
      return null;
    });
  }, [pushUndo]);

  // ---- klawiatura ----
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      const ctrl = e.ctrlKey || e.metaKey;
      if (e.key === "Delete" || e.key === "Backspace") {
        deleteSelected();
      } else if (ctrl && !e.shiftKey && e.key.toLowerCase() === "z") {
        e.preventDefault();
        undo();
      } else if (ctrl && (e.key.toLowerCase() === "y" || (e.shiftKey && e.key.toLowerCase() === "z"))) {
        e.preventDefault();
        redo();
      } else if (e.key === "Escape") {
        setPreview(null);
        setSelectedId(null);
        setTool("select");
      } else if (!ctrl && !e.altKey) {
        const nt = KEY_TO_TOOL[e.key.toLowerCase()];
        if (nt) setTool(nt);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [deleteSelected, undo, redo]);

  // ---- zapis / tytuł / import / eksport ----
  const save = useCallback(async () => {
    if (!board) return;
    try {
      const updated = await api.updateBoard(board.id, {
        document: docRef.current as unknown as Record<string, unknown>,
      });
      setBoard(updated);
      setDirty(false);
      toast.success("Zapisano tablicę.");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }, [board, toast]);

  async function commitTitle() {
    if (!board) return;
    const t = title.trim();
    if (!t || t === board.title) {
      setTitle(board.title);
      return;
    }
    try {
      const updated = await api.updateBoard(board.id, { title: t });
      setBoard(updated);
      toast.success("Zmieniono tytuł.");
    } catch (e) {
      toast.error((e as Error).message);
      setTitle(board.title);
    }
  }

  async function importFiles(files: File[], at: { x: number; y: number }) {
    let next = docRef.current;
    let total = 0;
    let step = 0;
    let warned = 0;
    for (const file of files) {
      try {
        const { doc: inc, warnings } = await convertFilePreferServer(file);
        warned += warnings.length;
        const ib = bounds(inc.nodes);
        const cx = (ib.minX + ib.maxX) / 2;
        const cy = (ib.minY + ib.maxY) / 2;
        const moved = translateNodes(inc.nodes, at.x - cx + step * 24, at.y - cy + step * 24).map((n, i) => ({
          ...n,
          id: `imp${Date.now()}-${step}-${i}-${n.id}`,
        }));
        next = {
          ...next,
          source: next.source ?? inc.source,
          fidelity: next.fidelity ?? inc.fidelity,
          nodes: [...next.nodes, ...moved],
        };
        total += moved.length;
        step += 1;
      } catch (e) {
        toast.error(`Nie udało się skonwertować ${file.name}: ${(e as Error).message}`);
      }
    }
    if (total > 0) {
      pushUndo();
      setDoc(next);
      setDirty(true);
      toast.success(`Zaimportowano ${total} obiektów${warned > 0 ? ` · ${warned} ostrzeżeń konwersji` : ""}.`);
    }
  }

  async function importViaDialog() {
    const files = await openFiles(IMPORT_EXTENSIONS);
    if (!files.length) return;
    const r = areaRef.current?.getBoundingClientRect();
    const at = r ? screenToCanvas(svgEl(), r.left + r.width / 2, r.top + r.height / 2) : null;
    await importFiles(files, at ?? { x: 0, y: 0 });
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    if (!e.dataTransfer.files.length) return;
    const at = screenToCanvas(svgEl(), e.clientX, e.clientY) ?? { x: 0, y: 0 };
    importFiles(Array.from(e.dataTransfer.files), at);
  }

  async function exportBoard() {
    const text = exportDev(docRef.current, { id: board?.id, title: board?.title });
    const ok = await saveTextFile(safeFilename(board?.title ?? "tablica", "devbrd"), text);
    if (ok) toast.success(`Wyeksportowano ${docRef.current.nodes.length} obiektów (.devbrd).`);
  }

  function onRestored(b: Board) {
    setBoard(b);
    setDoc(asDoc(b));
    setTitle(b.title);
    setDirty(false);
    setSelectedId(null);
    past.current = [];
    future.current = [];
    const r = areaRef.current?.getBoundingClientRect();
    if (r) setView(fitViewBox(asDoc(b), r.width, r.height));
  }

  // ---- menu aplikacji ----
  useMenuAction((a) => {
    if (a === "menu:import-file") importViaDialog();
    else if (a === "menu:export-devbrd") exportBoard();
    else if (a === "menu:undo") undo();
    else if (a === "menu:redo") redo();
  });

  async function copySecret() {
    if (!board?.secret) return;
    (await copyText(board.secret))
      ? toast.success("Skopiowano tajny klucz tablicy.")
      : toast.error("Nie udało się skopiować.");
  }

  if (loadError && !board) {
    return (
      <div className="workspace">
        <div className="ws-topbar">
          <button className="ghost" onClick={onClose}>
            <Icon name="back" size={16} />
            <span>Wstecz</span>
          </button>
          <strong>Tablica</strong>
        </div>
        <div className="ws-empty">
          {loadError}
          <br />
          <span className="muted small">
            Zaloguj się jako ktoś z dostępem albo poproś właściciela o nadanie uprawnień.
          </span>
        </div>
      </div>
    );
  }

  const unknownCount = doc.nodes.filter((n) => n.type === "unknown").length;

  return (
    <div className="workspace">
      <div className="ws-topbar">
        <div className="row tight">
          <button className="ghost icon-btn" onClick={onClose} title="Wstecz">
            <Icon name="back" size={18} />
          </button>
          <input
            className="ws-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={commitTitle}
            onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
          />
          {board?.secret && (
            <button className="badge key-badge" title="Kopiuj tajny klucz tablicy" onClick={copySecret}>
              <Icon name="key" size={13} /> {board.secret.slice(0, 8)}…
            </button>
          )}
          {dirty && <span className="badge warn">niezapisane</span>}
        </div>
        <div className="row tight">
          <span className="badge">obiektów: {doc.nodes.length}</span>
          {doc.fidelity && <span className="badge">wierność: {doc.fidelity}</span>}
          {unknownCount > 0 && <span className="badge">opaque: {unknownCount}</span>}
          <button className="ghost" onClick={importViaDialog}>
            <Icon name="import" size={16} />
            <span>Importuj</span>
          </button>
          <button className="ghost" onClick={exportBoard} disabled={doc.nodes.length === 0}>
            <Icon name="export" size={16} />
            <span>Eksport</span>
          </button>
          <button
            className={"ghost" + (dock === "history" ? " active" : "")}
            onClick={() => setDock((d) => (d === "history" ? null : "history"))}
          >
            <Icon name="history" size={16} />
            <span>Historia</span>
          </button>
          <button
            className={"ghost" + (dock === "share" ? " active" : "")}
            onClick={() => setDock((d) => (d === "share" ? null : "share"))}
          >
            <Icon name="share" size={16} />
            <span>Udostępnij</span>
          </button>
          <button className="primary" onClick={save} disabled={!dirty}>
            <Icon name="save" size={16} />
            <span>Zapisz</span>
          </button>
        </div>
      </div>

      <div className="ws-main">
        <div
          ref={areaRef}
          className={"ws-canvas-area" + (dragOver ? " over" : "") + (tool !== "select" ? " drawing" : "")}
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
          <div className="tool-palette" onPointerDown={(e) => e.stopPropagation()}>
            {TOOLS.map((td) => (
              <button
                key={td.tool}
                className={"tool-btn" + (tool === td.tool ? " active" : "")}
                title={`${td.label} (${td.key})`}
                onClick={() => setTool(td.tool)}
              >
                <Icon name={TOOL_ICON[td.tool]} size={18} />
              </button>
            ))}
            <div className="tool-sep" />
            <button
              className="tool-btn"
              title="Usuń zaznaczony (Delete)"
              disabled={!selectedId}
              onClick={deleteSelected}
            >
              <Icon name="trash" size={18} />
            </button>
          </div>

          <BoardCanvas
            doc={doc}
            height="100%"
            viewBox={view ?? undefined}
            selectedId={selectedId}
            preview={preview}
            onNodePointerDown={onNodePointerDown}
          />

          <div className="canvas-controls" onPointerDown={(e) => e.stopPropagation()}>
            <button className="ghost icon-btn" title="Powiększ" onClick={() => zoomButton(1 / 1.2)}>
              <Icon name="zoomIn" size={16} />
            </button>
            <button className="ghost icon-btn" title="Pomniejsz" onClick={() => zoomButton(1.2)}>
              <Icon name="zoomOut" size={16} />
            </button>
            <button className="ghost icon-btn" title="Dopasuj do zawartości" onClick={fit}>
              <Icon name="fit" size={16} />
            </button>
          </div>

          {doc.nodes.length === 0 && !dragOver && tool === "select" && (
            <div className="canvas-hint">
              Wybierz narzędzie z lewej i rysuj, albo przeciągnij plik <b>.excalidraw</b> / <b>.svg</b> /{" "}
              <b>.devbrd</b> na tablicę.
            </div>
          )}
          {dragOver && <div className="canvas-drop">Upuść — obiekty pojawią się w tym miejscu</div>}
        </div>

        {dock && (
          <aside className="ws-dock">
            <div className="dock-tabs">
              <button className={dock === "history" ? "active" : ""} onClick={() => setDock("history")}>
                Historia
              </button>
              <button className={dock === "share" ? "active" : ""} onClick={() => setDock("share")}>
                Udostępnianie
              </button>
              <button className="icon-btn dock-close" title="Zamknij panel" onClick={() => setDock(null)}>
                <Icon name="close" size={15} />
              </button>
            </div>
            {board && dock === "history" && <HistoryPanel board={board} onRestore={onRestored} />}
            {board && dock === "share" && <SharePanel board={board} />}
          </aside>
        )}
      </div>

      <div className="ws-status">
        <span className="muted small">
          {tool === "select"
            ? "Kółko = zoom · tło = przesuń · klik obiekt = zaznacz · przeciągnij = przesuń · Delete = usuń"
            : `Narzędzie: ${TOOLS.find((x) => x.tool === tool)?.label} · przeciągnij na kanwie, aby narysować · Esc = zaznaczanie`}
        </span>
      </div>
    </div>
  );
}
