/**
 * Overview landing (the shell index route). Extracted from AppShell's inline
 * default so it can be the `/` index element alongside the RF-2 nested routes
 * (T009). Reads scope from RF-1's provider; renders no authorization opinion.
 */
import { useActiveContextValue } from "@/context/ActiveContextProvider";
import { useT } from "@/i18n";

export function Overview(): React.JSX.Element {
  const t = useT();
  const { context } = useActiveContextValue();
  const tenant = <bdi>{context?.active_tenant?.name}</bdi>;
  return (
    <>
      <h1 className="content__title">{t("shell.overview.title")}</h1>
      <p className="content__sub">
        {context?.active_store
          ? t.rich("shell.overview.scope", {
              tenant,
              store: <bdi>{context.active_store.name}</bdi>,
            })
          : tenant}
      </p>
    </>
  );
}
