import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

/**
 * RT-396 light-first token migration. The shipped colour tokens must trace to
 * the RT-392 approved light table (design/claude-design-system/colors_and_type.css),
 * every text and boundary pairing must pass WCAG AA, and no retired value (the
 * dark default, navy action, Tower Gold) may remain in src/.
 */

const root = process.cwd();
// CRLF-safe: a core.autocrlf checkout has CRLF files.
const stripComments = (css: string): string =>
  css.replace(/\r\n/g, "\n").replace(/\/\*[\s\S]*?\*\//g, "");

/** The custom properties of the first `${selector} {` block, raw (aliases kept). */
function block(css: string, selector: string): Record<string, string> {
  const start = css.indexOf(`${selector} {`);
  if (start < 0) throw new Error(`block ${selector} not found`);
  const body = css.slice(start, css.indexOf("}", start));
  return Object.fromEntries(
    [...body.matchAll(/(--[a-z0-9-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]),
  );
}

const shipped = block(
  stripComments(readFileSync(join(root, "src/styles/tokens.css"), "utf8")),
  ":root",
);
const approved = block(
  stripComments(
    readFileSync(join(root, "design/claude-design-system/colors_and_type.css"), "utf8"),
  ),
  ':root,\n[data-theme="light"]',
);

const shippedColours = Object.keys(shipped).filter((k) => k.startsWith("--color-"));

function resolve(name: string): string {
  const v = shipped[`--color-${name}`];
  if (v === undefined) throw new Error(`--color-${name} is not defined`);
  const alias = /^var\(--color-([a-z-]+)\)$/.exec(v);
  return alias ? resolve(alias[1]) : v;
}

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5]
    .map((i) => Number.parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function ratio(fg: string, bg: string): number {
  const [hi, lo] = [luminance(resolve(fg)), luminance(resolve(bg))].sort((a, b) => b - a);
  return (hi + 0.05) / (lo + 0.05);
}

// Same list as CONTRAST_PAIRS in .design-sync/build-bundle.mjs (that module runs
// the bundle build on import, so it is copied here; keep the two in step).
const LAYERS = ["background", "surface", "surface-sunken"];
const CONTRAST_PAIRS: [string, string, number][] = [
  ...LAYERS.flatMap((bg): [string, string, number][] => [
    ["text", bg, 4.5],
    ["text-muted", bg, 4.5],
    ["control-border", bg, 3],
    ["focus-ring", bg, 3],
    ...["success", "warning", "danger", "info"].map((s): [string, string, number] => [s, bg, 4.5]),
  ]),
  ["text", "primary-soft", 4.5],
  ["text-muted", "primary-soft", 4.5],
  ["primary-emphasis", "primary-soft", 4.5],
  ["primary-emphasis", "surface", 4.5],
  ["primary", "primary-soft", 3],
  ["on-primary", "primary", 4.5],
  ["on-primary", "primary-emphasis", 4.5],
  ["on-primary", "danger", 4.5],
];

// Retired identity values from the pre-RT-396 tokens.css (dark default, navy, gold).
const RETIRED = [
  "#0d1520",
  "#131e2e",
  "#1a2840",
  "#0a1018",
  "#1e2d42",
  "#2a3d55",
  "#3a5270",
  "#e8eef5",
  "#8a9db5",
  "#4a5e78",
  "#c8a24a",
  "#2a2010",
  "#8a6a2a",
  "#1f4e7a",
  "#163d61",
  "#0e1e30",
  "#2e7da3",
  "#9a2730",
  "200, 162, 74",
  "31, 78, 122",
];

function cssFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry !== "generated") cssFiles(full, acc);
    } else if (/\.(css|tsx?)$/.test(entry)) {
      acc.push(full);
    }
  }
  return acc;
}

describe("RT-396 light-first tokens", () => {
  test("every shipped colour token equals its RT-392 approved light value", () => {
    expect(shippedColours.length).toBeGreaterThan(0);
    for (const name of shippedColours) {
      expect({ name, value: shipped[name] }).toEqual({ name, value: approved[name] });
    }
    expect(shipped["--shadow-overlay"]).toBe(approved["--shadow-overlay"]);
  });

  test("the 13 roles and the derived roles are all shipped", () => {
    const roles = [
      "background",
      "surface",
      "surface-sunken",
      "text",
      "text-muted",
      "border",
      "primary",
      "primary-emphasis",
      "primary-soft",
      "success",
      "warning",
      "danger",
      "info",
      "on-primary",
      "control-border",
      "focus-ring",
      "scrim",
    ];
    expect(shippedColours.sort()).toEqual(roles.map((r) => `--color-${r}`).sort());
  });

  test("radius follows 8 / 12 / 16 (UX-04)", () => {
    expect(shipped["--radius-control"]).toBe("8px");
    expect(shipped["--radius-object"]).toBe("12px");
    expect(shipped["--radius-overlay"]).toBe("16px");
  });

  test.each(CONTRAST_PAIRS)("%s on %s passes WCAG AA (>= %s:1)", (fg, bg, min) => {
    expect(ratio(fg, bg)).toBeGreaterThanOrEqual(min);
  });

  test("no retired value and no raw colour outside tokens.css remains in src/", () => {
    const tokensFile = join(root, "src", "styles", "tokens.css");
    for (const file of cssFiles(join(root, "src"))) {
      const code = stripComments(readFileSync(file, "utf8"));
      for (const value of RETIRED)
        expect({ file, has: code.includes(value) }).toEqual({ file, has: false });
      if (file !== tokensFile) {
        expect({ file, raw: /#[0-9a-fA-F]{3,8}\b|rgba?\(/.test(code) }).toEqual({
          file,
          raw: false,
        });
      }
    }
  });
});
