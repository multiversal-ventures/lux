import { useMutation, useQueryClient, type UseMutationResult } from "@tanstack/react-query";
import { getDefaultClient } from "@fenero-ai/lux-core";
import { caseScenariosQueryKey } from "../Scenario/ScenarioProvider.js";

export interface CreateScenarioWithRefinementInput {
  /** Scenario approach (`qualified_mortgage`, `non_qualified_mortgage`, `dscr`, …). */
  approach: string;
  /** Pool version pin; defaults to 0 (latest) when omitted. */
  poolVersion?: number;
  /** Manifest borrower selection — defaults to `null` meaning "all". */
  borrowerIds?: string[] | null;
  /** Manifest document selection — defaults to `null` meaning "all". */
  documentIds?: string[] | null;
  /** Loan product ids selected for this run. */
  productIds: string[];
  /** Spec ids to run (optional — defaults to all enabled specs for the products). */
  specIds?: string[] | null;
  /** Optional manifest note (free-form rationale text). */
  note?: string | null;
  /**
   * When true (default), POST `/start` to kick off the workflow. Set to
   * `false` if the host wants to defer running.
   */
  start?: boolean;
}

export interface CreateScenarioWithRefinementResult {
  scenarioId: string;
  refinementId: string;
  refinementNum: number | null;
  /** Temporal workflow id if `start` was true; `null` otherwise. */
  workflowId: string | null;
}

export type UseCreateScenarioWithRefinementResult = UseMutationResult<
  CreateScenarioWithRefinementResult,
  Error,
  CreateScenarioWithRefinementInput
>;

/**
 * Atomic-feeling helper that runs the three Veritas calls needed to launch
 * a new income calculation:
 *
 * 1. `POST /scenarios` — create the scenario shell
 * 2. `POST /scenarios/{sid}/refinements` — pin the borrower/doc/product/spec
 *    selections into a manifest (this is the new pool the user is configuring)
 * 3. `POST /scenarios/{sid}/refinements/{rid}/start` — kick off the workflow
 *
 * The host only ever sees one mutation, so React Query / SSE invalidation
 * happens in a single place. On success the case-level scenarios cache is
 * invalidated so any `CaseScenarioProvider autoFetch` re-fetches.
 */
export function useCreateScenarioWithRefinement(
  caseId: string | null,
): UseCreateScenarioWithRefinementResult {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateScenarioWithRefinementInput) => {
      if (!caseId) throw new Error("caseId required");
      const client = getDefaultClient();
      const start = input.start ?? true;

      const scenarioResp = await client.createCaseScenario(caseId, {
        approach: input.approach,
        pool_version: input.poolVersion ?? 0,
      });
      const scenarioId = scenarioResp.scenario_id;

      const refinementResp = await client.createCaseScenarioRefinement(caseId, scenarioId, {
        borrower_ids: input.borrowerIds ?? null,
        document_ids: input.documentIds ?? null,
        product_ids: input.productIds,
        spec_ids: input.specIds ?? null,
        note: input.note ?? null,
      });
      const refinementId = refinementResp.refinement_id;

      let workflowId: string | null = null;
      if (start) {
        const startResp = await client.startCaseScenarioRefinement(
          caseId,
          scenarioId,
          refinementId,
        );
        workflowId = startResp.workflow_id;
      }

      return {
        scenarioId,
        refinementId,
        refinementNum: refinementResp.refinement_num ?? null,
        workflowId,
      };
    },
    onSuccess: () => {
      if (caseId) {
        qc.invalidateQueries({ queryKey: caseScenariosQueryKey(caseId) });
        // Partial-prefix invalidation so any host using `['case', caseId, 'scenarios']`
        // (the gunnr legacy key) also refreshes.
        qc.invalidateQueries({ queryKey: ["case", caseId, "scenarios"] });
      }
    },
  });
}
