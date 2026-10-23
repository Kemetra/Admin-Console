/**
 * RT-823 (VIZ-5, RT-751 slice 6) geometry of the daily received-sales bars,
 * built from the report model (never from the DOM). Pure: no React, no fetch.
 *
 * Rules (RT-751 AC 4, D9; UX-13):
 *  - one currency at a time; currencies are never added together;
 *  - a bar's label is the server's decimal string, shown as given; a number
 *    exists only to size the bar;
 *  - a date missing from the read is `unknown`: no bar, never a zero;
 *  - a present day with no sale in the currency is a real zero (the contract
 *    zero-fills `days[]`);
 *  - a day that has not begun draws no bar rather than a misleading zero;
 *  - the baseline is zero;
 *  - the time axis mirrors in RTL by position, never by flipping the SVG
 *    (that would mirror the text).
 */
import { formatMoney } from "@/i18n";
import type { DayState, ReportModel } from "./dailyLogic";

export type Direction = "ltr" | "rtl";

/** Cell per day, bar inside it, and the margins of the plot (SVG user units). */
export const SLOT = 52;
export const BAR_WIDTH = 30;
export const PLOT_HEIGHT = 160;
/** Room above the plot for the value labels. */
export const TOP = 28;
/** Room below the baseline for the date labels. */
export const BOTTOM = 52;
/** Room on the inline-start side for the axis labels. */
export const AXIS_WIDTH = 64;
export const END_PAD = 12;
const TICK_INTERVALS = 4;

export type BarKind = "value" | "unknown" | "not-begun";

export interface ChartBar {
  date: string;
  state: DayState;
  kind: BarKind;
  /** The server's figure without the currency; null when there is none to show. */
  label: string | null;
  /** Left edge, from the physical left of the SVG. */
  x: number;
  y: number;
  height: number;
  /** Centre of the cell, where the labels sit. */
  cx: number;
}

export interface ChartTick {
  value: number;
  y: number;
}

export interface ChartGeometry {
  currency: string;
  width: number;
  height: number;
  plotHeight: number;
  baselineY: number;
  /** Width of one day's cell. */
  slot: number;
  /** Top of the scale. */
  max: number;
  ticks: ChartTick[];
  bars: ChartBar[];
  /** Where the axis labels end, on the inline-start side. */
  axisX: number;
}

/** Currencies seen in received sales, first seen first, never summed. */
export function currenciesOf(model: ReportModel): string[] {
  const seen = new Set<string>();
  const sources = [...model.rows.map((r) => r.kpis), model.totals];
  for (const kpis of sources) {
    for (const c of kpis?.receivedSales.byCurrency ?? []) seen.add(c.currencyCode);
  }
  return [...seen];
}

/** The smallest 1, 2 or 5 times a power of ten that holds `value`; 1 for none. */
export function niceMax(value: number): number {
  if (Number.isNaN(value) || value <= 0) return 1;
  const exponent = 10 ** Math.floor(Math.log10(value));
  const fraction = value / exponent;
  const step = [1, 2, 5, 10].find((s) => fraction <= s * (1 + 1e-9)) ?? 10;
  return step * exponent;
}

/** Width of one value label character at the chart's label size, and its padding. */
const CHAR_WIDTH = 7.4;
const LABEL_PAD = 10;

/** A cell wide enough for the longest value label, so labels never overlap. */
export function slotFor(labels: readonly (string | null)[]): number {
  const longest = Math.max(0, ...labels.map((l) => l?.length ?? 0));
  return Math.max(SLOT, Math.ceil(longest * CHAR_WIDTH + LABEL_PAD));
}

function widthOf(count: number, slot: number): number {
  return AXIS_WIDTH + count * slot + END_PAD;
}

/** Left edge of bar `index` of `count`: left to right in LTR, right to left in RTL. */
export function barPosition(
  index: number,
  count: number,
  direction: Direction,
  slot: number = SLOT,
): number {
  const inset = (slot - BAR_WIDTH) / 2;
  if (direction === "rtl") return widthOf(count, slot) - AXIS_WIDTH - (index + 1) * slot + inset;
  return AXIS_WIDTH + index * slot + inset;
}

interface Reading {
  kind: BarKind;
  total: string | null;
  amount: number;
}

function readingOf(row: ReportModel["rows"][number], currency: string): Reading {
  if (row.kpis === null) return { kind: "unknown", total: null, amount: 0 };
  if (row.state === "not-begun") return { kind: "not-begun", total: null, amount: 0 };
  const total = row.kpis.receivedSales.byCurrency.find((c) => c.currencyCode === currency)?.total;
  if (total === undefined) return { kind: "value", total: "0", amount: 0 };
  const amount = Number.parseFloat(total);
  if (!Number.isFinite(amount)) return { kind: "unknown", total: null, amount: 0 };
  return { kind: "value", total, amount };
}

/** The bars of one currency over the report's days. */
export function chartModel(
  model: ReportModel,
  currency: string,
  direction: Direction,
): ChartGeometry {
  const readings = model.rows.map((row) => readingOf(row, currency));
  const max = niceMax(Math.max(0, ...readings.map((r) => r.amount)));
  const baselineY = TOP + PLOT_HEIGHT;
  const count = model.rows.length;
  const labels = readings.map((r) => (r.total === null ? null : formatMoney(r.total, "").trim()));
  const slot = slotFor(labels);
  const bars = model.rows.map((row, index): ChartBar => {
    const { kind, amount } = readings[index];
    const height = (amount / max) * PLOT_HEIGHT;
    const x = barPosition(index, count, direction, slot);
    return {
      date: row.date,
      state: row.state,
      kind,
      label: labels[index],
      x,
      y: baselineY - height,
      height,
      cx: x + BAR_WIDTH / 2,
    };
  });
  const ticks = Array.from({ length: TICK_INTERVALS + 1 }, (_, i) => {
    const value = (max / TICK_INTERVALS) * i;
    return { value, y: baselineY - (value / max) * PLOT_HEIGHT };
  });
  return {
    currency,
    width: widthOf(count, slot),
    height: TOP + PLOT_HEIGHT + BOTTOM,
    plotHeight: PLOT_HEIGHT,
    baselineY,
    slot,
    max,
    ticks,
    bars,
    axisX: direction === "rtl" ? widthOf(count, slot) - AXIS_WIDTH : AXIS_WIDTH,
  };
}
