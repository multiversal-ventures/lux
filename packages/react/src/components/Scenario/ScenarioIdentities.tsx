import { useScenarioContext } from "./ScenarioProvider.js";
import type { components } from "@fenero/lux-core";

type IdentityInfo = components["schemas"]["IdentityInfo"];
type RefinementResponse = components["schemas"]["RefinementResponse"];

const ROLE_ORDER: Record<string, number> = {
  Primary: 0,
  "Co-Borrower": 1,
};

function getRoleOrder(role: string | null): number {
  if (role === null) return 2;
  return ROLE_ORDER[role] ?? 2;
}

function getLatestRefinement(refinements: RefinementResponse[]): RefinementResponse | null {
  if (refinements.length === 0) return null;
  return refinements.reduce((best, current) => {
    const bestNum = best.refinement_num ?? -1;
    const currentNum = current.refinement_num ?? -1;
    return currentNum > bestNum ? current : best;
  });
}

function IdentityRow({ identity }: { identity: IdentityInfo }) {
  const displayName = identity.name ?? "Unknown";
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "0.375rem",
        padding: "0.25rem 0",
        fontSize: "0.8125rem",
        color: "#1e293b",
      }}
    >
      <span>{displayName}</span>
      {identity.entity_type && (
        <span style={{ color: "#94a3b8" }}>{identity.entity_type}</span>
      )}
      {identity.role && (
        <span style={{ color: "#94a3b8" }}>({identity.role})</span>
      )}
      {identity.needs_review && (
        <span title="Needs review" style={{ marginLeft: "0.125rem" }}>⚠</span>
      )}
    </div>
  );
}

export interface ScenarioIdentitiesProps {
  className?: string;
}

export function ScenarioIdentities({ className }: ScenarioIdentitiesProps) {
  const { refinements } = useScenarioContext();

  const latest = getLatestRefinement(refinements);
  const identities: IdentityInfo[] = latest?.identities ?? [];

  const borrowers = identities
    .filter((i) => i.borrower_class === "borrower")
    .sort((a, b) => getRoleOrder(a.role) - getRoleOrder(b.role));

  const entities = identities.filter((i) => i.borrower_class === "business_entity");

  if (borrowers.length === 0 && entities.length === 0) {
    return null;
  }

  const sectionHeaderStyle: React.CSSProperties = {
    fontSize: "0.6875rem",
    fontWeight: 600,
    color: "#94a3b8",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    marginBottom: "0.25rem",
  };

  return (
    <div className={className} style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      {borrowers.length > 0 && (
        <div>
          <div style={sectionHeaderStyle}>Borrowers</div>
          {borrowers.map((identity) => (
            <IdentityRow key={identity.id} identity={identity} />
          ))}
        </div>
      )}
      {entities.length > 0 && (
        <div>
          <div style={sectionHeaderStyle}>Business Entities</div>
          {entities.map((identity) => (
            <IdentityRow key={identity.id} identity={identity} />
          ))}
        </div>
      )}
    </div>
  );
}
