import { useCallback, useEffect, useMemo, useState } from "react";
import type { TenantProduct } from "../Case/useTenantProducts.js";
import type { RefinementContext } from "../Refinement/DynamicUserInputsForm.js";
import { toRefinementContext } from "../Case/useInitialRequiredInputs.js";
import { validateInitialRequiredInputs } from "../Refinement/DynamicUserInputsForm.js";
import type { UseInitialRequiredInputsResult } from "../Case/useInitialRequiredInputs.js";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MissingProductInputs {
  product: TenantProduct;
  fields: TenantProduct["initial_required_inputs"];
}

export interface UseScenarioRequiredInputsResult extends UseInitialRequiredInputsResult {
  /**
   * Products that still have at least one ``initial_required_inputs`` field
   * absent from ``existingContext[productId]?.inputs``. Empty when all inputs
   * are already present — callers should render nothing in that case.
   */
  missingProducts: MissingProductInputs[];
  /**
   * Convenience flag: ``true`` iff at least one product has missing inputs.
   * Guards conditional rendering without needing to inspect the array.
   */
  hasMissing: boolean;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Detects products with incomplete ``required_at_create`` inputs relative to
 * an existing refinement context and manages a re-supply form for those
 * products.
 *
 * This is the "summary page" counterpart to ``useInitialRequiredInputs``
 * (which targets the create-case modal). Key differences:
 *
 * 1. Compares ``initial_required_inputs`` against an *existing* refinement
 *    context to determine which products still have missing inputs.
 * 2. Pre-seeds the form with any values already present in that context so
 *    the operator sees their previous entries, not a blank form.
 * 3. Surfaces ``hasMissing`` and ``missingProducts`` alongside the standard
 *    ``inputs`` / ``errors`` / ``isValid`` / ``context`` tuple.
 *
 * Core logic (``toRefinementContext`` + ``validateInitialRequiredInputs``) is
 * reused from ``useInitialRequiredInputs`` — no duplication.
 *
 * Usage:
 * ```tsx
 * const { hasMissing, missingProducts, inputs, setInputs, errors, isValid, context } =
 *   useScenarioRequiredInputs(products, selectedProductIds, existingContext);
 *
 * if (!hasMissing) return null;
 *
 * return missingProducts.map(({ product, fields }) => (
 *   <DynamicUserInputsFormFields
 *     key={product.product_id}
 *     fields={fields}
 *     value={inputs[product.product_id] ?? {}}
 *     onChange={(k, v) =>
 *       setInputs(product.product_id, { ...inputs[product.product_id], [k]: v })
 *     }
 *     errors={errors[product.product_id]}
 *   />
 * ));
 * ```
 */
export function useScenarioRequiredInputs(
  products: TenantProduct[],
  selectedProductIds: string[],
  existingContext: RefinementContext | null,
): UseScenarioRequiredInputsResult {
  const productById = useMemo(() => {
    const m = new Map<string, TenantProduct>();
    for (const p of products) m.set(p.product_id, p);
    return m;
  }, [products]);

  // All selected products that declare any initial_required_inputs fields.
  const productsNeedingInputs = useMemo(() => {
    const out: MissingProductInputs[] = [];
    for (const pid of selectedProductIds) {
      const product = productById.get(pid);
      const fields = product?.initial_required_inputs ?? [];
      if (product && fields.length > 0) out.push({ product, fields });
    }
    return out;
  }, [selectedProductIds, productById]);

  // Subset: products where existingContext is missing at least one field that
  // is actually required given the current inputs. A field with a
  // ``required_when`` predicate is required only when its sibling input matches
  // (e.g. Purchase Price is required only for transaction_type == purchase) —
  // refis must not be flagged for an absent purchase price.
  const missingProducts = useMemo(() => {
    return productsNeedingInputs.filter(({ product, fields }) => {
      const existing = existingContext?.[product.product_id]?.inputs ?? {};
      return fields.some((f) => {
        const requiredWhen = f.required_when;
        const isRequired = requiredWhen?.field
          ? existing[requiredWhen.field] === requiredWhen.equals
          : Boolean(f.required_at_create);
        if (!isRequired) return false;
        const v = existing[f.name];
        return v === undefined || v === null || v === "";
      });
    });
  }, [productsNeedingInputs, existingContext]);

  const hasMissing = missingProducts.length > 0;

  // Sync inputs: seed from existingContext (highest priority), then YAML
  // defaults for any fields still undefined. Drop slices for deselected
  // products to stay in sync with selectedProductIds.
  //
  // Value-based stable-reference guard: even when `productById` is a new
  // Map instance (e.g. `products` array was recreated by the caller), if
  // the resulting field values haven't changed we return `prev` so React
  // skips the re-render.

  const [rawInputs, setRawInputs] = useState<Record<string, Record<string, unknown>>>({});

  useEffect(() => {
    setRawInputs((prev) => {
      const next: Record<string, Record<string, unknown>> = {};
      for (const pid of selectedProductIds) {
        const product = productById.get(pid);
        const fields = product?.initial_required_inputs ?? [];
        if (fields.length === 0) continue;

        const fromContext = existingContext?.[pid]?.inputs ?? {};
        const fromPrev = prev[pid] ?? {};
        const seeded: Record<string, unknown> = { ...fromPrev };

        // Pre-fill from existing context (takes priority over YAML defaults)
        for (const [k, v] of Object.entries(fromContext)) {
          if (v !== undefined && v !== null && v !== "") seeded[k] = v;
        }

        // Seed YAML defaults for fields still undefined
        for (const field of fields) {
          if (
            seeded[field.name] === undefined &&
            field.default !== undefined &&
            field.default !== null
          ) {
            seeded[field.name] = field.default;
          }
        }
        next[pid] = seeded;
      }

      // Value-based equality check: if all product input maps have the same
      // keys and values, return `prev` so React bails out without a re-render.
      // (Reference equality would always fail because `seeded` is a new object.)
      const prevKeys = Object.keys(prev).sort();
      const nextKeys = Object.keys(next).sort();
      if (
        prevKeys.length !== nextKeys.length ||
        !prevKeys.every((k, i) => k === nextKeys[i])
      ) {
        return next;
      }
      for (const k of nextKeys) {
        const pf = prev[k] ?? {};
        const nf = next[k];
        const pfk = Object.keys(pf).sort();
        const nfk = Object.keys(nf).sort();
        if (
          pfk.length !== nfk.length ||
          !pfk.every((fk, i) => fk === nfk[i] && pf[fk] === nf[fk])
        ) {
          return next;
        }
      }
      return prev;
    });
  }, [selectedProductIds, productById, existingContext]);

  const setInputs = useCallback(
    (productId: string, values: Record<string, unknown>) => {
      setRawInputs((prev) => ({ ...prev, [productId]: values }));
    },
    [],
  );

  const errors = useMemo(() => {
    const out: Record<string, Record<string, string>> = {};
    for (const { product, fields } of productsNeedingInputs) {
      out[product.product_id] = validateInitialRequiredInputs(
        fields,
        rawInputs[product.product_id] ?? {},
      );
    }
    return out;
  }, [productsNeedingInputs, rawInputs]);

  const isValid = useMemo(
    () =>
      productsNeedingInputs.every(
        ({ product }) => Object.keys(errors[product.product_id] ?? {}).length === 0,
      ),
    [productsNeedingInputs, errors],
  );

  const context = useMemo(() => {
    const ctx = toRefinementContext(rawInputs);
    return Object.keys(ctx).length > 0 ? ctx : null;
  }, [rawInputs]);

  return { inputs: rawInputs, setInputs, errors, isValid, context, missingProducts, hasMissing };
}
