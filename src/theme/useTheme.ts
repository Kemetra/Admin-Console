import { useCallback, useEffect, useState } from "react";
import { type Theme, currentTheme, saveTheme, storedThemeFor } from "./theme";

/**
 * The signed-in user's theme. Starts from what is already painted (the pre-paint
 * script), so mounting never flashes; once the user is known, their own stored
 * choice wins, and the last-choice mirror is updated to match.
 */
export function useTheme(userId: string | undefined): {
  theme: Theme;
  toggle: () => void;
} {
  const [theme, setTheme] = useState<Theme>(currentTheme);

  useEffect(() => {
    if (!userId) return;
    const mine = storedThemeFor(userId);
    saveTheme(userId, mine);
    setTheme(mine);
  }, [userId]);

  const toggle = useCallback(() => {
    const next: Theme = currentTheme() === "dark" ? "light" : "dark";
    saveTheme(userId, next);
    setTheme(next);
  }, [userId]);

  return { theme, toggle };
}
