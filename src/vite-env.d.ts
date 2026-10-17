/// <reference types="vite/client" />

// Build-time env exposed to the client (D-1). No secret is committed
// here (C-8); VITE_API_BASE_URL defaults to same-origin in client.ts.
interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// RT-633: the build's full commit SHA (GITHUB_SHA in CI), injected by
// vite.config.ts `define`. Not a secret: it is the release artifact's own
// commit, already public in /version.json. Empty outside CI.
declare const __CONSOLE_RELEASE_SHA__: string | undefined;
