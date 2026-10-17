import { URL, fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// D-1: React 19 + Vite 6, SPA mode (no SSR adapter).
export default defineConfig({
  plugins: [react()],
  // RT-633: Sentry `release` / `version` = the release SHA12. Only the commit
  // id is baked in; the tunnel and env arrive at runtime (src/observability/).
  define: {
    __CONSOLE_RELEASE_SHA__: JSON.stringify(process.env.GITHUB_SHA ?? ""),
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  build: {
    // Plain SPA build; target evergreen browsers (C-1).
    target: "es2022",
    outDir: "dist",
  },
});
