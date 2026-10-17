/**
 * RT-587 shared display parts for the sales list and detail. They render the
 * server's recorded values and label what is missing; they never compute a
 * value. Names follow their source (OD-534-6): `snapshot` as recorded,
 * `current` labelled "current name", `unavailable` "not recorded".
 */
import { useLocale, useT } from "@/i18n";
import { intlTag } from "@/i18n/locale";
import type { SaleItem } from "@/lib/sale-queries";
import { erpStateKey, returnStateKey, syncStatusKey } from "./saleLogic";

/**
 * A business date: a calendar day fixed at capture in the store's zone. It is
 * formatted as a day, never as an instant, so no zone can move it.
 */
export function BusinessDate({ value }: Readonly<{ value: string }>): React.JSX.Element {
  const locale = useLocale();
  const [y, m, d] = value.split("-").map(Number);
  const day = new Date(Date.UTC(y, m - 1, d));
  const text = Number.isNaN(day.getTime())
    ? value
    : new Intl.DateTimeFormat(intlTag(locale), {
        timeZone: "UTC",
        day: "numeric",
        month: locale === "ar" ? "long" : "short",
        year: "numeric",
      }).format(day);
  return <time dateTime={value}>{text}</time>;
}

/**
 * A recorded name or label, by its source. The name is isolated (it may be
 * Latin in Arabic copy, or the reverse), so the "current name" label keeps its
 * place on either side of it.
 */
export function RecordedName({
  name,
  source,
}: Readonly<{ name: string | null; source: string }>): React.JSX.Element {
  const t = useT();
  if (name === null || source === "unavailable") return <>{t("sales.value.notRecorded")}</>;
  const isolated = <bdi dir="auto">{name}</bdi>;
  return source === "current" ? (
    <>{t.rich("sales.value.currentName", { name: isolated })}</>
  ) : (
    isolated
  );
}

/** The terminal: none for a sale captured before device attribution (RT-77). */
export function DeviceName({
  device,
}: Readonly<{ device: SaleItem["device"] }>): React.JSX.Element {
  const t = useT();
  if (device.deviceRef === null && device.label === null) return <>{t("sales.device.none")}</>;
  return <RecordedName name={device.label} source={device.labelSource} />;
}

/** A recorded sale number or receipt id: machine data, isolated LTR. */
export function SaleNumber({ value }: Readonly<{ value: string | null }>): React.JSX.Element {
  const t = useT();
  if (value === null) return <>{t("sales.value.notRecorded")}</>;
  return <bdi dir="ltr">{value}</bdi>;
}

const WARNING_SYNC = new Set(["failed-retryable", "failed-needs-repair"]);

/** Status chips: text carries the meaning; colour only reinforces it. */
export function StatusChips({ sale }: Readonly<{ sale: SaleItem }>): React.JSX.Element {
  const t = useT();
  return (
    <span className="sale-chips">
      <span className={WARNING_SYNC.has(sale.syncStatus) ? "badge badge--suspended" : "badge"}>
        {t(syncStatusKey(sale))}
      </span>
      {sale.voided ? (
        <span className="badge badge--suspended">{t("sales.chip.voided")}</span>
      ) : null}
      {sale.returnState === "none" ? null : (
        <span className="badge">{t(returnStateKey(sale))}</span>
      )}
      <ErpChip state={sale.erpPostingState} />
    </span>
  );
}

const ERP_BADGES: Record<string, string> = {
  posted: "badge",
  pending: "badge badge--pending",
  failed: "badge badge--suspended",
};

export function ErpChip({ state }: Readonly<{ state: string }>): React.JSX.Element {
  const t = useT();
  return (
    <span className={ERP_BADGES[state] ?? "badge"}>
      {t(erpStateKey({ erpPostingState: state }))}
    </span>
  );
}
