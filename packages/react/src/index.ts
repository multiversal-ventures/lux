// Global singleton store (health, version, products)
export { luxStore, useHealth, useVersion } from "./store/index.js";
export type {
  LuxStoreState,
  HealthSlice,
  VersionSlice,
  SliceStatus,
  UseHealthResult,
  UseVersionResult,
} from "./store/index.js";


// SDK session primitives (from refactor/lux-as-sdk architecture)
export { SessionProvider } from "./SessionProvider.js";
export { useSession } from "./useSession.js";
export { useEvents } from "./useEvents.js";

// Operator provider + context (react-query based)
export {
	OperatorProvider,
	useOperatorClient,
	useOperatorClientOptional,
	useBearerToken,
	useBaseUrl,
} from "./providers/OperatorProvider.js";
export type { OperatorProviderProps } from "./providers/OperatorProvider.js";

// Case events provider (SSE)
export {
	CaseEventsProvider,
	useCaseEvents,
} from "./providers/CaseEventsProvider.js";
export type {
	CaseEventsProviderProps,
	UseCaseEventsOptions,
	UseCaseEventsResult,
} from "./providers/CaseEventsProvider.js";
export {
	applyScenarioRunSideEffects,
	invalidationMap,
} from "./providers/invalidation-map.js";

// Cross-component zustand stores. ``createCaseWorkflowStore`` is
// re-exported via ``./components/Case/index.js`` already; here we
// surface the scenario-run pulse store so SSE bridges (e.g. Gunnr's
// ``useEventInvalidation``) can clear pulses on terminal events
// without depending on the lux-react React context tree.
export {
	createScenarioRunsStore,
	getScenarioRunsStore,
} from "./state/index.js";
export type {
	ScenarioRunsState,
	ScenarioRunsActions,
	ScenarioRunsStore,
} from "./state/index.js";

// Query hooks (react-query based)
export {
	useCase,
	useCases,
	useCasesList,
	useDeleteCase,
	casesListQueryKey,
	useSpecs,
	useSpecDetail,
	useDocuments,
	useExtractions,
	useDocTypeRegions,
	useCreditReport,
	useBanking,
	useBankingTransactions,
	useAudit,
	useAuthedBlob,
	useQualification,
	usePortalSession,
	useCasePipelinePhase,
	derivePipelinePhase,
	PIPELINE_PHASE_PRIORITY,
	useCreatePortalLink,
	usePortalSuggestions,
	usePortalLinkStatus,
	buildPortalUrl,
} from "./hooks/index.js";
export type { UseQualificationReturn, QualificationState, UsePortalSessionReturn, PipelinePhaseResult, PortalLink, PortalLinkRequest, PortalRequestItem, PortalLinkStatus } from "./hooks/index.js";

// UI components
export { AuthedImage } from "./components/AuthedImage/index.js";
export type { AuthedImageProps } from "./components/AuthedImage/index.js";
export { BoundingBoxOverlay } from "./components/BoundingBoxOverlay/index.js";
export type { BoundingBoxOverlayProps, BboxNormalized, BboxHighlight } from "./components/BoundingBoxOverlay/index.js";
export { DocumentPageImage } from "./components/DocumentPageImage/index.js";
export type { DocumentPageImageProps } from "./components/DocumentPageImage/index.js";
export { PipelineFeed } from "./components/PipelineFeed/index.js";
export type { PipelineFeedProps } from "./components/PipelineFeed/index.js";
export { AuditTrail } from "./components/AuditTrail/index.js";
export type { AuditTrailProps } from "./components/AuditTrail/index.js";
export { ResultCard } from "./components/ResultCard/index.js";
export type { ResultCardProps } from "./components/ResultCard/index.js";
export { DocumentList } from "./components/DocumentList/index.js";
export type { DocumentListProps } from "./components/DocumentList/index.js";
export { ExtractionTable } from "./components/ExtractionTable/index.js";
export type { ExtractionTableProps } from "./components/ExtractionTable/index.js";
export { BankingSummary } from "./components/BankingSummary/index.js";
export type { BankingSummaryProps } from "./components/BankingSummary/index.js";
export { CreditSummary, CreditScoreDisplay, TradeAccountsTable } from "./components/CreditSummary/index.js";
export type { CreditSummaryProps, CreditScoreDisplayProps, TradeAccountsTableProps } from "./components/CreditSummary/index.js";
export { DtiPanel } from "./components/DtiPanel/index.js";
export type { DtiPanelProps } from "./components/DtiPanel/index.js";
export { Checklist } from "./components/Checklist/index.js";
export type { ChecklistProps } from "./components/Checklist/index.js";
export { ConsentBanner } from "./components/ConsentBanner/index.js";
export type { ConsentBannerProps } from "./components/ConsentBanner/index.js";
export { BorrowerPortalLink } from "./components/PortalLink/index.js";
export type { BorrowerPortalLinkProps } from "./components/PortalLink/index.js";
export { BorrowerPortal } from "./components/PortalLink/index.js";
export type { BorrowerPortalProps } from "./components/PortalLink/index.js";

// Scenario compound component system
export {
  CaseScenarioProvider,
  ScenarioProvider,
  useCaseScenarioContext,
  useMaybeCaseScenarioContext,
  useScenarioContext,
  useMaybeScenarioContext,
  useActiveScenarioId,
  caseScenariosQueryKey,
  ScenarioRenderer,
  ScenarioHeader,
  ScenarioName,
  RefinementName,
  ScenarioTabs,
  ScenarioTabPanel,
  ScenarioCalcLogs,
  ScenarioRefs,
  ScenarioAdvice,
  ScenarioNarrativeSummary,
  ScenarioSidebar,
  ScenarioComparison,
  ScenarioIdentities,
  ScenarioResults,
  ScenarioSummaryText,
  AGENCY_LABELS,
  KNOWN_AGENCIES,
  useScenarioAdvice,
  useScenarioSummary,
  useScenarioProductIncome,
  useScenarioRunningState,
  useMarkScenarioJustStarted,
  ScenarioRunningPanel,
  useScenarioRequiredInputs,
  ScenarioRequiredInputsBanner,
  useScenarioReferences,
  payloadFromRow,
  ScenarioReferenceTable,
  ScenarioReferenceDetail,
  PRODUCT_ID_TO_AGENCY,
  formatScenarioSummary,
  formatReferenceValue,
  shortenText,
  bboxLabel,
  resolveScenarioDisplayName,
  formatScenarioListHeadline,
  formatRefinementDisplayName,
  formatRefinementSubtitle,
  formatRefinementRowTitle,
} from "./components/Scenario/index.js";
export {
  ReportRenderer,
  ReportSheet,
  ReportSheetTabs,
  useReportWorkbook,
  reportWorkbookQueryKey,
} from "./components/Reports/index.js";
export {
  sheetToHtmlWithStyles,
  cellStyleToCss,
  rgbToHex,
  escapeHtml,
  decodeHtmlEntities,
} from "./lib/excelSheet.js";
export {
  ReferenceFocusProvider,
  useReferenceFocus,
  ReferenceViewerPanel,
  useReferenceFocusFromSearchParams,
  payloadFromSearchParams,
} from "./components/Reference/index.js";
export type {
  ReferenceFocus,
  ReferenceFocusContextValue,
  ReferenceFocusProviderProps,
  ReferenceViewerPanelProps,
  SearchParamsLike,
  ReferenceFocusParamNames,
  UseReferenceFocusFromSearchParamsOptions,
} from "./components/Reference/index.js";

export {
  CaseDocumentViewer,
  CasePageImage,
  useCaseExtractions,
  useCasePageBlob,
} from "./components/Document/index.js";

export {
  resolveProductCategory,
  useProductCategory,
  TaxYearOverridePicker,
  validateTaxYears,
  StatementPeriodPicker,
  DEFAULT_STATEMENT_PERIOD_MONTHS,
  NumberOfYearsPicker,
  ExpenseFactorEditor,
  useRefinementForm,
  toUserInputsPayload,
  useCreateRefinement,
  RefinementPeriodsTab,
  RefinementTabs,
  RefinementExtractionTab,
  DynamicUserInputsForm,
  DynamicUserInputsFormFields,
  applyContextChange,
  validateInitialRequiredInputs,
} from "./components/Refinement/index.js";
export type {
  ProductCategory,
  TaxYearOverridePickerProps,
  TaxYearOverridePickerClassNames,
  TaxYearOverridePickerSlots,
  TaxYearValidation,
  StatementPeriodPickerProps,
  StatementPeriodPickerClassNames,
  StatementPeriodPickerSlots,
  NumberOfYearsPickerProps,
  NumberOfYearsPickerClassNames,
  NumberOfYearsPickerSlots,
  ExpenseFactorEditorProps,
  ExpenseFactorEditorClassNames,
  ExpenseFactorEditorSlots,
  RefinementFormState,
  RefinementFormSeed,
  RefinementFormValidation,
  UseRefinementFormOptions,
  UseRefinementFormResult,
  CreateRefinementInput,
  CreateRefinementResult,
  UseCreateRefinementResult,
  RefinementPeriodsTabProps,
  RefinementPeriodsTabClassNames,
  RefinementTabsProps,
  RefinementTabsClassNames,
  RefinementTabDescriptor,
  RefinementExtractionTabProps,
  RefinementExtractionTabClassNames,
  RefinementExtractionTabSlots,
  DynamicUserInputsFormProps,
  DynamicUserInputsFormFieldsProps,
  DynamicUserInputsFormClassNames,
  DynamicUserInputsFormSlots,
  DynamicUserInputFieldRenderer,
  DynamicUserInputFieldRendererProps,
  RefinementContext,
} from "./components/Refinement/index.js";
export type {
  CaseDocumentViewerProps,
  CaseDocumentViewerClassNames,
  CaseDocumentViewerRenderSlots,
  CasePageImageProps,
  UseCasePageBlobResult,
} from "./components/Document/index.js";

export {
  useCaseDocuments,
  useCaseIdentities,
  useCaseRelationships,
  useUploadCaseFiles,
  useCreateScenarioWithRefinement,
  CaseFileUploadDropzone,
  CaseDocumentPicker,
  CaseIdentityPicker,
  ApproachPicker,
  ProductPicker,
  useTenantProducts,
  tenantProductsQueryKey,
  groupProductsByApproach,
  toApproachOptions,
  toProductOptions,
  getProductDisplayLabel,
  validateRequiredDocuments,
  getMissingDocsErrorMessage,
  useSuggestedProducts,
  suggestedProductsQueryKey,
  CaseWorkflowProvider,
  useCaseWorkflowContext,
  useMaybeCaseWorkflowContext,
  useCaseUploadFlow,
  CaseUploadStatusBanner,
  CaseActivityBadge,
  createCaseWorkflowStore,
  normalizeCaseDocument,
  caseDocumentsQueryKey,
  caseFilesQueryKey,
  caseIdentitiesQueryKey,
  caseIdentitiesEntitiesQueryKey,
  caseIdentitiesScenarioQueryKey,
  caseRelationshipsQueryKey,
} from "./components/Case/index.js";
export type {
  CaseDocumentRow,
  UseCaseDocumentsResult,
  CaseIdentityRow,
  UseCaseIdentitiesOptions,
  UseCaseIdentitiesResult,
  UploadCaseFilesResponse,
  UseUploadCaseFilesVars,
  UseUploadCaseFilesOptions,
  UseUploadCaseFilesResult,
  CaseFileUploadDropzoneProps,
  CaseFileUploadDropzoneClassNames,
  CaseFileUploadRenderProps,
  UploadPhase,
  CaseDocumentPickerProps,
  CaseDocumentPickerClassNames,
  CaseDocumentPickerSlots,
  CaseIdentityPickerProps,
  CaseIdentityPickerClassNames,
  CaseIdentityPickerSlots,
  ApproachPickerProps,
  ApproachPickerClassNames,
  ApproachOption,
  ProductPickerProps,
  ProductPickerClassNames,
  ProductOption,
  TenantProduct,
  UseTenantProductsOptions,
  UseTenantProductsResult,
  ProductLabelSource,
  ProductRequiredDocsSource,
  MissingProductDocs,
  ValidateRequiredDocumentsResult,
  SuggestedProducts,
  ProductSuggestion,
  UseSuggestedProductsOptions,
  UseSuggestedProductsResult,
  CreateScenarioWithRefinementInput,
  CreateScenarioWithRefinementResult,
  UseCreateScenarioWithRefinementResult,
  CaseWorkflowProviderProps,
  UseCaseUploadFlowResult,
  CaseUploadStatusBannerProps,
  CaseUploadStatusBannerClassNames,
  CaseUploadStatusBannerSlots,
  CaseActivityBadgeProps,
  CaseActivityBadgeClassNames,
  CaseActivityBadgeSlots,
  CaseWorkflowState,
  CaseWorkflowActions,
  CaseWorkflowStore,
  UseInitialRequiredInputsResult,
} from "./components/Case/index.js";
export {
  toRefinementContext,
  useInitialRequiredInputs,
} from "./components/Case/index.js";
export type {
  ReportRendererProps,
  ReportSheetProps,
  ReportSheetTabsProps,
  UseReportWorkbookOptions,
  UseReportWorkbookResult,
  ReportGenerateResponse,
} from "./components/Reports/index.js";

export type {
  CaseScenarioProviderProps,
  ScenarioProviderProps,
  ScenarioRendererProps,
  ScenarioHeaderProps,
  ScenarioNameProps,
  RefinementNameProps,
  ScenarioTabsProps,
  ScenarioTabExtra,
  ScenarioTabPanelProps,
  ScenarioCalcLogsProps,
  ScenarioRefsProps,
  RefClickPayload,
  ScenarioAdviceProps,
  ScenarioNarrativeSummaryProps,
  ScenarioSidebarProps,
  ScenarioComparisonProps,
  ScenarioIdentitiesProps,
  ScenarioResultsProps,
  ScenarioSummaryTextProps,
  UseScenarioAdviceReturn,
  UseScenarioSummaryResult,
  UseScenarioProductIncomeResult,
  ScenarioRunPhase,
  ScenarioRunningState,
  UseMarkScenarioJustStartedResult,
  ScenarioRunningPanelProps,
  ScenarioRunningPanelClassNames,
  ScenarioRunningPanelSlots,
  MissingProductInputs,
  UseScenarioRequiredInputsResult,
  ScenarioRequiredInputsBannerProps,
  UseScenarioReferencesResult,
  ScenarioReferenceRow,
  ScenarioReferenceTableProps,
  ScenarioReferenceDetailProps,
  ExtractionSourceRef,
  InputProvenance,
  InputValueRow,
  AuditStepWithProvenance,
  FormatScenarioSummaryOptions,
  HasSummaryResult,
} from "./components/Scenario/index.js";
