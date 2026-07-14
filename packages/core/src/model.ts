// Tymczasowy „uniwersalny model" na potrzeby testu konwersji.
// Docelowo przeniesie się do packages/core (idea.md pkt 3.1) i zyska wersjonowanie schematu (pkt 5.1).

export type NodeType =
  | "rect"
  | "ellipse"
  | "diamond"
  | "text"
  | "line"
  | "arrow"
  | "draw"
  | "unknown"; // nierozpoznany kształt = opaque (idea.md pkt 3.1)

export interface UniNode {
  id: string;
  type: NodeType;
  x: number;
  y: number;
  width: number;
  height: number;
  angle?: number;
  points?: [number, number][]; // dla line/arrow/draw — względem (x, y)
  text?: string; // treść tekstu lub etykieta scalona w kształt (idea.md pkt 3.1)
  fontSize?: number;
  textAlign?: string; // "left" | "center" | "right" — wyrównanie etykiety/tekstu
  textColor?: string; // kolor etykiety scalonej w kształt (osobny od `stroke` obrysu)
  stroke?: string;
  fill?: string;
  strokeWidth?: number;
  sourceType?: string; // oryginalny typ ze źródła (zachowany dla opaque / round-trip)
}

export type Fidelity = 1 | 2 | 3; // patrz tabela poziomów wierności, idea.md pkt 2

export interface UniDoc {
  version: number;
  source?: string; // np. "excalidraw"
  fidelity?: Fidelity;
  nodes: UniNode[];
}

export function isUniDoc(v: unknown): v is UniDoc {
  return !!v && typeof v === "object" && Array.isArray((v as UniDoc).nodes);
}
