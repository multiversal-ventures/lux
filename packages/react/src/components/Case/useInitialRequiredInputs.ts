import { useCallback, useEffect, useMemo, useState } from "react";
import type { RefinementContext } from "../Refinement/DynamicUserInputsForm.js";
import type { TenantProduct } from "./useTenantProducts.js";
import { validateInitialRequiredInputs } from "../Refinement/DynamicUserInputsForm.js";

// ─── Pure helper ────────────────────────────────────────────────────────────

/**
 * Convert a per-product ``{ fieldName: value }`` map into the
 * ``RefinementContext`` wire shape ``{ [productId]: { inputs: { ... } } }``
 * that ``useCreateScenarioWithRefinement`` (and the qualify activity)
 * expect on the refinement manifest. Null / undefined / empty-string values
 * are stripped so the payload stays minimal.
 *
 * Exported as a standalone so callers that don't need the full hook can
 * do a one-off conversion without extra ceremony.
 */
export function toRefinementContext(
  values: Record<string, Record<string, unknown>>,
): RefinementContext {
  const out: RefinementContext = {};
  for (const [pid, fields] of Object.entries(values)) {
    const inputs: Record<string, unknown> = {};
    for (const [name, v] of Object.entries(fields)) {
      if (v !== undefined && v !== null && v !== "") inputs[name] = v;
    }
    if (Object.keys(inputs).length > 0) out[pid] = { inputs };
  }
  return out;
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export interface UseInitialRequiredInputsResult {
  /**
   * Raw per-product input values, keyed ``{ [productId]: { [fieldName]: value } }``.
   * Pass ``inputs[productId]`` as the ``value`` prop of
   * ``<DynamicUserInputsFormFields>``.
   */
  inputs: Record<string, Record<string, unknown>>;
  /** Update all field values for one product at once. */
  setInputs: (productId: string, values: Record<string, unknown>) => void;
  /**
   * Per-product validation errors. An empty object for a product means all
   * its fields are valid. Use ``isValid`` for the aggregate gate.
   */
  errors: Record<string, Record<string, string>>;
  /** True iff every product with ``required_at_create`` fields is fully valid. */
  isValid: boolean;
  /**
   * Ready-to-send ``RefinementContext`` — pass directly as the ``context``
   * arg of ``useCreateScenarioWithRefinement.mutateAsync``.
   * Is ``null`` (not ``{}``) when there are no qualifying inputs so the
   * backend treats the absence correctly.
   */
  context: RefinementContext | null;
}

/**
 * Centralises all required-at-create input logic so consumers never have to
 * manage the state, default-seeding, validation, or wire-shape conversion
 * themselves.
 *
 * Usage:
 * ```tsx
 * const { inputs, setInputs, errors, isValid, context } =
 *   useInitialRequiredInputs(products, selectedProductIds);
 *
 * // Render one form section per product that declares fields:
 * <DynamicUserInputsFormFields
 *   fields={product.initial_required_inputs}
 *   value={inputs[product.product_id] ?? {}}
 *   onChange={(k, v) => setInputs(product.product_id, { ...inputs[product.product_id], [k]: v })}
 *   errors={errors[product.product_id]}
 * />
 *
 * // Gate the submit button:
 * <button disabled={!isValid}>Create Case</button>
 *
 * // Forward to the scenario:
 * navigate('/case/{id}/new-scenario', { state: { initialContext: context } });
 * ```
 */
export function useInitialRequiredInputs(
  products: TenantProduct[],
  selectedProductIds: string[],
): UseInitialRequiredInputsResult {
  const productById = useMemo(() => {
    const m = new Map<string, TenantProduct>();
    for (const p of products) m.set(p.product_id, p);
    return m;
  }, [products]);

  const productsNeedingInputs = useMemo(() => {
    const out: { product: TenantProduct; fields: TenantProduct["initial_required_inputs"] }[] = [];
    for (const pid of selectedProductIds) {
      const product = productById.get(pid);
      const fields = product?.initial_required_inputs ?? [];
      if (product && fields.length > 0) out.push({ product, fields });
    }
    return out;
  }, [selectedProductIds, productById]);

  const [rawInputs, setRawInputs] = useState<Record<string, Record<string, unknown>>>({});

  // Sync: drop slices for deselected products; seed YAML defaults for newly
  // selected products. Without seeding, a field with a visible default would
  // still be treated as "missing" by the validator — the operator would see
  // a populated field next to a spurious "required" error.
  useEffect(() => {
    setRawInputs((prev) => {
      const next: Record<string, Record<string, unknown>> = {};
      for (const pid of selectedProductIds) {
        const product = productById.get(pid);
        const fields = product?.initial_required_inputs ?? [];
        if (fields.length === 0) continue;
        const existing = prev[pid] ?? {};
        const seeded: Record<string, unknown> = { ...existing };
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
      // Value-based equality check: if every product slice has the same
      // keys and the same values, return `prev` so React bails out. A
      // reference check (``prev[k] === next[k]``) never matched because
      // ``seeded`` is freshly spread every iteration — the old bail-out
      // never fired and downstream memos / effects churned on every
      // selectedProductIds re-render.
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
  }, [selectedProductIds, productById]);

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

  return { inputs: rawInputs, setInputs, errors, isValid, context };
}
