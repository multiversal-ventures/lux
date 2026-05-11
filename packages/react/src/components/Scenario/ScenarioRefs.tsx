import { useScenarioContext } from "./ScenarioProvider.js";
import { resolveAgency } from "./resolveAgency.js";

export interface ScenarioRefsProps {
  onRefClick: (canonicalKey: string, docId?: string) => void;
  className?: string;
}

export function ScenarioRefs({ onRefClick, className }: ScenarioRefsProps) {
  const { scenario, audit, activeProductId } = useScenarioContext();
  // Resolves via rendering_hints first, then falls back to a static slug→agency
  // map so references list keeps working when Veritas leaves product_specs empty.
  const agency = resolveAgency(activeProductId, scenario.rendering_hints?.product_specs ?? null);

  const filteredAudit = agency
    ? audit.filter((a) => a.spec_name?.startsWith(agency + "_"))
    : [];

  const refs: Array<{ label: string; canonicalKey: string; docId?: string }> = [];
  const seen = new Set<string>();
  let totalFunctionCalls = 0;
  for (const spec of filteredAudit) {
    for (const step of spec.steps ?? []) {
      for (const fc of step.function_calls ?? []) {
        totalFunctionCalls += 1;
        const args = fc.args as Record<string, unknown> | null | undefined;
        if (!args) continue;
        const docType = (args.doc_type as string) ?? "";
        const canonicalKey = (args.canonical_key as string) ?? (args.key as string) ?? "";
        if (!canonicalKey) continue;
        const label = docType ? `${docType}.${canonicalKey}` : canonicalKey;
        if (seen.has(label)) continue;
        seen.add(label);
        refs.push({ label, canonicalKey, docId: args.doc_id as string | undefined });
      }
    }
  }

  if (refs.length === 0) {
    if (typeof window !== "undefined") {
      // One-shot diagnostic so we can see whether the empty state is from
      // (a) audit fetch returning nothing, (b) wrong agency slug filtering it
      // all out, or (c) audit rows present but no canonical_key in any fc.args.
      console.warn("[ScenarioRefs] no refs", {
        activeProductId,
        agency,
        auditTotal: audit.length,
        filteredAuditTotal: filteredAudit.length,
        totalFunctionCalls,
        firstAuditSpec: audit[0]?.spec_name ?? null,
        firstFcKeys:
          filteredAudit[0]?.steps?.[0]?.function_calls?.[0]?.args
            ? Object.keys(
                filteredAudit[0].steps[0].function_calls[0].args as Record<string, unknown>,
              )
            : null,
      });
    }
    let message = "No references for this product.";
    if (audit.length === 0) {
      message = "Calculation audit is still loading or unavailable.";
    } else if (filteredAudit.length === 0) {
      message = `No audit rows for ${agency ?? "this product"}.`;
    } else if (totalFunctionCalls === 0) {
      message = "No function calls recorded — references can't be derived.";
    }
    return (
      <div className={className} style={{ padding: "1rem", color: "#64748b", fontSize: "0.875rem" }}>
        {message}
      </div>
    );
  }

  return (
    <div className={className} style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", padding: "0.75rem" }}>
      {refs.map((ref) => (
        <button
          key={ref.label}
          onClick={() => onRefClick(ref.canonicalKey, ref.docId)}
          style={{
            display: "inline-flex", alignItems: "center", gap: "0.25rem",
            padding: "0.25rem 0.625rem", borderRadius: "0.375rem",
            background: "#eff6ff", border: "1px solid #bfdbfe",
            color: "#1d4ed8", fontSize: "0.75rem", fontFamily: "monospace", cursor: "pointer",
          }}
        >
          {ref.label}
        </button>
      ))}
    </div>
  );
}
