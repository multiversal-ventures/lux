/**
 * Built-in field renderers for ``<DynamicUserInputsForm>``.
 *
 * Each renderer is a small focused React component. They are exported so
 * hosts can compose or wrap them (e.g. add an icon next to ``CurrencyField``).
 * ``pickDefaultRenderer`` selects the right one from the field's YAML type.
 */

import React from "react";
import type { ReactNode } from "react";
import {
  resolveEffectiveValue,
  unitSuffix,
  getCurrencyFormat,
  formatCurrencyDisplay,
  parseCurrencyInput,
} from "./fieldUtils.js";
import type { UserInputField } from "./fieldUtils.js";
import type { DynamicUserInputFieldRenderer, DynamicUserInputFieldRendererProps } from "./DynamicUserInputsForm.js";

type UserInputOption = NonNullable<UserInputField["options"]>[number];

// ─── SelectField ─────────────────────────────────────────────────────────────

export function SelectField({
  field, value, disabled, classNames, onChange,
}: DynamicUserInputFieldRendererProps): ReactNode {
  const options: readonly UserInputOption[] = field.options ?? [];
  const currentValue = value ?? field.default ?? "";
  return (
    <select
      value={currentValue == null ? "" : String(currentValue)}
      disabled={disabled}
      onChange={(e) => {
        const raw = e.target.value;
        const opt = options.find((o) => String(o.value) === raw);
        onChange(opt ? opt.value : (raw === "" ? null : raw));
      }}
      className={classNames?.select}
      aria-label={field.label}
    >
      <option value="">{`(auto-detect)`}</option>
      {options.map((o) => (
        <option key={String(o.value)} value={String(o.value)}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

// ─── YearField ───────────────────────────────────────────────────────────────

export function YearField({
  field, value, disabled, classNames, yearOptions, onChange,
}: DynamicUserInputFieldRendererProps): ReactNode {
  const years = yearOptions ?? [];
  return (
    <select
      value={value == null ? "" : String(value)}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value || null)}
      className={classNames?.select}
      aria-label={field.label}
    >
      <option value="">Auto-detect</option>
      {years.map((y) => (
        <option key={y} value={y}>{y}</option>
      ))}
    </select>
  );
}

// ─── CurrencyField ───────────────────────────────────────────────────────────

/**
 * Currency input with thousands-separator formatting and multi-currency support.
 *
 * - Displays formatted value on blur (e.g. ``$500,000.00``).
 * - Shows raw number on focus so editing is clean.
 * - Derives symbol and separators from ``field.unit`` (ISO 4217, defaults to USD).
 * - No third-party dependency — uses ``Intl``-compatible pure helpers.
 */
export function CurrencyField({
  field, value, disabled, classNames, onChange,
}: DynamicUserInputFieldRendererProps): ReactNode {
  const effectiveRaw = resolveEffectiveValue(field, value);
  const numericValue = (() => {
    if (effectiveRaw == null || effectiveRaw === "") return null;
    if (typeof effectiveRaw === "number") {
      return Number.isFinite(effectiveRaw) ? effectiveRaw : null;
    }
    const n = Number(effectiveRaw);
    return Number.isFinite(n) ? n : null;
  })();
  const fmt = getCurrencyFormat(field.unit);

  // rawText: what the user is actively typing (no formatting).
  // null = use formatted display value.
  const [rawText, setRawText] = React.useState<string | null>(null);

  const display = rawText !== null
    ? rawText
    : numericValue != null
      ? formatCurrencyDisplay(numericValue, fmt)
      : "";

  return (
    <input
      type="text"
      inputMode="decimal"
      value={display}
      placeholder={`${fmt.prefix}0`}
      disabled={disabled}
      className={classNames?.input}
      aria-label={field.label}
      onChange={(e) => {
        setRawText(e.target.value);
        const parsed = parseCurrencyInput(e.target.value, fmt);
        onChange(parsed);
      }}
      onFocus={(e) => {
        // Show plain number while editing; select all for easy replacement.
        if (numericValue != null) setRawText(String(numericValue));
        e.target.select();
      }}
      onBlur={() => {
        // On blur: clear rawText so the formatted display value shows.
        setRawText(null);
      }}
    />
  );
}

// ─── NumericField ────────────────────────────────────────────────────────────

/**
 * Numeric input for ``percent`` / ``percentage`` / ``integer`` / ``number`` types.
 *
 * Percent fields:
 * - Store fractional value (0.065 = 6.5 %).
 * - Display as percentage (6.5) so operators see a human-readable number.
 * - YAML ``min`` / ``max`` / ``step`` are in fraction units and are scaled ×100
 *   for the HTML ``min``/``max``/``step`` attributes.
 */
export function NumericField({
  field, value, disabled, classNames, onChange,
}: DynamicUserInputFieldRendererProps): ReactNode {
  const effective = resolveEffectiveValue(field, value);
  const isPercent = field.type === "percent" || field.type === "percentage";
  const isInt = field.type === "integer";

  // Convert stored fraction → display value.
  const display =
    effective == null
      ? ""
      : isPercent && typeof effective === "number"
        ? String(Math.round(effective * 10000) / 100)
        : String(effective);

  // Scale YAML fraction bounds → display-unit bounds for HTML attributes.
  const htmlMin  = field.minimum != null ? (isPercent ? field.minimum * 100 : field.minimum) : (isPercent ? 0 : undefined);
  const htmlMax  = field.maximum != null ? (isPercent ? field.maximum * 100 : field.maximum) : (isPercent ? 100 : undefined);
  const htmlStep = field.step    != null ? (isPercent ? field.step    * 100 : field.step)    : (isPercent ? 0.01 : undefined);

  const input = (
    <input
      type="number"
      inputMode="decimal"
      value={display}
      min={htmlMin}
      max={htmlMax}
      step={htmlStep}
      placeholder={isInt ? "0" : isPercent ? "0" : "0.0"}
      disabled={disabled}
      className={classNames?.input}
      aria-label={field.label}
      onChange={(e) => {
        const raw = e.target.value.trim();
        if (raw === "") { onChange(null); return; }
        const parsed = Number(raw);
        if (!Number.isFinite(parsed)) return;
        // Convert display % back to stored fraction.
        onChange(isPercent ? parsed / 100 : parsed);
      }}
    />
  );

  const suffix = unitSuffix(field.unit);
  if (!suffix) return input;

  return (
    <div
      className={classNames?.inputGroup}
      style={
        classNames?.inputGroup
          ? undefined
          : { display: "inline-flex", alignItems: "center", gap: "0.5rem", width: "100%" }
      }
    >
      {input}
      <span
        className={classNames?.inputSuffix}
        aria-hidden="true"
        style={
          classNames?.inputSuffix
            ? undefined
            : { color: "#64748b", fontSize: "0.875rem", whiteSpace: "nowrap" }
        }
      >
        {suffix}
      </span>
    </div>
  );
}

// ─── BooleanField ─────────────────────────────────────────────────────────────

export function BooleanField({
  field, value, disabled, classNames, onChange,
}: DynamicUserInputFieldRendererProps): ReactNode {
  const effective = resolveEffectiveValue(field, value);
  return (
    <input
      type="checkbox"
      checked={Boolean(effective)}
      disabled={disabled}
      onChange={(e) => onChange(e.target.checked)}
      className={classNames?.input}
      aria-label={field.label}
    />
  );
}

// ─── StringField ──────────────────────────────────────────────────────────────

export function StringField({
  field, value, disabled, classNames, onChange,
}: DynamicUserInputFieldRendererProps): ReactNode {
  const effective = resolveEffectiveValue(field, value);
  return (
    <input
      type="text"
      value={effective == null ? "" : String(effective)}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value || null)}
      className={classNames?.input}
      aria-label={field.label}
    />
  );
}

// ─── Renderer dispatch ────────────────────────────────────────────────────────

/**
 * Pick the default built-in renderer for a field based on its YAML type.
 * Explicit ``options[]`` always wins (renders as a ``<select>``).
 */
export function pickDefaultRenderer(field: UserInputField): DynamicUserInputFieldRenderer {
  if (field.options && field.options.length > 0) return SelectField;
  if (field.derive_options_from === "case.document_years" || field.type === "year") return YearField;
  switch (field.type) {
    case "currency": return CurrencyField;
    case "percent":
    case "percentage":
    case "integer":
    case "number":   return NumericField;
    case "boolean":  return BooleanField;
    default:         return StringField;
  }
}
