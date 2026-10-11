import { useTheme } from "./useTheme";

/**
 * Top-bar dark-mode switch (RT-398). A toggle button with a constant label;
 * aria-pressed carries the state, so the label never swaps (UX-11). The label
 * moves to Arabic with the locale work (RT-399).
 */
export function ThemeToggle({ userId }: { userId: string | undefined }): React.JSX.Element {
  const { theme, toggle } = useTheme(userId);
  return (
    <button
      type="button"
      className="btn-secondary"
      aria-pressed={theme === "dark"}
      onClick={toggle}
    >
      Dark mode
    </button>
  );
}
