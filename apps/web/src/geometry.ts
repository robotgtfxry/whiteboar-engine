import { type UniNode } from "./model";

export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export function bounds(nodes: UniNode[]): Bounds {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const grow = (x: number, y: number) => {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  };
  for (const n of nodes) {
    grow(n.x, n.y);
    grow(n.x + n.width, n.y + n.height);
    for (const [px, py] of n.points ?? []) grow(n.x + px, n.y + py);
  }
  if (!isFinite(minX)) return { minX: 0, minY: 0, maxX: 100, maxY: 100 };
  return { minX, minY, maxX, maxY };
}

// Przesuwa wszystkie węzły o (dx, dy). Bezpieczne dla wszystkich typów, bo punkty
// linii/ścieżek są względne wobec (x, y) — wystarczy przesunąć x/y.
export function translateNodes(nodes: UniNode[], dx: number, dy: number): UniNode[] {
  return nodes.map((n) => ({ ...n, x: n.x + dx, y: n.y + dy }));
}
