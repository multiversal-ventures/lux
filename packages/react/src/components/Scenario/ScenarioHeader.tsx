import { useScenarioContext } from "./ScenarioProvider.js";
import styles from "./Scenario.module.css";

export interface ScenarioHeaderProps {
  className?: string;
}

export function ScenarioHeader({ className }: ScenarioHeaderProps) {
  const { scenario } = useScenarioContext();
  const hints = scenario.rendering_hints;
  const income = hints?.best_qualifying_income;
  const statusClass =
    scenario.status === "completed" ? styles.statusCompleted
    : scenario.status === "running" ? styles.statusRunning
    : styles.statusDefault;

  return (
    <div className={[styles.header, className].filter(Boolean).join(" ")}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <h1 style={{ fontSize: "1.25rem", fontWeight: 600 }}>{(scenario as any).name ?? "Scenario"}</h1>
            <span className={[styles.statusBadge, statusClass].join(" ")}>
              {scenario.status}
            </span>
          </div>
          {income != null && scenario.status === "completed" && (
            <p style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--scenario-success)", marginTop: "0.25rem" }}>
              ${income.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/mo
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
