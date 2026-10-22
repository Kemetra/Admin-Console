/**
 * `/platform/tenants`, the platform landing (RT-780, OQ-3). The directory ships
 * in RT-777 S3; until then this is the plain empty state, with no placeholder
 * rows or controls.
 */
import { useT } from "@/i18n";

export function PlatformTenants(): React.JSX.Element {
  const t = useT();
  return (
    <section aria-labelledby="platform-tenants-title">
      <h1 id="platform-tenants-title" className="content__title">
        {t("platform.tenants.emptyTitle")}
      </h1>
      <p className="content__sub">{t("platform.tenants.emptyBody")}</p>
    </section>
  );
}
