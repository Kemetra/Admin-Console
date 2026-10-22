/**
 * Non-disclosing no-access state for `/platform` (RT-780). One component for
 * «not a platform admin» and «this path does not exist», so the two cannot be
 * told apart from the page. It names no role, flag or tenant. Standalone it
 * carries a plain product header (language and theme stay reachable); inside
 * the platform shell the shell supplies the chrome.
 */
import { TowerMark } from "@/components/TowerMark";
import { Icon } from "@/components/icons/Icon";
import { useActiveContextValue } from "@/context/ActiveContextProvider";
import { useT } from "@/i18n";
import { LocaleSwitch } from "@/i18n/LocaleSwitch";
import { ThemeToggle } from "@/theme/ThemeToggle";
import { Link } from "react-router";
import "@/shell/app-shell.css";
import "./platform.css";

export interface PlatformNotAvailableProps {
  /** Inside the platform shell, whose own <main> already is the landmark. */
  embedded?: boolean;
}

function Card(): React.JSX.Element {
  const t = useT();
  return (
    <div className="platform-unavailable">
      <span className="platform-unavailable__icon" aria-hidden="true">
        <Icon name="lock" size="lg" />
      </span>
      <h1 className="platform-unavailable__title">{t("platform.noAccess.title")}</h1>
      <p className="platform-unavailable__body">{t("platform.noAccess.body")}</p>
      <Link className="btn-secondary" to="/">
        {t("platform.noAccess.home")}
      </Link>
    </div>
  );
}

export function PlatformNotAvailable({
  embedded = false,
}: Readonly<PlatformNotAvailableProps>): React.JSX.Element {
  const { context } = useActiveContextValue();
  const userId = context?.user?.id;
  if (embedded) {
    return (
      <div className="platform-stage platform-stage--embedded">
        <Card />
      </div>
    );
  }
  return (
    <div className="platform-standalone">
      <header className="topbar">
        <span className="tower-lockup">
          <TowerMark className="tower-mark" />
          <span className="tower-lockup__word">Retail Tower OS</span>
        </span>
        <div className="topbar__spacer" />
        <LocaleSwitch userId={userId} />
        <ThemeToggle userId={userId} />
      </header>
      <main className="platform-stage">
        <Card />
      </main>
    </div>
  );
}
