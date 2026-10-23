/**
 * RT-824 (VIZ-6) «تصدير CSV»: downloads exactly the rows of the report below,
 * with its context header (see `csvExport.ts`). Client-side: no request.
 */
import { useLocale, useT } from "@/i18n";
import { buildCsv } from "./csvExport";
import type { ReportModel } from "./dailyLogic";
import { csvFilename, downloadCsv } from "./downloadCsv";

export function ExportButton({
  model,
  storeName,
}: Readonly<{ model: ReportModel; storeName: string | null }>): React.JSX.Element {
  const t = useT();
  const locale = useLocale();
  const from = model.rows[0]?.date ?? "";
  const to = model.rows.at(-1)?.date ?? "";
  return (
    <div className="daily-report__export">
      <button
        type="button"
        className="btn-secondary"
        onClick={() => downloadCsv(csvFilename(from, to), buildCsv(model, { locale, storeName }))}
      >
        {t("salesDaily.export.button")}
      </button>
      <span className="daily-report__hint">{t("salesDaily.export.hint")}</span>
    </div>
  );
}
