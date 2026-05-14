// SDK session primitives (from refactor/lux-as-sdk architecture)
export { SessionProvider } from "./SessionProvider.js";
export { useSession } from "./useSession.js";
export { useEvents } from "./useEvents.js";

// Operator provider + context (react-query based)
export {
	OperatorProvider,
	useOperatorClient,
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

// Query hooks (react-query based)
export {
	useCase,
	useCases,
	useSpecs,
	useSpecDetail,
	useDocuments,
	useExtractions,
	useBanking,
	useAudit,
	useAuthedBlob,
	useQualification,
	usePortalSession,
} from "./hooks/index.js";
export type { UseQualificationReturn, QualificationState, UsePortalSessionReturn } from "./hooks/index.js";

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
export { Checklist } from "./components/Checklist/index.js";
export type { ChecklistProps } from "./components/Checklist/index.js";
export { ConsentBanner } from "./components/ConsentBanner/index.js";
export type { ConsentBannerProps } from "./components/ConsentBanner/index.js";

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
  applyContextChange,
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
  caseIdentitiesEntitiesQueryKey,
  caseIdentitiesScenarioQueryKey,
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
