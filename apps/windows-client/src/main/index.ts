import { readFile, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";

import { app, BrowserWindow, dialog, ipcMain, Menu, shell } from "electron";
import type { MenuItemConstructorOptions } from "electron";

let win: BrowserWindow | null = null;

// Kanały menu wysyłane do renderera (subskrybowane przez window.desktop.onMenu).
function send(channel: string): void {
  win?.webContents.send(channel);
}

function buildMenu(): void {
  const template: MenuItemConstructorOptions[] = [
    {
      label: "Plik",
      submenu: [
        { label: "Nowa tablica", accelerator: "CmdOrCtrl+N", click: () => send("menu:new-board") },
        { type: "separator" },
        { label: "Importuj plik…", accelerator: "CmdOrCtrl+O", click: () => send("menu:import-file") },
        { label: "Importuj .devbrd…", click: () => send("menu:import-devbrd") },
        { label: "Eksportuj .devbrd…", accelerator: "CmdOrCtrl+E", click: () => send("menu:export-devbrd") },
        { type: "separator" },
        { label: "Ustawienia", accelerator: "CmdOrCtrl+,", click: () => send("menu:settings") },
        { type: "separator" },
        { role: "quit", label: "Zakończ" },
      ],
    },
    {
      label: "Edycja",
      submenu: [
        { label: "Cofnij", accelerator: "CmdOrCtrl+Z", click: () => send("menu:undo") },
        { label: "Ponów", accelerator: "CmdOrCtrl+Shift+Z", click: () => send("menu:redo") },
        { type: "separator" },
        { role: "cut", label: "Wytnij" },
        { role: "copy", label: "Kopiuj" },
        { role: "paste", label: "Wklej" },
        { role: "selectAll", label: "Zaznacz wszystko" },
      ],
    },
    {
      label: "Widok",
      submenu: [
        { role: "reload", label: "Odśwież" },
        { role: "forceReload", label: "Wymuś odświeżenie" },
        { role: "toggleDevTools", label: "Narzędzia deweloperskie" },
        { type: "separator" },
        { role: "resetZoom", label: "Zoom 100%" },
        { role: "zoomIn", label: "Powiększ" },
        { role: "zoomOut", label: "Pomniejsz" },
        { type: "separator" },
        { role: "togglefullscreen", label: "Pełny ekran" },
      ],
    },
    {
      label: "Pomoc",
      submenu: [
        {
          label: "O programie",
          click: () => {
            if (win) {
              dialog.showMessageBox(win, {
                type: "info",
                title: "O programie",
                message: "Whiteboard Engine — klient Windows",
                detail: "Electron + React. Klient tablicy z historią, kluczami pokoju i współdzieleniem.",
              });
            }
          },
        },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function registerIpc(): void {
  // Natywne okno otwierania plików → treść tekstowa (renderer składa z niej File).
  ipcMain.handle("dialog:openFile", async (_e, extensions: string[]) => {
    if (!win) return [];
    const clean = extensions.map((e) => e.replace(/^\./, ""));
    const res = await dialog.showOpenDialog(win, {
      properties: ["openFile", "multiSelections"],
      filters: [
        { name: "Obsługiwane", extensions: clean },
        { name: "Wszystkie pliki", extensions: ["*"] },
      ],
    });
    if (res.canceled) return [];
    const files: { name: string; text: string }[] = [];
    for (const p of res.filePaths) {
      files.push({ name: basename(p), text: await readFile(p, "utf8") });
    }
    return files;
  });

  // Natywne okno zapisu → zapis treści na dysk.
  ipcMain.handle("dialog:saveFile", async (_e, defaultName: string, content: string) => {
    if (!win) return false;
    const res = await dialog.showSaveDialog(win, {
      defaultPath: defaultName,
      filters: [{ name: "Whiteboard", extensions: ["devbrd", "json"] }],
    });
    if (res.canceled || !res.filePath) return false;
    await writeFile(res.filePath, content, "utf8");
    return true;
  });

  // Otwarcie linku pokoju w domyślnej przeglądarce systemu.
  ipcMain.handle("shell:openExternal", async (_e, url: string) => {
    if (/^https?:\/\//i.test(url)) await shell.openExternal(url);
  });
}

function createWindow(): void {
  win = new BrowserWindow({
    width: 1360,
    height: 900,
    minWidth: 1024,
    minHeight: 680,
    show: false,
    backgroundColor: "#0f1115",
    autoHideMenuBar: false,
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  win.on("ready-to-show", () => win?.show());
  win.on("closed", () => {
    win = null;
  });

  // Linki http(s) (np. link pokoju) otwieramy w przeglądarce, nie w oknie apki.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) shell.openExternal(url);
    return { action: "deny" };
  });

  // W dev electron-vite podaje URL serwera; w produkcji ładujemy zbudowany plik.
  const devUrl = process.env.ELECTRON_RENDERER_URL;
  if (devUrl) {
    win.loadURL(devUrl);
    win.webContents.openDevTools({ mode: "detach" });
  } else {
    win.loadFile(join(__dirname, "../renderer/index.html"));
  }
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });

  app.whenReady().then(() => {
    registerIpc();
    buildMenu();
    createWindow();

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });
}
