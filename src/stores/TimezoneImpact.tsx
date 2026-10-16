import { Banner } from "@/components/Banner";
import { useT } from "@/i18n";
import type { StoreTimezoneChangePreview } from "@/lib/rf2-queries";
import { ZoneName } from "./ZoneName";
/**
 * The impact review shown before a store's time zone is changed (RT-477,
 * RT-401 `previewStoreTimezoneChange`): what today's business date becomes,
 * whether a shift is open, and the confirmation the contract's
 * `timezone_impact_reviewed` asserts. The preview is advisory: an open shift is
 * shown here and blocks the save, and the server re-checks it on apply.
 *
 * The preview's business dates are plain `YYYY-MM-DD` strings, shown as they
 * are: parsing them as instants would shift them by a day in some zones.
 */
import type { TimezoneChange } from "./useTimezoneChange";

function PreviewDetails({
  preview,
}: Readonly<{ preview: StoreTimezoneChangePreview }>): React.JSX.Element {
  const t = useT();
  const openShifts = preview.open_shift_count;
  return (
    <>
      <p className="surface__impact-line">
        {t.rich("stores.timezone.impact.zones", {
          current: <ZoneName zone={preview.current_timezone} />,
          proposed: <ZoneName zone={preview.proposed_timezone} />,
        })}
      </p>
      <p className="surface__impact-line">
        {preview.business_date_changes_now
          ? t("stores.timezone.impact.dateChanges", {
              from: preview.business_date_current,
              to: preview.business_date_proposed,
            })
          : t("stores.timezone.impact.dateSame", { date: preview.business_date_current })}
      </p>
      <p
        className={
          openShifts > 0
            ? "surface__impact-line surface__impact-line--blocked"
            : "surface__impact-line"
        }
      >
        {openShifts > 0
          ? t("stores.timezone.impact.openShifts", { count: openShifts })
          : t("stores.timezone.impact.noOpenShifts")}
      </p>
      <p className="surface__impact-line surface__impact-line--muted">
        {t("stores.timezone.impact.history")}
      </p>
    </>
  );
}

function ImpactBody({ change }: Readonly<{ change: TimezoneChange }>): React.JSX.Element {
  const t = useT();
  const result = change.previewResult;
  if (change.isPreviewing || !result) {
    return <output>{t("stores.timezone.impact.loading")}</output>;
  }
  if (result.kind === "error") {
    const { render } = result;
    const requestId = "requestId" in render ? render.requestId : undefined;
    return <Banner variant="danger" message={t(render.messageKey)} requestId={requestId} />;
  }
  if (change.noOp) {
    return <p className="surface__impact-line">{t("stores.timezone.impact.noChange")}</p>;
  }
  return (
    <>
      <PreviewDetails preview={result.preview} />
      {change.blocked ? null : (
        <label className="surface__impact-review">
          <input
            type="checkbox"
            checked={change.reviewed}
            onChange={(e) => change.setReviewed(e.target.checked)}
          />
          <span>{t("stores.timezone.impact.review")}</span>
        </label>
      )}
    </>
  );
}

/** Renders nothing until the user picks a zone other than the store's own. */
export function TimezoneImpact({
  change,
}: Readonly<{ change: TimezoneChange }>): React.JSX.Element | null {
  const t = useT();
  if (!change.changed) return null;
  return (
    <section className="surface__impact" aria-label={t("stores.timezone.impact.title")}>
      <h3 className="surface__impact-title">{t("stores.timezone.impact.title")}</h3>
      {/* Polite live region: the preview resolving, or an open shift, is announced. */}
      <div className="surface__impact-body" aria-live="polite">
        <ImpactBody change={change} />
      </div>
    </section>
  );
}
