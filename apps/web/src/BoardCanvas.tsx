import { type PointerEvent as ReactPointerEvent } from "react";

import { bounds } from "./geometry";
import { type UniDoc, type UniNode } from "./model";

// Prosty renderer uniwersalnego modelu do SVG. Docelowo zastąpi go silnik z packages/engine
// (tldraw/Excalidraw-core, idea.md pkt 3.3). Obsługuje kontrolowany viewBox (pan/zoom) oraz
// podstawowe operacje: zaznaczanie i przesuwanie obiektów.

export interface ViewBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Props {
  doc: UniDoc;
  height?: number | string;
  viewBox?: ViewBox; // gdy podany — stały układ (pan/zoom); gdy nie — auto-dopasowanie (podglądy)
  selectedId?: string | null;
  onNodePointerDown?: (id: string, e: ReactPointerEvent) => void;
}

function Shape({ n }: { n: UniNode }) {
  const stroke = n.stroke ?? "#1e1e1e";
  const fill = n.fill ?? "none";
  const sw = n.strokeWidth ?? 1.5;
  const common = { stroke, fill, strokeWidth: sw };

  switch (n.type) {
    case "rect":
      return <rect x={n.x} y={n.y} width={n.width} height={n.height} rx={4} {...common} />;
    case "ellipse":
      return (
        <ellipse
          cx={n.x + n.width / 2}
          cy={n.y + n.height / 2}
          rx={Math.abs(n.width / 2)}
          ry={Math.abs(n.height / 2)}
          {...common}
        />
      );
    case "diamond":
      return (
        <polygon
          points={[
            [n.x + n.width / 2, n.y],
            [n.x + n.width, n.y + n.height / 2],
            [n.x + n.width / 2, n.y + n.height],
            [n.x, n.y + n.height / 2],
          ]
            .map((p) => p.join(","))
            .join(" ")}
          {...common}
        />
      );
    case "text":
      return (
        <text x={n.x} y={n.y + (n.fontSize ?? 16)} fontSize={n.fontSize ?? 16} fill={stroke}>
          {n.text}
        </text>
      );
    case "line":
    case "arrow":
    case "draw": {
      const pts = (n.points ?? []).map(([px, py]) => `${n.x + px},${n.y + py}`).join(" ");
      return (
        <polyline
          points={pts}
          fill="none"
          stroke={stroke}
          strokeWidth={sw}
          markerEnd={n.type === "arrow" ? "url(#arrowhead)" : undefined}
        />
      );
    }
    default:
      return (
        <g>
          <rect
            x={n.x}
            y={n.y}
            width={n.width || 40}
            height={n.height || 40}
            fill="none"
            stroke="#9aa3b2"
            strokeDasharray="4 3"
          />
          <text x={n.x + 4} y={n.y + 14} fontSize={11} fill="#9aa3b2">
            {n.sourceType ?? "?"}
          </text>
        </g>
      );
  }
}

export function BoardCanvas({ doc, height = 420, viewBox, selectedId, onNodePointerDown }: Props) {
  let vb: string;
  if (viewBox) {
    vb = `${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`;
  } else {
    const b = bounds(doc.nodes);
    const pad = 20;
    vb = `${b.minX - pad} ${b.minY - pad} ${b.maxX - b.minX + pad * 2} ${b.maxY - b.minY + pad * 2}`;
  }

  const interactive = !!onNodePointerDown;

  return (
    <svg
      viewBox={vb}
      style={{ width: "100%", height, display: "block", background: "#fff", borderRadius: 8 }}
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        <marker id="arrowhead" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
          <path d="M0,0 L6,3 L0,6 Z" fill="#1e1e1e" />
        </marker>
      </defs>
      {doc.nodes.map((n) => {
        const nb = bounds([n]);
        const selected = selectedId === n.id;
        return (
          <g
            key={n.id}
            style={interactive ? { cursor: "move" } : undefined}
            onPointerDown={onNodePointerDown ? (e) => onNodePointerDown(n.id, e) : undefined}
          >
            {/* przezroczysta strefa trafienia — ułatwia klik w puste/cienkie kształty */}
            {interactive && (
              <rect
                x={nb.minX}
                y={nb.minY}
                width={Math.max(nb.maxX - nb.minX, 1)}
                height={Math.max(nb.maxY - nb.minY, 1)}
                fill="transparent"
                pointerEvents="all"
              />
            )}
            <Shape n={n} />
            {selected && (
              <rect
                x={nb.minX - 4}
                y={nb.minY - 4}
                width={nb.maxX - nb.minX + 8}
                height={nb.maxY - nb.minY + 8}
                fill="none"
                stroke="#4f8cff"
                strokeWidth={1.5}
                strokeDasharray="5 3"
                pointerEvents="none"
              />
            )}
          </g>
        );
      })}
    </svg>
  );
}
