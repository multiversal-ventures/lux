import { useMemo } from "react";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import {
  getDefaultClient,
  type components,
} from "@multiversal-ventures/lux-core";

import type { ApproachOption } from "./ApproachPicker.js";
import type { ProductOption } from "./ProductPicker.js";

export type TenantProduct = components["schemas"]["ProductResponse"];

/**
 * Tenant-scoped loan product catalog, fetched from
 * ``GET /api/products``.
 *
 * The endpoint returns the rows from ``tenant_products`` (or the YAML
 * fallback when the tenant hasn't been seeded yet — see
 * ``veritas.policy.product_registry.list_tenant_products``). Every field
 * needed to render the approach + product pickers lives on the row, so
 * no second config endpoint is required.
 *
 * The legacy ``non_qm`` catch-all is filtered out by default — it's a
 * back-compat alias that runs every Non-QM spec, and surfaces poorly in
 * a chip picker that already exposes the granular ``non_qm_bank_statement``
 * and ``irs_1099_income`` siblings. Set ``includeLegacy: true`` to opt
 * in (e.g. on an admin page that audits the full catalog).
 */
const LEGACY_CATCHALL_IDS = new Set(["non_qm"]);

export const tenantProductsQueryKey = ["lux", "tenant", "products"] as const;

export interface UseTenantProductsOptions {
  /** When false (default), filters out legacy catch-all products. */
  includeLegacy?: boolean;
  /** When true, includes products with ``enabled: false`` from the API. */
  includeDisabled?: boolean;
  /** Override the React Query staleTime (ms). Default 5 minutes. */
  staleTime?: number;
}

export interface UseTenantProductsResult {
  /** Filtered + sorted product list, ready for UI. */
  products: TenantProduct[];
  /** Map by ``product_id`` for O(1) lookup in selectors / pickers. */
  productById: Map<string, TenantProduct>;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  query: UseQueryResult<TenantProduct[], Error>;
}

export function useTenantProducts(
  options?: UseTenantProductsOptions,
): UseTenantProductsResult {
  const includeLegacy = options?.includeLegacy ?? false;
  const includeDisabled = options?.includeDisabled ?? false;
  const staleTime = options?.staleTime ?? 5 * 60 * 1000;

  const query = useQuery({
    queryKey: [...tenantProductsQueryKey, { includeDisabled }] as const,
    queryFn: () => getDefaultClient().listTenantProducts({ includeDisabled }),
    staleTime,
  });

  const products = useMemo<TenantProduct[]>(() => {
    const raw = query.data ?? [];
    const filtered = raw.filter((p) => {
      if (!includeLegacy && LEGACY_CATCHALL_IDS.has(p.product_id)) return false;
      return true;
    });
    filtered.sort((a, b) => {
      const orderDiff = (a.sort_order ?? 0) - (b.sort_order ?? 0);
      if (orderDiff !== 0) return orderDiff;
      return a.display_name.localeCompare(b.display_name);
    });
    return filtered;
  }, [query.data, includeLegacy]);

  const productById = useMemo(() => {
    const map = new Map<string, TenantProduct>();
    for (const p of products) map.set(p.product_id, p);
    return map;
  }, [products]);

  return {
    products,
    productById,
    isLoading: query.isLoading,
    isError: query.isError,
    error: (query.error as Error | null) ?? null,
    query,
  };
}

// ─── Selector helpers (presentation-layer adapters) ─────────────────────────

/**
 * Group products by the Lux "approach" concept used in ``<ApproachPicker>``.
 *
 * Approach is derived from the product's ``agency_path`` — anything under
 * ``non_qm_*`` is Non-QM, everything else is QM. This mirrors the
 * ``api.scenarios._is_non_qm_product`` classifier on the backend so the
 * UI grouping and the qualify execution stay aligned.
 */
export function groupProductsByApproach(
  products: TenantProduct[],
): Record<"qm" | "non_qm", TenantProduct[]> {
  const grouped: Record<"qm" | "non_qm", TenantProduct[]> = { qm: [], non_qm: [] };
  for (const p of products) {
    if (p.agency_path && p.agency_path.startsWith("non_qm_")) {
      grouped.non_qm.push(p);
    } else {
      grouped.qm.push(p);
    }
  }
  return grouped;
}

/**
 * Build the ``<ApproachPicker>`` option list from a tenant catalog.
 *
 * The description summarises the products inside each approach so the
 * picker is self-explanatory without the host wiring up a separate
 * product preview.
 */
export function toApproachOptions(
  products: TenantProduct[],
): ApproachOption[] {
  const groups = groupProductsByApproach(products);
  const qmLabels = groups.qm.map((p) => p.display_name).slice(0, 6).join(", ");
  const nonQmLabels = groups.non_qm.map((p) => p.display_name).slice(0, 6).join(", ");
  const options: ApproachOption[] = [];
  if (groups.qm.length > 0) {
    options.push({
      id: "qualified_mortgage",
      label: "Qualified Mortgage",
      description: qmLabels || "Agency products",
    });
  }
  if (groups.non_qm.length > 0) {
    options.push({
      id: "non_qualified_mortgage",
      label: "Non-Qualified Mortgage",
      description: nonQmLabels || "Non-QM products",
    });
  }
  return options;
}

/**
 * Convert a tenant catalog (optionally filtered to a single approach) into
 * the chip-shape ``<ProductPicker>`` expects.
 */
export function toProductOptions(
  products: TenantProduct[],
): ProductOption[] {
  return products.map((p) => ({
    id: p.product_id,
    label: p.display_name,
    enabled: p.enabled ?? true,
  }));
}
