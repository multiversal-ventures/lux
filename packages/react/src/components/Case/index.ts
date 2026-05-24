export {
  useCaseDocuments,
  normalizeCaseDocument,
  caseDocumentsQueryKey,
  caseFilesQueryKey,
} from "./useCaseDocuments.js";
export type { CaseDocumentRow, UseCaseDocumentsResult } from "./useCaseDocuments.js";

export {
  useCaseIdentities,
  caseIdentitiesQueryKey,
  caseIdentitiesEntitiesQueryKey,
  caseIdentitiesScenarioQueryKey,
} from "./useCaseIdentities.js";
export type {
  CaseIdentityRow,
  UseCaseIdentitiesOptions,
  UseCaseIdentitiesResult,
} from "./useCaseIdentities.js";

export { useCaseRelationships, caseRelationshipsQueryKey } from "./useCaseRelationships.js";

export { useUploadCaseFiles } from "./useUploadCaseFiles.js";
export type {
  UploadCaseFilesResponse,
  UseUploadCaseFilesVars,
  UseUploadCaseFilesOptions,
  UseUploadCaseFilesResult,
} from "./useUploadCaseFiles.js";

export { CaseFileUploadDropzone } from "./CaseFileUploadDropzone.js";
export type {
  CaseFileUploadDropzoneProps,
  CaseFileUploadDropzoneClassNames,
  CaseFileUploadRenderProps,
  UploadPhase,
} from "./CaseFileUploadDropzone.js";

export { CaseDocumentPicker } from "./CaseDocumentPicker.js";
export type {
  CaseDocumentPickerProps,
  CaseDocumentPickerClassNames,
  CaseDocumentPickerSlots,
} from "./CaseDocumentPicker.js";

export { CaseIdentityPicker } from "./CaseIdentityPicker.js";
export type {
  CaseIdentityPickerProps,
  CaseIdentityPickerClassNames,
  CaseIdentityPickerSlots,
} from "./CaseIdentityPicker.js";

export { ApproachPicker } from "./ApproachPicker.js";
export type {
  ApproachPickerProps,
  ApproachPickerClassNames,
  ApproachOption,
} from "./ApproachPicker.js";

export { ProductPicker } from "./ProductPicker.js";
export type {
  ProductPickerProps,
  ProductPickerClassNames,
  ProductOption,
} from "./ProductPicker.js";

export {
  useTenantProducts,
  tenantProductsQueryKey,
  groupProductsByApproach,
  toApproachOptions,
  toProductOptions,
} from "./useTenantProducts.js";
export type {
  TenantProduct,
  UseTenantProductsOptions,
  UseTenantProductsResult,
} from "./useTenantProducts.js";

export {
  getProductDisplayLabel,
  validateRequiredDocuments,
  getMissingDocsErrorMessage,
} from "./productMetadata.js";
export type {
  ProductLabelSource,
  ProductRequiredDocsSource,
  MissingProductDocs,
  ValidateRequiredDocumentsResult,
} from "./productMetadata.js";

export {
  useSuggestedProducts,
  suggestedProductsQueryKey,
} from "./useSuggestedProducts.js";
export type {
  SuggestedProducts,
  ProductSuggestion,
  UseSuggestedProductsOptions,
  UseSuggestedProductsResult,
} from "./useSuggestedProducts.js";

export { useCreateScenarioWithRefinement } from "./useCreateScenarioWithRefinement.js";
export type {
  CreateScenarioWithRefinementInput,
  CreateScenarioWithRefinementResult,
  UseCreateScenarioWithRefinementResult,
} from "./useCreateScenarioWithRefinement.js";

export {
  CaseWorkflowProvider,
  useCaseWorkflowContext,
  useMaybeCaseWorkflowContext,
} from "./CaseWorkflowProvider.js";
export type { CaseWorkflowProviderProps } from "./CaseWorkflowProvider.js";

export { useCaseUploadFlow } from "./useCaseUploadFlow.js";
export type { UseCaseUploadFlowResult } from "./useCaseUploadFlow.js";

export { CaseUploadStatusBanner } from "./CaseUploadStatusBanner.js";
export type {
  CaseUploadStatusBannerProps,
  CaseUploadStatusBannerClassNames,
  CaseUploadStatusBannerSlots,
} from "./CaseUploadStatusBanner.js";

export { CaseActivityBadge } from "./CaseActivityBadge.js";
export type {
  CaseActivityBadgeProps,
  CaseActivityBadgeClassNames,
  CaseActivityBadgeSlots,
} from "./CaseActivityBadge.js";

export {
  createCaseWorkflowStore,
} from "../../state/caseWorkflowStore.js";
export type {
  CaseWorkflowState,
  CaseWorkflowActions,
  CaseWorkflowStore,
} from "../../state/caseWorkflowStore.js";
