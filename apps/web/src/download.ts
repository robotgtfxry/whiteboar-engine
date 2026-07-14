// Pobranie tekstu jako plik (bez zależności zewnętrznych).
export function downloadText(filename: string, text: string, mime = "application/json") {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// Bezpieczna nazwa pliku z tytułu tablicy.
export function safeFilename(name: string, ext: string): string {
  const base = (name || "tablica").trim().replace(/[^\p{L}\p{N}\-_ ]+/gu, "").replace(/\s+/g, "_");
  return `${base || "tablica"}.${ext}`;
}
