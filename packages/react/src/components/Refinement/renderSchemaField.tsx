/**
 * ``renderSchemaField`` — shared field rendering scaffold.
 *
 * Renders label + required marker + field renderer + hint + inline error.
 * Used by both ``DynamicUserInputsForm`` (scenario-scoped) and
 * ``DynamicUserInputsFormFields`` (create-case modal, no scenario context).
 */

import type { ReactNode } from "react";
import type {
  DynamicUserInputsFormClassNames,
  DynamicUserInputsFormSlots,
  DynamicUserInputFieldRenderer,
} from "./DynamicUserInputsForm.js";
import { pickDefaultRenderer } from "./fieldRenderers.js";
import type { UserInputField } from "./fieldUtils.js";

export interface RenderSchemaFieldOptions {
  field: UserInputField;
  productId: string;
  value: unknown;
  documentYears?: readonly string[];
  disabled?: boolean;
  classNames?: DynamicUserInputsFormClassNames;
  slots?: DynamicUserInputsFormSlots;
  /** Inline validation error shown below the input. */
  error?: string;
  onChange: (next: unknown) => void;
}

export function renderSchemaField({
  field,
  productId,
  value,
  documentYears,
  disabled,
  classNames,
  slots,
  error,
  onChange,
}: RenderSchemaFieldOptions): ReactNode {
  const renderer: DynamicUserInputFieldRenderer =
    slots?.renderers?.[field.type] ?? slots?.defaultRenderer ?? pickDefaultRenderer(field);

  return (
    <div key={`${productId}.${field.name}`} className={classNames?.field?.root}>
      <label className={classNames?.field?.label}>
        {field.label}
        {field.required && <span aria-label="required"> *</span>}
      </label>
      {renderer({
        field,
        productId,
        value,
        yearOptions: documentYears,
        disabled,
        classNames: classNames?.field,
        onChange,
      })}
      {field.hint && (
        <div className={classNames?.field?.hint}>{field.hint}</div>
      )}
      {error && (
        <div className={classNames?.field?.error} role="alert">
          {error}
        </div>
      )}
    </div>
  );
}
