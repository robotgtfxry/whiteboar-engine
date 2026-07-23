import { resolve } from "node:path";

import react from "@vitejs/plugin-react";
import { defineConfig, externalizeDepsPlugin } from "electron-vite";

// Monorepo (idea.md pkt 3.10): pakiety @whiteboard/* konsumowane jako źródła TS przez alias.
// To samo podejście co apps/web/vite.config.ts — Vite serwuje je spoza katalogu apki
// dzięki server.fs.allow ustawionemu na root repozytorium.
const root = __dirname;
const pkg = (name: string) => resolve(root, `../../packages/${name}/src/index.ts`);

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
  },
  renderer: {
    resolve: {
      alias: {
        "@whiteboard/core": pkg("core"),
        "@whiteboard/importers": pkg("importers"),
        "@whiteboard/api-client": pkg("api-client"),
      },
    },
    server: {
      fs: {
        allow: [resolve(root, "../..")],
      },
    },
    plugins: [react()],
  },
});
