// Importer .svg → uniwersalny model. Odpowiednik przyszłego packages/importers/svg (idea.md pkt 3.2).
// Poziom wierności 2: odzyskujemy geometrię i tekst, bez semantyki (pkt 2).
// Uproszczenia: krzywe w <path> przybliżamy odcinkami do punktów końcowych; transform/gradient pomijamy.

import type { UniDoc, UniNode } from "../model";

function prop(el: Element, name: string): string | undefined {
  const attr = el.getAttribute(name);
  if (attr != null && attr !== "") return attr;
  const style = el.getAttribute("style");
  if (style) {
    const item = style
      .split(";")
      .map((s) => s.trim())
      .find((s) => s.startsWith(name + ":"));
    if (item) return item.slice(name.length + 1).trim();
  }
  return undefined;
}

function num(v: string | undefined, d = 0): number {
  const n = parseFloat(v ?? "");
  return Number.isNaN(n) ? d : n;
}

function color(v: string | undefined): string | undefined {
  return v && v !== "none" ? v : undefined;
}

function strokeWidth(el: Element): number | undefined {
  const v = prop(el, "stroke-width");
  return v ? parseFloat(v) : undefined;
}

function parsePoints(raw: string | undefined): [number, number][] {
  const nums = (raw ?? "").match(/-?\d*\.?\d+(?:e-?\d+)?/g)?.map(Number) ?? [];
  const pts: [number, number][] = [];
  for (let i = 0; i + 1 < nums.length; i += 2) pts.push([nums[i], nums[i + 1]]);
  return pts;
}

// Minimalny parser <path>: M/L/H/V/Z dokładnie, krzywe (C/S/Q/T/A) redukowane do punktu końcowego.
function parsePath(d: string): [number, number][] {
  const tokens = d.match(/[a-zA-Z]|-?\d*\.?\d+(?:e-?\d+)?/g) ?? [];
  const pts: [number, number][] = [];
  let i = 0;
  let cx = 0;
  let cy = 0;
  let sx = 0;
  let sy = 0;
  let cmd = "";
  const read = () => parseFloat(tokens[i++]);
  while (i < tokens.length) {
    if (/[a-zA-Z]/.test(tokens[i])) {
      cmd = tokens[i];
      i++;
    }
    const rel = cmd === cmd.toLowerCase();
    const C = cmd.toUpperCase();
    if (C === "M") {
      let x = read();
      let y = read();
      if (rel) {
        x += cx;
        y += cy;
      }
      cx = x;
      cy = y;
      sx = x;
      sy = y;
      pts.push([x, y]);
      cmd = rel ? "l" : "L"; // kolejne pary bez litery = lineto
    } else if (C === "L" || C === "T") {
      let x = read();
      let y = read();
      if (rel) {
        x += cx;
        y += cy;
      }
      cx = x;
      cy = y;
      pts.push([x, y]);
    } else if (C === "H") {
      let x = read();
      if (rel) x += cx;
      cx = x;
      pts.push([cx, cy]);
    } else if (C === "V") {
      let y = read();
      if (rel) y += cy;
      cy = y;
      pts.push([cx, cy]);
    } else if (C === "Z") {
      cx = sx;
      cy = sy;
      pts.push([sx, sy]);
    } else if (C === "C" || C === "S" || C === "Q" || C === "A") {
      const skip = C === "C" ? 4 : C === "A" ? 5 : 2; // parametry przed punktem końcowym
      for (let k = 0; k < skip; k++) read();
      let x = read();
      let y = read();
      if (rel) {
        x += cx;
        y += cy;
      }
      cx = x;
      cy = y;
      pts.push([x, y]);
    } else {
      i++; // nieznany token — pomiń
    }
  }
  return pts;
}

export function convertSvg(text: string): UniDoc {
  const dom = new DOMParser().parseFromString(text, "image/svg+xml");
  if (dom.querySelector("parsererror")) {
    throw new Error("Plik nie jest poprawnym SVG.");
  }

  const nodes: UniNode[] = [];
  const elements = dom.querySelectorAll(
    "rect, circle, ellipse, line, polyline, polygon, path, text",
  );

  elements.forEach((el, i) => {
    const tag = el.tagName.toLowerCase();
    const id = el.id || `n${i}`;
    const stroke = color(prop(el, "stroke"));
    const fill = color(prop(el, "fill"));
    const sw = strokeWidth(el);
    const base = { id, stroke, fill, strokeWidth: sw, sourceType: tag };

    if (tag === "rect") {
      nodes.push({
        ...base,
        type: "rect",
        x: num(prop(el, "x")),
        y: num(prop(el, "y")),
        width: num(prop(el, "width")),
        height: num(prop(el, "height")),
      });
    } else if (tag === "circle") {
      const r = num(prop(el, "r"));
      nodes.push({
        ...base,
        type: "ellipse",
        x: num(prop(el, "cx")) - r,
        y: num(prop(el, "cy")) - r,
        width: r * 2,
        height: r * 2,
      });
    } else if (tag === "ellipse") {
      const rx = num(prop(el, "rx"));
      const ry = num(prop(el, "ry"));
      nodes.push({
        ...base,
        type: "ellipse",
        x: num(prop(el, "cx")) - rx,
        y: num(prop(el, "cy")) - ry,
        width: rx * 2,
        height: ry * 2,
      });
    } else if (tag === "line") {
      nodes.push({
        ...base,
        type: "line",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        points: [
          [num(prop(el, "x1")), num(prop(el, "y1"))],
          [num(prop(el, "x2")), num(prop(el, "y2"))],
        ],
      });
    } else if (tag === "polyline" || tag === "polygon") {
      const pts = parsePoints(prop(el, "points"));
      if (tag === "polygon" && pts.length) pts.push(pts[0]); // domknij
      nodes.push({ ...base, type: "line", x: 0, y: 0, width: 0, height: 0, points: pts });
    } else if (tag === "path") {
      nodes.push({
        ...base,
        type: "draw",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        points: parsePath(prop(el, "d") ?? ""),
      });
    } else if (tag === "text") {
      nodes.push({
        ...base,
        type: "text",
        x: num(prop(el, "x")),
        y: num(prop(el, "y")),
        width: 0,
        height: 0,
        text: el.textContent?.trim() ?? "",
        fontSize: prop(el, "font-size") ? parseFloat(prop(el, "font-size")!) : 16,
        stroke: stroke ?? fill ?? "#1e1e1e",
      });
    }
  });

  if (nodes.length === 0) {
    throw new Error("W SVG nie znaleziono obsługiwanych elementów (rect/circle/ellipse/line/path/text).");
  }

  return { version: 1, source: "svg", fidelity: 2, nodes };
}
