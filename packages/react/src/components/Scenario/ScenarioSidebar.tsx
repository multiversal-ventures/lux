import { useState, type ReactNode } from "react";
import { useCaseScenarioContext } from "./ScenarioProvider.js";
import type { components } from "@fenero/lux-core";

type RefinementResponse = components["schemas"]["RefinementResponse"];

const APPROACH_LABELS: Record<string, string> = {
  qualified_mortgage: "QM",
  non_qualified_mortgage: "Non-QM",
  dscr: "DSCR",
};

export interface ScenarioSidebarProps {
  activeScenarioId?: string;
  onSelectScenario: (scenarioId: string) => void;
  onNewScenario?: () => void;
  newScenarioSlot?: ReactNode;
  className?: string;
}

export function ScenarioSidebar({
  activeScenarioId,
  onSelectScenario,
  onNewScenario,
  newScenarioSlot,
  className,
}: ScenarioSidebarProps) {
  const { scenarios } = useCaseScenarioContext();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div className={className} style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
      {scenarios.map((s) => {
        const scenarioId = String(s.scenario_id);
        const isActive = scenarioId === activeScenarioId;
        const isExpanded = expandedId === scenarioId;
        // income intentionally omitted — rendering_hints not on ScenarioComparisonResponse
        const approachLabel = APPROACH_LABELS[(s.approach ?? "")] ?? s.approach ?? "";
        const refinements: RefinementResponse[] = s.refinements ?? [];

        return (
          <div key={scenarioId}>
            <button
              onClick={() => {
                onSelectScenario(scenarioId);
                setExpandedId(isExpanded ? null : scenarioId);
              }}
              style={{
                width: "100%", textAlign: "left", padding: "0.625rem 0.75rem",
                background: isActive ? "#eff6ff" : "white",
                border: "1px solid", borderColor: isActive ? "#bfdbfe" : "#e5e7eb",
                borderRadius: "0.375rem", cursor: "pointer",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "0.875rem", fontWeight: 500 }}>
                  {approachLabel}
                </span>
                <span style={{ fontSize: "0.75rem", color: s.status === "completed" ? "#057a55" : "#92400e" }}>
                  {s.status === "completed" ? "✓" : "…"}
                </span>
              </div>
              <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.125rem" }}>
                <span style={{ fontSize: "0.75rem", color: "#64748b" }}>{approachLabel}</span>
              </div>
            </button>

            {isExpanded && refinements.length > 0 && (
              <div style={{ paddingLeft: "0.75rem", borderLeft: "2px solid #e5e7eb", marginLeft: "0.5rem" }}>
                {refinements.map((r) => (
                  <div
                    key={r.refinement_id}
                    style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.25rem 0.5rem", fontSize: "0.75rem", color: "#475569" }}
                  >
                    <span style={{ color: r.status === "completed" ? "#057a55" : "#94a3b8" }}>
                      {r.status === "completed" ? "✓" : "○"}
                    </span>
                    <span>Run #{r.refinement_num}</span>
                    {r.name && <span style={{ color: "#94a3b8" }}>— {r.name}</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
      {newScenarioSlot ?? (onNewScenario && (
        <button
          onClick={onNewScenario}
          style={{ padding: "0.5rem 0.75rem", fontSize: "0.875rem", color: "#1d4ed8", background: "none", border: "1px dashed #bfdbfe", borderRadius: "0.375rem", cursor: "pointer" }}
        >
          + New scenario
        </button>
      ))}
    </div>
  );
}
