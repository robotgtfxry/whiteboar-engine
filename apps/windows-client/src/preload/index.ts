import { contextBridge, ipcRenderer } from "electron";

// Kanały menu, które renderer może obserwować przez onMenu(action => …).
const MENU_CHANNELS = [
  "menu:new-board",
  "menu:import-file",
  "menu:import-devbrd",
  "menu:export-devbrd",
  "menu:settings",
  "menu:undo",
  "menu:redo",
] as const;

// Jedyny most między main a rendererem (contextIsolation). Renderer nie ma dostępu do Node.
const desktop = {
  openFile: (extensions: string[]): Promise<{ name: string; text: string }[]> =>
    ipcRenderer.invoke("dialog:openFile", extensions),
  saveFile: (defaultName: string, content: string): Promise<boolean> =>
    ipcRenderer.invoke("dialog:saveFile", defaultName, content),
  openExternal: (url: string): Promise<void> => ipcRenderer.invoke("shell:openExternal", url),
  onMenu: (cb: (action: string) => void): (() => void) => {
    const unsubs = MENU_CHANNELS.map((ch) => {
      const handler = () => cb(ch);
      ipcRenderer.on(ch, handler);
      return () => ipcRenderer.removeListener(ch, handler);
    });
    return () => unsubs.forEach((u) => u());
  },
};

contextBridge.exposeInMainWorld("desktop", desktop);
