import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Static source-scan helpers for boundary tests (RT-371). Comments are stripped
 * so documentation that names a forbidden operation does not false-positive.
 */
export function stripComments(code: string): string {
  return code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

/** A repository file, comments stripped. `path` is relative to the repo root. */
export function readSource(path: string): string {
  return stripComments(readFileSync(join(process.cwd(), path), "utf8"));
}

/** Every .ts / .tsx file under `dir` (relative to the repo root), comments stripped. */
export function sourcesUnder(dir: string): { file: string; src: string }[] {
  const walk = (abs: string): string[] =>
    readdirSync(abs).flatMap((entry) => {
      const full = join(abs, entry);
      if (statSync(full).isDirectory()) return walk(full);
      return /\.(ts|tsx)$/.test(entry) ? [full] : [];
    });
  return walk(join(process.cwd(), dir)).map((full) => ({
    file: full.replaceAll("\\", "/"),
    src: stripComments(readFileSync(full, "utf8")),
  }));
}
