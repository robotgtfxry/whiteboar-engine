import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const root = dirname(fileURLToPath(import.meta.url));
const pkg = (name: string) => resolve(root, `../../packages/${name}/src/index.ts`);

// Monorepo (idea.md pkt 3.10): pakiety @whiteboard/* konsumowane jako źródła TS.
// Alias + fs.allow pozwalają Vite rozwiązać i serwować je spoza katalogu apps/web.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@whiteboard/core": pkg("core"),
      "@whiteboard/importers": pkg("importers"),
      "@whiteboard/api-client": pkg("api-client"),
    },
  },
  server: {
    port: 5173,
    fs: {
      allow: [resolve(root, "../..")],
    },
  },
});
