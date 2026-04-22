export interface CaseCompletionRedirectInput {
	caseId: string | null | undefined;
	isComplete: boolean;
	firstScenarioId: string | null;
	scenariosReady: boolean;
	scenarioIds: string[];
  }
  
  export function getCaseCompletionRedirect({
	caseId,
	isComplete,
	firstScenarioId,
	scenariosReady,
	scenarioIds,
  }: CaseCompletionRedirectInput): string | null {
	if (!caseId || !isComplete) {
	  return null;
	}
  
	if (firstScenarioId) {
	  return `/case/${caseId}/scenario/${firstScenarioId}/summary`;
	}
  
	const firstKnownScenarioId = scenarioIds[0];
	if (firstKnownScenarioId) {
	  return `/case/${caseId}/scenario/${firstKnownScenarioId}/summary`;
	}
  
	if (!scenariosReady) {
	  return null;
	}
  
	return `/case/${caseId}/new-scenario`;
  }
  