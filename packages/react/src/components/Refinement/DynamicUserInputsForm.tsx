/**
 * `<DynamicUserInputsForm>` — schema-driven operator overrides form.
 *
 * Renders the form for everything an operator can adjust on a scenario /
 * refinement. The schema is authored in Veritas YAML — no hardcoded knowledge
 * of loan products, policy domains, or field semantics lives here.
 *
 * ## Architecture
 *
 * ```
 * DynamicUserInputsForm.tsx   ← this file: types + two exported form components
 *   fieldUtils.ts             ← pure helpers (resolveEffectiveValue, unitSuffix,
 *                                currency formatting)
 *   fieldRenderers.tsx        ← CurrencyField, NumericField, BooleanField, …
 *   renderSchemaField.tsx     ← label + renderer + hint scaffold
 * ```
 *
 * ## Data flow
 *
 * ```
 * Spec YAML (`override:` block on a spec input)
 *    ▼
 * Veritas compute_user_inputs_schema() → UserInputsSchemaResponse
 *    ▼
 * <DynamicUserInputsForm schema=… value=… onContextChange=… />
 *    │  iterates sections → renderSchemaField → field renderer → onChange
 *    ▼
 * host updates `context`, POSTs to /refinements as
 *   { context: { <product>: { inputs: { <field>: <value> } } } }
 * ```
 */

import { useCallback, type CSSProperties, type ReactNode } from "react";
import type { components } from "@multiversal-ventures/lux-core";
import { renderSchemaField } from "./renderSchemaField.js";

// ─── Types ───────────────────────────────────────────────────────────────────

type UserInputsSchema      = components["schemas"]["UserInputsSchemaResponse"];
type UserInputsSection     = components["schemas"]["UserInputsProductSectionResponse"];
type UserInputsGroupSection = components["schemas"]["UserInputsGroupSectionResponse"];
type UserInputField        = components["schemas"]["UserInputFieldResponse"];

/**
 * Shape stored on the manifest's `context` JSONB.
 *   { "<product_id>": { "inputs": { "<field>": <value>, ... } } }
 */
export type RefinementContext = Record<string, { inputs?: Record<string, unknown> }>;

export interface DynamicUserInputFieldRendererProps {
  field: UserInputField;
  productId: string;
  value: unknown;
  /** Available years when the field declares `derive_options_from: case.document_years`. */
  yearOptions?: readonly string[];
  disabled?: boolean;
  classNames?: DynamicUserInputsFormClassNames["field"];
  onChange: (value: unknown) => void;
}

export type DynamicUserInputFieldRenderer = (
  props: DynamicUserInputFieldRendererProps,
) => ReactNode;

export interface DynamicUserInputsFormClassNames {
  root?: string;
  section?: string;
  sectionTitle?: string;
  sectionHint?: string;
  emptyMessage?: string;
  groupSection?: string;
  groupSectionTitle?: string;
  groupSectionHint?: string;
  groupAppliesTo?: string;
  field?: {
    root?: string;
    label?: string;
    hint?: string;
    input?: string;
    /** Wrapper around input + unit suffix. Defaults to inline-flex when unset. */
    inputGroup?: string;
    /** Unit suffix label (``%`` / ``USD`` / ``mo``). Driven by the YAML ``unit:`` field. */
    inputSuffix?: string;
    select?: string;
    error?: string;
  };
}

export interface DynamicUserInputsFormSlots {
  empty?: ReactNode;
  sectionHeader?: (section: UserInputsSection) => ReactNode;
  groupSectionHeader?: (section: UserInputsGroupSection) => ReactNode;
  /** Per-type renderer override. Key is `field.type` (e.g. "currency"). */
  renderers?: Partial<Record<string, DynamicUserInputFieldRenderer>>;
  defaultRenderer?: DynamicUserInputFieldRenderer;
}

export interface DynamicUserInputsFormProps {
  schema: UserInputsSchema | null | undefined;
  value: RefinementContext;
  onContextChange: (productId: string, fieldName: string, value: unknown) => void;
  documentYears?: readonly string[];
  disabled?: boolean;
  classNames?: DynamicUserInputsFormClassNames;
  slots?: DynamicUserInputsFormSlots;
  style?: CSSProperties;
}

// ─── DynamicUserInputsForm ───────────────────────────────────────────────────

export function DynamicUserInputsForm({
  schema,
  value,
  onContextChange,
  documentYears,
  disabled = false,
  classNames,
  slots,
  style,
}: DynamicUserInputsFormProps) {
  const groupSections   = schema?.groups   ?? [];
  const productSections = schema?.products ?? [];
  const hasAnyField =
    groupSections.some((g) => (g.fields ?? []).length > 0) ||
    productSections.some((s) => (s.fields ?? []).length > 0);

  // Group-field write: fan out to every product the group applies to.
  const renderGroupField = useCallback(
    (section: UserInputsGroupSection, field: UserInputField) => {
      const members = section.applies_to_products ?? [];
      const representative = members[0];
      const currentValue = representative != null
        ? value[representative]?.inputs?.[field.name]
        : undefined;
      return renderSchemaField({
        field,
        productId: representative ?? section.group_id,
        value: currentValue,
        documentYears,
        disabled,
        classNames,
        slots,
        onChange: (next) => {
          for (const pid of members) onContextChange(pid, field.name, next);
        },
      });
    },
    [value, onContextChange, documentYears, disabled, classNames, slots],
  );

  const renderField = useCallback(
    (section: UserInputsSection, field: UserInputField) => {
      const pid = section.product_id;
      return renderSchemaField({
        field,
        productId: pid,
        value: value[pid]?.inputs?.[field.name],
        documentYears,
        disabled,
        classNames,
        slots,
        onChange: (next) => onContextChange(pid, field.name, next),
      });
    },
    [value, onContextChange, documentYears, disabled, classNames, slots],
  );

  if (!hasAnyField) {
    return (
      <div className={classNames?.root} style={style}>
        {slots?.empty ?? (
          <div className={classNames?.emptyMessage}>
            No operator-adjustable inputs for the selected products.
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={classNames?.root} style={style}>
      {groupSections.map((section) => {
        const fields = section.fields ?? [];
        if (fields.length === 0) return null;
        return (
          <div
            key={`group:${section.group_id}`}
            className={classNames?.groupSection ?? classNames?.section}
          >
            {slots?.groupSectionHeader?.(section) ?? (
              <h3 className={classNames?.groupSectionTitle ?? classNames?.sectionTitle}>
                {section.display_name}
                {section.applies_to_products.length > 1 && (
                  <span className={classNames?.groupAppliesTo}>
                    {` — applies to ${section.applies_to_products.length} products`}
                  </span>
                )}
              </h3>
            )}
            {section.description && (
              <div className={classNames?.groupSectionHint ?? classNames?.sectionHint}>
                {section.description}
              </div>
            )}
            {fields.map((field) => renderGroupField(section, field))}
          </div>
        );
      })}
      {productSections.map((section) => {
        const fields = section.fields ?? [];
        if (fields.length === 0) return null;
        return (
          <div key={section.product_id} className={classNames?.section}>
            {slots?.sectionHeader?.(section) ?? (
              <h3 className={classNames?.sectionTitle}>{section.display_name}</h3>
            )}
            {fields.map((field) => renderField(section, field))}
          </div>
        );
      })}
    </div>
  );
}

// ─── applyContextChange ───────────────────────────────────────────────────────

/**
 * Apply a single field change to the namespaced context blob.
 * Pure / immutable — returns a new object, never mutates.
 * Empty product entries are pruned so the API receives a minimal payload.
 */
export function applyContextChange(
  prev: RefinementContext,
  productId: string,
  fieldName: string,
  value: unknown,
): RefinementContext {
  const next: RefinementContext = { ...prev };
  const product = next[productId] ?? {};
  const inputs = { ...(product.inputs ?? {}) };
  if (value === null || value === undefined || value === "") {
    delete inputs[fieldName];
  } else {
    inputs[fieldName] = value;
  }
  next[productId] = { ...product, inputs };
  if (Object.keys(inputs).length === 0) delete next[productId];
  return next;
}

// ─── DynamicUserInputsFormFields (presentational / create-case modal) ────────

export interface DynamicUserInputsFormFieldsProps {
  /** Flat list of fields, e.g. ``tenantProduct.initial_required_inputs``. */
  fields: readonly UserInputField[];
  /** Operator-supplied values keyed by ``field.name``. */
  value: Record<string, unknown>;
  /** Emitted on every edit. ``key`` is ``field.name``. */
  onChange: (key: string, value: unknown) => void;
  /** Product id forwarded to custom renderers. Defaults to ``"_"``. */
  productId?: string;
  /** Per-field inline error strings (from ``validateInitialRequiredInputs``). */
  errors?: Record<string, string | undefined>;
  documentYears?: readonly string[];
  disabled?: boolean;
  classNames?: DynamicUserInputsFormClassNames;
  slots?: DynamicUserInputsFormSlots;
  style?: CSSProperties;
}

export function DynamicUserInputsFormFields({
  fields,
  value,
  onChange,
  productId = "_",
  errors,
  documentYears,
  disabled = false,
  classNames,
  slots,
  style,
}: DynamicUserInputsFormFieldsProps) {
  if (fields.length === 0) return null;
  return (
    <div className={classNames?.root} style={style}>
      {fields.map((field) =>
        renderSchemaField({
          field,
          productId,
          value: value[field.name],
          documentYears,
          disabled,
          classNames,
          slots,
          error: errors?.[field.name],
          onChange: (next) => onChange(field.name, next),
        }),
      )}
    </div>
  );
}

// ─── validateInitialRequiredInputs ───────────────────────────────────────────

/**
 * Validate a ``DynamicUserInputsFormFields`` value blob against its schema.
 * Returns a per-field error map — empty object means submission-ready.
 */
export function validateInitialRequiredInputs(
  fields: readonly UserInputField[],
  value: Record<string, unknown>,
  options?: { requiredAtCreateOnly?: boolean },
): Record<string, string> {
  const requiredAtCreateOnly = options?.requiredAtCreateOnly ?? true;
  const errors: Record<string, string> = {};
  for (const field of fields) {
    // Conditional requirement wins when declared: the field is required only
    // when a sibling input matches the predicate (e.g. Purchase Price is
    // required only for transaction_type == purchase). Otherwise fall back to
    // the static required_at_create / required flag.
    const requiredWhen = field.required_when;
    const isRequired = requiredWhen?.field
      ? value[requiredWhen.field] === requiredWhen.equals
      : requiredAtCreateOnly
        ? Boolean(field.required_at_create)
        : Boolean(field.required);
    const raw = value[field.name];
    const isMissing = raw === undefined || raw === null || raw === "";
    if (isRequired && isMissing) { errors[field.name] = `${field.label} is required`; continue; }
    if (isMissing) continue;
    if (typeof raw === "number" && Number.isFinite(raw)) {
      if (field.minimum != null && raw < field.minimum) {
        errors[field.name] = `${field.label} must be at least ${field.minimum}`; continue;
      }
      if (field.maximum != null && raw > field.maximum) {
        errors[field.name] = `${field.label} must be at most ${field.maximum}`; continue;
      }
    }
  }
  return errors;
}
