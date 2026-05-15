import { useMemo, type CSSProperties, type ReactNode } from "react";

/**
 * Bank-statement period selector (Non-QM bank statement income).
 *
 * Controlled component. Renders months options; falls back to a value
 * derived from `availableYears` when nothing is set, mirroring the
 * legacy gunnr default. Hosts can override the options list (e.g. add a
 * 36-month bucket).
 */
export const DEFAULT_STATEMENT_PERIOD_MONTHS: readonly number[] = [24, 12, 6, 3];

export interface StatementPeriodPickerClassNames {
  root?: string;
  label?: string;
  select?: string;
  hint?: string;
}

export interface StatementPeriodPickerSlots {
  description?: ReactNode;
  detectedHint?: (label: string) => ReactNode;
}

export interface StatementPeriodPickerProps {
  /** Currently selected number of months. `null` means "auto-detect". */
  value: number | null;
  onChange: (months: number | null) => void;
  /** Allowed dropdown values; defaults to `[24, 12, 6, 3]`. */
  options?: readonly number[];
  /** Years detected from the case's bank-statement documents. */
  availableYears?: readonly string[];
  disabled?: boolean;
  classNames?: StatementPeriodPickerClassNames;
  slots?: StatementPeriodPickerSlots;
  style?: CSSProperties;
}

export function StatementPeriodPicker({
  value,
  onChange,
  options = DEFAULT_STATEMENT_PERIOD_MONTHS,
  availableYears = [],
  disabled = false,
  classNames,
  slots,
  style,
}: StatementPeriodPickerProps) {
  const detected = useMemo(() => {
    if (availableYears.length < 1) return null;
    const sorted = [...availableYears].sort((a, b) => Number(a) - Number(b));
    const minYear = Number(sorted[0]);
    const maxYear = Number(sorted[sorted.length - 1]);
    return {
      months: (maxYear - minYear + 1) * 12,
      label: `Bank Statements (${sorted[0]}\u2013${sorted[sorted.length - 1]}) : ${(maxYear - minYear + 1) * 12} months detected`,
    };
  }, [availableYears]);

  return (
    <div className={classNames?.root} style={style}>
      {slots?.description}
      <select
        value={value ?? detected?.months ?? options[0]}
        onChange={(e) => {
          const v = Number(e.target.value);
          onChange(Number.isFinite(v) && v > 0 ? v : null);
        }}
        disabled={disabled}
        className={classNames?.select}
        aria-label="Statement period in months"
      >
        {options.map((m) => (
          <option key={m} value={m}>
            {m} months
          </option>
        ))}
      </select>
      {detected?.label && (
        <div className={classNames?.hint}>
          {slots?.detectedHint?.(detected.label) ?? detected.label}
        </div>
      )}
    </div>
  );
}
