export {
  CaseScenarioProvider,
  ScenarioProvider,
  useCaseScenarioContext,
  useMaybeCaseScenarioContext,
  useScenarioContext,
  useMaybeScenarioContext,
  useActiveScenarioId,
  caseScenariosQueryKey,
} from "./ScenarioProvider.js";
export type { CaseScenarioProviderProps, ScenarioProviderProps } from "./ScenarioProvider.js";
export { useScenarioSummary, formatScenarioSummary } from "./useScenarioSummary.js";
export type {
  UseScenarioSummaryResult,
  FormatScenarioSummaryOptions,
  HasSummaryResult,
} from "./useScenarioSummary.js";
export { ScenarioSummaryText } from "./ScenarioSummaryText.js";
export type { ScenarioSummaryTextProps } from "./ScenarioSummaryText.js";
export { ScenarioHeader } from "./ScenarioHeader.js";
export type { ScenarioHeaderProps } from "./ScenarioHeader.js";
export { ScenarioName } from "./ScenarioName.js";
export type { ScenarioNameProps } from "./ScenarioName.js";
export { RefinementName } from "./RefinementName.js";
export type { RefinementNameProps } from "./RefinementName.js";
export {
  resolveScenarioDisplayName,
  formatScenarioListHeadline,
  formatRefinementDisplayName,
  formatRefinementSubtitle,
  formatRefinementRowTitle,
} from "./scenarioDisplay.js";
export { ScenarioTabs } from "./ScenarioTabs.js";
export type { ScenarioTabsProps, ScenarioTabExtra } from "./ScenarioTabs.js";
export { ScenarioTabPanel } from "./ScenarioTabPanel.js";
export type { ScenarioTabPanelProps } from "./ScenarioTabPanel.js";
export { ScenarioCalcLogs } from "./ScenarioCalcLogs.js";
export type { ScenarioCalcLogsProps } from "./ScenarioCalcLogs.js";
export { ScenarioRefs } from "./ScenarioRefs.js";
export type { ScenarioRefsProps, RefClickPayload } from "./ScenarioRefs.js";
export {
  useScenarioReferences,
  payloadFromRow,
} from "./useScenarioReferences.js";
export type {
  ScenarioReferenceRow,
  InputProvenance,
  InputValueRow,
  ExtractionSourceRef,
  AuditStepWithProvenance,
  UseScenarioReferencesResult,
} from "./useScenarioReferences.js";
export { ScenarioReferenceTable } from "./ScenarioReferenceTable.js";
export type { ScenarioReferenceTableProps } from "./ScenarioReferenceTable.js";
export { ScenarioReferenceDetail } from "./ScenarioReferenceDetail.js";
export type { ScenarioReferenceDetailProps } from "./ScenarioReferenceDetail.js";
export {
  formatReferenceValue,
  shortenText,
  bboxLabel,
} from "./referenceFormat.js";
export { ScenarioAdvice } from "./ScenarioAdvice.js";
export type { ScenarioAdviceProps } from "./ScenarioAdvice.js";
export { ScenarioNarrativeSummary } from "./ScenarioNarrativeSummary.js";
export type { ScenarioNarrativeSummaryProps } from "./ScenarioNarrativeSummary.js";
export { useScenarioAdvice } from "./useScenarioAdvice.js";
export type { UseScenarioAdviceReturn } from "./useScenarioAdvice.js";
export { ScenarioSidebar } from "./ScenarioSidebar.js";
export type { ScenarioSidebarProps } from "./ScenarioSidebar.js";
export { ScenarioComparison } from "./ScenarioComparison.js";
export type { ScenarioComparisonProps } from "./ScenarioComparison.js";
export { ScenarioRenderer } from "./ScenarioRenderer.js";
export type { ScenarioRendererProps } from "./ScenarioRenderer.js";
export { ScenarioIdentities } from "./ScenarioIdentities.js";
export type { ScenarioIdentitiesProps } from "./ScenarioIdentities.js";
export { ScenarioResults, AGENCY_LABELS, KNOWN_AGENCIES } from "./ScenarioResults.js";
export type { ScenarioResultsProps } from "./ScenarioResults.js";
export {
  useScenarioProductIncome,
  PRODUCT_ID_TO_AGENCY,
} from "./useScenarioProductIncome.js";
export type { UseScenarioProductIncomeResult } from "./useScenarioProductIncome.js";
export {
  useScenarioRunningState,
  useMarkScenarioJustStarted,
} from "./useScenarioRunningState.js";
export type {
  ScenarioRunningState,
  ScenarioRunPhase,
  UseMarkScenarioJustStartedResult,
} from "./useScenarioRunningState.js";
export { ScenarioRunningPanel } from "./ScenarioRunningPanel.js";
export type {
  ScenarioRunningPanelProps,
  ScenarioRunningPanelClassNames,
  ScenarioRunningPanelSlots,
} from "./ScenarioRunningPanel.js";
export { useScenarioRequiredInputs } from "./useScenarioRequiredInputs.js";
export type {
  MissingProductInputs,
  UseScenarioRequiredInputsResult,
} from "./useScenarioRequiredInputs.js";
export { ScenarioRequiredInputsBanner } from "./ScenarioRequiredInputsBanner.js";
export type { ScenarioRequiredInputsBannerProps } from "./ScenarioRequiredInputsBanner.js";
