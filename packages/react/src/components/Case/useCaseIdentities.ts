import { useMemo } from "react";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { getDefaultClient, type VeritasEntityGroup, type components } from "@multiversal-ventures/lux-core";

type IdentityInfo = components["schemas"]["IdentityInfo"];

/**
 * Normalized identity row. Comes from GET /api/cases/{id}/identities which
 * returns persons, entities, and financial institutions in a unified list.
 *
 * The `origin` field is `"case"` for all rows from this endpoint.
 * Legacy values `"scenario"` and `"entities"` are preserved in the union
 * for downstream code that may still reference them.
 */
export interface CaseIdentityRow {
  /** Stable id (identity cluster id). */
  id: string;
  /** Display name (`"Acme Corp"`, `"Jane Q. Public"`). */
  name: string;
  /** Underwriter-facing role label (e.g. `borrower`, `employer`, `spouse`). */
  role: string;
  /** Coarse entity type slug (`person`, `partnership`, `scorp`, `employer`, …). */
  entityType: string;
  /** Whether this identity needs operator review before relying on it. */
  needsReview: boolean;
  /** Source of this row — useful for diagnostics + tests. */
  origin: "case" | "scenario" | "entities";
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
    origin: "case",
    raw: identity,
  };
}

/**
 * Cache key. When ``scenarioId`` is supplied the response is scenario-
 * pinned (it applies the active product borrower assembly server-side),
 * so it MUST live in its own React-Query bucket — otherwise refining
 * one scenario would visually mutate the flat case-level list shared
 * with other consumers.
 */
export const caseIdentitiesQueryKey = (
  caseId: string | null,
  scenarioId?: string | null,
) =>
  scenarioId
    ? (["lux", "case", caseId, "identities", { scenarioId }] as const)
    : (["lux", "case", caseId, "identities"] as const);

/** @deprecated Use caseIdentitiesQueryKey. Kept for backward compat. */
export const caseIdentitiesEntitiesQueryKey = (caseId: string | null) =>
  ["lux", "case", caseId, "entities"] as const;

/** @deprecated No longer used — scenario identities are read directly from the refinement. */
export const caseIdentitiesScenarioQueryKey = (
  caseId: string | null,
  scenarioId: string | null,
  refinementId: string | null,
) => ["lux", "case", caseId, "scenario-identities", scenarioId, refinementId] as const;

export interface UseCaseIdentitiesOptions {
  /**
   * When set, forwarded to ``GET /api/cases/{id}/identities?scenario_id=``
   * so the response is filtered through the scenario's active product
   * borrower assembly. ``null``/undefined preserves the legacy flat
   * case-level shape.
   */
  scenarioId?: string | null;
  refinementId?: string | null;
}

export interface UseCaseIdentitiesResult {
  rows: CaseIdentityRow[];
  /** Fast id → row lookup. */
  productById: Map<string, CaseIdentityRow>;
  /** Underlying react-query result for advanced consumers. */
  query: UseQueryResult<IdentityInfo[]>;
  /** Where the rows came from. Always `"case"` with the unified endpoint; `"empty"` when none loaded. */
  source: "case" | "scenario" | "entities" | "empty";
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
}

/**
 * Return identities for a case from the unified GET /api/cases/{id}/identities
 * endpoint, which includes persons, entities, and financial institutions.
 */
export function useCaseIdentities(
  caseId: string | null,
  options: UseCaseIdentitiesOptions = {},
): UseCaseIdentitiesResult {
  const scenarioId = options.scenarioId ?? null;
  const query = useQuery({
    queryKey: caseIdentitiesQueryKey(caseId, scenarioId),
    queryFn: () =>
      getDefaultClient().getCaseIdentities(
        caseId as string,
        scenarioId ? { scenarioId } : undefined,
      ),
    enabled: !!caseId,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  const rows = useMemo<CaseIdentityRow[]>(() => {
    return (query.data ?? []).map(identityToRow);
  }, [query.data]);

  const productById = useMemo(
    () => new Map(rows.map((r) => [r.id, r])),
    [rows],
  );

  const source: UseCaseIdentitiesResult["source"] =
    rows.length > 0 ? "case" : "empty";

  return {
    rows,
    productById,
    query,
    source,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error as Error | null,
  };
}
