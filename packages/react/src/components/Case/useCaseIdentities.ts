import { useMemo } from "react";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { getDefaultClient, type VeritasEntityGroup, type components } from "@multiversal-ventures/lux-core";
import { useMaybeCaseScenarioContext } from "../Scenario/ScenarioProvider.js";

type IdentityInfo = components["schemas"]["IdentityInfo"];

/**
 * Normalized identity row. Comes from two possible sources:
 *
 * 1. **scenario-derived** — the latest completed scenario's first refinement
 *    has classified `identities[]` (borrower/business/employer/etc.) already.
 *    Preferred when present because it carries `borrower_class` + `role`.
 * 2. **entity-derived** — falls back to `GET /api/cases/{id}/entities` so
 *    the picker works pre-scenario. Row shape stays identical via the
 *    `entityToIdentity` normalizer.
 *
 * Both sources map to the same `CaseIdentityRow` so the picker UI never
 * has to branch on origin.
 */
export interface CaseIdentityRow {
  /** Stable id (entity_group_id or identity id depending on source). */
  id: string;
  /** Display name (`"Acme Corp"`, `"Jane Q. Public"`). */
  name: string;
  /** Underwriter-facing role label (e.g. `borrower`, `employer`, `spouse`). */
  role: string;
  /** Coarse entity type slug (`person`, `partnership`, `scorp`, `employer`, …). */
  entityType: string;
  /** Whether this identity needs operator review before relying on it. */
  needsReview: boolean;
  /** Source of this row \u2014 useful for diagnostics + tests. */
  origin: "scenario" | "entities";
  /** Raw payload of whichever source produced this row. */
  raw: IdentityInfo | VeritasEntityGroup;
}

const _BORROWER_ROLE_LABELS: Record<string, string> = {
  taxpayer: "borrower",
  spouse: "co_borrower",
  employer: "employer",
  employee: "employee",
};

function identityToRow(identity: IdentityInfo): CaseIdentityRow {
  const rawRole = identity.role ?? "";
  const role = _BORROWER_ROLE_LABELS[rawRole.toLowerCase()] ?? rawRole.toLowerCase() ?? "unknown";
  return {
    id: identity.id,
    name: identity.name ?? "Unknown",
    role: role || identity.borrower_class || "unknown",
    entityType: (identity.entity_type ?? identity.borrower_class ?? "unknown").toLowerCase(),
    needsReview: identity.needs_review,
    origin: "scenario",
    raw: identity,
  };
}

function entityToRow(entity: VeritasEntityGroup): CaseIdentityRow {
  // Entity groups have `entity_type` ∈ {person, partnership, scorp, employer, …}
  // and no explicit "role" — treat the type as the role for business entities
  // and infer "borrower" for `person`. Refinement-derived identities override
  // this when available.
  const t = (entity.entity_type ?? "unknown").toLowerCase();
  const role = t === "person" ? "borrower" : t;
  return {
    id: entity.entity_group_id,
    name: entity.label,
    role,
    entityType: t,
    needsReview: false,
    origin: "entities",
    raw: entity,
  };
}

export const caseIdentitiesEntitiesQueryKey = (caseId: string | null) =>
  ["lux", "case", caseId, "entities"] as const;

export const caseIdentitiesScenarioQueryKey = (
  caseId: string | null,
  scenarioId: string | null,
  refinementId: string | null,
) => ["lux", "case", caseId, "scenario-identities", scenarioId, refinementId] as const;

export interface UseCaseIdentitiesOptions {
  /**
   * When provided, the hook will try to read identities from this scenario's
   * latest refinement first. Defaults to "auto": pick the most-recent scenario
   * with refinements found in the surrounding `CaseScenarioProvider` (if any).
   */
  scenarioId?: string | null;
  refinementId?: string | null;
}

export interface UseCaseIdentitiesResult {
  rows: CaseIdentityRow[];
  /** Whether the rows came from a scenario or from the fallback entities endpoint. */
  source: "scenario" | "entities" | "empty";
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
}

/**
 * Return identities for a case, preferring a completed scenario's refinement
 * when available and falling back to the raw entities endpoint otherwise.
 *
 * The hook tolerates being used outside `CaseScenarioProvider` — it just
 * skips the scenario-first lookup and goes straight to entities.
 */
export function useCaseIdentities(
  caseId: string | null,
  options: UseCaseIdentitiesOptions = {},
): UseCaseIdentitiesResult {
  // Optional scenario context — this hook is intentionally usable outside
  // `CaseScenarioProvider` (e.g. on the create-scenario page before any
  // scenarios exist).
  const scenarioCtx = useMaybeCaseScenarioContext();

  const resolvedScenario = useMemo(() => {
    if (options.scenarioId && options.refinementId) {
      return { scenarioId: options.scenarioId, refinementId: options.refinementId };
    }
    const scenarios = scenarioCtx?.scenarios ?? [];
    // Prefer a completed scenario with at least one refinement; newest first.
    const sorted = [...scenarios].sort((a, b) => {
      const aTime = a.created_at ?? "";
      const bTime = b.created_at ?? "";
      return bTime.localeCompare(aTime);
    });
    for (const s of sorted) {
      const refinements = s.refinements ?? [];
      if (refinements.length === 0) continue;
      // Pick the refinement with the highest refinement_num.
      const latest = [...refinements].sort(
        (a, b) => (b.refinement_num ?? -1) - (a.refinement_num ?? -1),
      )[0];
      if (latest && latest.identities && latest.identities.length > 0) {
        return { scenarioId: s.scenario_id, refinementId: latest.refinement_id };
      }
    }
    return null;
  }, [options.scenarioId, options.refinementId, scenarioCtx?.scenarios]);

  const scenarioIdentitiesQuery = useQuery({
    queryKey: caseIdentitiesScenarioQueryKey(
      caseId,
      resolvedScenario?.scenarioId ?? null,
      resolvedScenario?.refinementId ?? null,
    ),
    queryFn: async () => {
      const refinement = await getDefaultClient().getCaseScenarioRefinement(
        caseId as string,
        resolvedScenario!.scenarioId,
        resolvedScenario!.refinementId,
      );
      return refinement.identities ?? [];
    },
    enabled: !!caseId && !!resolvedScenario,
    staleTime: 30_000,
  });

  const entitiesQuery = useQuery({
    queryKey: caseIdentitiesEntitiesQueryKey(caseId),
    queryFn: () => getDefaultClient().getCaseEntities(caseId as string),
    enabled: !!caseId,
    staleTime: 30_000,
  });

  const rows = useMemo<CaseIdentityRow[]>(() => {
    const scenarioRows = (scenarioIdentitiesQuery.data ?? []).map(identityToRow);
    if (scenarioRows.length > 0) return scenarioRows;
    return (entitiesQuery.data ?? []).map(entityToRow);
  }, [scenarioIdentitiesQuery.data, entitiesQuery.data]);

  const source: UseCaseIdentitiesResult["source"] =
    (scenarioIdentitiesQuery.data?.length ?? 0) > 0
      ? "scenario"
      : (entitiesQuery.data?.length ?? 0) > 0
        ? "entities"
        : "empty";

  return {
    rows,
    source,
    isLoading:
      (resolvedScenario != null && scenarioIdentitiesQuery.isLoading) || entitiesQuery.isLoading,
    isError: scenarioIdentitiesQuery.isError || entitiesQuery.isError,
    error:
      (scenarioIdentitiesQuery.error as Error | null) ??
      (entitiesQuery.error as Error | null),
  };
}

