import { type UniNode } from "@whiteboard/core";

// Narzędzia kanwy. "select" = zaznacz/przesuń/pan; reszta tworzy nowe kształty.
export type Tool = "select" | "rect" | "ellipse" | "diamond" | "text" | "arrow" | "line";

export interface ToolDef {
  tool: Tool;
  label: string;
  key: string; // skrót klawiszowy (wyświetlany)
}

export const TOOLS: ToolDef[] = [
  { tool: "select", label: "Zaznacz", key: "V" },
  { tool: "rect", label: "Prostokąt", key: "R" },
  { tool: "ellipse", label: "Elipsa", key: "O" },
  { tool: "diamond", label: "Romb", key: "D" },
  { tool: "text", label: "Tekst", key: "T" },
  { tool: "arrow", label: "Strzałka", key: "A" },
  { tool: "line", label: "Linia", key: "L" },
];

export const KEY_TO_TOOL: Record<string, Tool> = {
  v: "select",
  r: "rect",
  o: "ellipse",
  d: "diamond",
  t: "text",
  a: "arrow",
  l: "line",
};

let seq = 0;
export function newId(prefix = "draw"): string {
  return `${prefix}-${Date.now().toString(36)}-${(seq++).toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

export interface DrawStyle {
  stroke: string;
  fill: string;
  strokeWidth: number;
  fontSize: number;
}

// Kanwa ma białe tło (BoardCanvas), więc domyślny obrys jest ciemny.
export const DEFAULT_STYLE: DrawStyle = { stroke: "#1e1e1e", fill: "none", strokeWidth: 2, fontSize: 20 };

interface Pt {
  x: number;
  y: number;
}

// Buduje węzeł z prostokąta przeciągnięcia (start→end w jednostkach canvasu).
// Używane też do podglądu w trakcie rysowania.
export function shapeFromDrag(tool: Tool, start: Pt, end: Pt, style: DrawStyle): UniNode | null {
  switch (tool) {
    case "rect":
    case "ellipse":
    case "diamond":
      return {
        id: newId(),
        type: tool,
        x: Math.min(start.x, end.x),
        y: Math.min(start.y, end.y),
        width: Math.abs(end.x - start.x),
        height: Math.abs(end.y - start.y),
        stroke: style.stroke,
        fill: style.fill,
        strokeWidth: style.strokeWidth,
      };
    case "arrow":
    case "line":
      return {
        id: newId(),
        type: tool,
        x: start.x,
        y: start.y,
        width: end.x - start.x,
        height: end.y - start.y,
        points: [
          [0, 0],
          [end.x - start.x, end.y - start.y],
        ] as [number, number][],
        stroke: style.stroke,
        strokeWidth: style.strokeWidth,
      };
    default:
      return null;
  }
}

// Węzeł tekstowy w punkcie kliknięcia.
export function textNode(at: Pt, text: string, style: DrawStyle): UniNode {
  return {
    id: newId("text"),
    type: "text",
    x: at.x,
    y: at.y,
    width: Math.max(text.length * style.fontSize * 0.6, 40),
    height: style.fontSize * 1.4,
    text,
    fontSize: style.fontSize,
    stroke: style.stroke,
  };
}

// Kształt zbyt mały, by go tworzyć (przypadkowy klik zamiast przeciągnięcia).
export function isTooSmall(node: UniNode): boolean {
  if (node.type === "arrow" || node.type === "line") {
    return Math.abs(node.width) < 3 && Math.abs(node.height) < 3;
  }
  return node.width < 3 && node.height < 3;
}
