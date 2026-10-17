/**
 * RT-372 — A plain pairing code (no device replaced), issued from the pending
 * codes page. One step: the store and the terminal binding, then the code is
 * shown ONCE. There is no impact preview, because nothing is revoked, moved or
 * retired. As with Replace and Move, an issue is non-replayable: a refused or
 * unanswered attempt is never retried with the same key.
 */
import { Banner } from "@/components/Banner";
import { Drawer } from "@/components/Drawer";
import { useT } from "@/i18n";
import type { PairingCodeIssued } from "@/lib/device-queries";
import { type StoreDirectory, useStoreDirectory } from "@/shift-closes/useShiftCloses";
import { useState } from "react";
import { Link } from "react-router";
import { IssueFields } from "./IssueFields";
import { IssuedCode } from "./IssuedCode";
import { type Notice, noticeOf } from "./flowTypes";
import { classifyMutationFailure } from "./lifecycleFailure";
import {
  EMPTY_ISSUE_DRAFT,
  type IssueDraft,
  type IssueProblems,
  buildIssueBody,
  validateIssueDraft,
} from "./pairingLogic";
import { useIssuePairingCode } from "./useDeviceLifecycle";
import { useDeviceScope } from "./useDevices";
import { useSingleFlight } from "./useSingleFlight";
import "./devices.css";

function NoticeBanner({
  notice,
  onClose,
}: Readonly<{ notice?: Notice; onClose: () => void }>): React.JSX.Element | null {
  const t = useT();
  if (!notice) return null;
  return (
    <Banner
      variant={notice.variant}
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
  );
}

interface FormProps {
  draft: IssueDraft;
  problems: IssueProblems;
  notice?: Notice;
  directory: StoreDirectory;
  pending: boolean;
  onChange: (patch: Partial<IssueDraft>) => void;
  onClose: () => void;
}

function IssueForm({
  draft,
  problems,
  notice,
  directory,
  pending,
  onChange,
  onClose,
}: Readonly<FormProps>): React.JSX.Element {
  const t = useT();
  return (
    <>
      <NoticeBanner notice={notice} onClose={onClose} />
      <IssueFields
        mode="pair"
        draft={draft}
        problems={problems}
        stores={directory.stores}
        onChange={onChange}
      />
      <div className="surface__actions">
        <button type="submit" className="btn-primary" disabled={pending}>
          {pending ? <span className="spinner" aria-hidden="true" /> : null}
          {t("devices.issue.confirm")}
        </button>
        <button type="button" className="btn-secondary" onClick={onClose} disabled={pending}>
          {t("common.cancel")}
        </button>
      </div>
    </>
  );
}

function IssuedView({
  issued,
  directory,
  onClose,
}: Readonly<{
  issued: PairingCodeIssued;
  directory: StoreDirectory;
  onClose: () => void;
}>): React.JSX.Element {
  const t = useT();
  return (
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
  );
}

export function PairDrawer({ onClose }: Readonly<{ onClose: () => void }>): React.JSX.Element {
  const t = useT();
  const directory = useStoreDirectory(useDeviceScope().tenantId);
  const issue = useIssuePairingCode();
  const singleFlight = useSingleFlight();
  const [draft, setDraft] = useState<IssueDraft>(EMPTY_ISSUE_DRAFT);
  const [problems, setProblems] = useState<IssueProblems>({});
  const [notice, setNotice] = useState<Notice | undefined>();
  // The secret code lives here only, until the drawer closes.
  const [issued, setIssued] = useState<PairingCodeIssued | undefined>();
  // While the server is answering, nothing closes the drawer: an issued code would be lost.
  const close = issue.isPending ? () => undefined : onClose;

  async function submit(): Promise<void> {
    const found = validateIssueDraft(draft);
    setProblems(found);
    if (Object.keys(found).length > 0) return;
    setNotice(undefined);
    await singleFlight(() => issueOnce());
  }

  async function issueOnce(): Promise<void> {
    try {
      const res = await issue.mutateAsync(buildIssueBody(draft));
      if (res.status === 201 && res.data) {
        setIssued(res.data);
        issue.reset();
        return;
      }
      // A gateway error or timeout can arrive after the server made the code: unknown outcome.
      const unanswered = res.status >= 500 || res.status === 0;
      setNotice(
        noticeOf(unanswered ? { kind: "no-answer" } : classifyMutationFailure(res), "pair"),
      );
    } catch {
      setNotice(noticeOf({ kind: "no-answer" }, "pair"));
    }
  }

  return (
    <Drawer title={t("devices.issue.title.pair")} onClose={close}>
      <form
        className="surface__form"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          if (!issued) void submit();
        }}
      >
        {issued ? (
          <IssuedView issued={issued} directory={directory} onClose={onClose} />
        ) : (
          <IssueForm
            draft={draft}
            problems={problems}
            notice={notice}
            directory={directory}
            pending={issue.isPending}
            onChange={(patch) => setDraft((d) => ({ ...d, ...patch }))}
            onClose={onClose}
          />
        )}
      </form>
    </Drawer>
  );
}
