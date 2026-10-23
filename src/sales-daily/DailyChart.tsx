/**
 * RT-823 (VIZ-5, RT-751 slice 6) the first chart: daily received-sales bars,
 * hand-built SVG on the ratified `--color-viz-*` tokens (RT-822), no library
 * (RT-751 D1). It is a summary of the first table, never a replacement: every
 * bar is a link to its table row, every label is the server figure, and
 * nothing is only in a tooltip. Geometry lives in `chartModel.ts`.
 *
 * - One metric, one currency; a selector when there is more than one.
 * - A partial day is hatched and says "So far"; a date the read lacks says
 *   "Unknown" and draws no bar; a day not begun says "Not begun".
 * - The time axis mirrors in RTL by position (see `chartModel`).
 * - No motion, no `<style>`, no inline style (the CSP has no `style-src`).
 */
import { DataTableScroll } from "@/components/DataTableScroll";
import { DIRECTION, type Locale, type MessageKey, intlTag, useLocale, useT } from "@/i18n";
import { useId, useState } from "react";
import {
  BAR_WIDTH,
  type ChartBar,
  type ChartGeometry,
  type Direction,
  chartModel,
  currenciesOf,
} from "./chartModel";
import type { ReportModel } from "./dailyLogic";
import { dayRowId } from "./dayRowId";
import "./daily-chart.css";

function dayFormat(locale: Locale, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat(intlTag(locale), { timeZone: "UTC", ...options });
}

function atNoon(date: string): Date {
  return new Date(`${date}T12:00:00Z`);
}

function useFormats() {
  const locale = useLocale();
  return {
    short: (date: string) =>
      dayFormat(locale, { day: "numeric", month: "short" }).format(atNoon(date)),
    full: (date: string) =>
      dayFormat(locale, { day: "numeric", month: "short", year: "numeric" }).format(atNoon(date)),
    tick: (value: number) =>
      new Intl.NumberFormat(intlTag(locale), {
        notation: "compact",
        maximumFractionDigits: 1,
      }).format(value),
  };
}

type Mark = "so-far" | "unknown" | "not-begun";

const MARK_KEY: Record<Mark, MessageKey> = {
  "so-far": "salesDaily.chart.soFar",
  unknown: "salesDaily.chart.unknown",
  "not-begun": "salesDaily.chart.notBegun",
};

function markOf(bar: ChartBar): Mark | null {
  if (bar.kind !== "value") return bar.kind;
  return bar.state === "so-far" ? "so-far" : null;
}

/** Moves focus to the table row of the bar (a hash link does not focus a `<tr>`). */
function goToRow(event: React.MouseEvent, date: string): void {
  const row = document.getElementById(dayRowId(date));
  if (!row) return;
  event.preventDefault();
  row.focus();
}

function labelKeyOf(bar: ChartBar): MessageKey {
  if (bar.kind === "unknown") return "salesDaily.chart.barUnknown";
  if (bar.kind === "not-begun") return "salesDaily.chart.barNotBegun";
  return bar.state === "so-far" ? "salesDaily.chart.barSoFar" : "salesDaily.chart.bar";
}

function Bar({
  bar,
  geometry,
  patternId,
}: Readonly<{ bar: ChartBar; geometry: ChartGeometry; patternId: string }>): React.JSX.Element {
  const t = useT();
  const format = useFormats();
  const mark = markOf(bar);
  const partial = bar.state === "so-far";
  const label = t(labelKeyOf(bar), {
    date: format.full(bar.date),
    value: bar.label ?? "",
    currency: geometry.currency,
  });
  return (
    <a
      href={`#${dayRowId(bar.date)}`}
      className="daily-chart__link"
      aria-label={label}
      onClick={(event) => goToRow(event, bar.date)}
    >
      <rect
        className="daily-chart__hit"
        x={bar.cx - geometry.slot / 2}
        y={0}
        width={geometry.slot}
        height={geometry.height}
      />
      {bar.kind === "value" ? (
        <>
          <rect
            className={`daily-chart__bar${partial ? " daily-chart__bar--so-far" : ""}`}
            x={bar.x}
            y={bar.y}
            width={BAR_WIDTH}
            height={bar.height}
            fill={partial ? `url(#${patternId})` : undefined}
          />
          <text className="daily-chart__value" x={bar.cx} y={bar.y - 6} textAnchor="middle">
            {bar.label}
          </text>
        </>
      ) : null}
      <text className="daily-chart__day" x={bar.cx} y={geometry.baselineY + 18} textAnchor="middle">
        {format.short(bar.date)}
      </text>
      {mark ? (
        <text
          className={`daily-chart__mark${bar.kind === "value" ? "" : " daily-chart__mark--missing"}`}
          x={bar.cx}
          y={bar.kind === "value" ? geometry.baselineY + 34 : geometry.baselineY - 8}
          textAnchor="middle"
        >
          {t(MARK_KEY[mark])}
        </text>
      ) : null}
    </a>
  );
}

function Axis({
  geometry,
  direction,
}: Readonly<{ geometry: ChartGeometry; direction: Direction }>): React.JSX.Element {
  const format = useFormats();
  const rtl = direction === "rtl";
  const far = rtl ? 12 : geometry.width - 12;
  return (
    // biome-ignore lint/a11y/noAriaHiddenOnFocusable: a plain SVG group of axis text; the bars carry the labels
    <g aria-hidden="true">
      {geometry.ticks.map((tick) => (
        <g key={tick.value}>
          <line
            className={`daily-chart__grid${tick.value === 0 ? " daily-chart__grid--base" : ""}`}
            x1={geometry.axisX}
            x2={far}
            y1={tick.y}
            y2={tick.y}
          />
          <text
            className="daily-chart__tick"
            x={rtl ? geometry.axisX + 8 : geometry.axisX - 8}
            y={tick.y + 4}
            textAnchor={rtl ? "start" : "end"}
          >
            {format.tick(tick.value)}
          </text>
        </g>
      ))}
    </g>
  );
}

function CurrencySelect({
  currencies,
  value,
  onChange,
}: Readonly<{ currencies: readonly string[]; value: string; onChange: (code: string) => void }>) {
  const t = useT();
  const id = useId();
  if (currencies.length < 2) return null;
  return (
    <div className="daily-chart__currency">
      <label htmlFor={id}>{t("salesDaily.chart.currency")}</label>
      <select id={id} value={value} onChange={(event) => onChange(event.target.value)}>
        {currencies.map((code) => (
          <option key={code} value={code}>
            {code}
          </option>
        ))}
      </select>
    </div>
  );
}

function Empty({ model }: Readonly<{ model: ReportModel }>): React.JSX.Element {
  const t = useT();
  const unknownEverywhere = model.rows.every((row) => row.kpis === null);
  return (
    <p className="daily-chart__empty" data-testid="sales-daily-chart-empty">
      {t(unknownEverywhere ? "salesDaily.chart.emptyUnknown" : "salesDaily.chart.empty")}
    </p>
  );
}

export function DailyChart({ model }: Readonly<{ model: ReportModel }>): React.JSX.Element {
  const t = useT();
  const direction = DIRECTION[useLocale()];
  const captionId = `daily-chart-caption-${useId()}`;
  const patternId = `daily-chart-hatch-${useId().replaceAll(":", "")}`;
  const currencies = currenciesOf(model);
  const [chosen, setChosen] = useState<string | null>(null);
  const currency = chosen && currencies.includes(chosen) ? chosen : currencies[0];
  if (currency === undefined) return <Empty model={model} />;
  const geometry = chartModel(model, currency, direction);
  return (
    <figure className="daily-chart">
      <figcaption className="daily-chart__caption">
        <span id={captionId} className="daily-chart__title">
          {t("salesDaily.chart.title")}
        </span>
        <span className="daily-chart__summary">{t("salesDaily.chart.summary", { currency })}</span>
        <span className="daily-chart__legend">{t("salesDaily.chart.legend")}</span>
      </figcaption>
      <CurrencySelect currencies={currencies} value={currency} onChange={setChosen} />
      <DataTableScroll captionId={captionId}>
        <svg
          className="daily-chart__svg"
          // biome-ignore lint/a11y/useSemanticElements: a group, not an image (role img would hide the bar links); fieldset does not apply to SVG
          role="group"
          aria-labelledby={captionId}
          viewBox={`0 0 ${geometry.width} ${geometry.height}`}
          width={geometry.width}
          height={geometry.height}
          focusable="false"
        >
          <defs>
            <pattern
              id={patternId}
              patternUnits="userSpaceOnUse"
              width="6"
              height="6"
              patternTransform="rotate(45)"
            >
              <rect className="daily-chart__hatch-ground" width="6" height="6" />
              <line
                className="daily-chart__hatch-line"
                x1="0"
                y1="0"
                x2="0"
                y2="6"
                strokeWidth="3"
              />
            </pattern>
          </defs>
          <Axis geometry={geometry} direction={direction} />
          {geometry.bars.map((bar) => (
            <Bar key={bar.date} bar={bar} geometry={geometry} patternId={patternId} />
          ))}
        </svg>
      </DataTableScroll>
    </figure>
  );
}
