/**
 * Pure helpers for schema-driven field rendering.
 * No JSX — importable from field renderers and the form alike.
 */

import type { components } from "@multiversal-ventures/lux-core";

export type UserInputField = components["schemas"]["UserInputFieldResponse"];

// ─── Value resolution ─────────────────────────────────────────────────────────

/**
 * Effective field value: prior context wins, then the YAML-declared
 * default, then null. Keeps each renderer thin — every field type
 * applies the same precedence so the UI mirrors what qualify will
 * actually evaluate.
 */
export function resolveEffectiveValue(field: UserInputField, value: unknown): unknown {
  if (value !== null && value !== undefined && value !== "") return value;
  return field.default ?? null;
}

// ─── Unit suffix ──────────────────────────────────────────────────────────────

/**
 * Human-friendly suffix for the YAML ``unit:`` declaration.
 *
 * Spec authors write canonical slugs (``percent``, ``months``, ``usd_per_month``)
 * and this maps them to short UI strings. Unknown slugs pass through verbatim
 * so a future unit (e.g. ``basis_points``) renders something without a code
 * change.
 */
export function unitSuffix(unit: string | null | undefined): string | null {
  if (!unit) return null;
  switch (unit.toLowerCase()) {
    case "percent":
    case "percentage":
      return "%";
    case "currency":
    case "usd":
      return "USD";
    case "usd_per_month":
      return "$ / mo";
    case "months":
      return "months";
    case "years":
      return "years";
    case "days":
      return "days";
    default:
      return unit;
  }
}

// ─── Currency format config ───────────────────────────────────────────────────

export interface CurrencyFormatConfig {
  /** Thousands grouping separator (e.g. `","` for USD, `"."` for EUR). */
  thousandSep: string;
  /** Decimal separator (e.g. `"."` for USD, `","` for EUR). */
  decimalSep: string;
  /** Symbol prefix shown inside the input (e.g. `"$"`, `"£"`). */
  prefix: string;
}

/**
 * Per-currency display config for the most common currencies in lending.
 * Keys are ISO 4217 codes (uppercase). Unlisted currencies fall back to USD.
 */
export const CURRENCY_FORMATS: Record<string, CurrencyFormatConfig> = {
  USD: { thousandSep: ",", decimalSep: ".", prefix: "$"   },
  CAD: { thousandSep: ",", decimalSep: ".", prefix: "CA$" },
  GBP: { thousandSep: ",", decimalSep: ".", prefix: "£"   },
  EUR: { thousandSep: ".", decimalSep: ",", prefix: "€"   },
  AUD: { thousandSep: ",", decimalSep: ".", prefix: "A$"  },
  NZD: { thousandSep: ",", decimalSep: ".", prefix: "NZ$" },
};

export const DEFAULT_CURRENCY_FORMAT: CurrencyFormatConfig = CURRENCY_FORMATS.USD;

export function getCurrencyFormat(unit: string | null | undefined): CurrencyFormatConfig {
  if (!unit) return DEFAULT_CURRENCY_FORMAT;
  return CURRENCY_FORMATS[unit.toUpperCase()] ?? DEFAULT_CURRENCY_FORMAT;
}

/**
 * Format a number as a localized currency string for display.
 * Uses ``Intl.NumberFormat`` — no third-party dependency.
 */
export function formatCurrencyDisplay(value: number, fmt: CurrencyFormatConfig): string {
  // Build string manually to respect per-currency separators.
  const [intPart, fracPart] = Math.abs(value).toFixed(2).split(".");
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, fmt.thousandSep);
  return `${fmt.prefix}${grouped}${fmt.decimalSep}${fracPart}`;
}

/**
 * Parse a user-typed currency string back to a float.
 * Strips the currency prefix, thousands separators, and normalises the
 * decimal separator before calling ``parseFloat``.
 */
export function parseCurrencyInput(raw: string, fmt: CurrencyFormatConfig): number | null {
  const stripped = raw
    .replace(fmt.prefix, "")
    .split(fmt.thousandSep).join("")
    .replace(fmt.decimalSep, ".")
    .trim();
  if (stripped === "" || stripped === "-") return null;
  const n = parseFloat(stripped);
  return isFinite(n) ? n : null;
}
