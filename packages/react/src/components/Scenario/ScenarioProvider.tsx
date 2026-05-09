import { createContext, useContext, useState, type ReactNode } from "react";
import type { components } from "@fenero/lux-core";

type ScenarioDetailResponse = components["schemas"]["ScenarioDetailResponse"];
type ScenarioComparisonResponse = components["schemas"]["ScenarioComparisonResponse"];
type SpecAuditResponse = components["schemas"]["SpecAuditResponse"];
type RefinementResponse = components["schemas"]["RefinementResponse"];

interface CaseScenarioContextValue {
  caseId: string;
  scenarios: ScenarioComparisonResponse[];
  isLoading: boolean;
}

interface ScenarioContextValue {
  caseId: string;
  scenarioId: string;
  scenario: ScenarioDetailResponse;
  audit: SpecAuditResponse[];
  refinements: RefinementResponse[];
  activeProductId: string | null;
  setActiveProductId: (id: string) => void;
  isLoading: boolean;
}

const CaseScenarioContext = createContext<CaseScenarioContextValue | null>(null);
const ScenarioContext = createContext<ScenarioContextValue | null>(null);

export function useCaseScenarioContext(): CaseScenarioContextValue {
  const ctx = useContext(CaseScenarioContext);
  if (!ctx) throw new Error("CaseScenarioProvider required");
  return ctx;
}

export function useScenarioContext(): ScenarioContextValue {
  const ctx = useContext(ScenarioContext);
  if (!ctx) throw new Error("ScenarioProvider required");
  return ctx;
}

export interface CaseScenarioProviderProps {
  caseId: string;
  scenarios?: ScenarioComparisonResponse[];
  isLoading?: boolean;
  children: ReactNode;
}

export function CaseScenarioProvider({
  caseId,
  scenarios = [],
  isLoading = false,
  children,
}: CaseScenarioProviderProps) {
  return (
    <CaseScenarioContext.Provider value={{ caseId, scenarios, isLoading }}>
      {children}
    </CaseScenarioContext.Provider>
  );
}

export interface ScenarioProviderProps {
  scenarioId: string;
  scenario: ScenarioDetailResponse;
  audit?: SpecAuditResponse[];
  refinements?: RefinementResponse[];
  initialProductId?: string | null;
  isLoading?: boolean;
  children: ReactNode;
}

export function ScenarioProvider({
  scenarioId,
  scenario,
  audit = [],
  refinements = [],
  initialProductId = null,
  isLoading = false,
  children,
}: ScenarioProviderProps) {
  const { caseId } = useCaseScenarioContext();
  const [activeProductId, setActiveProductId] = useState<string | null>(initialProductId);

  return (
    <ScenarioContext.Provider
      value={{ caseId, scenarioId, scenario, audit, refinements, activeProductId, setActiveProductId, isLoading }}
    >
      {children}
    </ScenarioContext.Provider>
  );
}
