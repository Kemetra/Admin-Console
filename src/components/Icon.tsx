/**
 * Inline-SVG icon set (SF-2 chrome; Console v4.0 design adoption). A closed,
 * hand-picked glyph map — not an open icon font — so the bundle carries only
 * what the shell renders and every path is design-reviewed. Glyphs inherit
 * `currentColor` and are decorative by default (`aria-hidden`), so an <Icon>
 * placed beside a text label never pollutes that element's accessible name
 * (the shell's role/name test contract depends on this). Pass `title` to make
 * a standalone icon a labelled image instead.
 *
 * Stroke geometry follows the prototype's 24x24 / 1.75-stroke line style
 * (DESIGN.md line-icon register): even weight, round caps, no fills.
 */
import type { SVGProps } from "react";

/** The exact glyph set the app shell consumes. Extend deliberately, per surface. */
export type IconName =
  | "overview"
  | "tenants"
  | "stores"
  | "operators"
  | "audit"
  | "catalog"
  | "unknown"
  | "stock"
  | "search"
  | "bell"
  | "help"
  | "sign-out"
  | "chevron";

/** 24x24 path data, drawn for a 1.75 stroke. One source of truth per glyph. */
const PATHS: Record<IconName, React.ReactNode> = {
  // Layout grid — the operational "everything" view.
  overview: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </>
  ),
  // Building — a tenant org.
  tenants: (
    <>
      <path d="M3 21h18" />
      <path d="M5 21V6l7-3 7 3v15" />
      <path d="M9 9h0M9 13h0M9 17h0M15 9h0M15 13h0M15 17h0" />
    </>
  ),
  // Storefront — a single store.
  stores: (
    <>
      <path d="M3 9l1.5-5h15L21 9" />
      <path d="M4 9v11a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V9" />
      <path d="M3 9h18" />
      <path d="M9 21v-6h6v6" />
    </>
  ),
  // People — operators & roles.
  operators: (
    <>
      <circle cx="9" cy="8" r="3.25" />
      <path d="M3.5 20a5.5 5.5 0 0 1 11 0" />
      <path d="M16 5.2a3.25 3.25 0 0 1 0 5.6" />
      <path d="M17 14.2A5.5 5.5 0 0 1 20.5 20" />
    </>
  ),
  // Document with lines — audit log.
  audit: (
    <>
      <path d="M6 3h8l4 4v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" />
      <path d="M14 3v4h4" />
      <path d="M8 12h8M8 16h8M8 8h3" />
    </>
  ),
  // Tag — catalog / inventory.
  catalog: (
    <>
      <path d="M3 6.5A1.5 1.5 0 0 1 4.5 5H11l9 9-6.5 6.5-9-9V6.5Z" />
      <circle cx="7.5" cy="9.5" r="1.25" />
    </>
  ),
  // Question diamond — unknown items review.
  unknown: (
    <>
      <path d="M12 3.2 20.8 12 12 20.8 3.2 12 12 3.2Z" />
      <path d="M9.6 9.6a2.4 2.4 0 0 1 4.7.6c0 1.6-2.3 1.9-2.3 3.4" />
      <path d="M12 17h0" />
    </>
  ),
  // Box with a down arrow — ERPNext stock discrepancies (RT-178).
  stock: (
    <>
      <path d="M3.5 8 12 3.5 20.5 8v8L12 20.5 3.5 16V8Z" />
      <path d="M3.5 8 12 12.5 20.5 8" />
      <path d="M12 12.5v8" />
    </>
  ),
  // Magnifier — global search.
  search: (
    <>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m20 20-4.8-4.8" />
    </>
  ),
  // Bell — notifications.
  bell: (
    <>
      <path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6Z" />
      <path d="M10 19a2 2 0 0 0 4 0" />
    </>
  ),
  // Circled question — help.
  help: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.6 9.6a2.4 2.4 0 0 1 4.7.6c0 1.6-2.3 1.9-2.3 3.4" />
      <path d="M12 17h0" />
    </>
  ),
  // Door with arrow — sign out.
  "sign-out": (
    <>
      <path d="M14 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4" />
      <path d="M10 12H3" />
      <path d="m6 8-4 4 4 4" />
    </>
  ),
  // Chevron down — disclosure / collapse.
  chevron: <path d="m6 9 6 6 6-6" />,
};

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, "name"> {
  name: IconName;
  /** px size for both axes. */
  size?: number;
  /** When set, the icon is a labelled image; otherwise it is decorative. */
  title?: string;
}

export function Icon({
  name,
  size = 18,
  title,
  strokeWidth = 1.75,
  ...rest
}: IconProps): React.JSX.Element {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
      focusable="false"
      {...rest}
    >
      {title ? <title>{title}</title> : null}
      {PATHS[name]}
    </svg>
  );
}
