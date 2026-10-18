/**
 * No-access terminal state (SF-1/SF-2, S7, VD-2). Shown when a signed-in user
 * has zero memberships. Offers only sign-out. Copy: `auth.noAccess.*` (RT-399).
 */
import { Icon } from "@/components/icons/Icon";
import { useT } from "@/i18n";
import "./no-access.css";

export interface NoAccessProps {
  onSignOut: () => void | Promise<void>;
}

export function NoAccess({ onSignOut }: Readonly<NoAccessProps>): React.JSX.Element {
  const t = useT();
  return (
    <div className="signin-stage">
      <div className="noaccess">
        {/* The lg glyph sits unscaled in the 40px slot (doc 25 §2 rule 7). */}
        <span className="noaccess__icon" aria-hidden="true">
          <Icon name="lock" size="lg" />
        </span>
        <h1 className="noaccess__title">{t("auth.noAccess.title")}</h1>
        <p className="noaccess__body">{t("auth.noAccess.body")}</p>
        <button className="btn-secondary" type="button" onClick={() => void onSignOut()}>
          {t("auth.noAccess.signOut")}
        </button>
      </div>
    </div>
  );
}
