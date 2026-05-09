import { useCaseScenarioContext } from "./ScenarioProvider.js";
import type { components } from "@fenero/lux-core";

type ProductSpecGroup = components["schemas"]["ProductSpecGroup"];

export interface ScenarioComparisonProps {
  onScenarioClick: (scenarioId: string) => void;
  className?: string;
}

function humanizeSpec(specName: string, productSpecs: ProductSpecGroup[]): string {
  for (const group of productSpecs) {
    if (group.spec_names.includes(specName)) {
      return `${group.display_name} — ${specName.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}`;
    }
  }
  return specName.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function ScenarioComparison({ onScenarioClick, className }: ScenarioComparisonProps) {
  const { scenarios } = useCaseScenarioContext();

  type Row = { specName: string; humanized: string; amount: number | null; scenarioId: string };
  const rows: Row[] = [];
  for (const s of scenarios) {
    const productSpecs: ProductSpecGroup[] = (s as any).product_specs ?? [];
    for (const r of s.results ?? []) {
      rows.push({
        specName: r.spec_name ?? "",
        humanized: humanizeSpec(r.spec_name ?? "", productSpecs),
        amount: r.monthly_amount != null ? Number(r.monthly_amount) : null,
        scenarioId: String(s.scenario_id),
      });
    }
  }

  if (rows.length === 0) {
    return <div className={className} style={{ padding: "1rem", color: "#64748b", fontSize: "0.875rem" }}>No results to compare.</div>;
  }

  return (
    <div className={className} style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
        <thead>
          <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e5e7eb" }}>
            <th style={{ padding: "0.5rem 0.75rem", textAlign: "left" }}>Spec</th>
            <th style={{ padding: "0.5rem 0.75rem", textAlign: "right" }}>Qualifying Income</th>
            <th style={{ padding: "0.5rem 0.75rem", textAlign: "center" }}>Period</th>
            <th style={{ padding: "0.5rem 0.75rem", textAlign: "left" }}>From</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} style={{ borderBottom: "1px solid #f1f5f9" }}>
              <td style={{ padding: "0.5rem 0.75rem", fontFamily: "monospace" }}>{row.humanized}</td>
              <td style={{ padding: "0.5rem 0.75rem", textAlign: "right", fontWeight: 600 }}>
                {row.amount != null ? `$${row.amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}/mo` : "—"}
              </td>
              <td style={{ padding: "0.5rem 0.75rem", textAlign: "center", color: "#64748b" }}>—</td>
              <td style={{ padding: "0.5rem 0.75rem" }}>
                <button
                  onClick={() => onScenarioClick(row.scenarioId)}
                  style={{ fontSize: "0.75rem", color: "#1d4ed8", background: "none", border: "none", cursor: "pointer", padding: 0, fontFamily: "monospace" }}
                >
                  {row.scenarioId.slice(0, 8)}…
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
