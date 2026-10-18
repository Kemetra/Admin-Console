/**
 * RT-696 (RT-263 IC-3) — the semantic icon registry. Product code names an
 * icon by its meaning; only this module maps a meaning to a vendored Fluent
 * Regular glyph (`fluent-paths.ts`). POS `docs/design/vnext/25-rt263-icon-
 * registry-fluent-poc.md` §3 is the canonical name table, shared with the POS
 * registry (D-263-9): same names, vendored per repository.
 *
 * - `mirror` is the product's RTL rule, not the vendor's: `never` stays as
 *   drawn, `mirror` flips in an RTL run, `variant` swaps to `rtlAsset`.
 * - `regular` lists only the grids a call site uses, since every declared
 *   variant ships (doc 25 §6).
 * - This is the Admin subset. A §3 name with no Admin call site (`bell` and
 *   `help` had none) joins with the slice that first renders it. Admin has no
 *   slim rail, so no entry declares a Filled glyph (D-263-8).
 */

export type IconGrid = 16 | 20 | 24;
export type IconMirror = "never" | "mirror" | "variant";

interface IconEntry {
  /** Fluent asset name, without grid and style. */
  readonly asset: string;
  /** The separate Fluent RTL asset of a `variant` entry. */
  readonly rtlAsset?: string;
  readonly mirror: IconMirror;
  readonly regular: readonly IconGrid[];
}

export const ICON_REGISTRY = {
  // Actions
  search: { asset: "search", mirror: "never", regular: [16] },
  close: { asset: "dismiss", mirror: "never", regular: [16] },
  confirm: { asset: "checkmark", mirror: "never", regular: [16] },
  lock: { asset: "lock_closed", mirror: "never", regular: [24] },
  signOut: { asset: "sign_out", mirror: "mirror", regular: [20] },
  // Direction: back follows reading direction.
  back: { asset: "arrow_left", mirror: "mirror", regular: [16] },
  disclosure: { asset: "chevron_down", mirror: "never", regular: [16] },
  // Domain
  dashboard: { asset: "grid", mirror: "never", regular: [20] },
  sale: { asset: "receipt", mirror: "never", regular: [20] },
  audit: {
    asset: "clipboard_task_list_ltr",
    rtlAsset: "clipboard_task_list_rtl",
    mirror: "variant",
    regular: [20],
  },
  inventory: { asset: "box", mirror: "never", regular: [20] },
  product: { asset: "tag", mirror: "never", regular: [20] },
  unknownItem: { asset: "tag_question_mark", mirror: "never", regular: [20] },
  cash: { asset: "money", mirror: "never", regular: [20] },
  terminal: { asset: "desktop", mirror: "never", regular: [20] },
  people: { asset: "people", mirror: "never", regular: [20] },
  tenant: { asset: "building", mirror: "never", regular: [20] },
  store: { asset: "building_shop", mirror: "never", regular: [20] },
  connection: { asset: "plug_connected", mirror: "never", regular: [20] },
} as const satisfies Readonly<Record<string, IconEntry>>;

export type IconName = keyof typeof ICON_REGISTRY;

export const ICON_NAMES = Object.keys(ICON_REGISTRY) as readonly IconName[];

/** The vendored key of one Fluent asset: its upstream file stem. */
export function assetKey(asset: string, grid: IconGrid): string {
  return `${asset}_${String(grid)}_regular`;
}
