/**
 * RT-824 hands a CSV to the browser as a file: a `Blob` behind an object URL
 * and a click on a temporary `<a download>`. No request is made and nothing
 * leaves the page, so it needs nothing from the CSP's `connect-src 'self'`.
 */
export const CSV_TYPE = "text/csv;charset=utf-8";

/** How long the object URL lives: long enough for the browser to start the save. */
const REVOKE_AFTER_MS = 1000;

export function downloadCsv(filename: string, csv: string): void {
  const url = URL.createObjectURL(new Blob([csv], { type: CSV_TYPE }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.rel = "noopener";
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), REVOKE_AFTER_MS);
}

/** `sales-daily_2026-10-16_2026-10-23.csv`: the range, not the store, so no name is leaked into a path. */
export function csvFilename(from: string, to: string): string {
  return `sales-daily_${from}_${to}.csv`;
}
