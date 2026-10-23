import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import {
  CONTRAST_PAIRS,
  VIZ_CATEGORICAL,
  VIZ_DIVERGING,
  VIZ_SEQUENTIAL,
} from "../../.design-sync/contrast-pairs.mjs";

/**
 * RT-396 light-first token migration and RT-397 Dubai type. The shipped colour
 * and type tokens must trace to the RT-392 approved light block
 * (design/claude-design-system/colors_and_type.css), every text and boundary
 * pairing must pass WCAG AA, no retired value (the dark default, navy action,
 * Tower Gold, Inter) may remain in src/, and declared CSS sizes keep the 12px
 * floor.
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

const shippedCss = stripComments(readFileSync(join(root, "src/styles/tokens.css"), "utf8"));
const approvedCss = stripComments(
  readFileSync(join(root, "design/claude-design-system/colors_and_type.css"), "utf8"),
);
const shipped = block(shippedCss, ":root");
const approved = block(approvedCss, ':root,\n[data-theme="light"]');
const DARK = '[data-theme="dark"]';
const shippedDark = block(shippedCss, DARK);
const approvedDark = block(approvedCss, DARK);

const shippedColours = Object.keys(shipped).filter((k) => k.startsWith("--color-"));
const VIZ_ROLES = [...VIZ_CATEGORICAL, ...VIZ_SEQUENTIAL, ...VIZ_DIVERGING];

/** A role's hex in a palette; an alias resolves within the same palette. */
function resolve(name: string, palette: Record<string, string> = shipped): string {
  const v = palette[`--color-${name}`];
  if (v === undefined) throw new Error(`--color-${name} is not defined`);
  const alias = /^var\(--color-([a-z0-9-]+)\)$/.exec(v);
  return alias ? resolve(alias[1], palette) : v;
}

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5]
    .map((i) => Number.parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function ratio(fg: string, bg: string, palette: Record<string, string> = shipped): number {
  const [hi, lo] = [luminance(resolve(fg, palette)), luminance(resolve(bg, palette))].sort(
    (a, b) => b - a,
  );
  return (hi + 0.05) / (lo + 0.05);
}

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

// CSS: any hex or rgb(). TS/TSX: only a quoted hex (an inline style), so an
// href="#id" or a "#123" label is not a false hit.
const rawColour = (file: string): RegExp =>
  file.endsWith(".css") ? /#[0-9a-fA-F]{3,8}\b|rgba?\(/ : /["'`]#[0-9a-fA-F]{3,8}["'`]|rgba?\(/;

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
      ...VIZ_ROLES,
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
        expect({ file, raw: rawColour(file).test(code) }).toEqual({
          file,
          raw: false,
        });
      }
    }
  });
});

describe("RT-397 Dubai type", () => {
  const typeTokens = Object.keys(approved).filter((k) => /^--(font|text|leading|weight)-/.test(k));

  test("every type token equals its approved value, and no other type token is shipped", () => {
    expect(typeTokens.length).toBeGreaterThan(0);
    for (const name of typeTokens) {
      expect({ name, value: shipped[name] }).toEqual({ name, value: approved[name] });
    }
    const shippedType = Object.keys(shipped).filter((k) =>
      /^--(font|text|leading|weight)-/.test(k),
    );
    expect(shippedType.sort()).toEqual([...typeTokens].sort());
  });

  test("Dubai leads the UI stack and Inter is gone from src/", () => {
    expect(shipped["--font-sans"].startsWith('"Dubai"')).toBe(true);
    for (const file of cssFiles(join(root, "src"))) {
      const code = stripComments(readFileSync(file, "utf8"));
      expect({ file, inter: /\bInter\b/.test(code) }).toEqual({ file, inter: false });
    }
  });

  test("CSS keeps the 12px floor, the three Dubai weights, and no tracking", () => {
    const tokensFile = join(root, "src", "styles", "tokens.css");
    for (const file of cssFiles(join(root, "src")).filter((f) => f.endsWith(".css"))) {
      const code = stripComments(readFileSync(file, "utf8"));
      // Any font size written in px below 12, or in rem below 0.75.
      const sizes = [...code.matchAll(/font(?:-size)?:[^;]*?(\d*\.?\d+)(px|rem)/g)];
      const small = sizes.filter(([, n, unit]) => Number(n) * (unit === "rem" ? 16 : 1) < 12);
      expect({ file, small: small.map((m) => m[0]) }).toEqual({ file, small: [] });
      // Relative keywords shrink below the floor without a number to check.
      const keyword = /font(?:-size)?:[^;]*\b(smaller|x-small|xx-small)\b/.test(code);
      expect({ file, keyword }).toEqual({ file, keyword: false });
      expect({ file, tracking: /letter-spacing/.test(code) }).toEqual({ file, tracking: false });
      if (file !== tokensFile) {
        const numericWeight = /font-weight:\s*\d|font:\s*\d{3}\s/.test(code);
        expect({ file, numericWeight }).toEqual({ file, numericWeight: false });
      }
    }
  });
});

describe("RT-398 dark theme", () => {
  test("the dark block equals the approved dark block, every value", () => {
    expect(Object.keys(approvedDark).length).toBeGreaterThan(0);
    expect(shippedDark).toEqual(approvedDark);
  });

  test("the dark block comes after :root, so it wins at equal specificity", () => {
    expect(shippedCss.indexOf(`${DARK} {`)).toBeGreaterThan(shippedCss.indexOf(":root {"));
  });

  test("on-primary is the dark background in dark (text on a teal fill is dark)", () => {
    expect(resolve("on-primary", shippedDark)).toBe(resolve("background", shippedDark));
  });

  test.each(CONTRAST_PAIRS)("dark: %s on %s passes WCAG AA (>= %s:1)", (fg, bg, min) => {
    expect(ratio(fg, bg, shippedDark)).toBeGreaterThanOrEqual(min);
  });
});

describe("RT-822 data-viz tokens", () => {
  // Status and intent roles a data colour must never reuse (UX-13).
  const RESERVED = [
    "primary",
    "primary-emphasis",
    "primary-soft",
    "success",
    "warning",
    "danger",
    "info",
  ];
  const themes = [
    ["light", shipped],
    ["dark", shippedDark],
  ] as const;

  test.each(themes)("%s: no data-viz role equals or aliases a status or intent role", (_, p) => {
    const reservedValues = new Set(RESERVED.map((r) => resolve(r, p)));
    for (const role of VIZ_ROLES) {
      const raw = p[`--color-${role}`];
      expect({ role, aliases: RESERVED.some((r) => raw === `var(--color-${r})`) }).toEqual({
        role,
        aliases: false,
      });
      expect({ role, reused: reservedValues.has(resolve(role, p)) }).toEqual({
        role,
        reused: false,
      });
    }
  });

  test.each(themes)("%s: the eight categorical slots are distinct", (_, p) => {
    expect(new Set(VIZ_CATEGORICAL.map((r) => resolve(r, p))).size).toBe(VIZ_CATEGORICAL.length);
  });

  test("sequential runs from the surface outward: lighter to darker in light, darker to lighter in dark", () => {
    const lum = (p: Record<string, string>) => VIZ_SEQUENTIAL.map((r) => luminance(resolve(r, p)));
    const light = lum(shipped);
    const dark = lum(shippedDark);
    expect(light).toEqual([...light].sort((a, b) => b - a));
    expect(dark).toEqual([...dark].sort((a, b) => a - b));
  });

  test("forced colours map every data-viz role to a system colour", () => {
    const start = shippedCss.indexOf("@media (forced-colors: active)");
    expect(start).toBeGreaterThan(shippedCss.indexOf(`${DARK} {`));
    const body = shippedCss.slice(start, shippedCss.indexOf("}", start));
    const mapped = Object.fromEntries(
      [...body.matchAll(/(--color-viz-[a-z0-9-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]),
    );
    for (const role of VIZ_ROLES) {
      expect({ role, value: mapped[`--color-${role}`] }).toEqual({
        role,
        value: expect.stringMatching(/^(CanvasText|GrayText|Canvas)$/),
      });
    }
  });
});
