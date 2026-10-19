/**
 * RT-665 presentational parts of the AI plan & usage panel. Everything shown is
 * the server's decision rendered as copy: a state, a feature's status, a meter's
 * figures and reset time. Reason codes are never copy, and nothing here knows a
 * price, a plan name, a token cost or a credit balance (the view model carries
 * none). Machine data (feature and meter ids) is isolated LTR (UX-12). State is
 * carried by text, never by colour alone.
 */
import { DateTime, type MessageKey, formatNumber, useT } from "@/i18n";
import type {
  FeatureStatus,
  FullFeatureModel,
  FullPanelModel,
  MeterModel,
  MinimalPanelModel,
  PlanStateKey,
} from "./aiLogic";

const STATE_KEY: Record<PlanStateKey, MessageKey> = {
  none: "aiPlan.state.none",
  trial: "aiPlan.state.trial",
  active: "aiPlan.state.active",
  grace: "aiPlan.state.grace",
  expired: "aiPlan.state.expired",
  cancelled: "aiPlan.state.cancelled",
  unknown: "aiPlan.state.unknown",
};

const STATUS_KEY: Record<FeatureStatus, MessageKey> = {
  available: "aiPlan.status.available",
  notInPlan: "aiPlan.status.notInPlan",
  trialEnded: "aiPlan.status.trialEnded",
  readOnly: "aiPlan.status.readOnly",
  switchedOff: "aiPlan.status.switchedOff",
  temporarilyUnavailable: "aiPlan.status.temporarilyUnavailable",
};

const WINDOW_KEY = {
  day: "aiPlan.meter.window.day",
  month: "aiPlan.meter.window.month",
  unknown: "aiPlan.meter.window.unknown",
} as const;

function MachineId({ value }: Readonly<{ value: string }>): React.JSX.Element {
  return (
    <bdi dir="ltr" className="ai-plan__id">
      {value}
    </bdi>
  );
}

function Field({
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

function meterState(
  meter: MeterModel,
  { t, time }: Readonly<{ t: ReturnType<typeof useT>; time: React.ReactNode }>,
): React.ReactNode {
  if (meter.noAllowance) return t.rich("aiPlan.meter.none", { time });
  if (meter.allowanceUsed) return t.rich("aiPlan.meter.used", { time });
  return t.rich("aiPlan.meter.left", {
    remaining: formatNumber(meter.remaining, t.locale),
    limit: formatNumber(meter.limit, t.locale),
    time,
  });
}

function MeterLine({ meter }: Readonly<{ meter: MeterModel }>): React.JSX.Element {
  const t = useT();
  const { locale } = t;
  const time = <DateTime value={meter.resetsAt} />;
  return (
    <li className="ai-plan__meter">
      <span className="ai-plan__meter-name">
        <MachineId value={meter.meter} /> {t(WINDOW_KEY[meter.window])}
        {" · "}
        {meter.storeRef === null ? (
          t("aiPlan.meter.scope.tenant")
        ) : (
          <>
            {t("aiPlan.meter.scope.store")} <MachineId value={meter.storeRef} />
          </>
        )}
      </span>
      <span className="ai-plan__meter-state">{meterState(meter, { t, time })}</span>
      <span className="ai-plan__meter-detail">
        {t("aiPlan.meter.detail", {
          limit: formatNumber(meter.limit, locale),
          used: formatNumber(meter.used, locale),
          reserved: formatNumber(meter.reserved, locale),
        })}
      </span>
    </li>
  );
}

function StatusBadge({ status }: Readonly<{ status: FeatureStatus }>): React.JSX.Element {
  const t = useT();
  const tone = status === "available" ? " badge--active" : "";
  return <span className={`badge ai-plan__badge${tone}`}>{t(STATUS_KEY[status])}</span>;
}

function FullFeatureItem({ feature }: Readonly<{ feature: FullFeatureModel }>): React.JSX.Element {
  const t = useT();
  return (
    <li className="ai-plan__feature">
      <div className="ai-plan__feature-head">
        <MachineId value={feature.featureId} />
        <StatusBadge status={feature.status} />
      </div>
      {feature.optedOut && feature.optedOutAt ? (
        <p className="ai-plan__line">
          {t.rich("aiPlan.optOut.since", { date: <DateTime value={feature.optedOutAt} /> })}
        </p>
      ) : null}
      {feature.meters.length > 0 ? (
        <ul className="ai-plan__meters">
          {feature.meters.map((meter) => (
            <MeterLine key={`${meter.meter}:${meter.window}:${meter.storeRef}`} meter={meter} />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

export function FullView({ model }: Readonly<{ model: FullPanelModel }>): React.JSX.Element {
  const t = useT();
  return (
    <>
      <dl className="surface__detail">
        <Field label={t("aiPlan.field.state")}>
          <span className="badge ai-plan__badge">{t(STATE_KEY[model.state])}</span>
        </Field>
        {model.effectiveFrom ? (
          <Field label={t("aiPlan.field.effectiveFrom")}>
            <DateTime value={model.effectiveFrom} />
          </Field>
        ) : null}
        {model.effectiveUntil ? (
          <Field label={t("aiPlan.field.effectiveUntil")}>
            <DateTime value={model.effectiveUntil} />
          </Field>
        ) : null}
        {model.evaluatedAt ? (
          <Field label={t("aiPlan.field.evaluatedAt")}>
            <DateTime value={model.evaluatedAt} />
          </Field>
        ) : null}
      </dl>
      <h3 className="ai-plan__features-title">{t("aiPlan.features.title")}</h3>
      {model.features.length === 0 ? (
        <p className="field__hint">{t("aiPlan.features.empty")}</p>
      ) : (
        <ul className="ai-plan__features">
          {model.features.map((feature) => (
            <FullFeatureItem key={feature.featureId} feature={feature} />
          ))}
        </ul>
      )}
    </>
  );
}

export function MinimalView({ model }: Readonly<{ model: MinimalPanelModel }>): React.JSX.Element {
  const t = useT();
  if (model.features.length === 0) {
    return <p className="field__hint">{t("aiPlan.features.empty")}</p>;
  }
  return (
    <ul className="ai-plan__features">
      {model.features.map((feature) => (
        <li key={feature.featureId} className="ai-plan__feature">
          <div className="ai-plan__feature-head">
            <MachineId value={feature.featureId} />
            <span className={`badge ai-plan__badge${feature.available ? " badge--active" : ""}`}>
              {t(feature.available ? "aiPlan.minimal.available" : "aiPlan.minimal.unavailable")}
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}
