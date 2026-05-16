import { useScenarioContext } from "./ScenarioProvider.js";
import { useScenarioAdvice } from "./useScenarioAdvice.js";
import type { VeritasScenarioAdviceItem } from "@multiversal-ventures/lux-core";

const SEVERITY_ICONS: Record<string, string> = {
  action_required: "🔴",
  warning: "⚠️",
  info: "ℹ️",
};

export interface ScenarioAdviceProps {
  onAction?: (code: string, action: string) => void;
  className?: string;
}

export function ScenarioAdvice({ onAction, className }: ScenarioAdviceProps) {
  const { caseId, scenarioId, scenario } = useScenarioContext();
  const immediateItems: VeritasScenarioAdviceItem[] =
    scenario.rendering_hints?.advice ?? [];
  const { items: enrichedItems, narrative, isLoading, fetch } = useScenarioAdvice(caseId, scenarioId);

  const displayItems = enrichedItems.length > 0 ? enrichedItems : immediateItems;

  if (displayItems.length === 0 && !narrative) return null;

  return (
    <div className={className}>
      {displayItems.map((item) => (
        <div key={item.code} style={{ display: "flex", gap: "0.75rem", padding: "0.75rem", borderLeft: "4px solid", borderLeftColor: item.severity === "action_required" ? "#dc2626" : item.severity === "warning" ? "#f59e0b" : "#3b82f6", background: "#f8fafc", marginBottom: "0.5rem", borderRadius: "0 0.375rem 0.375rem 0" }}>
          <span>{SEVERITY_ICONS[item.severity] ?? "ℹ️"}</span>
          <div style={{ flex: 1 }}>
            <p style={{ margin: 0, fontSize: "0.875rem" }}>{item.message}</p>
            {item.action && item.action_label && onAction && (
              <button
                onClick={() => onAction(item.code, item.action!)}
                style={{ marginTop: "0.375rem", fontSize: "0.75rem", padding: "0.25rem 0.625rem", background: "#1d4ed8", color: "white", border: "none", borderRadius: "0.25rem", cursor: "pointer" }}
              >
                {item.action_label}
              </button>
            )}
          </div>
        </div>
      ))}
      {narrative && (
        <p style={{ fontSize: "0.875rem", color: "#475569", marginTop: "0.75rem", padding: "0 0.75rem" }}>{narrative}</p>
      )}
      {!enrichedItems.length && !isLoading && (
        <button onClick={fetch} style={{ fontSize: "0.75rem", color: "#64748b", background: "none", border: "none", cursor: "pointer", padding: "0.25rem 0" }}>
          Get AI advice →
        </button>
      )}
    </div>
  );
}
