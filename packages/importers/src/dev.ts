// Natywny format zapisu ".devbrd" — kontener JSON z nagłówkiem formatu, wersją schematu i metadanymi.
// Prototyp natywnego formatu platformy (idea.md pkt 3.7); wersjonowanie zgodnie z pkt 5.1.

import { isUniDoc, type UniDoc } from "@whiteboard/core";

export const DEV_FORMAT = "whiteboard-engine/dev";
export const DEV_VERSION = 1;
export const GENERATOR = "whiteboard-engine web 0.1.0";

export interface DevFile {
  format: string; // stały identyfikator — pozwala rozpoznać plik niezależnie od rozszerzenia
  version: number; // wersja schematu formatu (migracje — idea.md pkt 5.1)
  meta: {
    id?: string;
    title?: string;
    exportedAt: string;
    generator: string;
    nodeCount: number;
  };
  document: UniDoc; // uniwersalny model (docelowo packages/core)
}

export function exportDev(doc: UniDoc, meta: { id?: string; title?: string }): string {
  const file: DevFile = {
    format: DEV_FORMAT,
    version: DEV_VERSION,
    meta: {
      id: meta.id,
      title: meta.title,
      exportedAt: new Date().toISOString(),
      generator: GENERATOR,
      nodeCount: doc.nodes.length,
    },
    document: {
      version: doc.version,
      source: doc.source,
      fidelity: doc.fidelity,
      nodes: doc.nodes,
    },
  };
  return JSON.stringify(file, null, 2);
}

// Szybkie rozpoznanie treści .devbrd (gdy plik ma inne/rozszerzenie brak).
export function isDevText(text: string): boolean {
  return text.includes(DEV_FORMAT);
}

export function parseDev(text: string): UniDoc {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("Plik .devbrd nie jest poprawnym JSON-em.");
  }
  const f = parsed as Partial<DevFile>;
  if (f.format !== DEV_FORMAT) {
    throw new Error("To nie jest plik formatu .devbrd (brak nagłówka formatu).");
  }
  if (typeof f.version !== "number") {
    throw new Error("Plik .devbrd bez numeru wersji schematu.");
  }
  if (f.version > DEV_VERSION) {
    throw new Error(
      `Wersja formatu .devbrd (${f.version}) jest nowsza niż obsługiwana (${DEV_VERSION}) — zaktualizuj aplikację.`,
    );
  }
  if (!isUniDoc(f.document)) {
    throw new Error("Plik .devbrd nie zawiera poprawnego dokumentu.");
  }
  return f.document as UniDoc;
}
