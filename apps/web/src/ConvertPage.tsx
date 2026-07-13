import { useState } from "react";

import { api } from "./api";
import { BoardCanvas } from "./BoardCanvas";
import { convertExcalidraw } from "./convert/excalidraw";
import { convertFile } from "./convert";
import { convertSvg } from "./convert/svg";
import { type UniDoc } from "./model";

const SAMPLE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 200">
  <rect x="20" y="20" width="120" height="70" fill="#a5d8ff" stroke="#1971c2" stroke-width="2"/>
  <circle cx="220" cy="60" r="40" fill="none" stroke="#e8590c" stroke-width="2"/>
  <line x1="140" y1="55" x2="180" y2="55" stroke="#1e1e1e" stroke-width="2"/>
  <polygon points="60,120 110,120 85,170" fill="#b2f2bb" stroke="#2f9e44" stroke-width="2"/>
  <path d="M160 120 C 190 100, 230 160, 260 120" fill="none" stroke="#7048e8" stroke-width="2"/>
  <text x="30" y="60" font-size="16" fill="#1e1e1e">SVG</text>
</svg>`;

// Wbudowany przykład .excalidraw — żeby dało się przetestować konwersję bez własnego pliku.
const SAMPLE = {
  type: "excalidraw",
  version: 2,
  source: "sample",
  elements: [
    {
      id: "a",
      type: "rectangle",
      x: 100,
      y: 100,
      width: 200,
      height: 100,
      strokeColor: "#1971c2",
      backgroundColor: "#a5d8ff",
      strokeWidth: 2,
    },
    {
      id: "b",
      type: "ellipse",
      x: 380,
      y: 110,
      width: 120,
      height: 120,
      strokeColor: "#e8590c",
      backgroundColor: "transparent",
      strokeWidth: 2,
    },
    {
      id: "c",
      type: "text",
      x: 120,
      y: 130,
      width: 160,
      height: 25,
      text: "Tablica testowa",
      fontSize: 20,
      strokeColor: "#1e1e1e",
    },
    {
      id: "d",
      type: "arrow",
      x: 300,
      y: 150,
      width: 80,
      height: 0,
      strokeColor: "#1e1e1e",
      strokeWidth: 2,
      points: [
        [0, 0],
        [80, 0],
      ],
    },
    {
      id: "e",
      type: "diamond",
      x: 200,
      y: 260,
      width: 140,
      height: 90,
      strokeColor: "#2f9e44",
      backgroundColor: "#b2f2bb",
      strokeWidth: 2,
    },
    {
      id: "f",
      type: "image",
      x: 420,
      y: 280,
      width: 90,
      height: 60,
    },
  ],
};

export function ConvertPage() {
  const [doc, setDoc] = useState<UniDoc | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [title, setTitle] = useState("Konwersja testowa");

  function apply(converted: UniDoc, label: string) {
    setDoc(converted);
    setError(null);
    setInfo(`Skonwertowano ${label}: ${converted.nodes.length} obiektów.`);
  }

  function loadSampleExcalidraw() {
    try {
      apply(convertExcalidraw(SAMPLE), "przykład .excalidraw");
    } catch (e) {
      setDoc(null);
      setError((e as Error).message);
    }
  }

  function loadSampleSvg() {
    try {
      apply(convertSvg(SAMPLE_SVG), "przykład .svg");
    } catch (e) {
      setDoc(null);
      setError((e as Error).message);
    }
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      apply(convertFile(file.name, text), file.name);
    } catch (e) {
      setDoc(null);
      setError(`Nie udało się skonwertować ${file.name}: ${(e as Error).message}`);
    }
  }

  async function saveAsBoard() {
    if (!doc) return;
    try {
      const board = await api.createBoard({
        title,
        document: doc as unknown as Record<string, unknown>,
      });
      setInfo(`Zapisano jako tablicę: ${board.id}`);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const unknownCount = doc?.nodes.filter((n) => n.type === "unknown").length ?? 0;

  return (
    <>
      <div className="panel">
        <div className="row">
          <button onClick={loadSampleExcalidraw}>Przykład .excalidraw</button>
          <button onClick={loadSampleSvg}>Przykład .svg</button>
          <label className="ghost" style={{ padding: "8px 14px", borderRadius: 6, cursor: "pointer" }}>
            Wgraj plik (.excalidraw / .svg)
            <input
              type="file"
              accept=".excalidraw,.json,.svg,application/json,image/svg+xml"
              style={{ display: "none" }}
              onChange={onFile}
            />
          </label>
        </div>
        {info && <div className="sub" style={{ marginTop: 8 }}>{info}</div>}
        {error && <div className="error">{error}</div>}
      </div>

      {doc && (
        <>
          <div className="panel">
            <div className="row" style={{ justifyContent: "space-between", marginBottom: 10 }}>
              <div className="row">
                <span className="badge">źródło: {doc.source}</span>
                <span className="badge">poziom wierności: {doc.fidelity}</span>
                <span className="badge">obiektów: {doc.nodes.length}</span>
                {unknownCount > 0 && (
                  <span className="badge" style={{ borderColor: "#e8590c", color: "#e8590c" }}>
                    opaque: {unknownCount}
                  </span>
                )}
              </div>
            </div>
            <BoardCanvas doc={doc} />
            <p className="sub" style={{ marginTop: 8 }}>
              {doc.fidelity === 1
                ? "Poziom 1 (natywny): pełna struktura odzyskana. Kształty nierozpoznane pokazane jako opaque — dane źródłowe zachowane."
                : "Poziom 2 (wektorowy): geometria i tekst odzyskane, bez semantyki. Krzywe w <path> przybliżone odcinkami; transform/gradient pominięte."}
            </p>
          </div>

          <div className="panel">
            <div className="row" style={{ marginBottom: 8 }}>
              <input value={title} onChange={(e) => setTitle(e.target.value)} />
              <button onClick={saveAsBoard}>Zapisz jako tablicę (API)</button>
            </div>
            <p className="sub">Uniwersalny model po konwersji:</p>
            <textarea readOnly value={JSON.stringify(doc, null, 2)} style={{ minHeight: 200 }} />
          </div>
        </>
      )}
    </>
  );
}
