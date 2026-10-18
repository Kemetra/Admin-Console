import { readFileSync } from "node:fs";
import { join } from "node:path";
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";

import { BackArrow } from "@/components/BackArrow";
import { ICON_SIZE_PX, Icon, type IconProps } from "@/components/icons/Icon";
import { FLUENT_PATHS } from "@/components/icons/fluent-paths";
import {
  ICON_NAMES,
  ICON_REGISTRY,
  type IconGrid,
  type IconName,
  assetKey,
} from "@/components/icons/registry";
import { sourcesUnder } from "./source-scan";

/**
 * RT-696 (RT-263 IC-3) — the Admin semantic icon registry. Names are meanings
 * from POS doc 25 §3, the registry alone maps them to vendored Fluent Regular
 * glyphs, it owns RTL mirroring, it declares only the grids its call sites
 * use, and the glyph is always decorative (D-263-6).
 */

afterEach(cleanup);

const PATHS: Readonly<Record<string, string>> = FLUENT_PATHS;
const SIZE_OF: Readonly<Record<IconGrid, "sm" | "md" | "lg">> = { 16: "sm", 20: "md", 24: "lg" };
const read = (path: string): string => readFileSync(join(process.cwd(), path), "utf8");

/** Doc 25 §3: each retired Admin glyph (the 17 `Icon` keys and the one-offs) and its name. */
const FROM_ADMIN: Readonly<Record<string, IconName | null>> = {
  overview: "dashboard",
  tenants: "tenant",
  stores: "store",
  operators: "people",
  audit: "audit",
  catalog: "product",
  unknown: "unknownItem",
  stock: "inventory",
  cash: "cash",
  connection: "connection",
  device: "terminal",
  receipt: "sale",
  search: "search",
  // No call site: they join with the slice that first renders them (doc 25 §3).
  bell: null,
  help: null,
  "sign-out": "signOut",
  chevron: "disclosure",
  "NoAccess lock": "lock",
  "ScopeHeader caret": "disclosure",
  "BackArrow ←": "back",
  "Drawer ✕": "close",
  "ScopeHeader ✓": "confirm",
};

function draw(props: { name: IconName; size?: "sm" | "md" | "lg" }): SVGSVGElement {
  const { container } = render(<Icon {...(props as IconProps<IconName>)} />);
  const svg = container.querySelector("svg");
  if (svg === null) throw new Error("no svg");
  return svg;
}

function pathsOf(svg: SVGSVGElement): string[] {
  return Array.from(svg.querySelectorAll("path")).map((p) => p.getAttribute("d") ?? "");
}

describe("icon registry names", () => {
  test("serves every migrated Admin glyph, and nothing else", () => {
    const used = Object.values(FROM_ADMIN).filter((n): n is IconName => n !== null);
    expect([...ICON_NAMES].sort()).toEqual([...new Set(used)].sort());
  });

  test("names meanings, never screens, shapes or the vendor", () => {
    for (const name of ICON_NAMES) {
      expect(name).toMatch(/^[a-z][a-zA-Z]*(\.[a-z][a-zA-Z]*)?$/);
      expect(name).not.toMatch(/fluent|arrow|chevron|caret|^tower/i);
    }
  });

  test("keeps the brand TowerMark out of the registry (D-263-7)", () => {
    expect(ICON_NAMES.some((n) => /tower|brand|mark/i.test(n))).toBe(false);
  });
});

describe("icon registry RTL rules (D-263-4)", () => {
  test("mirrors only direction-implying meanings", () => {
    const mirrored = ICON_NAMES.filter((n) => ICON_REGISTRY[n].mirror === "mirror");
    expect([...mirrored].sort()).toEqual(["back", "signOut"]);
  });

  test("serves the audit list from its separate Fluent LTR and RTL assets", () => {
    const variants = ICON_NAMES.filter((n) => ICON_REGISTRY[n].mirror === "variant");
    expect(variants).toEqual(["audit"]);
    expect(ICON_REGISTRY.audit).toMatchObject({
      asset: "clipboard_task_list_ltr",
      rtlAsset: "clipboard_task_list_rtl",
    });
  });

  test("never flips search, lock, check or object icons (DESIGN.md §4)", () => {
    for (const name of ["search", "lock", "confirm", "store", "tenant", "cash"] as const) {
      expect(ICON_REGISTRY[name].mirror).toBe("never");
    }
  });

  test("gives only a variant entry an RTL asset", () => {
    for (const name of ICON_NAMES) {
      const entry = ICON_REGISTRY[name];
      expect("rtlAsset" in entry).toBe(entry.mirror === "variant");
    }
  });
});

describe("icon registry grids (doc 25 §2 rule 7, §6)", () => {
  test("declares only the Fluent optical grids, at least one per name", () => {
    for (const name of ICON_NAMES) {
      const { regular } = ICON_REGISTRY[name];
      expect(regular.length).toBeGreaterThan(0);
      for (const grid of regular) expect([16, 20, 24]).toContain(grid);
      expect(new Set(regular).size).toBe(regular.length);
    }
  });

  test("declares no Filled glyph: Admin has no slim rail (D-263-8)", () => {
    expect(ICON_NAMES.filter((n) => "filled" in ICON_REGISTRY[n])).toEqual([]);
    expect(Object.keys(FLUENT_PATHS).filter((k) => !k.endsWith("_regular"))).toEqual([]);
  });

  test("has vendored path data for every declared grid", () => {
    for (const key of declaredAssetKeys()) {
      expect(PATHS[key], key).toMatch(/^[Mm][\d.\s,a-zA-Z-]+$/);
    }
  });

  test("vendors nothing the registry does not declare", () => {
    expect(Object.keys(FLUENT_PATHS).sort()).toEqual([...declaredAssetKeys()].sort());
  });
});

function declaredAssetKeys(): Set<string> {
  return new Set(
    ICON_NAMES.flatMap((name) => {
      const entry = ICON_REGISTRY[name];
      const assets = "rtlAsset" in entry ? [entry.asset, entry.rtlAsset] : [entry.asset];
      return assets.flatMap((asset) => entry.regular.map((grid) => assetKey(asset, grid)));
    }),
  );
}

describe("Icon", () => {
  test("maps sm / md / lg to the 16 / 20 / 24 Fluent grids", () => {
    expect(ICON_SIZE_PX).toEqual({ sm: 16, md: 20, lg: 24 });
  });

  test("renders every name at every declared grid, at its native size, unscaled", () => {
    for (const name of ICON_NAMES) {
      const entry = ICON_REGISTRY[name];
      for (const grid of entry.regular) {
        const svg = draw({ name, size: SIZE_OF[grid] });
        expect(svg.getAttribute("width")).toBe(String(grid));
        expect(svg.getAttribute("height")).toBe(String(grid));
        expect(svg.getAttribute("viewBox")).toBe(`0 0 ${String(grid)} ${String(grid)}`);
        expect(pathsOf(svg)[0]).toBe(PATHS[assetKey(entry.asset, grid)]);
        cleanup();
      }
    }
  });

  test("defaults to md", () => {
    const svg = draw({ name: "store" });
    expect(svg.getAttribute("width")).toBe("20");
    expect(svg.classList.contains("rt-icon--md")).toBe(true);
  });

  test("is decorative: aria-hidden, not focusable, no role, label or title (D-263-6)", () => {
    const svg = draw({ name: "cash" });
    expect(svg.getAttribute("aria-hidden")).toBe("true");
    expect(svg.getAttribute("focusable")).toBe("false");
    expect(svg.hasAttribute("role")).toBe(false);
    expect(svg.hasAttribute("aria-label")).toBe(false);
    expect(svg.querySelector("title")).toBeNull();
  });

  test("paints with currentColor so the control decides colour", () => {
    const svg = draw({ name: "connection" });
    expect(svg.getAttribute("fill")).toBe("currentColor");
    expect(svg.hasAttribute("stroke")).toBe(false);
    expect(svg.querySelector("path")?.hasAttribute("fill")).toBe(false);
  });

  test("stamps the semantic name and keeps the call site's class", () => {
    const svg = draw({ name: "unknownItem" });
    expect(svg.getAttribute("data-icon")).toBe("unknownItem");
    const { container } = render(<Icon name="search" size="sm" className="lead" />);
    expect(container.querySelector("svg")?.getAttribute("class")).toBe("rt-icon rt-icon--sm lead");
  });

  test("marks only mirrored names for the RTL flip", () => {
    for (const name of ICON_NAMES) {
      const svg = draw({ name, size: SIZE_OF[ICON_REGISTRY[name].regular[0]] });
      expect(svg.classList.contains("rt-icon--mirror"), name).toBe(
        ICON_REGISTRY[name].mirror === "mirror",
      );
      cleanup();
    }
  });

  test("carries both audit assets and lets the direction pick one", () => {
    const [ltr, rtl] = Array.from(draw({ name: "audit" }).querySelectorAll("path"));
    expect(ltr?.getAttribute("class")).toBe("rt-icon__ltr");
    expect(ltr?.getAttribute("d")).toBe(FLUENT_PATHS.clipboard_task_list_ltr_20_regular);
    expect(rtl?.getAttribute("class")).toBe("rt-icon__rtl");
    expect(rtl?.getAttribute("d")).toBe(FLUENT_PATHS.clipboard_task_list_rtl_20_regular);
  });

  test("refuses a grid the registry does not declare", () => {
    expect(() => draw({ name: "close", size: "lg" })).toThrow(/close.*24/);
  });

  test("BackArrow is the mirrored registry `back` glyph, decorative", () => {
    const { container } = render(<BackArrow />);
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("data-icon")).toBe("back");
    expect(svg?.classList.contains("rt-icon--mirror")).toBe(true);
    expect(svg?.getAttribute("aria-hidden")).toBe("true");
    expect(container.textContent).toBe("");
  });
});

describe("icons.css", () => {
  const css = read("src/components/icons/icons.css").replace(/\/\*[\s\S]*?\*\//g, "");

  test("takes direction from the nearest dir attribute, inherited", () => {
    expect(css).toMatch(/\[dir="rtl" i\]\s*\{[^}]*--rt-icon-flip:\s*-1/);
    expect(css).toMatch(/\[dir="ltr" i\]\s*\{[^}]*--rt-icon-flip:\s*1;/);
    expect(css).toMatch(
      /\.rt-icon--mirror\s*\{[^}]*transform:\s*scaleX\(var\(--rt-icon-flip, 1\)\)/,
    );
  });

  test("never uses :dir() or a [dir] ancestor selector", () => {
    expect(css).not.toMatch(/:dir\(/);
    expect(css).not.toMatch(/\[dir[^\]]*\]\s+[.\w]/);
  });

  test("shows the LTR audit asset unless an RTL direction says otherwise", () => {
    expect(css).toMatch(/\.rt-icon__ltr\s*\{[^}]*display:\s*var\(--rt-icon-ltr, inline\)/);
    expect(css).toMatch(/\.rt-icon__rtl\s*\{[^}]*display:\s*var\(--rt-icon-rtl, none\)/);
  });

  test("leaves forced colours to the system", () => {
    expect(css).not.toMatch(/forced-color-adjust/);
  });
});

describe("one icon grammar in product code", () => {
  test("no raw <svg> outside the registry and the brand TowerMark", () => {
    const offenders = sourcesUnder("src")
      .filter(({ file }) => !/\/src\/components\/icons\//.test(file))
      .filter(({ file }) => !file.endsWith("/src/components/TowerMark.tsx"))
      .filter(({ file }) => !file.includes("/src/generated/"))
      .filter(({ src }) => /<svg\b/.test(src))
      .map(({ file }) => file);
    expect(offenders).toEqual([]);
  });

  test("no text glyph stands in for an icon (✕ ✓ ←)", () => {
    const offenders = sourcesUnder("src")
      .filter(({ file }) => file.endsWith(".tsx"))
      .filter(({ src }) => /[✕✓←]/.test(src))
      .map(({ file }) => file);
    expect(offenders).toEqual([]);
  });
});

describe("Fluent licence (doc 25 §5)", () => {
  test("keeps the MIT notice file next to the registry", () => {
    const notice = read("src/components/icons/LICENSE-fluentui-system-icons.txt");
    expect(notice).toContain("MIT License");
    expect(notice).toContain("Copyright (c) 2020 Microsoft Corporation");
    expect(notice).toContain(
      "The above copyright notice and this permission notice shall be included in all",
    );
  });

  test("lists Fluent in NOTICE", () => {
    const notice = read("NOTICE");
    expect(notice).toContain("Fluent UI System Icons");
    expect(notice).toContain("Copyright (c) 2020 Microsoft Corporation");
    expect(notice).toContain("src/components/icons/LICENSE-fluentui-system-icons.txt");
  });

  test("opens the vendored data with a legal comment the minifier keeps", () => {
    const source = read("src/components/icons/fluent-paths.ts");
    expect(source.startsWith("/*!")).toBe(true);
    const header = source.slice(0, source.indexOf("*/"));
    expect(header).toContain("@license MIT");
    expect(header).toContain("Copyright (c) 2020 Microsoft Corporation");
    expect(header).toContain("@fluentui/svg-icons 1.1.344");
  });
});

/** Compile-time contract (never rendered): `tsc --noEmit` fails if these stop erroring. */
function typeContract(): React.JSX.Element[] {
  return [
    <Icon key="a" name="store" />,
    <Icon key="b" name="lock" size="lg" />,
    // @ts-expect-error search declares no md grid, so the size must be given.
    <Icon key="c" name="search" />,
    // @ts-expect-error close declares no lg grid.
    <Icon key="d" name="close" size="lg" />,
    // @ts-expect-error the label lives on the control, never on the glyph (D-263-6).
    <Icon key="e" name="store" title="Store" />,
    // @ts-expect-error the old shape name is retired; names are meanings.
    <Icon key="f" name="chevron" size="sm" />,
  ];
}

test("the compile-time contract is part of the typecheck", () => {
  expect(typeContract()).toHaveLength(6);
});
