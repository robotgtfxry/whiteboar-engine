import { useState } from "react";

import { api } from "@whiteboard/api-client";
import { type UniDoc } from "@whiteboard/core";
import { convertExcalidraw, convertSvg, exportDev } from "@whiteboard/importers";

import { BoardCanvas } from "../lib/canvas/BoardCanvas";
import { convertFilePreferServer } from "../lib/convertService";
import { IMPORT_EXTENSIONS, openFiles, saveTextFile } from "../lib/desktopFiles";
import { safeFilename } from "../lib/download";
import { Icon } from "./ui/Icon";
import { useToast } from "./ui/Toast";

const SAMPLE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 200">
  <rect x="20" y="20" width="120" height="70" fill="#a5d8ff" stroke="#1971c2" stroke-width="2"/>
  <circle cx="220" cy="60" r="40" fill="none" stroke="#e8590c" stroke-width="2"/>
  <line x1="140" y1="55" x2="180" y2="55" stroke="#1e1e1e" stroke-width="2"/>
  <polygon points="60,120 110,120 85,170" fill="#b2f2bb" stroke="#2f9e44" stroke-width="2"/>
  <path d="M160 120 C 190 100, 230 160, 260 120" fill="none" stroke="#7048e8" stroke-width="2"/>
  <text x="30" y="60" font-size="16" fill="#1e1e1e">SVG</text>
</svg>`;

const SAMPLE_EXCALIDRAW = {
  type: "excalidraw",
  version: 2,
  source: "sample",
  elements: [
    { id: "a", type: "rectangle", x: 100, y: 100, width: 200, height: 100, strokeColor: "#1971c2", backgroundColor: "#a5d8ff", strokeWidth: 2 },
    { id: "b", type: "ellipse", x: 380, y: 110, width: 120, height: 120, strokeColor: "#e8590c", backgroundColor: "transparent", strokeWidth: 2 },
    { id: "c", type: "text", x: 120, y: 130, width: 160, height: 25, text: "Tablica testowa", fontSize: 20, strokeColor: "#1e1e1e" },
    { id: "d", type: "arrow", x: 300, y: 150, width: 80, height: 0, strokeColor: "#1e1e1e", strokeWidth: 2, points: [[0, 0], [80, 0]] },
    { id: "e", type: "diamond", x: 200, y: 260, width: 140, height: 90, strokeColor: "#2f9e44", backgroundColor: "#b2f2bb", strokeWidth: 2 },
    { id: "f", type: "image", x: 420, y: 280, width: 90, height: 60 },
  ],
};

export function ConvertScreen() {
  const toast = useToast();
  const [doc, setDoc] = useState<UniDoc | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [title, setTitle] = useState("Konwersja testowa");

  function apply(converted: UniDoc, label: string) {
    setDoc(converted);
    setWarnings([]);
    toast.success(`Skonwertowano ${label}: ${converted.nodes.length} obiektów.`);
  }

  function loadSampleExcalidraw() {
    try {
      apply(convertExcalidraw(SAMPLE_EXCALIDRAW), "przykład .excalidraw");
    } catch (e) {
      setDoc(null);
      toast.error((e as Error).message);
    }
  }

  function loadSampleSvg() {
    try {
      apply(convertSvg(SAMPLE_SVG), "przykład .svg");
    } catch (e) {
      setDoc(null);
      toast.error((e as Error).message);
    }
  }

  async function pickFile() {
    const files = await openFiles(IMPORT_EXTENSIONS);
    if (!files.length) return;
    const file = files[0];
    try {
      const { doc: converted, warnings: w, via } = await convertFilePreferServer(file);
      setDoc(converted);
      setWarnings(w);
      toast.success(
        `Skonwertowano ${file.name} [${via === "server" ? "serwer" : "lokalnie"}]: ${converted.nodes.length} obiektów.`,
      );
    } catch (err) {
      setDoc(null);
      setWarnings([]);
      toast.error(`Nie udało się skonwertować ${file.name}: ${(err as Error).message}`);
    }
  }

  async function saveAsBoard() {
    if (!doc) return;
    try {
      const board = await api.createBoard({ title, document: doc as unknown as Record<string, unknown> });
      toast.success(`Zapisano jako tablicę: ${board.title}.`);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function exportDevbrd() {
    if (!doc) return;
    const ok = await saveTextFile(safeFilename(title, "devbrd"), exportDev(doc, { title }));
    if (ok) toast.success(`Wyeksportowano ${doc.nodes.length} obiektów (.devbrd).`);
  }

  const unknownCount = doc?.nodes.filter((n) => n.type === "unknown").length ?? 0;

  return (
    <div className="screen">
      <header className="screen-head">
        <h2>Konwersja</h2>
        <div className="row tight">
          <button className="ghost" onClick={loadSampleExcalidraw}>
            Przykład .excalidraw
          </button>
          <button className="ghost" onClick={loadSampleSvg}>
            Przykład .svg
          </button>
          <button className="primary" onClick={pickFile}>
            <Icon name="import" size={16} />
            <span>Wgraj plik</span>
          </button>
        </div>
      </header>

      {warnings.length > 0 && (
        <div className="card warnings">
          <strong className="small">Ostrzeżenia konwersji:</strong>
          <ul>
            {warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      {doc ? (
        <>
          <div className="card">
            <div className="row tight" style={{ marginBottom: 10 }}>
              <span className="badge">źródło: {doc.source ?? "—"}</span>
              <span className="badge">wierność: {doc.fidelity ?? "—"}</span>
              <span className="badge">obiektów: {doc.nodes.length}</span>
              {unknownCount > 0 && <span className="badge warn">opaque: {unknownCount}</span>}
            </div>
            <div className="convert-canvas">
              <BoardCanvas doc={doc} height={360} />
            </div>
          </div>

          <div className="create-bar wrap">
            <input value={title} onChange={(e) => setTitle(e.target.value)} />
            <button className="primary" onClick={saveAsBoard}>
              Zapisz jako tablicę
            </button>
            <button className="ghost" onClick={exportDevbrd}>
              <Icon name="export" size={16} />
              <span>Eksport .devbrd</span>
            </button>
          </div>
        </>
      ) : (
        <div className="empty">Wczytaj plik lub przykład, aby zobaczyć wynik konwersji.</div>
      )}
    </div>
  );
}
