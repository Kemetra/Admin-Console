import { useT } from "@/i18n";
import "../shell/surface.css";

/** No active tenant: nothing is requested until RF-1's gate has one. */
export function ShiftScopePrompt(): React.JSX.Element {
  const t = useT();
  return (
    <div className="surface">
      <p className="content__sub">{t("shift.list.scopePrompt")}</p>
    </div>
  );
}
