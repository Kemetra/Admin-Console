/**
 * No-access terminal state (SF-1/SF-2, S7, VD-2). Shown when a signed-in user
 * has zero memberships. Offers only sign-out. Copy: `auth.noAccess.*` (RT-399).
 */
import { useT } from "@/i18n";
import "./no-access.css";

export interface NoAccessProps {
  onSignOut: () => void | Promise<void>;
}

export function NoAccess({ onSignOut }: NoAccessProps): React.JSX.Element {
  const t = useT();
  return (
    <div className="signin-stage">
      <div className="noaccess">
        <svg
          className="noaccess__icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <rect x="4" y="10" width="16" height="11" rx="2" />
          <path d="M8 10V7a4 4 0 0 1 8 0v3" />
        </svg>
        <h1 className="noaccess__title">{t("auth.noAccess.title")}</h1>
        <p className="noaccess__body">{t("auth.noAccess.body")}</p>
        <button className="btn-secondary" type="button" onClick={() => void onSignOut()}>
          {t("auth.noAccess.signOut")}
        </button>
      </div>
    </div>
  );
}
