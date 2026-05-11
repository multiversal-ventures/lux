import { useMemo } from "react";
import type { components } from "@fenero/lux-core";

type SpecSummaryResultResponse = components["schemas"]["SpecSummaryResultResponse"];

/** Anything Veritas returns that carries an aggregated headline value. */
export interface HasSummaryResult {
  summary_result?: SpecSummaryResultResponse | null;
}

export interface FormatScenarioSummaryOptions {
  /** Intl locale (default `"en-US"`). */
  locale?: string;
  /** ISO currency code for monetary units (default `"USD"`). */
  currency?: string;
  /** Text returned when no summary value exists. Defaults to `null`. */
  placeholder?: string | null;
  /**
   * Decimal places for currency. Defaults to `0` (whole dollars) to match
   * sidebar/preview cards; pass `2` for invoice-style precision.
   */
  fractionDigits?: number;
}

/**
 * Format a `SpecSummaryResultResponse.value` using its `unit` hint.
 *
 * Recognized units:
 * - `usd_per_month` → `$5,000/mo`
 * - `usd`           → `$5,000`
 * - `ratio`         → `0.42`
 * - anything else   → `String(value)` (so new domains keep working)
 *
 * Returns the placeholder (default `null`) when the summary or value is missing.
 */
export function formatScenarioSummary(
  summary: SpecSummaryResultResponse | null | undefined,
  options: FormatScenarioSummaryOptions = {},
): string | null {
  const placeholder = options.placeholder ?? null;
  if (!summary || summary.value == null) return placeholder;

  const locale = options.locale ?? "en-US";
  const currency = options.currency ?? "USD";
  const fractionDigits = options.fractionDigits ?? 0;
  const unit = summary.unit ?? null;

  if (unit === "usd_per_month" || unit === "usd") {
    const formatted = new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    }).format(summary.value);
    return unit === "usd_per_month" ? `${formatted}/mo` : formatted;
  }

  if (unit === "ratio") {
    return summary.value.toFixed(2);
  }

  return String(summary.value);
}

export interface UseScenarioSummaryResult {
  /** Raw response straight from Veritas (or `null`). */
  raw: SpecSummaryResultResponse | null;
  /** Numeric value, or `null` when missing. */
  value: number | null;
  /** Aggregation rule used (e.g. `"max_value"`). */
  strategy: SpecSummaryResultResponse["strategy"] | null;
  /** Policy domain hint (e.g. `"income"`, `"asset_verification"`). */
  domain: string | null;
  /** Unit hint (e.g. `"usd_per_month"`). */
  unit: string | null;
  /** Display string per `formatScenarioSummary`. */
  formatted: string | null;
  /** Per-bucket totals that produced `value`. Empty when none. */
  groups: Record<string, number>;
}

/**
 * Read the aggregated summary off any object that carries `summary_result`
 * (scenarios, refinements, future entities). Policy-neutral — the hook never
 * looks at "income" or any other domain by name.
 */
export function useScenarioSummary(
  source: HasSummaryResult | null | undefined,
  options: FormatScenarioSummaryOptions = {},
): UseScenarioSummaryResult {
  const summary = source?.summary_result ?? null;
  const { locale, currency, placeholder, fractionDigits } = options;
  return useMemo<UseScenarioSummaryResult>(() => ({
    raw: summary,
    value: summary?.value ?? null,
    strategy: summary?.strategy ?? null,
    domain: summary?.domain ?? null,
    unit: summary?.unit ?? null,
    formatted: formatScenarioSummary(summary, {
      locale,
      currency,
      placeholder,
      fractionDigits,
    }),
    groups: summary?.groups ?? {},
  }), [summary, locale, currency, placeholder, fractionDigits]);
}
