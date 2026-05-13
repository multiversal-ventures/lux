import { useMemo, type CSSProperties, type ReactNode } from "react";

/**
 * QM tax-year override picker (Year 1 + Year 2 dropdowns).
 *
 * Controlled component: parent owns the override values, this just renders
 * the selects and surfaces validation. Empty string in either select means
 * "auto-detect" — emitted as `null` to keep parents free of the empty-
 * string vs null trap.
 */
export interface TaxYearOverridePickerClassNames {
  root?: string;
  field?: string;
  label?: string;
  select?: string;
  selectError?: string;
  error?: string;
  hint?: string;
}

export interface TaxYearOverridePickerSlots {
  /** Override the entire description block above the dropdowns. */
  description?: ReactNode;
  /** Custom validation-error renderer. Receives the error string. */
  error?: (message: string) => ReactNode;
}

export interface TaxYearOverridePickerProps {
  y1: string | null;
  y2: string | null;
  onY1Change: (value: string | null) => void;
  onY2Change: (value: string | null) => void;
  /** Years detected from the case's documents, e.g. `["2024", "2023"]`. */
  availableYears?: readonly string[];
  /** Optional copy explaining which years were auto-selected. */
  yearSelectionReason?: string | null;
  disabled?: boolean;
  classNames?: TaxYearOverridePickerClassNames;
  slots?: TaxYearOverridePickerSlots;
  style?: CSSProperties;
}

export function TaxYearOverridePicker({
  y1,
  y2,
  onY1Change,
  onY2Change,
  availableYears = [],
  yearSelectionReason,
  disabled = false,
  classNames,
  slots,
  style,
}: TaxYearOverridePickerProps) {
  const years = useMemo(() => {
    if (availableYears.length > 0) {
      return Array.from(new Set(availableYears)).sort((a, b) => Number(b) - Number(a));
    }
    const currentYear = new Date().getFullYear();
    return Array.from({ length: 5 }, (_, i) => String(currentYear - i));
  }, [availableYears]);

  const validationError = useMemo(() => {
    if (!y1 || !y2) return null;
    const y1n = Number(y1);
    const y2n = Number(y2);
    if (y1n === y2n) return "Year 1 and Year 2 cannot be the same";
    if (y1n < y2n) return "Year 1 must be more recent than Year 2";
    return null;
  }, [y1, y2]);

  const y2Years = useMemo(() => {
    if (!y1) return years;
    const y1n = Number(y1);
    return years.filter((y) => Number(y) < y1n);
  }, [years, y1]);

  const y1Years = useMemo(() => {
    if (!y2) return years;
    const y2n = Number(y2);
    return years.filter((y) => Number(y) > y2n);
  }, [years, y2]);

  return (
    <div className={classNames?.root} style={style}>
      {slots?.description}

      <div>
        <div className={classNames?.field}>
          <label className={classNames?.label}>Year 1 (Most Recent)</label>
          <select
            value={y1 ?? ""}
            onChange={(e) => onY1Change(e.target.value || null)}
            disabled={disabled}
            className={[
              classNames?.select,
              validationError ? classNames?.selectError : null,
            ]
              .filter(Boolean)
              .join(" ")}
          >
            <option value="">Auto-detect</option>
            {y1Years.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </div>

        <div className={classNames?.field}>
          <label className={classNames?.label}>Year 2</label>
          <select
            value={y2 ?? ""}
            onChange={(e) => onY2Change(e.target.value || null)}
            disabled={disabled}
            className={[
              classNames?.select,
              validationError ? classNames?.selectError : null,
            ]
              .filter(Boolean)
              .join(" ")}
          >
            <option value="">Auto-detect</option>
            {y2Years.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </div>
      </div>

      {validationError && (
        slots?.error?.(validationError) ?? (
          <div role="alert" className={classNames?.error}>
            {validationError}
          </div>
        )
      )}

      {!y1 && !y2 && yearSelectionReason && (
        <div className={classNames?.hint}>{yearSelectionReason}</div>
      )}
      {availableYears.length > 0 && (
        <div className={classNames?.hint}>
          Years available from documents: {years.join(", ")}
        </div>
      )}
    </div>
  );
}

export interface TaxYearValidation {
  valid: boolean;
  error: string | null;
}

/** Pure validation helper — useful from `useRefinementForm`. */
export function validateTaxYears(y1: string | null, y2: string | null): TaxYearValidation {
  if (!y1 || !y2) return { valid: true, error: null };
  const y1n = Number(y1);
  const y2n = Number(y2);
  if (y1n === y2n) return { valid: false, error: "Year 1 and Year 2 cannot be the same" };
  if (y1n < y2n) return { valid: false, error: "Year 1 must be more recent than Year 2" };
  return { valid: true, error: null };
}
