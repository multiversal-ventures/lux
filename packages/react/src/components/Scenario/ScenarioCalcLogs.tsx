import { useState } from "react";
import { useScenarioContext } from "./ScenarioProvider.js";
import { resolveAgency } from "./resolveAgency.js";

export interface ScenarioCalcLogsProps {
  className?: string;
}

export function ScenarioCalcLogs({ className }: ScenarioCalcLogsProps) {
  const { scenario, audit, activeProductId, activeRefinementId } = useScenarioContext();
  const [expandedSpecs, setExpandedSpecs] = useState<Set<string>>(new Set());

  // Resolves via rendering_hints first, then falls back to a static slug→agency
  // map so audit filtering keeps working when Veritas leaves product_specs empty.
  const agency = resolveAgency(activeProductId, scenario.rendering_hints?.product_specs ?? null);

  // Filter by refinement when manifest_id is present on audit rows.
  // The audit endpoint may not yet return manifest_id on every row — guard
  // against that case so calc logs still render until the field is added.
  const auditHasManifestId = audit.some(
    (a) => typeof (a as { manifest_id?: string }).manifest_id === "string",
  );
  const refinementAudit =
    activeRefinementId && auditHasManifestId
      ? audit.filter((a) => (a as { manifest_id?: string }).manifest_id === activeRefinementId)
      : audit;

  const filteredAudit = agency
    ? refinementAudit.filter((a) => a.spec_name?.startsWith(agency + "_"))
    : [];

  if (filteredAudit.length === 0) {
    if (typeof window !== "undefined") {
      console.warn("[ScenarioCalcLogs] no rows", {
        activeProductId,
        agency,
        auditTotal: audit.length,
        sampleSpecNames: audit.slice(0, 3).map((a) => a.spec_name),
      });
    }
    const message =
      audit.length === 0
        ? "Calculation audit is still loading or unavailable."
        : `No calculation logs for ${agency ?? "this product"}.`;
    return (
      <div className={className} style={{ padding: "1rem", color: "#64748b", fontSize: "0.875rem" }}>
        {message}
      </div>
    );
  }

  return (
    <div className={className}>
      {filteredAudit.map((spec) => {
        const isExpanded = expandedSpecs.has(spec.spec_name ?? "");
        return (
          <div key={spec.spec_name} style={{ borderBottom: "1px solid #e5e7eb" }}>
            <button
              onClick={() => {
                const next = new Set(expandedSpecs);
                if (isExpanded) next.delete(spec.spec_name ?? "");
                else next.add(spec.spec_name ?? "");
                setExpandedSpecs(next);
              }}
              style={{ width: "100%", textAlign: "left", padding: "0.5rem 0.75rem", background: "none", border: "none", cursor: "pointer", display: "flex", justifyContent: "space-between" }}
            >
              <span style={{ fontFamily: "monospace", fontSize: "0.875rem" }}>{spec.spec_name}</span>
              <span style={{ fontSize: "0.875rem", color: "#64748b" }}>
                {spec.monthly_amount != null ? `$${spec.monthly_amount.toLocaleString()}/mo` : "—"}
              </span>
            </button>
            {isExpanded && (
              <table style={{ width: "100%", fontSize: "0.8125rem", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "#f8fafc" }}>
                    <th style={{ padding: "0.25rem 0.75rem", textAlign: "left" }}>#</th>
                    <th style={{ padding: "0.25rem 0.75rem", textAlign: "left" }}>Derivation</th>
                    <th style={{ padding: "0.25rem 0.75rem", textAlign: "left" }}>Formula</th>
                    <th style={{ padding: "0.25rem 0.75rem", textAlign: "right" }}>Result</th>
                  </tr>
                </thead>
                <tbody>
                  {(spec.steps ?? []).map((step) => (
                    <tr key={step.step_number} style={{ borderTop: "1px solid #f1f5f9" }}>
                      <td style={{ padding: "0.25rem 0.75rem" }}>{step.step_number}</td>
                      <td style={{ padding: "0.25rem 0.75rem", fontFamily: "monospace" }}>{step.derivation_name}</td>
                      <td style={{ padding: "0.25rem 0.75rem", fontFamily: "monospace", color: "#64748b" }}>
                        {step.formula_display ?? step.formula}
                      </td>
                      <td style={{ padding: "0.25rem 0.75rem", textAlign: "right" }}>
                        {step.result != null ? step.result.toLocaleString() : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        );
      })}
    </div>
  );
}
