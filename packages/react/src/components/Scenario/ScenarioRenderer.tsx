import type { ReactNode } from "react";
import { CaseScenarioProvider } from "./ScenarioProvider.js";
import { ScenarioProvider } from "./ScenarioProvider.js";
import { ScenarioHeader } from "./ScenarioHeader.js";
import { ScenarioTabs } from "./ScenarioTabs.js";
import { ScenarioTabPanel } from "./ScenarioTabPanel.js";
import { ScenarioCalcLogs } from "./ScenarioCalcLogs.js";
import { ScenarioRefs, type RefClickPayload } from "./ScenarioRefs.js";
import { ScenarioAdvice } from "./ScenarioAdvice.js";
import type { components } from "@multiversal-ventures/lux-core";

type ScenarioDetailResponse = components["schemas"]["ScenarioDetailResponse"];
type ScenarioComparisonResponse = components["schemas"]["ScenarioComparisonResponse"];
type SpecAuditResponse = components["schemas"]["SpecAuditResponse"];
type RefinementResponse = components["schemas"]["RefinementResponse"];

export interface ScenarioRendererProps {
  caseId: string;
  scenarioId: string;
  scenario: ScenarioDetailResponse;
  scenarios?: ScenarioComparisonResponse[];
  audit?: SpecAuditResponse[];
  refinements?: RefinementResponse[];
  onRefClick: (canonicalKey: string, payload: RefClickPayload) => void;
  onAction?: (code: string, action: string) => void;
  onSelectScenario?: (scenarioId: string) => void;
  onNewScenario?: () => void;
  children?: ReactNode;
  className?: string;
}

export function ScenarioRenderer({
  caseId,
  scenarioId,
  scenario,
  scenarios = [],
  audit,
  refinements = [],
  onRefClick,
  onAction,
  onSelectScenario,
  onNewScenario,
  children,
  className,
}: ScenarioRendererProps) {
  return (
    <CaseScenarioProvider caseId={caseId} scenarios={scenarios}>
      <ScenarioProvider
        scenarioId={scenarioId}
        scenario={scenario}
        {...(audit !== undefined ? { audit } : {})}
        refinements={refinements}
      >
        <div className={className}>
          <ScenarioHeader />
          <ScenarioTabs />
          <ScenarioTabPanel>
            <ScenarioAdvice onAction={onAction} />
            <ScenarioCalcLogs />
            <ScenarioRefs onRefClick={onRefClick} />
            {children}
          </ScenarioTabPanel>
        </div>
      </ScenarioProvider>
    </CaseScenarioProvider>
  );
}
