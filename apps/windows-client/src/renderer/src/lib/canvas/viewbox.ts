import { bounds, type UniDoc } from "@whiteboard/core";

export interface ViewBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

// Dopasowuje viewBox do zawartości (lub domyślnie), zachowując proporcje kontenera.
export function fitViewBox(doc: UniDoc, w: number, h: number): ViewBox {
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

// Przelicza współrzędne ekranu (clientX/Y) na jednostki canvasu wg aktualnego CTM svg.
export function screenToCanvas(
  svg: SVGSVGElement | null,
  clientX: number,
  clientY: number,
): { x: number; y: number } | null {
  const ctm = svg?.getScreenCTM();
  if (!svg || !ctm) return null;
  const p = svg.createSVGPoint();
  p.x = clientX;
  p.y = clientY;
  const c = p.matrixTransform(ctm.inverse());
  return { x: c.x, y: c.y };
}

// Przelicznik CSS px → jednostki canvasu (z aktualnego CTM).
export function ctmScale(svg: SVGSVGElement | null): { sx: number; sy: number } {
  const ctm = svg?.getScreenCTM();
  return { sx: ctm?.a || 1, sy: ctm?.d || 1 };
}
