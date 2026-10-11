import { useT } from "@/i18n";
import { useTheme } from "./useTheme";

/**
 * Top-bar dark-mode switch (RT-398). A toggle button with a constant label;
 * aria-pressed carries the state, so the label never swaps (UX-11). The label
 * comes from the catalog (RT-399).
 */
export function ThemeToggle({ userId }: { userId: string | undefined }): React.JSX.Element {
  const t = useT();
  const { theme, toggle } = useTheme(userId);
  return (
    <button
      type="button"
      className="btn-secondary"
      aria-pressed={theme === "dark"}
      onClick={toggle}
    >
      {t("theme.darkMode")}
    </button>
  );
}
