import { type CSSProperties, type ReactElement } from "react";

// Minimalny zestaw ikon (inline SVG, stroke = currentColor). Bez zależności zewnętrznych.
const P = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export type IconName =
  | "boards"
  | "users"
  | "convert"
  | "settings"
  | "logout"
  | "plus"
  | "save"
  | "trash"
  | "copy"
  | "key"
  | "share"
  | "history"
  | "back"
  | "import"
  | "export"
  | "search"
  | "external"
  | "refresh"
  | "close"
  | "fit"
  | "zoomIn"
  | "zoomOut"
  | "restore"
  | "eye"
  | "select"
  | "rect"
  | "ellipse"
  | "diamond"
  | "text"
  | "arrow"
  | "line";

function glyph(name: IconName): ReactElement {
  switch (name) {
    case "boards":
      return (
        <>
          <rect x={3} y={3} width={8} height={8} rx={1.5} {...P} />
          <rect x={13} y={3} width={8} height={8} rx={1.5} {...P} />
          <rect x={3} y={13} width={8} height={8} rx={1.5} {...P} />
          <rect x={13} y={13} width={8} height={8} rx={1.5} {...P} />
        </>
      );
    case "users":
      return (
        <>
          <circle cx={12} cy={8} r={3.2} {...P} />
          <path d="M5 20c0-3.5 3-5.5 7-5.5s7 2 7 5.5" {...P} />
        </>
      );
    case "convert":
      return <path d="M4 9h13l-3.5-3.5M20 15H7l3.5 3.5" {...P} />;
    case "settings":
      return (
        <>
          <circle cx={12} cy={12} r={3} {...P} />
          <path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2" {...P} />
        </>
      );
    case "logout":
      return (
        <>
          <path d="M14 4h5v16h-5" {...P} />
          <path d="M10 8l4 4-4 4M14 12H3" {...P} />
        </>
      );
    case "plus":
      return <path d="M12 5v14M5 12h14" {...P} />;
    case "save":
      return (
        <>
          <path d="M5 4h11l3 3v13H5z" {...P} />
          <path d="M8 4v5h7V4M8 20v-6h8v6" {...P} />
        </>
      );
    case "trash":
      return <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" {...P} />;
    case "copy":
      return (
        <>
          <rect x={9} y={9} width={10} height={11} rx={2} {...P} />
          <path d="M6 15V5a2 2 0 0 1 2-2h8" {...P} />
        </>
      );
    case "key":
      return (
        <>
          <circle cx={7} cy={7} r={3.5} {...P} />
          <path d="M9.5 9.5L20 20M16 16l2 2M18 14l2 2" {...P} />
        </>
      );
    case "share":
      return (
        <>
          <circle cx={6} cy={12} r={2.5} {...P} />
          <circle cx={18} cy={6} r={2.5} {...P} />
          <circle cx={18} cy={18} r={2.5} {...P} />
          <path d="M8.2 10.8L15.8 7.2M8.2 13.2l7.6 3.6" {...P} />
        </>
      );
    case "history":
      return (
        <>
          <path d="M3.2 8A9 9 0 1 1 3 12" {...P} />
          <path d="M3 4v4h4" {...P} />
          <path d="M12 8v4l3 2" {...P} />
        </>
      );
    case "back":
      return <path d="M15 6l-6 6 6 6" {...P} />;
    case "import":
      return (
        <>
          <path d="M12 3v10M8 9l4 4 4-4" {...P} />
          <path d="M5 20h14" {...P} />
        </>
      );
    case "export":
      return (
        <>
          <path d="M12 14V4M8 8l4-4 4 4" {...P} />
          <path d="M5 20h14" {...P} />
        </>
      );
    case "search":
      return (
        <>
          <circle cx={11} cy={11} r={6} {...P} />
          <path d="M16 16l4 4" {...P} />
        </>
      );
    case "external":
      return (
        <>
          <path d="M14 4h6v6M20 4l-8 8" {...P} />
          <path d="M18 13v6H5V6h6" {...P} />
        </>
      );
    case "refresh":
      return (
        <>
          <path d="M4 12a8 8 0 0 1 13.7-5.6L20 8" {...P} />
          <path d="M20 4v4h-4" {...P} />
        </>
      );
    case "close":
      return <path d="M6 6l12 12M18 6L6 18" {...P} />;
    case "fit":
      return <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" {...P} />;
    case "zoomIn":
      return (
        <>
          <circle cx={11} cy={11} r={6} {...P} />
          <path d="M11 8v6M8 11h6M16 16l4 4" {...P} />
        </>
      );
    case "zoomOut":
      return (
        <>
          <circle cx={11} cy={11} r={6} {...P} />
          <path d="M8 11h6M16 16l4 4" {...P} />
        </>
      );
    case "restore":
      return (
        <>
          <path d="M3.2 12A9 9 0 1 0 6 5.6" {...P} />
          <path d="M3 4v4h4" {...P} />
        </>
      );
    case "eye":
      return (
        <>
          <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12z" {...P} />
          <circle cx={12} cy={12} r={2.5} {...P} />
        </>
      );
    case "select":
      return <path d="M5 3l14 7-6 2-2 6z" {...P} />;
    case "rect":
      return <rect x={4} y={6} width={16} height={12} rx={2} {...P} />;
    case "ellipse":
      return <ellipse cx={12} cy={12} rx={9} ry={6} {...P} />;
    case "diamond":
      return <path d="M12 3l9 9-9 9-9-9z" {...P} />;
    case "text":
      return <path d="M6 6h12M12 6v12" {...P} />;
    case "arrow":
      return <path d="M4 12h14M13 7l5 5-5 5" {...P} />;
    case "line":
      return <path d="M5 19L19 5" {...P} />;
  }
}

export function Icon({ name, size = 18, style }: { name: IconName; size?: number; style?: CSSProperties }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={style} aria-hidden="true">
      {glyph(name)}
    </svg>
  );
}
