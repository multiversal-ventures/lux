import { useState } from "react";
import { useScenarioContext } from "./ScenarioProvider.js";

export interface ScenarioCalcLogsProps {
  className?: string;
}

export function ScenarioCalcLogs({ className }: ScenarioCalcLogsProps) {
  const { scenario, audit, activeProductId } = useScenarioContext();
  const [expandedSpecs, setExpandedSpecs] = useState<Set<string>>(new Set());

  const hints = scenario.rendering_hints;
  const productSpec = hints?.product_specs?.find((p) => p.product_id === activeProductId);
  const agency = productSpec?.agency ?? null;

  const filteredAudit = agency
    ? audit.filter((a) => a.spec_name?.startsWith(agency + "_"))
    : [];

  if (filteredAudit.length === 0) {
    return (
      <div className={className} style={{ padding: "1rem", color: "#64748b", fontSize: "0.875rem" }}>
        No calculation logs for this product.
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
