import { useMutation, useQueryClient, type UseMutationResult } from "@tanstack/react-query";
import { getDefaultClient, type components } from "@multiversal-ventures/lux-core";
import { caseScenariosQueryKey } from "../Scenario/ScenarioProvider.js";

type CreateRefinementRequest = components["schemas"]["CreateRefinementRequest"];
type CreateRefinementResponse = components["schemas"]["CreateRefinementResponse"];

export interface CreateRefinementInput {
  scenarioId: string;
  borrowerIds?: string[] | null;
  documentIds?: string[] | null;
  productIds?: string[] | null;
  specIds?: string[] | null;
  note?: string | null;
  /**
   * Operator-supplied input overrides namespaced by product:
   *
   * ```
   * {
   *   "<product_id>": { inputs: { "<field>": <value>, ... } }
   * }
   * ```
   *
   * Persisted on the resulting manifest's `context` JSONB. The qualify
   * activity merges each product's `inputs` block into that product's
   * spec evaluation. The accepted keys per product are declared in the
   * spec YAML's `user_input:` block — see `useUserInputsSchema()` for the
   * canonical schema.
   */
  context?: Record<string, { inputs?: Record<string, unknown> }> | null;
  /** Auto-start the refinement workflow after create. Default `true`. */
  start?: boolean;
}

export interface CreateRefinementResult {
  refinementId: string;
  refinementNum: number | null;
  workflowId: string | null;
}

export type UseCreateRefinementResult = UseMutationResult<
  CreateRefinementResult,
  Error,
  CreateRefinementInput
>;

/**
 * Mutation for creating + (optionally) starting a refinement on an
 * existing scenario.
 *
 * Differs from `useCreateScenarioWithRefinement` in that this assumes the
 * scenario already exists — the typical "Refine" page flow. Invalidates
 * the case-scenarios cache so any `CaseScenarioProvider autoFetch`
 * consumer picks up the new refinement immediately.
 */
export function useCreateRefinement(caseId: string | null): UseCreateRefinementResult {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateRefinementInput) => {
      if (!caseId) throw new Error("caseId required");
      const client = getDefaultClient();
      const start = input.start ?? true;

      const body: CreateRefinementRequest = {
        borrower_ids: input.borrowerIds ?? null,
        document_ids: input.documentIds ?? null,
        product_ids: input.productIds ?? null,
        spec_ids: input.specIds ?? null,
        note: input.note ?? null,
        context: input.context ?? null,
      };

      const created: CreateRefinementResponse = await client.createCaseScenarioRefinement(
        caseId,
        input.scenarioId,
        body,
      );

      let workflowId: string | null = null;
      if (start) {
        const startResp = await client.startCaseScenarioRefinement(
          caseId,
          input.scenarioId,
          created.refinement_id,
        );
        workflowId = startResp.workflow_id;
      }

      return {
        refinementId: created.refinement_id,
        refinementNum: created.refinement_num ?? null,
        workflowId,
      };
    },
    onSuccess: () => {
      if (caseId) {
        qc.invalidateQueries({ queryKey: caseScenariosQueryKey(caseId) });
        qc.invalidateQueries({ queryKey: ["case", caseId, "scenarios"] });
      }
    },
  });
}
