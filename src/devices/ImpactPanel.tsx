/**
 * RT-372 — The server's impact preview, rendered. Every fact here is a field of
 * `DeviceImpactPreview`; nothing is derived from the device, the role or a
 * count the console made itself. The verdict line says what the server said and
 * what to do about it; `null` stays unknown, never zero.
 */
import { Banner } from "@/components/Banner";
import { type MessageKey, useT } from "@/i18n";
import type { DeviceImpactPreview } from "@/lib/device-queries";
import { LtrTime, TrustBadge } from "./DeviceParts";
import { type ImpactDecision, blockedMessageKey, decideImpact } from "./impactDecision";
import "./devices.css";

const SOURCE_KEYS: Record<string, MessageKey> = {
  cash_up: "devices.impact.source.cash_up",
  legacy: "devices.impact.source.legacy",
};

function VerdictLine({
  decision,
  action,
}: Readonly<{ decision: ImpactDecision; action: string }>): React.JSX.Element {
  const t = useT();
  switch (decision.kind) {
    case "ready":
      return decision.custody ? (
        <Banner variant="warning" message={t("devices.impact.verdict.allowedCustody")} />
      ) : (
        <p className="device-impact__verdict">{t("devices.impact.verdict.allowed")}</p>
      );
    case "forbidden":
      return <Banner variant="danger" message={t("devices.impact.verdict.forbidden")} />;
    case "no_change":
      return <Banner variant="info" message={t("devices.impact.verdict.noChange")} />;
    case "blocked":
      return (
        <>
          <Banner
            variant="danger"
            message={t(blockedMessageKey(decision.known ? decision.blockCode : null, action))}
          />
          {decision.known || decision.blockCode === null ? null : (
            <bdi dir="ltr" className="device-impact__id">
              {decision.blockCode}
            </bdi>
          )}
        </>
      );
  }
}

function Fact({
  label,
  children,
}: Readonly<{ label: string; children: React.ReactNode }>): React.JSX.Element {
  return (
    <div className="device-impact__fact">
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function OpenShiftFact({
  shift,
  timeZone,
}: Readonly<{
  shift: NonNullable<DeviceImpactPreview["openShift"]>;
  timeZone?: string;
}>): React.JSX.Element {
  const t = useT();
  const sourceKey = SOURCE_KEYS[shift.source];
  const source = sourceKey ? t(sourceKey) : shift.source;
  return (
    <>
      <Fact label={t("devices.impact.field.openShift")}>
        {t.rich("devices.impact.openShift.line", {
          time: <LtrTime value={shift.openedAt} timeZone={timeZone} />,
          source,
        })}
        <bdi dir="ltr" className="device-impact__id">
          {shift.shiftId}
        </bdi>
      </Fact>
      <Fact label={t("devices.impact.field.cashFacts")}>
        {shift.cashFacts ? (
          <>
            {t.rich("devices.impact.cashFacts.value", {
              count: shift.cashFacts.receivedCount,
              time: <LtrTime value={shift.cashFacts.lastReceivedAt} timeZone={timeZone} />,
            })}
            <small className="device-quiet">{t("devices.impact.cashFacts.note")}</small>
          </>
        ) : (
          <span className="device-flag device-flag--danger">
            {t("devices.impact.cashFacts.unknown")}
          </span>
        )}
      </Fact>
    </>
  );
}

export function ImpactPanel({
  preview,
  timeZone,
}: Readonly<{ preview: DeviceImpactPreview; timeZone?: string }>): React.JSX.Element {
  const t = useT();
  const decision = decideImpact(preview);
  return (
    <section className="device-impact" aria-label={t("devices.impact.title")}>
      <h3 className="device-impact__title">{t("devices.impact.title")}</h3>
      <VerdictLine decision={decision} action={preview.action} />
      <dl className="device-impact__facts">
        <Fact label={t("devices.impact.field.state")}>
          <TrustBadge trustState={preview.trustState} />
        </Fact>
        {preview.openShift ? (
          <OpenShiftFact shift={preview.openShift} timeZone={timeZone} />
        ) : (
          <Fact label={t("devices.impact.field.openShift")}>
            {t("devices.impact.openShift.none")}
          </Fact>
        )}
        <Fact label={t("devices.impact.field.custody")}>
          {preview.custodyExceptionShiftId
            ? t.rich("devices.impact.custody.shift", {
                shift: (
                  <bdi dir="ltr" className="device-impact__id">
                    {preview.custodyExceptionShiftId}
                  </bdi>
                ),
              })
            : t("devices.impact.custody.none")}
        </Fact>
        {preview.cascade ? (
          <>
            <Fact label={t("devices.impact.field.sessions")}>
              {String(preview.cascade.operatorSessionCount)}
            </Fact>
            <Fact label={t("devices.impact.field.codes")}>
              {String(preview.cascade.pendingPairingCodeCount)}
            </Fact>
          </>
        ) : (
          <Fact label={t("devices.impact.field.sessions")}>{t("devices.impact.cascade.none")}</Fact>
        )}
      </dl>
      <p className="device-quiet device-impact__snapshot">
        {t.rich("devices.impact.snapshot", {
          time: <LtrTime value={preview.evaluatedAt} timeZone={timeZone} />,
        })}
      </p>
    </section>
  );
}
