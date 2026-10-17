/**
 * RT-372 — The issued pairing code, shown ONCE with its time to live. The code
 * is a secret the server keeps only as a hash: it lives in the component's
 * state while this panel is open, never in the URL, storage, the page title, a
 * log or a query cache, and it is gone when the drawer closes. Nothing on the
 * panel navigates away: leaving would destroy the code before it was typed in. A replace or
 * move also carries the contract's REPLACEMENT_BLOCKED note: that refusal is the
 * POS's, at pairing, when a shift opened on the old device after the issue.
 */
import { useT } from "@/i18n";
import type { PairingCodeIssued } from "@/lib/device-queries";
import { LtrTime } from "./DeviceParts";
import "./devices.css";

const MS_PER_MINUTE = 60_000;

/** Whole minutes between the server's own `createdAt` and `expiresAt`. */
export function minutesToLive(issued: Pick<PairingCodeIssued, "createdAt" | "expiresAt">): number {
  const span = Date.parse(issued.expiresAt) - Date.parse(issued.createdAt);
  return Number.isFinite(span) ? Math.max(0, Math.round(span / MS_PER_MINUTE)) : 0;
}

export function IssuedCode({
  issued,
  storeName,
  timeZone,
}: Readonly<{
  issued: PairingCodeIssued;
  storeName?: string;
  timeZone?: string;
}>): React.JSX.Element {
  const t = useT();
  const replacing = issued.kind !== "pair";
  return (
    <section className="device-issued" aria-label={t("devices.issue.issued.title")}>
      <h3 className="device-impact__title">{t("devices.issue.issued.title")}</h3>
      <div className="device-issued__code">
        <span className="device-quiet">{t("devices.issue.issued.code")}</span>
        <code dir="ltr" className="device-issued__value">
          {issued.code}
        </code>
      </div>
      <p className="device-impact__verdict">{t("devices.issue.issued.once")}</p>
      <p>
        {t.rich("devices.issue.issued.valid", {
          count: minutesToLive(issued),
          time: <LtrTime value={issued.expiresAt} timeZone={timeZone} />,
        })}
      </p>
      {replacing ? (
        <>
          <p>
            {t.rich("devices.issue.issued.replaceHelp", {
              store: <bdi>{storeName ?? issued.storeId}</bdi>,
            })}
          </p>
          <p className="device-quiet">
            {t.rich("devices.issue.issued.blockedHelp", {
              code: (
                <bdi dir="ltr">
                  <code>REPLACEMENT_BLOCKED</code>
                </bdi>
              ),
            })}
          </p>
        </>
      ) : null}
    </section>
  );
}
