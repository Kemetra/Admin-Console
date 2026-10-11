import { Avatar } from "@/components/Avatar";
import { Banner } from "@/components/Banner";
import { ListState } from "@/components/ListState";
import { useActiveContextValue } from "@/context/ActiveContextProvider";
import { type T, roleKey, useT } from "@/i18n";
import "@/components/avatar.css";
/**
 * SF5-1 — Member list (T012/T013). The membership graph for the active tenant
 * rendered as a `.data-table` (DESIGN.md rule 7): Member (name over mono email),
 * Role badge, Store access (All stores / N stores — ids/count not names, OQ-3),
 * State (Revoked badge when revoked_at). Page header + right-aligned "Invite
 * member" primary.
 *
 * Pre-call guard (FR-005-007): no active tenant → scope prompt, `listMembers`
 * never called (it has no precondition-401). `listMembers` documents only 404 →
 * uniform banner with request_id. The invite/edit drawers mount from here.
 */
import { useState } from "react";
import { EditMember } from "./EditMember";
import { InviteMember } from "./InviteMember";
import { OperatorScopePrompt } from "./OperatorScopePrompt";
import { type MemberRow, useMembers } from "./useMembers";
import "../shell/surface.css";

function storeAccessLabel(row: MemberRow, t: T): string {
  if (row.storeAccessKind === "all") return t("operators.storeAccess.all");
  return t("operators.storeAccess.count", { count: row.accessibleStoreIds.length });
}

export function MemberList(): React.JSX.Element {
  const t = useT();
  const { context } = useActiveContextValue();
  const rawTenant = context?.active_tenant ?? null;
  const { result, isLoading, refetch } = useMembers(rawTenant?.id ?? null);
  const [inviting, setInviting] = useState(false);
  const [editing, setEditing] = useState<MemberRow | null>(null);

  // Pre-call guard: no active tenant -> scope prompt, listMembers never issued.
  if (!rawTenant?.id) {
    return <OperatorScopePrompt />;
  }
  const activeTenant = { id: rawTenant.id, name: rawTenant.name ?? rawTenant.id };

  const rows = result?.kind === "rows" ? result.rows : [];
  const notFound = result?.kind === "not-found" ? { requestId: result.requestId } : undefined;

  return (
    <div className="surface">
      <header className="surface__head">
        <div>
          <h1 className="content__title">{t("operators.title")}</h1>
          <p className="content__sub">
            {t.rich("operators.list.subtitle", { tenant: <bdi>{activeTenant.name}</bdi> })}
          </p>
        </div>
        {/* Single-primary (DESIGN.md 6): header invite shows only when there are
            rows; the empty state carries its own invite primary. */}
        {!isLoading && !notFound && rows.length > 0 ? (
          <button type="button" className="btn-primary" onClick={() => setInviting(true)}>
            {t("operators.list.invite")}
          </button>
        ) : null}
      </header>

      {notFound ? (
        <Banner
          variant="danger"
          message={t("operators.list.notFound")}
          requestId={notFound.requestId}
        />
      ) : null}

      {isLoading ? <ListState state="loading" label={t("operators.list.loadingNoun")} /> : null}

      {!isLoading && !notFound && rows.length === 0 ? (
        <ListState
          state="empty"
          emptyMessage={t("operators.list.empty")}
          action={
            <button type="button" className="btn-primary" onClick={() => setInviting(true)}>
              {t("operators.list.invite")}
            </button>
          }
        />
      ) : null}

      {!isLoading && !notFound && rows.length > 0 ? (
        <table className="data-table">
          <caption className="data-table__caption">{t("operators.list.caption")}</caption>
          <thead>
            <tr>
              <th scope="col">{t("operators.list.col.member")}</th>
              <th scope="col">{t("operators.list.col.role")}</th>
              <th scope="col">{t("operators.list.col.storeAccess")}</th>
              <th scope="col">{t("operators.list.col.state")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.membershipId}
                className="data-table__row"
                tabIndex={0}
                onClick={() => setEditing(row)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setEditing(row);
                  }
                }}
              >
                <td>
                  <span className="member-cell">
                    <Avatar name={row.displayName ?? row.email} size={32} />
                    <span className="member-identity">
                      <span className="member-identity__name">{row.displayName ?? row.email}</span>
                      {row.displayName ? (
                        <span className="member-identity__email">
                          <bdi dir="ltr">{row.email}</bdi>
                        </span>
                      ) : null}
                    </span>
                  </span>
                </td>
                <td>
                  <span className="badge">{t(roleKey(row.roleCode))}</span>
                </td>
                <td>{storeAccessLabel(row, t)}</td>
                <td>
                  {row.revoked ? (
                    <span className="badge badge--suspended">{t("operators.state.revoked")}</span>
                  ) : (
                    <span className="badge badge--active">{t("operators.state.active")}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}

      {inviting ? (
        <InviteMember
          activeTenant={activeTenant}
          onClose={() => setInviting(false)}
          onInvited={() => {
            setInviting(false);
            refetch();
          }}
        />
      ) : null}

      {editing ? (
        <EditMember
          activeTenantId={activeTenant.id}
          member={editing}
          onClose={() => setEditing(null)}
          onChanged={() => {
            setEditing(null);
            refetch();
          }}
        />
      ) : null}
    </div>
  );
}
