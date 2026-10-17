/**
 * RT-389 small presentational parts shared by the tenant and store sections.
 * Everything shown is rendered as the server returned it: a value, its source,
 * a revision's reason and ids. Machine data (ids) is isolated LTR (UX-12).
 */
import { DateTime, Money, useT } from "@/i18n";
import type { CashVariancePolicyValue, PolicySource } from "@/lib/cash-variance-policy-queries";

const SOURCE_KEY = {
  system: "cashPolicy.source.system",
  tenant: "cashPolicy.source.tenant",
  store: "cashPolicy.source.store",
} as const;

/** `none`, or `limit` with the amount and currency as `1,250.00 EGP`. */
export function PolicyValue({
  value,
}: Readonly<{ value: CashVariancePolicyValue }>): React.JSX.Element {
  const t = useT();
  if (value.mode === "limit" && value.limitAmount !== undefined) {
    return (
      <span>
        {t.rich("cashPolicy.value.limit", {
          amount: <Money value={value.limitAmount} currency={value.currencyCode} />,
        })}
      </span>
    );
  }
  return <span>{t("cashPolicy.value.none")}</span>;
}

export function SourceBadge({ source }: Readonly<{ source: PolicySource }>): React.JSX.Element {
  const t = useT();
  return <span className="badge">{t(SOURCE_KEY[source])}</span>;
}

export function MachineId({ value }: Readonly<{ value: string }>): React.JSX.Element {
  return <bdi dir="ltr">{value}</bdi>;
}

export function Field({
  label,
  children,
}: Readonly<{ label: string; children: React.ReactNode }>): React.JSX.Element {
  return (
    <div className="field-row">
      <dt className="field-row__label">{label}</dt>
      <dd className="field-row__value">{children}</dd>
    </div>
  );
}

/** The latest revision's reason, time and author (tenant default). */
export function RevisionFacts({
  reason,
  effectiveFrom,
  createdByUserId,
  timeZone,
}: Readonly<{
  reason: string;
  effectiveFrom: string;
  createdByUserId: string;
  timeZone?: string;
}>): React.JSX.Element {
  const t = useT();
  return (
    <>
      <Field label={t("cashPolicy.field.reason")}>
        <bdi dir="auto">{reason}</bdi>
      </Field>
      <Field label={t("cashPolicy.field.changedAt")}>
        <DateTime value={effectiveFrom} timeZone={timeZone} />
      </Field>
      <Field label={t("cashPolicy.field.changedBy")}>
        <MachineId value={createdByUserId} />
      </Field>
    </>
  );
}
