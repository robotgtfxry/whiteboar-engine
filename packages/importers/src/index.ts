import { type UniDoc } from "@whiteboard/core";

import { parseDev } from "./dev";
import { convertExcalidraw } from "./excalidraw";
import { convertSvg } from "./svg";

const DEV_FORMAT = "whiteboard-engine/dev";

// Formaty rozpoznawane przez rejestr (idea.md pkt 3.2).
export type SourceFormat = "excalidraw" | "dev" | "svg" | "drawio" | "xml" | "json" | "invalid";

function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

// Rozpoznaje format po TREŚCI (markery), a nie po rozszerzeniu — odporne na mylące nazwy plików.
// XML rozróżniamy dalej na svg / drawio / inny, żeby dawać trafne komunikaty (nie każdy `<...>` to SVG).
export function detectFormat(text: string): SourceFormat {
  const head = stripBom(text).trimStart();
  if (head.startsWith("<")) {
    const low = head.slice(0, 1024).toLowerCase();
    if (low.includes("<svg")) return "svg";
    if (low.includes("<mxfile") || low.includes("<mxgraphmodel")) return "drawio";
    return "xml";
  }
  let data: unknown;
  try {
    data = JSON.parse(head);
  } catch {
    return "invalid";
  }
  if (data && typeof data === "object") {
    const o = data as Record<string, unknown>;
    if (o.format === DEV_FORMAT) return "dev";
    if (o.type === "excalidraw" || Array.isArray(o.elements)) return "excalidraw";
  }
  return "json";
}

// Deleguje do właściwego importera na podstawie rozpoznanego formatu.
export function convertFile(name: string, text: string): UniDoc {
  switch (detectFormat(text)) {
    case "excalidraw":
      return convertExcalidraw(JSON.parse(stripBom(text)));
    case "dev":
      return parseDev(stripBom(text));
    case "svg":
      return convertSvg(text);
    case "drawio":
      throw new Error(`Pliki draw.io (.drawio) nie są jeszcze obsługiwane (${name}).`);
    case "xml":
      throw new Error(`Nierozpoznany format XML — obsługiwane: .excalidraw, .svg, .devbrd (${name}).`);
    case "invalid":
      throw new Error(`Plik nie jest poprawnym JSON-em ani XML-em (${name}).`);
    default:
      throw new Error(`Nierozpoznany plik — obsługiwane: .excalidraw, .svg, .devbrd (${name}).`);
  }
}

// Barrel pakietu importers — publiczne API formatów.
export { convertExcalidraw } from "./excalidraw";
export { convertSvg } from "./svg";
export * from "./dev";
