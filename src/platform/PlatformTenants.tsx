/**
 * `/platform/tenants`, the platform landing (RT-780, OQ-3) and the tenant
 * directory (RT-782, RT-777 S3, screen 30). One `listTenants` read, searched
 * client-side by name and slug (the contract has no filter).
 *
 * `TenantSummary` carries id, slug and name only, so the directory shows no
 * lifecycle status and no store counts (OQ-8): it says once, truthfully, that a
 * suspended organization opens read-only, and the server applies that at open.
 *
 * Each row offers the one action that can succeed (UX Addendum A3): a tenant
 * the caller is a member of gets the normal tenant switch, any other a support
 * session (`openSupportSession` would refuse a member with 409 `already_member`).
 */
import { Banner } from "@/components/Banner";
import { DataTableScroll, useCaptionId } from "@/components/DataTableScroll";
import { GatedButton } from "@/components/GatedButton";
import { ListState } from "@/components/ListState";
import { useActiveContextValue } from "@/context/ActiveContextProvider";
import { type T, useT } from "@/i18n";
import { useState } from "react";
import { StartSessionDrawer, type StartTenant } from "./start/StartSessionDrawer";
import { type DirectoryRow, directoryRows, filterTenants } from "./tenants/directoryLogic";
import { type DirectoryError, useTenantDirectory } from "./tenants/useTenantDirectory";
import { useTenantSwitch } from "./tenants/useTenantSwitch";
import "./platform.css";

function errorCopy(t: T, error: DirectoryError): { message: string; requestId?: string } {
  if (error.kind === "rate-limited") return { message: t("platform.tenants.error.rateLimited") };
  return { message: t("platform.tenants.error.failed"), requestId: error.requestId };
}

function RowAction({
  row,
  onStart,
  onSwitch,
}: Readonly<{
  row: DirectoryRow;
  onStart: (row: DirectoryRow) => void;
  onSwitch: (tenantId: string) => void;
}>) {
  const t = useT();
  if (row.action === "switch") {
    return (
      <GatedButton
        className="btn-secondary"
        aria-label={t("platform.tenants.action.switchFor", { name: row.name })}
        onClick={() => onSwitch(row.id)}
      >
        {t("platform.tenants.action.switch")}
      </GatedButton>
    );
  }
  return (
    <button
      type="button"
      className="btn-secondary"
      aria-label={t("platform.tenants.action.startFor", { name: row.name })}
      aria-haspopup="dialog"
      onClick={() => onStart(row)}
    >
      {t("platform.tenants.action.start")}
    </button>
  );
}

function DirectoryTable({
  rows,
  onStart,
  onSwitch,
}: Readonly<{
  rows: DirectoryRow[];
  onStart: (row: DirectoryRow) => void;
  onSwitch: (tenantId: string) => void;
}>) {
  const t = useT();
  const captionId = useCaptionId();
  return (
    <DataTableScroll captionId={captionId}>
      <table className="data-table">
        <caption id={captionId} className="data-table__caption">
          {t("platform.tenants.caption")}
        </caption>
        <thead>
          <tr>
            <th scope="col">{t("platform.tenants.col.tenant")}</th>
            <th scope="col">{t("platform.tenants.col.action")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="data-table__row data-table__row--static">
              <td>
                <span className="platform-directory__name">
                  <bdi>{row.name}</bdi>
                </span>
                {row.slug ? (
                  <bdi dir="ltr" className="platform-directory__slug">
                    {row.slug}
                  </bdi>
                ) : null}
                {row.action === "switch" ? (
                  <span className="platform-directory__member">{t("platform.tenants.member")}</span>
                ) : null}
              </td>
              <td>
                <RowAction row={row} onStart={onStart} onSwitch={onSwitch} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </DataTableScroll>
  );
}

function DirectoryBody({
  query,
  onStart,
  onSwitch,
  directory,
}: Readonly<{
  query: string;
  onStart: (row: DirectoryRow) => void;
  onSwitch: (tenantId: string) => void;
  directory: ReturnType<typeof useTenantDirectory>;
}>) {
  const t = useT();
  const { context } = useActiveContextValue();
  const { tenants, isLoading, error, refetch } = directory;

  if (isLoading) return <ListState state="loading" label={t("platform.tenants.title")} />;
  if (error) {
    const copy = errorCopy(t, error);
    return (
      <Banner
        variant={error.kind === "rate-limited" ? "warning" : "danger"}
        message={copy.message}
        requestId={copy.requestId}
        action={
          <GatedButton className="btn-secondary" onClick={refetch}>
            {t("platform.tenants.retry")}
          </GatedButton>
        }
      />
    );
  }
  const all = directoryRows(tenants ?? [], context?.memberships ?? []);
  if (all.length === 0) {
    return (
      <ListState
        state="empty"
        emptyMessage={t("platform.tenants.emptyTitle")}
        emptyHint={t("platform.tenants.emptyBody")}
      />
    );
  }
  const shown = directoryRows(filterTenants(tenants ?? [], query), context?.memberships ?? []);
  return (
    <>
      {shown.length === 0 ? (
        <ListState
          state="empty"
          emptyMessage={t("platform.tenants.noMatch", { query: query.trim() })}
        />
      ) : (
        <DirectoryTable rows={shown} onStart={onStart} onSwitch={onSwitch} />
      )}
      <p className="platform-directory__count" aria-live="polite">
        {t("platform.tenants.count", { shown: shown.length, total: all.length })}
      </p>
    </>
  );
}

export function PlatformTenants(): React.JSX.Element {
  const t = useT();
  const { context } = useActiveContextValue();
  const directory = useTenantDirectory();
  const [query, setQuery] = useState("");
  const [starting, setStarting] = useState<StartTenant | null>(null);
  const {
    toTenant,
    failure: switchFailure,
    clearFailure,
  } = useTenantSwitch(() => setStarting(null));

  return (
    <section aria-labelledby="platform-tenants-title" className="platform-directory">
      <h1 id="platform-tenants-title" className="content__title">
        {t("platform.tenants.title")}
      </h1>
      <p className="content__sub">{t("platform.tenants.sub")}</p>
      <p className="platform-directory__note">{t("platform.tenants.suspendedNote")}</p>

      <div className="field platform-directory__search">
        <label htmlFor="platform-tenant-search">{t("platform.tenants.search.label")}</label>
        <input
          id="platform-tenant-search"
          className="input"
          type="search"
          autoComplete="off"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {switchFailure && !starting ? <Banner variant="danger" message={t(switchFailure)} /> : null}

      <DirectoryBody
        query={query}
        directory={directory}
        onStart={(row) => {
          clearFailure();
          setStarting({ id: row.id, name: row.name, slug: row.slug });
        }}
        onSwitch={(id) => void toTenant(id)}
      />

      {starting ? (
        <StartSessionDrawer
          key={starting.id}
          tenant={starting}
          replacesSession={Boolean(context?.support_session)}
          onClose={() => setStarting(null)}
          onNotAvailable={() => {
            setStarting(null);
            directory.refetch();
          }}
          onSwitch={(id) => void toTenant(id)}
          switchFailure={switchFailure}
        />
      ) : null}
    </section>
  );
}
