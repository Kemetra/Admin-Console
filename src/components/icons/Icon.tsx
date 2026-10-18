import { FLUENT_PATHS } from "./fluent-paths";
import { ICON_REGISTRY, type IconGrid, type IconName, assetKey } from "./registry";
import "./icons.css";

/** The Fluent optical grids (doc 25 §2 rule 7): a glyph is never scaled between them. */
export const ICON_SIZE_PX = { sm: 16, md: 20, lg: 24 } as const;
export type IconSize = keyof typeof ICON_SIZE_PX;

type GridOf<N extends IconName> = (typeof ICON_REGISTRY)[N]["regular"][number];
type SizeFor<N extends IconName> = {
  [S in IconSize]: (typeof ICON_SIZE_PX)[S] extends GridOf<N> ? S : never;
}[IconSize];

/** The names that declare grid `S`: a typed map of call sites (the nav) stays on one grid. */
export type IconNameFor<S extends IconSize> = {
  [N in IconName]: S extends SizeFor<N> ? N : never;
}[IconName];

/** `size` may be left out only when the name declares the default `md` grid. */
type SizeProp<N extends IconName> = 20 extends GridOf<N>
  ? { readonly size?: SizeFor<N> }
  : { readonly size: SizeFor<N> };

export type IconProps<N extends IconName> = {
  readonly name: N;
  /** Layout and colour hook of the call site; never a label. */
  readonly className?: string;
} & SizeProp<N>;

const PATHS: Readonly<Record<string, string | undefined>> = FLUENT_PATHS;

function pathOf(name: IconName, asset: string, grid: IconGrid): string {
  const d = PATHS[assetKey(asset, grid)];
  // The types rule this out; a cast that slips past them fails loudly in tests.
  if (d === undefined) throw new Error(`icon "${name}" declares no ${String(grid)} glyph`);
  return d;
}

/**
 * RT-696 (RT-263 IC-3) — one registry glyph. Always decorative: the control
 * or the text beside it carries the meaning, never the `<svg>` (D-263-6; the
 * old `title` prop is retired). Colour comes from `currentColor`; direction
 * comes from the nearest `dir` attribute through `icons.css`, never from the
 * call site.
 */
export function Icon<N extends IconName>(props: IconProps<N>): React.JSX.Element {
  const { name } = props;
  const size: IconSize = props.size ?? "md";
  const entry: (typeof ICON_REGISTRY)[IconName] = ICON_REGISTRY[name];
  const grid = ICON_SIZE_PX[size];
  const d = pathOf(name, entry.asset, grid);
  const classes = ["rt-icon", `rt-icon--${size}`];
  if (entry.mirror === "mirror") classes.push("rt-icon--mirror");
  if (props.className) classes.push(props.className);

  return (
    <svg
      className={classes.join(" ")}
      data-icon={name}
      width={grid}
      height={grid}
      viewBox={`0 0 ${String(grid)} ${String(grid)}`}
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
    >
      {"rtlAsset" in entry ? (
        <>
          <path className="rt-icon__ltr" d={d} />
          <path className="rt-icon__rtl" d={pathOf(name, entry.rtlAsset, grid)} />
        </>
      ) : (
        <path d={d} />
      )}
    </svg>
  );
}
