import { useCallback, useEffect, useMemo, useReducer } from "react";
import type { components } from "@fenero/lux-core";
import {
  resolveProductCategory,
  type ProductCategory,
} from "./productCategory.js";
import { validateTaxYears } from "./TaxYearOverridePicker.js";

type ScenarioDetailResponse = components["schemas"]["ScenarioDetailResponse"];
type RefinementResponse = components["schemas"]["RefinementResponse"];

/**
 * Canonical refinement-form state. Every input on the refine page maps to
 * one field here; pickers stay controlled by reading + dispatching against
 * this state.
 *
 * `userInputs` is a free-form bag for policy-engine overrides that don't
 * yet have first-class fields here (today: `expense_factor`).
 */
export interface RefinementFormState {
  selectedBorrowerIds: string[];
  selectedDocumentIds: string[];
  selectedProductIds: string[];
  /** Year 1 (Most Recent) tax-year override. `null` = auto-detect. */
  y1Override: string | null;
  /** Year 2 tax-year override. */
  y2Override: string | null;
  /** Non-QM bank statement months. `null` = auto-detect from documents. */
  statementPeriodMonths: number | null;
  /** Extra policy parameter bag (e.g. `expense_factor`). */
  userInputs: Record<string, unknown>;
  /** Optional free-text note saved on the resulting manifest. */
  note: string;
  /** Local-only counter — hosts hooking up an extraction editor can bump this. */
  extractionEditCount: number;
}

type Action =
  | { type: "SET_BORROWERS"; ids: string[] }
  | { type: "SET_DOCUMENTS"; ids: string[] }
  | { type: "SET_PRODUCTS"; ids: string[] }
  | { type: "SET_Y1"; value: string | null }
  | { type: "SET_Y2"; value: string | null }
  | { type: "SET_STATEMENT_MONTHS"; value: number | null }
  | { type: "SET_USER_INPUT"; key: string; value: unknown }
  | { type: "SET_NOTE"; value: string }
  | { type: "BUMP_EXTRACTION_EDITS"; delta?: number }
  | { type: "RESET"; state: RefinementFormState };

function reducer(state: RefinementFormState, action: Action): RefinementFormState {
  switch (action.type) {
    case "SET_BORROWERS":
      return { ...state, selectedBorrowerIds: action.ids };
    case "SET_DOCUMENTS":
      return { ...state, selectedDocumentIds: action.ids };
    case "SET_PRODUCTS":
      return { ...state, selectedProductIds: action.ids };
    case "SET_Y1":
      return { ...state, y1Override: action.value };
    case "SET_Y2":
      return { ...state, y2Override: action.value };
    case "SET_STATEMENT_MONTHS":
      return { ...state, statementPeriodMonths: action.value };
    case "SET_USER_INPUT": {
      const next = { ...state.userInputs };
      if (action.value === null || action.value === undefined) {
        delete next[action.key];
      } else {
        next[action.key] = action.value;
      }
      return { ...state, userInputs: next };
    }
    case "SET_NOTE":
      return { ...state, note: action.value };
    case "BUMP_EXTRACTION_EDITS":
      return { ...state, extractionEditCount: state.extractionEditCount + (action.delta ?? 1) };
    case "RESET":
      return action.state;
    default:
      return state;
  }
}

/**
 * Seed values for the form — applied when the scenario detail loads.
 * Hosts that want to seed from a prior refinement can override here.
 */
export interface RefinementFormSeed {
  borrowerIds?: string[];
  documentIds?: string[];
  productIds?: string[];
  y1Override?: string | null;
  y2Override?: string | null;
  statementPeriodMonths?: number | null;
  userInputs?: Record<string, unknown>;
  note?: string;
}

function emptyState(seed: RefinementFormSeed = {}): RefinementFormState {
  return {
    selectedBorrowerIds: seed.borrowerIds ?? [],
    selectedDocumentIds: seed.documentIds ?? [],
    selectedProductIds: seed.productIds ?? [],
    y1Override: seed.y1Override ?? null,
    y2Override: seed.y2Override ?? null,
    statementPeriodMonths: seed.statementPeriodMonths ?? null,
    userInputs: seed.userInputs ?? {},
    note: seed.note ?? "",
    extractionEditCount: 0,
  };
}

/**
 * Bundle the parameter-override fields into a `user_inputs` blob keyed
 * by the names the qualify activity reads. Empty fields are omitted so
 * downstream "is this overridden?" checks stay clean.
 */
export function toUserInputsPayload(state: RefinementFormState): Record<string, unknown> | null {
  const out: Record<string, unknown> = { ...state.userInputs };
  if (state.y1Override) out.y1_override = state.y1Override;
  if (state.y2Override) out.y2_override = state.y2Override;
  if (state.statementPeriodMonths != null) out.statement_period_months = state.statementPeriodMonths;
  return Object.keys(out).length === 0 ? null : out;
}

function arraysEqualUnordered(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  const sa = [...a].sort();
  const sb = [...b].sort();
  for (let i = 0; i < sa.length; i += 1) {
    if (sa[i] !== sb[i]) return false;
  }
  return true;
}

export interface RefinementFormValidation {
  valid: boolean;
  errors: string[];
}

export interface UseRefinementFormResult {
  state: RefinementFormState;
  productCategory: ProductCategory;
  /** True when the form differs from the seed baseline. */
  isDirty: boolean;
  /** Aggregated validation across all fields. */
  validation: RefinementFormValidation;

  setBorrowers: (ids: string[]) => void;
  setDocuments: (ids: string[]) => void;
  setProducts: (ids: string[]) => void;
  setY1Override: (v: string | null) => void;
  setY2Override: (v: string | null) => void;
  setStatementPeriodMonths: (v: number | null) => void;
  setUserInput: (key: string, value: unknown) => void;
  setNote: (v: string) => void;
  bumpExtractionEdits: (delta?: number) => void;
  reset: (seed?: RefinementFormSeed) => void;
}

export interface UseRefinementFormOptions {
  scenario?: ScenarioDetailResponse | null;
  /** Refinement to seed from. When omitted, hosts can pass `seed` directly. */
  baseRefinement?: RefinementResponse | null;
  seed?: RefinementFormSeed;
}

/**
 * Hook that owns the refinement form's state machine.
 *
 * - Initial state derived from the scenario + base refinement (host can
 *   override via `seed`).
 * - Re-seeds when the scenario or base refinement identity changes (i.e.
 *   user switches to a different scenario in a multi-pane layout).
 * - Tracks dirtiness vs the seed baseline.
 * - Aggregates validation from the policy-specific pickers.
 */
export function useRefinementForm(
  options: UseRefinementFormOptions = {},
): UseRefinementFormResult {
  const { scenario, baseRefinement, seed } = options;

  const baselineSeed = useMemo<RefinementFormSeed>(() => {
    const fromRefinement = baseRefinement
      ? {
          // RefinementResponse.identities carries id+borrower_class; the
          // selected-borrower-ids for the form are best seeded by the host
          // (they live on the manifest's borrower_ids, not on the response
          // shape). Default to empty here; hosts pass `seed.borrowerIds`
          // when reseeding from a prior refinement.
          borrowerIds: [] as string[],
          documentIds: (baseRefinement.documents ?? []).map((d) => d.id),
          productIds: baseRefinement.product_ids ?? [],
          userInputs: {} as Record<string, unknown>,
          note: baseRefinement.note ?? "",
        }
      : {};
    return { ...fromRefinement, ...(seed ?? {}) };
  }, [baseRefinement, seed]);

  const [state, dispatch] = useReducer(reducer, emptyState(baselineSeed));

  // Re-seed when the scenario or base refinement identity changes.
  const reseedKey = `${scenario?.scenario_id ?? ""}|${baseRefinement?.refinement_id ?? ""}`;
  useEffect(() => {
    dispatch({ type: "RESET", state: emptyState(baselineSeed) });
    // The seed itself is rebuilt from the dependencies above; we re-trigger
    // only on identity change to avoid stomping in-flight edits when callers
    // pass new option objects with structurally-equal payloads.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reseedKey]);

  const productCategory = useMemo<ProductCategory>(() => {
    const approach = scenario?.approach ?? null;
    const productIds = state.selectedProductIds.length > 0
      ? state.selectedProductIds
      : scenario?.rendering_hints?.effective_product_ids ?? [];
    return resolveProductCategory(approach, productIds);
  }, [scenario?.approach, scenario?.rendering_hints?.effective_product_ids, state.selectedProductIds]);

  const baseline = useMemo(() => emptyState(baselineSeed), [baselineSeed]);

  const isDirty = useMemo(() => {
    if (state.extractionEditCount > 0) return true;
    if (state.note !== baseline.note) return true;
    if (state.y1Override !== baseline.y1Override) return true;
    if (state.y2Override !== baseline.y2Override) return true;
    if (state.statementPeriodMonths !== baseline.statementPeriodMonths) return true;
    if (!arraysEqualUnordered(state.selectedBorrowerIds, baseline.selectedBorrowerIds)) return true;
    if (!arraysEqualUnordered(state.selectedDocumentIds, baseline.selectedDocumentIds)) return true;
    if (!arraysEqualUnordered(state.selectedProductIds, baseline.selectedProductIds)) return true;
    const ak = Object.keys(state.userInputs).sort();
    const bk = Object.keys(baseline.userInputs).sort();
    if (ak.length !== bk.length) return true;
    for (const k of ak) {
      if (state.userInputs[k] !== baseline.userInputs[k]) return true;
    }
    return false;
  }, [state, baseline]);

  const validation = useMemo<RefinementFormValidation>(() => {
    const errors: string[] = [];

    // Tax-year override consistency (QM + 1099 share this constraint).
    if (productCategory === "qm" || productCategory === "1099" || productCategory === "dscr") {
      const tax = validateTaxYears(state.y1Override, state.y2Override);
      if (!tax.valid && tax.error) errors.push(tax.error);
    }

    return { valid: errors.length === 0, errors };
  }, [state.y1Override, state.y2Override, productCategory]);

  const setBorrowers = useCallback((ids: string[]) => dispatch({ type: "SET_BORROWERS", ids }), []);
  const setDocuments = useCallback((ids: string[]) => dispatch({ type: "SET_DOCUMENTS", ids }), []);
  const setProducts = useCallback((ids: string[]) => dispatch({ type: "SET_PRODUCTS", ids }), []);
  const setY1Override = useCallback(
    (v: string | null) => dispatch({ type: "SET_Y1", value: v }),
    [],
  );
  const setY2Override = useCallback(
    (v: string | null) => dispatch({ type: "SET_Y2", value: v }),
    [],
  );
  const setStatementPeriodMonths = useCallback(
    (v: number | null) => dispatch({ type: "SET_STATEMENT_MONTHS", value: v }),
    [],
  );
  const setUserInput = useCallback(
    (key: string, value: unknown) => dispatch({ type: "SET_USER_INPUT", key, value }),
    [],
  );
  const setNote = useCallback((v: string) => dispatch({ type: "SET_NOTE", value: v }), []);
  const bumpExtractionEdits = useCallback(
    (delta?: number) => dispatch({ type: "BUMP_EXTRACTION_EDITS", delta }),
    [],
  );
  const reset = useCallback(
    (nextSeed?: RefinementFormSeed) =>
      dispatch({ type: "RESET", state: emptyState(nextSeed ?? baselineSeed) }),
    [baselineSeed],
  );

  return {
    state,
    productCategory,
    isDirty,
    validation,
    setBorrowers,
    setDocuments,
    setProducts,
    setY1Override,
    setY2Override,
    setStatementPeriodMonths,
    setUserInput,
    setNote,
    bumpExtractionEdits,
    reset,
  };
}
