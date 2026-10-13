import { URL, fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// D-3: Vitest (unit/integration). Shares Vite's transform via vitest/config.
// Kept as a distinct file per data-model A-5; mirrors vite.config.ts resolve.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    // C-5: no live Data-Pulse-2 — tests mock the generated client.
    include: ["tests/unit/**/*.test.ts", "tests/unit/**/*.test.tsx"],
    // RT-399: pins the English locale for suites that assert English copy.
    setupFiles: ["tests/unit/setup.ts"],
    coverage: {
      provider: "v8",
      // RT-461: lcov is the machine-readable report CI uploads to Codecov.
      reporter: ["text", "html", "lcov"],
      include: ["src/**"],
      // Excluded: vendored client (D-7, generated output), the bootstrap
      // entry (main.tsx, exercised by E2E not unit), and ambient types.
      exclude: ["src/generated/**", "src/main.tsx", "src/vite-env.d.ts"],
    },
  },
});
