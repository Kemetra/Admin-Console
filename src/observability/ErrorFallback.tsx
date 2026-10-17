/**
 * Safe fallback screen for an unexpected render error (RT-633). It never shows
 * the error, its message or its stack: those can carry tokens, emails or
 * business data. `useT` reads the module-level locale store, so this renders
 * above every provider.
 */
import { useT } from "@/i18n";
import "@/components/banner.css";
import "./error-fallback.css";

export function ErrorFallback(): React.JSX.Element {
  const t = useT();
  return (
    <main className="rtc-crash">
      <div className="rtc-alert rtc-alert--danger" role="alert">
        <strong className="rtc-alert__title">{t("app.crash.title")}</strong>
        <span className="rtc-alert__body">{t("app.crash.body")}</span>
        <span className="rtc-alert__action">
          <button type="button" className="btn-secondary" onClick={() => window.location.reload()}>
            {t("app.crash.reload")}
          </button>
        </span>
      </div>
    </main>
  );
}
