import type { CSSProperties, ReactNode } from "react";
import { useScenarioContext, useCaseScenarioContext } from "./ScenarioProvider.js";
import type { components } from "@multiversal-ventures/lux-core";

type SpecResultResponse = components["schemas"]["SpecResultResponse"];

export const AGENCY_LABELS: Record<string, string> = {
  fnma: "FNMA / Fannie Mae",
  fhlmc: "FHLMC / Freddie Mac",
  fha: "FHA",
  va: "VA",
  usda: "USDA",
};

export const KNOWN_AGENCIES = Object.keys(AGENCY_LABELS);

function getAgency(specName: string): string {
  for (const a of KNOWN_AGENCIES) {
    if (specName.startsWith(a + "_")) return a;
  }
  return "other";
}

function formatSpecLabel(specName: string): string {
  const withoutAgency = KNOWN_AGENCIES.reduce(
    (s, a) => (s.startsWith(a + "_") ? s.slice(a.length + 1) : s),
    specName,
  );
  return withoutAgency
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatMonthly(raw: string | null): string {
  if (!raw) return "—";
  const n = parseFloat(raw);
  if (isNaN(n)) return "—";
  if (n === 0) return "$0 / mo";
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / mo`;
}

/** Per spec_name: prefer eligible outcome, then highest monthly_amount. */
function deduplicateResults(results: SpecResultResponse[]): SpecResultResponse[] {
  const bySpec = new Map<string, SpecResultResponse>();
  for (const r of results) {
    const key = r.spec_name ?? r.result_id;
    const existing = bySpec.get(key);
    if (!existing) {
      bySpec.set(key, r);
      continue;
    }
    const curEligible = r.outcome === "eligible";
    const existingEligible = existing.outcome === "eligible";
    if (curEligible && !existingEligible) {
      bySpec.set(key, r);
    } else if (!curEligible && !existingEligible) {
      const curAmt = parseFloat(r.monthly_amount ?? "0") || 0;
      const existAmt = parseFloat(existing.monthly_amount ?? "0") || 0;
      if (curAmt > existAmt) bySpec.set(key, r);
    }
  }
  return Array.from(bySpec.values());
}

function OutcomeBadge({ outcome }: { outcome: string | null }) {
  const o = outcome ?? "none";
  let color = "#94a3b8";
  let bg = "#f1f5f9";
  if (o === "eligible") { color = "#059669"; bg = "#ecfdf5"; }
  else if (o !== "none") { color = "#2563eb"; bg = "#eff6ff"; }
  return (
    <span style={{ display: "inline-block", padding: "0.125rem 0.5rem", borderRadius: "0.25rem", fontSize: "0.6875rem", fontWeight: 600, color, background: bg, textTransform: "uppercase", letterSpacing: "0.04em" }}>
      {o === "none" ? "—" : o.replace(/_/g, " ")}
    </span>
  );
}

const thStyle: CSSProperties = {
  textAlign: "left",
  padding: "0.375rem 1rem",
  fontSize: "0.6875rem",
  fontWeight: 500,
  color: "#64748b",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
};

const tdStyle: CSSProperties = {
  padding: "0.5rem 1rem",
  fontSize: "0.875rem",
  borderTop: "1px solid #f1f5f9",
};

const sectionHeaderStyle: CSSProperties = {
  padding: "0.375rem 1rem",
  fontSize: "0.6875rem",
  fontWeight: 600,
  color: "#94a3b8",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  background: "#f8fafc",
  borderTop: "1px solid #e2e8f0",
};

function AgencySection({ agency, rows }: { agency: string; rows: SpecResultResponse[] }) {
  const label = AGENCY_LABELS[agency] ?? agency.toUpperCase();
  return (
    <>
      <tr><td colSpan={3} style={sectionHeaderStyle}>{label}</td></tr>
      {rows.map((r) => (
        <tr key={r.result_id}>
          <td style={{ ...tdStyle, color: "#374151" }}>{formatSpecLabel(r.spec_name ?? r.result_id)}</td>
          <td style={tdStyle}><OutcomeBadge outcome={r.outcome} /></td>
          <td style={{ ...tdStyle, textAlign: "right", fontWeight: r.outcome === "eligible" ? 600 : 400, color: r.outcome === "eligible" ? "#1e293b" : "#64748b" }}>
            {formatMonthly(r.monthly_amount)}
          </td>
        </tr>
      ))}
    </>
  );
}

export interface ScenarioResultsProps {
  className?: string;
  /** Direct results override — bypasses refinements context when provided. */
  results?: SpecResultResponse[];
  /** When set, shows only results for this agency (e.g. "fnma", "fha"). Shows all when omitted. */
  agency?: string;
  /**
   * Icon shown before the “Income Results” title (host typically passes Lucide `<BarChart3 />` etc.).
   * When omitted, no leading icon is rendered.
   */
  titleIcon?: ReactNode;
}

export function ScenarioResults({
  className,
  results: resultsProp,
  agency: agencyFilter,
  titleIcon,
}: ScenarioResultsProps) {
  const { scenarioId } = useScenarioContext();
  const { scenarios } = useCaseScenarioContext();

  const scenarioComparison = scenarios.find((s) => s.scenario_id === scenarioId);
  const raw: SpecResultResponse[] = resultsProp ?? scenarioComparison?.results ?? [];
  const allResults = deduplicateResults(raw);

  const results = agencyFilter
    ? allResults.filter((r) => getAgency(r.spec_name ?? "") === agencyFilter)
    : allResults;

  if (results.length === 0) {
    return (
      <div className={className} style={{ padding: "1rem", color: "#64748b", fontSize: "0.875rem" }}>
        No results available.
      </div>
    );
  }

  const agencyLabel = agencyFilter ? (AGENCY_LABELS[agencyFilter] ?? agencyFilter.toUpperCase()) : "All Agencies";
  const eligibleCount = results.filter((r) => r.outcome === "eligible").length;

  return (
    <div className={className}>
      <div style={{ padding: "0.5rem 0.75rem", background: "#f8fafc", borderBottom: "1px solid #e2e8f0", display: "flex", alignItems: "center", gap: "0.5rem" }}>
        {titleIcon != null && (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#64748b",
              flexShrink: 0,
            }}
          >
            {titleIcon}
          </span>
        )}
        <h3 style={{ margin: 0, fontSize: "0.875rem", fontWeight: 600, color: "#374151" }}>{agencyLabel} — Income Results</h3>
        <span style={{ marginLeft: "auto", fontSize: "0.75rem", color: "#64748b" }}>
          {results.length} spec{results.length !== 1 ? "s" : ""}{eligibleCount > 0 && `, ${eligibleCount} eligible`}
        </span>
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
          <tr>
            <th style={thStyle}>Spec</th>
            <th style={thStyle}>Outcome</th>
            <th style={{ ...thStyle, textAlign: "right" }}>Monthly</th>
          </tr>
        </thead>
        <tbody>
          {results.map((r) => (
            <tr key={r.result_id}>
              <td style={{ ...tdStyle, color: "#374151" }}>{formatSpecLabel(r.spec_name ?? r.result_id)}</td>
              <td style={tdStyle}><OutcomeBadge outcome={r.outcome} /></td>
              <td style={{ ...tdStyle, textAlign: "right", fontWeight: r.outcome === "eligible" ? 600 : 400, color: r.outcome === "eligible" ? "#1e293b" : "#64748b" }}>
                {formatMonthly(r.monthly_amount)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
