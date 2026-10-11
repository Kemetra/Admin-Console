/**
 * Audit scope prompt — shown when no active tenant (the RF-1 scope gate normally
 * precedes this; defensive). A precondition, not an error. Named *Like to avoid
 * implying it is the RF-5 OperatorScopePrompt.
 */
import { useT } from "@/i18n";
import "../shell/surface.css";

export function OperatorScopePromptLike(): React.JSX.Element {
  const t = useT();
  return (
    <div className="surface">
      <header className="surface__head">
        <div>
          <h1 className="content__title">{t("audit.title")}</h1>
        </div>
      </header>
      <p className="scope-prompt">{t("audit.scopePrompt")}</p>
    </div>
  );
}
