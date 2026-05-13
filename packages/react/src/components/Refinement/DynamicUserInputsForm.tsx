import { useCallback, type CSSProperties, type ReactNode } from "react";
import type { components } from "@fenero/lux-core";

/**
 * `<DynamicUserInputsForm>` — schema-driven operator overrides form.
 *
 * Renders the form for everything an operator can adjust on a scenario /
 * refinement. The schema is authored in Veritas YAML and arrives over the
 * wire — this component contains no hardcoded knowledge of loan products,
 * policy domains, or field semantics. Adding a new override is a YAML
 * edit, not a code change.
 *
 * ## Data flow
 *
 * ```
 * Spec YAML (`override:` block on a spec input)
 *    │
 *    ▼
 * Veritas `compute_user_inputs_schema(product_ids)` (DB-first)
 *    │  groups by product, dedupes by input name, applies the product's
 *    │  spec_filter so only relevant fields appear.
 *    ▼
 * ScenarioDetailResponse.rendering_hints.user_inputs_schema
 * RefinementResponse.user_inputs_schema
 *    │
 *    ▼
 * <DynamicUserInputsForm schema=… value=… onContextChange=… />
 *    │  iterates product sections → dispatches per field type to a
 *    │  renderer → emits (productId, fieldName, value) on change.
 *    ▼
 * Host updates `context` state, POSTs to /refinements as
 *   { context: { <product>: { inputs: { <field>: <value> } } } }
 *    │
 *    ▼
 * Veritas qualify activity merges `context[product].inputs` into spec
 * evaluation inputs by name (unknown keys are ignored).
 * ```
 *
 * ## Renderer dispatch
 *
 * Picked in order:
 *
 *   1. `slots.renderers[field.type]` — host override.
 *   2. `slots.defaultRenderer` — host catch-all.
 *   3. Built-in dispatch by:
 *      - explicit `options[]` → `<select>`
 *      - `derive_options_from: case.document_years` or `type: year`
 *        → year `<select>` populated from `documentYears`
 *      - `type: percent` / `currency` / `integer` / `number` → `<input type="number">`
 *        (percent fields show `0–100` in the input, store `0.00–1.00`)
 *      - `type: boolean` → `<input type="checkbox">`
 *      - otherwise → `<input type="text">`
 *
 * ## Controlled component contract
 *
 * Parents own the `context` blob (`Record<productId, { inputs: {…} }>`)
 * and update it via `applyContextChange(prev, productId, fieldName, value)`
 * when `onContextChange` fires. The form never reads from server state
 * directly — it's a thin renderer of the parent's state + schema.
 */

type UserInputsSchema = components["schemas"]["UserInputsSchemaResponse"];
type UserInputsSection = components["schemas"]["UserInputsProductSectionResponse"];
type UserInputField = components["schemas"]["UserInputFieldResponse"];
type UserInputOption = components["schemas"]["UserInputFieldOptionResponse"];

/**
 * Shape stored on the manifest's `context` JSONB.
 *
 *   { "<product_id>": { "inputs": { "<field>": <value>, ... } } }
 */
export type RefinementContext = Record<string, { inputs?: Record<string, unknown> }>;

export interface DynamicUserInputFieldRendererProps {
  field: UserInputField;
  productId: string;
  value: unknown;
  /** Available year options when the field declares `derive_options_from: case.document_years`. */
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
  field?: {
    root?: string;
    label?: string;
    hint?: string;
    input?: string;
    select?: string;
    error?: string;
  };
}

export interface DynamicUserInputsFormSlots {
  /** Override the empty-state message rendered when the schema has no fields. */
  empty?: ReactNode;
  /** Custom section header. */
  sectionHeader?: (section: UserInputsSection) => ReactNode;
  /** Per-type renderer override. Key is `field.type` (e.g. "percent"). */
  renderers?: Partial<Record<string, DynamicUserInputFieldRenderer>>;
  /** Renderer used when no per-type override matches. */
  defaultRenderer?: DynamicUserInputFieldRenderer;
}

export interface DynamicUserInputsFormProps {
  schema: UserInputsSchema | null | undefined;
  value: RefinementContext;
  /** Called with the canonical `(productId, fieldName, value)` triple. */
  onContextChange: (productId: string, fieldName: string, value: unknown) => void;
  /** Available document years; used for fields with `derive_options_from: case.document_years`. */
  documentYears?: readonly string[];
  disabled?: boolean;
  classNames?: DynamicUserInputsFormClassNames;
  slots?: DynamicUserInputsFormSlots;
  style?: CSSProperties;
}

// ---- Built-in renderers ----------------------------------------------------

function SelectField({ field, value, disabled, classNames, onChange }: DynamicUserInputFieldRendererProps) {
  const options: readonly UserInputOption[] = field.options ?? [];
  const currentValue = value ?? field.default ?? "";
  return (
    <select
      value={currentValue == null ? "" : String(currentValue)}
      disabled={disabled}
      onChange={(e) => {
        const raw = e.target.value;
        // Find the option to preserve native type (number/boolean/string).
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

function YearField({ field, value, disabled, classNames, yearOptions, onChange }: DynamicUserInputFieldRendererProps) {
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
        <option key={y} value={y}>
          {y}
        </option>
      ))}
    </select>
  );
}

function NumericField({ field, value, disabled, classNames, onChange }: DynamicUserInputFieldRendererProps) {
  const display =
    value == null
      ? ""
      : field.type === "percent" && typeof value === "number"
        ? String(Math.round(value * 10000) / 100)
        : String(value);
  return (
    <input
      type="number"
      inputMode="decimal"
      value={display}
      step={field.step ?? (field.type === "percent" ? 5 : undefined)}
      min={field.minimum ?? (field.type === "percent" ? 0 : undefined)}
      max={field.maximum ?? (field.type === "percent" ? 100 : undefined)}
      disabled={disabled}
      onChange={(e) => {
        const raw = e.target.value.trim();
        if (raw === "") {
          onChange(null);
          return;
        }
        const parsed = Number(raw);
        if (!Number.isFinite(parsed)) return;
        // Convert percent (UI shows 50) back to fraction (0.5) before storing.
        onChange(field.type === "percent" ? parsed / 100 : parsed);
      }}
      className={classNames?.input}
      aria-label={field.label}
    />
  );
}

function BooleanField({ field, value, disabled, classNames, onChange }: DynamicUserInputFieldRendererProps) {
  return (
    <input
      type="checkbox"
      checked={Boolean(value)}
      disabled={disabled}
      onChange={(e) => onChange(e.target.checked)}
      className={classNames?.input}
      aria-label={field.label}
    />
  );
}

function StringField({ field, value, disabled, classNames, onChange }: DynamicUserInputFieldRendererProps) {
  return (
    <input
      type="text"
      value={value == null ? "" : String(value)}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value || null)}
      className={classNames?.input}
      aria-label={field.label}
    />
  );
}

function pickDefaultRenderer(field: UserInputField): DynamicUserInputFieldRenderer {
  // Always prefer enum-style select when explicit options are declared.
  if (field.options && field.options.length > 0) return SelectField;
  if (field.derive_options_from === "case.document_years" || field.type === "year") return YearField;
  switch (field.type) {
    case "percent":
    case "currency":
    case "integer":
    case "number":
      return NumericField;
    case "boolean":
      return BooleanField;
    default:
      return StringField;
  }
}

// ---- Component -------------------------------------------------------------

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
  const sections = schema?.products ?? [];
  const hasAnyField = sections.some((s) => (s.fields ?? []).length > 0);

  const renderField = useCallback(
    (section: UserInputsSection, field: UserInputField) => {
      const productId = section.product_id;
      const currentValue = value[productId]?.inputs?.[field.name];
      const renderer =
        slots?.renderers?.[field.type] ?? slots?.defaultRenderer ?? pickDefaultRenderer(field);
      const onFieldChange = (next: unknown) => onContextChange(productId, field.name, next);
      return (
        <div key={`${productId}.${field.name}`} className={classNames?.field?.root}>
          <label className={classNames?.field?.label}>
            {field.label}
            {field.required && <span aria-label="required"> *</span>}
          </label>
          {renderer({
            field,
            productId,
            value: currentValue,
            yearOptions: documentYears,
            disabled,
            classNames: classNames?.field,
            onChange: onFieldChange,
          })}
          {field.hint && <div className={classNames?.field?.hint}>{field.hint}</div>}
        </div>
      );
    },
    [value, onContextChange, documentYears, disabled, classNames?.field, slots?.renderers, slots?.defaultRenderer],
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
      {sections.map((section) => {
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

/**
 * Apply a single field change to the namespaced context blob.
 *
 * Pure / immutable — returns a new object, never mutates. Empty product
 * entries are pruned so the resulting blob is the minimal shape the API
 * needs:
 *
 *   ```
 *   applyContextChange({}, "non_qm", "expense_factor", 0.5)
 *   // ⇒ { non_qm: { inputs: { expense_factor: 0.5 } } }
 *
 *   applyContextChange(
 *     { non_qm: { inputs: { expense_factor: 0.5 } } },
 *     "non_qm",
 *     "expense_factor",
 *     null,
 *   )
 *   // ⇒ {}    (field deleted; empty product pruned)
 *   ```
 *
 * Typical wiring in a host page:
 *
 * ```tsx
 * <DynamicUserInputsForm
 *   schema={schema}
 *   value={context}
 *   onContextChange={(productId, fieldName, value) =>
 *     setContext((prev) => applyContextChange(prev, productId, fieldName, value))
 *   }
 * />
 * ```
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
  if (Object.keys(inputs).length === 0) {
    // Strip empty product entries so the API receives a clean shape.
    delete next[productId];
  }
  return next;
}
