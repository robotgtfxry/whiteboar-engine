/// <reference types="vite/client" />

interface DesktopApi {
  openFile(extensions: string[]): Promise<{ name: string; text: string }[]>;
  saveFile(defaultName: string, content: string): Promise<boolean>;
  openExternal(url: string): Promise<void>;
  onMenu(cb: (action: string) => void): () => void;
}

interface Window {
  // Obecne tylko w Electronie (wstrzyknięte przez preload). W czystej przeglądarce undefined.
  desktop?: DesktopApi;
}
