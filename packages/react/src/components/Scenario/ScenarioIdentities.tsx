import type { CSSProperties } from "react";
import { useScenarioContext } from "./ScenarioProvider.js";
import type { components } from "@fenero/lux-core";

type IdentityInfo = components["schemas"]["IdentityInfo"];
type RefinementResponse = components["schemas"]["RefinementResponse"];

const ROLE_ORDER: Record<string, number> = { Primary: 0, "Co-Borrower": 1 };
function getRoleOrder(role: string | null): number {
  return role === null ? 2 : (ROLE_ORDER[role] ?? 2);
}

function getLatestRefinement(refinements: RefinementResponse[]): RefinementResponse | null {
  if (refinements.length === 0) return null;
  return refinements.reduce((best, cur) =>
    (cur.refinement_num ?? -1) > (best.refinement_num ?? -1) ? cur : best
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

const sectionHeaderTdStyle: CSSProperties = {
  padding: "0.375rem 1rem",
  fontSize: "0.6875rem",
  fontWeight: 600,
  color: "#94a3b8",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  background: "#f8fafc",
  borderTop: "1px solid #e2e8f0",
};

function StatusBadge({ status }: { status: string }) {
  const included = status === "Included";
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "0.25rem", fontSize: "0.75rem", fontWeight: 500, color: included ? "#059669" : "#94a3b8" }}>
      {included ? "✓" : "○"} {status}
    </span>
  );
}

function IdentityTableRow({ identity }: { identity: IdentityInfo }) {
  return (
    <tr>
      <td style={tdStyle}><StatusBadge status={identity.status} /></td>
      <td style={{ ...tdStyle, fontWeight: 500, color: identity.status === "Included" ? "#1e293b" : "#94a3b8" }}>
        {identity.name ?? "Unknown"}
        {identity.needs_review && (
          <span title="Needs underwriter review" style={{ marginLeft: "0.375rem", fontSize: "0.75rem" }}>⚠</span>
        )}
      </td>
      <td style={{ ...tdStyle, color: "#64748b" }}>{identity.role ?? "—"}</td>
      <td style={{ ...tdStyle, color: "#64748b" }}>{identity.entity_type ?? "—"}</td>
    </tr>
  );
}

export interface ScenarioIdentitiesProps {
  className?: string;
  /** Direct identities override — when provided, bypasses the refinements context. */
  identities?: IdentityInfo[];
}

export function ScenarioIdentities({ className, identities: identitiesProp }: ScenarioIdentitiesProps) {
  const { refinements } = useScenarioContext();

  const latest = getLatestRefinement(refinements);
  const identities: IdentityInfo[] = identitiesProp ?? latest?.identities ?? [];

  const borrowers = identities
    .filter((i) => i.borrower_class === "borrower")
    .sort((a, b) => getRoleOrder(a.role) - getRoleOrder(b.role));

  // Employers are companies — group with business entities for display.
  const entities = identities.filter(
    (i) => i.borrower_class === "business_entity" || i.borrower_class === "employer",
  );

  if (borrowers.length === 0 && entities.length === 0) return null;

  return (
    <div className={className}>
      <div style={{ padding: "0.5rem 0.75rem", background: "#f8fafc", borderBottom: "1px solid #e2e8f0", display: "flex", alignItems: "center", gap: "0.5rem" }}>
        <span style={{ fontSize: "0.875rem", color: "#64748b" }}>👤</span>
        <h3 style={{ margin: 0, fontSize: "0.875rem", fontWeight: 600, color: "#374151" }}>Identities</h3>
        <span style={{ marginLeft: "auto", fontSize: "0.75rem", color: "#64748b" }}>
          {borrowers.length} borrower{borrowers.length !== 1 ? "s" : ""}
          {entities.length > 0 && `, ${entities.length} ${entities.length !== 1 ? "entities" : "entity"}`}
        </span>
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
          <tr>
            <th style={thStyle}>Status</th>
            <th style={thStyle}>Name</th>
            <th style={thStyle}>Role</th>
            <th style={thStyle}>Type</th>
          </tr>
        </thead>
        <tbody>
          {borrowers.length > 0 && (
            <>
              <tr><td colSpan={4} style={sectionHeaderTdStyle}>Borrowers</td></tr>
              {borrowers.map((b) => <IdentityTableRow key={String(b.id)} identity={b} />)}
            </>
          )}
          {entities.length > 0 && (
            <>
              <tr><td colSpan={4} style={sectionHeaderTdStyle}>Business Entities</td></tr>
              {entities.map((e) => <IdentityTableRow key={String(e.id)} identity={e} />)}
            </>
          )}
        </tbody>
      </table>
    </div>
  );
}
