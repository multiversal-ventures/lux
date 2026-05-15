import type { CSSProperties, ReactNode } from "react";
import type { components } from "@fenero-ai/lux-core";
import { useMaybeScenarioContext } from "./ScenarioProvider.js";
import { resolveScenarioDisplayName } from "./scenarioDisplay.js";

type ScenarioComparisonResponse = components["schemas"]["ScenarioComparisonResponse"];
type ScenarioDetailResponse = components["schemas"]["ScenarioDetailResponse"];

export interface ScenarioNameProps {
  /**
   * When omitted, reads `scenario` from the nearest `ScenarioProvider`
   * (non-throwing — renders `emptyLabel` if absent).
   */
  scenario?: ScenarioComparisonResponse | ScenarioDetailResponse | null;
  className?: string;
  style?: CSSProperties;
  emptyLabel?: string;
  children?: (label: string) => ReactNode;
}

export function ScenarioName({
  scenario: scenarioProp,
  className,
  style,
  emptyLabel = "Scenario",
  children,
}: ScenarioNameProps) {
  const maybe = useMaybeScenarioContext();
  const scenario = scenarioProp ?? maybe?.scenario ?? null;
  const label = scenario ? resolveScenarioDisplayName(scenario) : emptyLabel;
  if (children) return <>{children(label)}</>;
  return (
    <span className={className} style={style}>
      {label}
    </span>
  );
}
