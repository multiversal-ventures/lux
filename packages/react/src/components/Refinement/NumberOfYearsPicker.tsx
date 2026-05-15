import { useMemo, type CSSProperties, type ReactNode } from "react";

/**
 * 1099 Non-QM "Number of Years" selector.
 *
 * Conceptually a Y1/Y2 override pair, but presented as a single
 * "1 year" / "2 years" dropdown — the engine is the same, the UI is
 * simpler. Switching to "1 year" clears Y2.
 */
export interface NumberOfYearsPickerClassNames {
  root?: string;
  label?: string;
  select?: string;
  hint?: string;
}

export interface NumberOfYearsPickerSlots {
  description?: ReactNode;
}

export interface NumberOfYearsPickerProps {
  /** Year 1 selection. */
  y1: string | null;
  /** Year 2 selection. */
  y2: string | null;
  onY1Change: (value: string | null) => void;
  onY2Change: (value: string | null) => void;
  /** Years detected from the case's 1099 documents. */
  availableYears?: readonly string[];
  disabled?: boolean;
  classNames?: NumberOfYearsPickerClassNames;
  slots?: NumberOfYearsPickerSlots;
  style?: CSSProperties;
}

export function NumberOfYearsPicker({
  y1,
  y2,
  onY1Change,
  onY2Change,
  availableYears = [],
  disabled = false,
  classNames,
  slots,
  style,
}: NumberOfYearsPickerProps) {
  const years = useMemo(
    () => Array.from(new Set(availableYears)).sort((a, b) => Number(b) - Number(a)),
    [availableYears],
  );

  // "1 year" = only Y1 is set; "2 years" = both. Default to whatever the
  // current selection implies, defaulting to 2 when nothing is set.
  const numYears = !y1 ? 2 : !y2 ? 1 : 2;

  const handleChange = (next: string) => {
    if (next === "1") {
      // Use the most recent available year for Y1 if not set yet; never clear it.
      if (!y1 && years.length > 0) onY1Change(years[0]);
      onY2Change(null);
    } else {
      if (!y1 && years.length > 0) onY1Change(years[0]);
      if (!y2 && years.length > 1) onY2Change(years[1]);
    }
  };

  return (
    <div className={classNames?.root} style={style}>
      {slots?.description}
      <select
        value={String(numYears)}
        onChange={(e) => handleChange(e.target.value)}
        disabled={disabled}
        className={classNames?.select}
        aria-label="Number of years"
      >
        <option value="2">2 years</option>
        <option value="1">1 year</option>
      </select>
      {years.length > 0 && (
        <div className={classNames?.hint}>
          Years available from documents: {years.join(", ")}
        </div>
      )}
    </div>
  );
}
