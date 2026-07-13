import { type UniDoc } from "../model";
import { convertExcalidraw } from "./excalidraw";
import { convertSvg } from "./svg";

// Rozpoznaje format po rozszerzeniu/treści i deleguje do właściwego importera.
// Odpowiednik przyszłego rejestru formatów w packages/importers (idea.md pkt 3.2).
export function convertFile(name: string, text: string): UniDoc {
  const isSvg = name.toLowerCase().endsWith(".svg") || text.trimStart().startsWith("<");
  return isSvg ? convertSvg(text) : convertExcalidraw(JSON.parse(text));
}
