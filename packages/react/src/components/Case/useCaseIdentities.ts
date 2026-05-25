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
  /**
   * Stable role slug used for filtering / grouping
   * (e.g. `taxpayer`, `spouse`, `landlord_person`, `employer`).
   *
   * Sourced from the API's ``IdentityInfo.role_hint`` so the host and
   * the backend agree on the same key. Falls back to ``borrower_class``
   * when a row has no role_hint (financial institutions, generic
   * entities). NEVER use this for display — render ``roleLabel`` or
   * resolve via the picker's slot.
   */
  role: string;
  /**
   * Display label for the role
   * (e.g. `"Borrower"`, `"Co-Borrower"`, `"Landlord"`, `"Employer"`).
   *
   * Sourced from the API's ``IdentityInfo.role`` which is computed
   * server-side from ``policy/specs/display_labels.yaml``. Empty when
   * the row carries no display role (most non-employer entities).
   */
  roleLabel: string;
  /**
   * Display-ready entity type label
   * (e.g. `"S-Corp"`, `"Subject Property"`, `"Financial Institution"`).
   *
   * Sourced from the API's ``IdentityInfo.entity_type`` which is itself
   * resolved server-side via ``entity_type_label()``. For persons the
   * server returns ``None``; we fall back to ``borrower_class`` so the
   * Type column / filter still has something useful to render.
   */
  entityType: string;
  /** Whether this identity needs operator review before relying on it. */
  needsReview: boolean;
  /** Source of this row — useful for diagnostics + tests. */
  origin: "case" | "scenario" | "entities";
  /** Raw payload of whichever source produced this row. */
  raw: IdentityInfo | VeritasEntityGroup;
}

function identityToRow(identity: IdentityInfo): CaseIdentityRow {
  // ``role_hint`` is the stable filter slug — when the backend can't
  // supply one (e.g. financial-institution shim) we fall back to
  // ``borrower_class`` so the filter dropdown still groups rows by
  // some meaningful category instead of collapsing them all into "".
  const slug = (identity.role_hint ?? identity.borrower_class ?? "unknown").toString();
  return {
    id: identity.id,
    name: identity.name ?? "Unknown",
    role: slug || "unknown",
    roleLabel: identity.role ?? "",
    // Entity type is already display-ready when the backend resolved it
    // through ``entity_type_label``. We keep the raw casing so values
    // like "S-Corp" / "Subject Property" render verbatim.
    entityType: identity.entity_type ?? identity.borrower_class ?? "",
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
