import type { CSSProperties, ReactNode } from "react";
import {
  TaxYearOverridePicker,
  type TaxYearOverridePickerClassNames,
} from "./TaxYearOverridePicker.js";
import {
  StatementPeriodPicker,
  type StatementPeriodPickerClassNames,
} from "./StatementPeriodPicker.js";
import {
  NumberOfYearsPicker,
  type NumberOfYearsPickerClassNames,
} from "./NumberOfYearsPicker.js";
import {
  ExpenseFactorEditor,
  type ExpenseFactorEditorClassNames,
} from "./ExpenseFactorEditor.js";
import type { ProductCategory } from "./productCategory.js";

/**
 * Refinement Periods tab — composes the right picker(s) based on the
 * resolved product category.
 *
 *   * `qm`             → TaxYearOverridePicker
 *   * `bank_statement` → StatementPeriodPicker + ExpenseFactorEditor
 *   * `1099`           → NumberOfYearsPicker
 *   * `dscr`           → TaxYearOverridePicker (placeholder)
 *
 * Everything below the per-category swap is controlled — the host owns
 * state via `useRefinementForm` (or its own reducer) and passes values +
 * setters through here.
 */
export interface RefinementPeriodsTabClassNames {
  root?: string;
  section?: string;
  taxYears?: TaxYearOverridePickerClassNames;
  statementPeriod?: StatementPeriodPickerClassNames;
  numberOfYears?: NumberOfYearsPickerClassNames;
  expenseFactor?: ExpenseFactorEditorClassNames;
}

export interface RefinementPeriodsTabProps {
  category: ProductCategory;
  /** Y1/Y2 (used by qm + 1099). */
  y1: string | null;
  y2: string | null;
  onY1Change: (v: string | null) => void;
  onY2Change: (v: string | null) => void;
  /** Statement months (used by bank_statement). */
  statementPeriodMonths: number | null;
  onStatementPeriodMonthsChange: (v: number | null) => void;
  /** Expense factor (used by bank_statement). 0..1 fraction. */
  expenseFactor: number | null;
  onExpenseFactorChange: (v: number | null) => void;
  /** Years inferred from documents. */
  availableYears?: readonly string[];
  yearSelectionReason?: string | null;
  disabled?: boolean;
  classNames?: RefinementPeriodsTabClassNames;
  /** Optional slot rendered above the picker (e.g. a "what does this control?" callout). */
  description?: ReactNode;
  style?: CSSProperties;
}

export function RefinementPeriodsTab({
  category,
  y1,
  y2,
  onY1Change,
  onY2Change,
  statementPeriodMonths,
  onStatementPeriodMonthsChange,
  expenseFactor,
  onExpenseFactorChange,
  availableYears = [],
  yearSelectionReason,
  disabled = false,
  classNames,
  description,
  style,
}: RefinementPeriodsTabProps) {
  return (
    <div className={classNames?.root} style={style}>
      {description}
      {(category === "qm" || category === "dscr") && (
        <div className={classNames?.section}>
          <TaxYearOverridePicker
            y1={y1}
            y2={y2}
            onY1Change={onY1Change}
            onY2Change={onY2Change}
            availableYears={availableYears}
            yearSelectionReason={yearSelectionReason}
            disabled={disabled}
            classNames={classNames?.taxYears}
          />
        </div>
      )}
      {category === "1099" && (
        <div className={classNames?.section}>
          <NumberOfYearsPicker
            y1={y1}
            y2={y2}
            onY1Change={onY1Change}
            onY2Change={onY2Change}
            availableYears={availableYears}
            disabled={disabled}
            classNames={classNames?.numberOfYears}
          />
        </div>
      )}
      {category === "bank_statement" && (
        <>
          <div className={classNames?.section}>
            <StatementPeriodPicker
              value={statementPeriodMonths}
              onChange={onStatementPeriodMonthsChange}
              availableYears={availableYears}
              disabled={disabled}
              classNames={classNames?.statementPeriod}
            />
          </div>
          <div className={classNames?.section}>
            <ExpenseFactorEditor
              value={expenseFactor}
              onChange={onExpenseFactorChange}
              disabled={disabled}
              classNames={classNames?.expenseFactor}
            />
          </div>
        </>
      )}
    </div>
  );
}
