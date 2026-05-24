import { useState, type CSSProperties } from "react";
import type { TenantProduct } from "../Case/useTenantProducts.js";
import type { RefinementContext } from "../Refinement/DynamicUserInputsForm.js";
import { DynamicUserInputsFormFields } from "../Refinement/DynamicUserInputsForm.js";
import { useScenarioRequiredInputs } from "./useScenarioRequiredInputs.js";

// ─── Props ────────────────────────────────────────────────────────────────────

export interface ScenarioRequiredInputsBannerProps {
  /**
   * Full product catalog — same list you'd pass to ``<ProductPicker>``.
   * Typically comes from ``useTenantProducts``.
   */
  products: TenantProduct[];
  /**
   * Product IDs active for this scenario (``effectiveLoanProductIds`` or
   * ``scenario.loan_product_ids``).
   */
  selectedProductIds: string[];
  /**
   * Inputs already persisted on the active refinement's manifest context.
   * Shape: ``{ [productId]: { inputs: { [fieldName]: value } } }``.
   * Pass ``null`` when no refinement exists yet or context is unavailable.
   */
  existingContext: RefinementContext | null;
  /**
   * Called when the operator clicks "Save & Re-qualify" and the form is
   * valid. Receives the new ``RefinementContext`` that should be forwarded
   * to ``createRefinement({ ..., context: newContext, start: true })``.
   *
   * If the handler returns a Promise, the button shows a "Saving…" label
   * until it settles.
   */
  onSubmit: (context: RefinementContext) => Promise<void> | void;
  /** Optional extra className applied to the banner root element. */
  className?: string;
}

// ─── Styles (inline, consistent with ScenarioNarrativeSummary) ──────────────

const bannerStyle: CSSProperties = {
  border: "1px solid #f59e0b",
  borderRadius: "0.375rem",
  backgroundColor: "#fffbeb",
  padding: "0.75rem 1rem",
};

const headingStyle: CSSProperties = {
  fontWeight: 600,
  color: "#92400e",
  fontSize: "0.875rem",
  margin: 0,
};

const subCopyStyle: CSSProperties = {
  color: "#92400e",
  fontSize: "0.8125rem",
  marginTop: "0.25rem",
  marginBottom: "0.875rem",
};

const productLabelStyle: CSSProperties = {
  fontWeight: 500,
  color: "#1e293b",
  fontSize: "0.875rem",
  margin: "0.75rem 0 0.375rem",
};

function makeButtonStyle(enabled: boolean): CSSProperties {
  return {
    marginTop: "0.875rem",
    padding: "0.375rem 0.875rem",
    backgroundColor: enabled ? "#d97706" : "#e5e7eb",
    color: enabled ? "#ffffff" : "#9ca3af",
    border: "none",
    borderRadius: "0.375rem",
    fontWeight: 500,
    fontSize: "0.875rem",
    cursor: enabled ? "pointer" : "not-allowed",
    display: "inline-flex",
    alignItems: "center",
    gap: "0.375rem",
    lineHeight: "1.4",
  };
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Amber warning banner that renders an inline form when a scenario has
 * products with ``required_at_create`` inputs not yet supplied.
 *
 * Renders **nothing** when all required inputs are already present in
 * ``existingContext`` (``hasMissing === false``), so it is safe to mount
 * unconditionally on every scenario summary page.
 *
 * Typical wiring:
 * ```tsx
 * <ScenarioRequiredInputsBanner
 *   products={tenantProducts}
 *   selectedProductIds={effectiveLoanProductIds}
 *   existingContext={existingContext}
 *   onSubmit={async (ctx) => {
 *     await createRefinement({
 *       scenarioId,
 *       productIds: effectiveLoanProductIds,
 *       context: ctx,
 *       start: true,
 *     });
 *   }}
 * />
 * ```
 */
export function ScenarioRequiredInputsBanner({
  products,
  selectedProductIds,
  existingContext,
  onSubmit,
  className,
}: ScenarioRequiredInputsBannerProps) {
  const {
    missingProducts,
    inputs,
    setInputs,
    errors,
    isValid,
    context,
    hasMissing,
  } = useScenarioRequiredInputs(products, selectedProductIds, existingContext);

  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!hasMissing) return null;

  const canSubmit = isValid && !isSubmitting;

  const handleSubmit = async () => {
    if (!canSubmit || !context) return;
    setIsSubmitting(true);
    try {
      await onSubmit(context);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={bannerStyle} className={className}>
      <div style={headingStyle}>Required Inputs Needed</div>
      <div style={subCopyStyle}>
        The following inputs are required to complete the calculation.
      </div>

      {missingProducts.map(({ product, fields }) => (
        <div key={product.product_id}>
          {missingProducts.length > 1 && (
            <div style={productLabelStyle}>{product.display_name}</div>
          )}
          <DynamicUserInputsFormFields
            fields={fields}
            value={inputs[product.product_id] ?? {}}
            onChange={(k, v) =>
              setInputs(product.product_id, {
                ...(inputs[product.product_id] ?? {}),
                [k]: v,
              })
            }
            productId={product.product_id}
            errors={errors[product.product_id]}
          />
        </div>
      ))}

      <button
        style={makeButtonStyle(canSubmit)}
        disabled={!canSubmit}
        onClick={handleSubmit}
        type="button"
      >
        {isSubmitting ? "Saving…" : "Save & Re-qualify"}
      </button>
    </div>
  );
}
