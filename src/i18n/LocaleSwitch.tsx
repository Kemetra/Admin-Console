import { useCallback, useEffect } from "react";
import { LANG_TAG, type Locale, adoptUserLocale, saveLocale } from "./locale";
import { useLocale } from "./react";
import { translate } from "./translate";

/**
 * The signed-in user's locale. Once the user is known their own stored choice
 * (or the Arabic default) wins; `choose` persists a new one per user.
 */
export function useUserLocale(userId: string | undefined): {
  locale: Locale;
  choose: (next: Locale) => void;
} {
  const locale = useLocale();

  useEffect(() => {
    if (userId) adoptUserLocale(userId);
  }, [userId]);

  const choose = useCallback((next: Locale) => saveLocale(userId, next), [userId]);
  return { locale, choose };
}

/**
 * Top-bar language switch (RT-399, card `patterns-locale-english`). A quiet
 * button named in the OTHER language («English» / «العربية»), carrying that
 * language's `lang` so it is pronounced and shaped correctly. It is the one
 * place the other language appears; everything else shows one locale at a
 * time (UX-12).
 */
export function LocaleSwitch({ userId }: { userId: string | undefined }): React.JSX.Element {
  const { locale, choose } = useUserLocale(userId);
  const other: Locale = locale === "ar" ? "en" : "ar";
  return (
    <button
      type="button"
      className="btn-ghost"
      lang={LANG_TAG[other]}
      aria-label={translate(other, "locale.switch.action")}
      onClick={() => choose(other)}
    >
      {translate(other, "locale.switch.name")}
    </button>
  );
}
