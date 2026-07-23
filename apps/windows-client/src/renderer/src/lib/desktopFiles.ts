// Warstwa plików: preferuje natywne okna Electrona (window.desktop), a gdy ich brak
// (dev w przeglądarce) używa <input type=file> / pobrania blobem.

import { downloadText } from "./download";

// Rozszerzenia importowanych plików źródłowych (bez kropki).
export const IMPORT_EXTENSIONS = ["excalidraw", "json", "svg", "devbrd"];
export const DEVBRD_EXTENSIONS = ["devbrd", "json"];

// Otwiera pliki i zwraca je jako File[] — dzięki temu ścieżka konwersji (api.convert,
// convertFilePreferServer, importDevbrd) pozostaje identyczna jak w przeglądarce.
export async function openFiles(extensions: string[]): Promise<File[]> {
  const d = window.desktop;
  if (d) {
    const res = await d.openFile(extensions);
    return res.map((f) => new File([f.text], f.name, { type: "text/plain" }));
  }
  return new Promise<File[]>((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = true;
    input.accept = extensions.map((e) => "." + e.replace(/^\./, "")).join(",");
    input.onchange = () => resolve(Array.from(input.files ?? []));
    input.click();
  });
}

export async function saveTextFile(defaultName: string, content: string): Promise<boolean> {
  const d = window.desktop;
  if (d) return d.saveFile(defaultName, content);
  downloadText(defaultName, content);
  return true;
}

export async function openExternal(url: string): Promise<void> {
  const d = window.desktop;
  if (d) return d.openExternal(url);
  window.open(url, "_blank", "noopener");
}
