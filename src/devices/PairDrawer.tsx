/**
 * RT-372 — A plain pairing code (no device replaced), issued from the pending
 * codes page. One step: the store and the terminal binding, then the code is
 * shown ONCE. There is no impact preview, because nothing is revoked, moved or
 * retired. As with Replace and Move, an issue is non-replayable: a refused or
 * unanswered attempt is never retried with the same key.
 */
import { Banner } from "@/components/Banner";
import { Drawer } from "@/components/Drawer";
import { type MessageKey, useT } from "@/i18n";
import type { PairingCodeIssued } from "@/lib/device-queries";
import { useStoreDirectory } from "@/shift-closes/useShiftCloses";
import { useState } from "react";
import { Link } from "react-router";
import { IssueFields } from "./IssueFields";
import { IssuedCode } from "./IssuedCode";
import { classifyMutationFailure, noticeKeyFor, requestIdOfFailure } from "./lifecycleLogic";
import {
  EMPTY_ISSUE_DRAFT,
  type IssueDraft,
  type IssueProblems,
  buildIssueBody,
  validateIssueDraft,
} from "./pairingLogic";
import { useIssuePairingCode } from "./useDeviceLifecycle";
import { useDeviceScope } from "./useDevices";
import "./devices.css";

interface Notice {
  key: MessageKey;
  requestId?: string;
  codesLink: boolean;
}

export function PairDrawer({ onClose }: Readonly<{ onClose: () => void }>): React.JSX.Element {
  const t = useT();
  const scope = useDeviceScope();
  const directory = useStoreDirectory(scope.tenantId);
  const issue = useIssuePairingCode();
  const [draft, setDraft] = useState<IssueDraft>(EMPTY_ISSUE_DRAFT);
  const [problems, setProblems] = useState<IssueProblems>({});
  const [notice, setNotice] = useState<Notice | undefined>();
  // The secret code lives here only, until the drawer closes.
  const [issued, setIssued] = useState<PairingCodeIssued | undefined>();

  async function submit(): Promise<void> {
    const found = validateIssueDraft(draft);
    setProblems(found);
    if (Object.keys(found).length > 0) return;
    setNotice(undefined);
    try {
      const res = await issue.mutateAsync(buildIssueBody(draft));
      if (res.status === 201 && res.data) {
        setIssued(res.data);
        issue.reset();
        return;
      }
      const failure = classifyMutationFailure(res);
      setNotice({
        key: failure.kind === "not-found" ? "devices.issue.error.notFound" : noticeKeyFor(failure),
        requestId: requestIdOfFailure(failure),
        codesLink:
          failure.kind === "in-progress" ||
          (failure.kind === "conflict" && failure.code === "idempotency_key_conflict"),
      });
    } catch {
      setNotice({ key: "devices.issue.error.unknownOutcome", codesLink: true });
    }
  }

  return (
    <Drawer title={t("devices.issue.title.pair")} onClose={onClose}>
      <form
        className="surface__form"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          if (!issued) void submit();
        }}
      >
        {issued ? (
          <>
            <IssuedCode
              issued={issued}
              storeName={directory.nameOf(issued.storeId)}
              timeZone={directory.timeZoneOf(issued.storeId)}
            />
            <div className="surface__actions">
              <button type="button" className="btn-primary" onClick={onClose}>
                {t("devices.flow.done")}
              </button>
            </div>
          </>
        ) : (
          <>
            {notice ? (
              <Banner
                variant="danger"
                message={t(notice.key)}
                requestId={notice.requestId}
                action={
                  notice.codesLink ? (
                    <Link to="/devices/pairing-codes" onClick={onClose} className="btn-secondary">
                      {t("devices.issue.viewCodes")}
                    </Link>
                  ) : undefined
                }
              />
            ) : null}
            <IssueFields
              mode="pair"
              draft={draft}
              problems={problems}
              stores={directory.stores}
              onChange={(patch) => setDraft((d) => ({ ...d, ...patch }))}
            />
            <div className="surface__actions">
              <button type="submit" className="btn-primary" disabled={issue.isPending}>
                {issue.isPending ? <span className="spinner" aria-hidden="true" /> : null}
                {t("devices.issue.confirm")}
              </button>
              <button type="button" className="btn-secondary" onClick={onClose}>
                {t("common.cancel")}
              </button>
            </div>
          </>
        )}
      </form>
    </Drawer>
  );
}
