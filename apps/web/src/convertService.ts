// Orkiestracja konwersji dla UI: backend jako kanoniczny konwerter (idea.md pkt 3.2/3.5),
// z łagodnym fallbackiem do importera klienckiego (offline, brak sesji lub format jeszcze
// nieobsługiwany po stronie serwera — np. SVG). Glue aplikacji: zależy od api-client i importers,
// dzięki czemu pakiet importers pozostaje bez zależności od sieci (zasada z idea.md pkt 3.10).

import { api } from "@whiteboard/api-client";
import { type UniDoc } from "@whiteboard/core";
import { convertFile } from "@whiteboard/importers";

export interface ConvertOutcome {
  doc: UniDoc;
  warnings: string[];
  stats?: Record<string, unknown>;
  via: "server" | "local"; // skąd pochodzi wynik (do pokazania w UI)
}

// Konwertuje plik: najpierw serwer, przy każdym błędzie próbuje importera klienckiego.
// Jeśli fallback też zawiedzie, rzuca błąd fallbacku (najbliższy problemowi z plikiem).
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
      // Oba tory zawiodły — pokaż błąd lokalny, ale zachowaj kontekst serwera w konsoli.
      console.warn("Konwersja serwerowa nie powiodła się:", serverErr);
      throw localErr;
    }
  }
}
