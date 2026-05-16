import { useCallback, type CSSProperties, type ReactNode } from "react";
import type { components } from "@multiversal-ventures/lux-core";

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
type UserInputsGroupSection = components["schemas"]["UserInputsGroupSectionResponse"];
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
  /** Optional styling specifically for group sections (top-level shared blocks). */
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
  /** Override the empty-state message rendered when the schema has no fields. */
  empty?: ReactNode;
  /** Custom section header for per-product sections. */
  sectionHeader?: (section: UserInputsSection) => ReactNode;
  /** Custom section header for shared override groups (e.g. "Qualified Mortgage"). */
  groupSectionHeader?: (section: UserInputsGroupSection) => ReactNode;
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

/**
 * Effective field value: prior context wins, then the YAML-declared
 * default, then nothing. Keeps the renderers thin — every field type
 * applies the same precedence so the form mirrors what qualify will
 * actually use at evaluation time.
 *
 * Renderers compute this once per render so a fresh scenario (no prior
 * context) still surfaces the spec author's default in the UI. That
 * answers the operator's question "what value will be used if I submit
 * without touching this field?" with the answer "the one you see".
 */
function resolveEffectiveValue(field: UserInputField, value: unknown): unknown {
  if (value !== null && value !== undefined && value !== "") return value;
  return field.default ?? null;
}

/**
 * Render-time symbol for the YAML ``unit:`` declaration.
 *
 * Keeps the spec YAML free of presentation quirks: spec authors write
 * the canonical unit slug (``percent``, ``months``, ``usd_per_month``)
 * and the form layer maps it to a short, human-friendly suffix. Unknown
 * slugs pass through verbatim so a one-off unit (e.g. a future
 * ``basis_points``) renders something instead of silently dropping —
 * adding it to the table later is a label tweak, not a contract change.
 */
function unitSuffix(unit: string | null | undefined): string | null {
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

function NumericField({ field, value, disabled, classNames, onChange }: DynamicUserInputFieldRendererProps) {
  const effective = resolveEffectiveValue(field, value);
  const display =
    effective == null
      ? ""
      : field.type === "percent" && typeof effective === "number"
        ? String(Math.round(effective * 10000) / 100)
        : String(effective);
  const input = (
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

  const suffix = unitSuffix(field.unit);
  if (!suffix) return input;

  // Inline-flex wrapper so the suffix sits next to the input on the same
  // baseline. Inline styles cover the no-host-CSS case; ``inputGroup``
  // and ``inputSuffix`` className hooks let hosts (e.g. Gunnr) restyle
  // without forking the renderer. Suffix is ``aria-hidden`` because the
  // unit is already part of the field's accessible label/hint.
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

function BooleanField({ field, value, disabled, classNames, onChange }: DynamicUserInputFieldRendererProps) {
  // Boolean inputs treat the YAML default identically to a prior context
  // value — checkbox state mirrors what qualify would evaluate.
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

function StringField({ field, value, disabled, classNames, onChange }: DynamicUserInputFieldRendererProps) {
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
  const groupSections = schema?.groups ?? [];
  const productSections = schema?.products ?? [];
  const hasAnyField =
    groupSections.some((g) => (g.fields ?? []).length > 0) ||
    productSections.some((s) => (s.fields ?? []).length > 0);

  // Group-field write: fan out to every product the group applies to so
  // the qualify activity sees the value under each member's manifest
  // context. Reads are still per-product, but all members share the same
  // value at steady state — we read from the first member as the
  // representative (the writes keep them in sync).
  const renderGroupField = useCallback(
    (section: UserInputsGroupSection, field: UserInputField) => {
      const members = section.applies_to_products ?? [];
      const representative = members[0];
      const currentValue = representative != null ? value[representative]?.inputs?.[field.name] : undefined;
      const renderer =
        slots?.renderers?.[field.type] ?? slots?.defaultRenderer ?? pickDefaultRenderer(field);
      const onFieldChange = (next: unknown) => {
        for (const pid of members) {
          onContextChange(pid, field.name, next);
        }
      };
      return (
        <div key={`${section.group_id}.${field.name}`} className={classNames?.field?.root}>
          <label className={classNames?.field?.label}>
            {field.label}
            {field.required && <span aria-label="required"> *</span>}
          </label>
          {renderer({
            field,
            // Pass the representative product so renderers that need a
            // productId (e.g. custom renderers reaching into context) get
            // a stable handle. Fan-out happens in onFieldChange above.
            productId: representative ?? section.group_id,
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
      {/* Shared override groups (e.g. QM Y1/Y2 pickers) render FIRST so
          operators see the "applies-to-many" knobs above per-product
          knobs that vary in scope. */}
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
