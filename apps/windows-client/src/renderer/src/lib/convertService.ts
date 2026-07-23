// Orkiestracja konwersji dla UI: backend jako kanoniczny konwerter (idea.md pkt 3.2/3.5),
// z łagodnym fallbackiem do importera klienckiego (offline / brak sesji / format tylko
// klientowy — np. SVG). Kopia glue z apps/web — zależy od api-client i importers, więc
// pakiet importers pozostaje bez zależności od sieci (idea.md pkt 3.10).

import { api } from "@whiteboard/api-client";
import { type UniDoc } from "@whiteboard/core";
import { convertFile } from "@whiteboard/importers";

export interface ConvertOutcome {
  doc: UniDoc;
  warnings: string[];
  stats?: Record<string, unknown>;
  via: "server" | "local";
}

export async function convertFilePreferServer(file: File): Promise<ConvertOutcome> {
  try {
    const res = await api.convert(file);
    return { doc: res.document, warnings: res.warnings ?? [], stats: res.stats, via: "server" };
  } catch (serverErr) {
    try {
      const text = await file.text();
      const doc = convertFile(file.name, text);
      return { doc, warnings: [], via: "local" };
    } catch (localErr) {
      console.warn("Konwersja serwerowa nie powiodła się:", serverErr);
      throw localErr;
    }
  }
}
