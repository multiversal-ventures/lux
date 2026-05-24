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
  const isPercent = field.type === "percent" || field.type === "percentage";
  const display =
    effective == null
      ? ""
      : isPercent && typeof effective === "number"
        ? String(Math.round(effective * 10000) / 100)
        : String(effective);
  const input = (
    <input
      type="number"
      inputMode="decimal"
      value={display}
      step={field.step ?? (isPercent ? 5 : undefined)}
      min={field.minimum ?? (isPercent ? 0 : undefined)}
      max={field.maximum ?? (isPercent ? 100 : undefined)}
      disabled={disabled}
      placeholder={`${field.type === "currency" ? "$" : field.type === "integer" ? "0" : field.type === "number" ? "0.0" : 
        isPercent ? "0%" : ""}`}
      onChange={(e) => {
        const raw = e.target.value.trim();
        if (raw === "") {
          onChange(null);
          return;
        }
        const parsed = Number(raw);
        if (!Number.isFinite(parsed)) return;
        // Convert percent (UI shows 50) back to fraction (0.5) before storing.
        onChange(isPercent ? parsed / 100 : parsed);
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
    case "percentage":
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

/**
 * Render one schema-driven field with the standard label / required-glyph
 * / renderer-dispatch / hint scaffolding. Shared between the scenario-
 * scoped ``DynamicUserInputsForm`` (where ``productId`` comes from the
 * section) and the create-case ``DynamicUserInputsFormFields`` (which
 * doesn't carry a scenario context at all). Inline errors render below
 * the input when an entry is present in the parent's ``errors`` map.
 */
function renderSchemaField({
  field,
  productId,
  value,
  documentYears,
  disabled,
  classNames,
  slots,
  error,
  onChange,
}: {
  field: UserInputField;
  productId: string;
  value: unknown;
  documentYears?: readonly string[];
  disabled?: boolean;
  classNames?: DynamicUserInputsFormClassNames;
  slots?: DynamicUserInputsFormSlots;
  error?: string;
  onChange: (next: unknown) => void;
}): ReactNode {
  const renderer =
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
      {field.hint && <div className={classNames?.field?.hint}>{field.hint}</div>}
      {error && (
        <div className={classNames?.field?.error} role="alert">
          {error}
        </div>
      )}
    </div>
  );
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
      const onFieldChange = (next: unknown) => {
        for (const pid of members) {
          onContextChange(pid, field.name, next);
        }
      };
      return renderSchemaField({
        field,
        // Pass the representative product so renderers that need a
        // productId (e.g. custom renderers reaching into context) get
        // a stable handle. Fan-out happens in onFieldChange above.
        productId: representative ?? section.group_id,
        value: currentValue,
        documentYears,
        disabled,
        classNames,
        slots,
        onChange: onFieldChange,
      });
    },
    [value, onContextChange, documentYears, disabled, classNames, slots],
  );

  const renderField = useCallback(
    (section: UserInputsSection, field: UserInputField) => {
      const productId = section.product_id;
      const currentValue = value[productId]?.inputs?.[field.name];
      const onFieldChange = (next: unknown) => onContextChange(productId, field.name, next);
      return renderSchemaField({
        field,
        productId,
        value: currentValue,
        documentYears,
        disabled,
        classNames,
        slots,
        onChange: onFieldChange,
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

// ─── Presentational variant for the create-case modal ──────────────────────
//
// ``DynamicUserInputsForm`` above is wired to the refine page's nested
// ``RefinementContext`` blob (per-product ``inputs`` maps) because it
// spans multiple products + shared override groups. The create-case
// modal has a much simpler need: render the rows from a SINGLE
// product's ``initial_required_inputs`` (a flat
// ``UserInputFieldResponse[]`` on the tenant-products list response)
// and let the operator fill them out before the case has any scenario
// or refinement at all.
//
// Sharing the schema-field renderer means both surfaces dispatch on the
// same YAML type slugs, honor the same per-type overrides, and show the
// same unit suffixes / hints. The only divergence is the value shape:
// the create-case form owns a flat ``Record<string, unknown>`` (it has
// no productId-namespacing problem) and surfaces inline error strings
// from the caller's validator. The wrapper that fetches a schema via
// scenario context (see ``DynamicUserInputsForm`` above) keeps working
// unchanged — it can keep its own context state and call this
// presentational variant per-section if a future refactor wants to.

export interface DynamicUserInputsFormFieldsProps {
  /**
   * Flat list of fields, typically
   * ``tenantProduct.initial_required_inputs`` from
   * ``useTenantProducts``. Empty list renders nothing — the caller
   * decides whether to suppress the surrounding section heading.
   */
  fields: readonly UserInputField[];
  /**
   * Operator-supplied values keyed by ``field.name``. The caller owns
   * the map; this component only emits change events.
   */
  value: Record<string, unknown>;
  /** Emitted on every edit. ``key`` is ``field.name``. */
  onChange: (key: string, value: unknown) => void;
  /**
   * Optional product id passed through to custom renderers' ``productId``
   * prop. Defaults to ``"_"`` so the built-in renderers (which don't
   * inspect it) keep working without ceremony. Hosts that wire in
   * product-aware custom renderers should pass the real id.
   */
  productId?: string;
  /**
   * Per-field inline error message, keyed by ``field.name``. Typically
   * the result of ``validateInitialRequiredInputs``. Falsy entries are
   * not rendered.
   */
  errors?: Record<string, string | undefined>;
  /** Available year options for fields with ``derive_options_from: case.document_years``. */
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

/**
 * Validate a ``DynamicUserInputsFormFields`` value blob against its
 * schema. Returns a per-field error map keyed by ``field.name`` —
 * ``Object.keys(...).length === 0`` means the blob is submission-ready.
 *
 * Rules, intentionally minimal because the wire types only declare
 * ``required`` / ``required_at_create`` / ``minimum`` / ``maximum``:
 *
 *   1. ``field.required`` (or ``field.required_at_create`` when
 *      ``requiredAtCreateOnly`` is true) with a missing value → "<Label>
 *      is required".
 *   2. Numeric value below ``field.minimum`` → "<Label> must be at least
 *      <minimum>".
 *   3. Numeric value above ``field.maximum`` → "<Label> must be at most
 *      <maximum>".
 *
 * Living here (next to the renderer) so both lux and gunnr-app share
 * the same definition of "valid" — invariant: a field that the renderer
 * accepts is one this validator can score, and vice versa. The
 * create-case modal calls this on every change to gate the "Create
 * Case" button.
 */
export function validateInitialRequiredInputs(
  fields: readonly UserInputField[],
  value: Record<string, unknown>,
  options?: { requiredAtCreateOnly?: boolean },
): Record<string, string> {
  const requiredAtCreateOnly = options?.requiredAtCreateOnly ?? true;
  const errors: Record<string, string> = {};
  for (const field of fields) {
    const isRequired = requiredAtCreateOnly
      ? Boolean(field.required_at_create)
      : Boolean(field.required);
    const raw = value[field.name];
    const isMissing = raw === undefined || raw === null || raw === "";
    if (isRequired && isMissing) {
      errors[field.name] = `${field.label} is required`;
      continue;
    }
    if (isMissing) continue;
    if (typeof raw === "number" && Number.isFinite(raw)) {
      if (field.minimum != null && raw < field.minimum) {
        errors[field.name] = `${field.label} must be at least ${field.minimum}`;
        continue;
      }
      if (field.maximum != null && raw > field.maximum) {
        errors[field.name] = `${field.label} must be at most ${field.maximum}`;
        continue;
      }
    }
  }
  return errors;
}
