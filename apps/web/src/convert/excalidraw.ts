// Importer .excalidraw → uniwersalny model. Odpowiednik przyszłego packages/importers/excalidraw
// (idea.md pkt 3.2). Poziom wierności 1 (natywny, otwarty JSON — pkt 2).

import type { NodeType, UniDoc, UniNode } from "../model";

interface ExcalidrawElement {
  id?: string;
  type: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  angle?: number;
  points?: [number, number][];
  text?: string;
  fontSize?: number;
  strokeColor?: string;
  backgroundColor?: string;
  strokeWidth?: number;
  isDeleted?: boolean;
}

interface ExcalidrawFile {
  type?: string;
  elements?: ExcalidrawElement[];
}

function mapType(t: string): NodeType {
  switch (t) {
    case "rectangle":
      return "rect";
    case "ellipse":
      return "ellipse";
    case "diamond":
      return "diamond";
    case "text":
      return "text";
    case "line":
      return "line";
    case "arrow":
      return "arrow";
    case "freedraw":
      return "draw";
    default:
      return "unknown"; // image i inne → zachowujemy jako opaque
  }
}

export function convertExcalidraw(raw: unknown): UniDoc {
  const file = raw as ExcalidrawFile;
  if (!file || !Array.isArray(file.elements)) {
    throw new Error("To nie wygląda na plik .excalidraw (brak tablicy 'elements').");
  }

  const nodes: UniNode[] = file.elements
    .filter((e) => !e.isDeleted)
    .map((e, i) => ({
      id: e.id ?? `n${i}`,
      type: mapType(e.type),
      x: e.x ?? 0,
      y: e.y ?? 0,
      width: e.width ?? 0,
      height: e.height ?? 0,
      angle: e.angle ?? 0,
      points: e.points,
      text: e.text,
      fontSize: e.fontSize,
      stroke: e.strokeColor,
      fill: e.backgroundColor && e.backgroundColor !== "transparent" ? e.backgroundColor : undefined,
      strokeWidth: e.strokeWidth,
      sourceType: e.type,
    }));

  return { version: 1, source: "excalidraw", fidelity: 1, nodes };
}
