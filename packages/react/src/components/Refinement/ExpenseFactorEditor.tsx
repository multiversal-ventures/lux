import { useCallback, useEffect, useState, type CSSProperties, type ReactNode } from "react";

/**
 * Expense-factor editor for Non-QM bank statement income.
 *
 * Lenders override the deduction percentage (`expense_factor`) applied
 * to gross deposits when calculating qualifying income. Common values
 * are 0.50 (50% personal) or 0.30 (30% business). Validates 0–1 inclusive.
 *
 * Controlled component: parent owns the value. Optional `onCommit` fires
 * when the user explicitly accepts the input (Enter or blur), letting
 * hosts batch saves instead of round-tripping on every keystroke.
 */
export interface ExpenseFactorEditorClassNames {
  root?: string;
  label?: string;
  input?: string;
  inputError?: string;
  hint?: string;
  error?: string;
}

export interface ExpenseFactorEditorSlots {
  description?: ReactNode;
  hint?: ReactNode;
  error?: (message: string) => ReactNode;
}

export interface ExpenseFactorEditorProps {
  /** Current expense factor, as a fraction (0.0 – 1.0). `null` = unset. */
  value: number | null;
  onChange: (value: number | null) => void;
  /** Called on Enter or blur with the parsed final value. Useful for explicit-commit UIs. */
  onCommit?: (value: number | null) => void;
  /** Render the value as a percentage in the input (50 instead of 0.5). Default `true`. */
  asPercent?: boolean;
  /** Min allowed value (inclusive). Default 0. */
  min?: number;
  /** Max allowed value (inclusive). Default 1 (or 100 when `asPercent`). */
  max?: number;
  disabled?: boolean;
  classNames?: ExpenseFactorEditorClassNames;
  slots?: ExpenseFactorEditorSlots;
  style?: CSSProperties;
}

function parsePercent(raw: string, asPercent: boolean): number | null {
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  const parsed = Number(trimmed.replace(/%$/, "").trim());
  if (!Number.isFinite(parsed)) return null;
  return asPercent ? parsed / 100 : parsed;
}

function formatForDisplay(value: number | null, asPercent: boolean): string {
  if (value == null) return "";
  return asPercent ? String(Math.round(value * 10000) / 100) : String(value);
}

export function ExpenseFactorEditor({
  value,
  onChange,
  onCommit,
  asPercent = true,
  min = 0,
  max = asPercent ? 100 : 1,
  disabled = false,
  classNames,
  slots,
  style,
}: ExpenseFactorEditorProps) {
  const [draft, setDraft] = useState(() => formatForDisplay(value, asPercent));
  const [error, setError] = useState<string | null>(null);

  // Sync the in-flight string with parent-driven value changes (e.g. an
  // external reset, or another component overwriting the same field). We
  // only do this when there's no live validation error so we don't stomp on
  // an in-progress edit.
  useEffect(() => {
    if (error != null) return;
    const display = formatForDisplay(value, asPercent);
    setDraft((current) => (current === display ? current : display));
  }, [value, asPercent, error]);

  const commit = useCallback(
    (raw: string) => {
      const parsed = parsePercent(raw, asPercent);
      if (parsed == null) {
        setError(null);
        onChange(null);
        onCommit?.(null);
        return;
      }
      const compareValue = asPercent ? parsed * 100 : parsed;
      if (compareValue < min || compareValue > max) {
        setError(
          asPercent
            ? `Enter a percent between ${min}% and ${max}%`
            : `Enter a value between ${min} and ${max}`,
        );
        return;
      }
      setError(null);
      onChange(parsed);
      onCommit?.(parsed);
    },
    [asPercent, min, max, onChange, onCommit],
  );

  return (
    <div className={classNames?.root} style={style}>
      {slots?.description}
      <input
        type="text"
        inputMode="decimal"
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value);
          // Live validation cleared on edit; commit happens on Enter/blur.
          if (error) setError(null);
        }}
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit(e.currentTarget.value);
          }
        }}
        disabled={disabled}
        className={[
          classNames?.input,
          error ? classNames?.inputError : null,
        ]
          .filter(Boolean)
          .join(" ")}
        aria-label="Expense factor"
      />
      {slots?.hint && <div className={classNames?.hint}>{slots.hint}</div>}
      {error &&
        (slots?.error?.(error) ?? (
          <div role="alert" className={classNames?.error}>
            {error}
          </div>
        ))}
    </div>
  );
}
