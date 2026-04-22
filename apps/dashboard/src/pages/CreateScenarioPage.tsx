/**
 * CreateScenarioPage - Full page for creating a new income scenario.
 *
 * Features:
 * - Approach selection (QM vs Non-QM)
 * - Loan product selection based on approach
 * - Shared draft editor for borrowers, documents, periods, and note
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import {
  useCaseResult,
  useCreateScenarioMutation,
  useIncomeReadiness,
  useLoanProducts,
  useTaxYearResolution,
  useConfirmTaxYearMutation,
} from '../hooks/useCaseQueries';
import { ScenarioDraftEditor } from '../components/scenario';
import { Warnings } from '../components/review/Warnings';
import {
  areDraftIdSetsEqual,
  buildBorrowers,
  DEFAULT_SCENARIO_DRAFT,
  getAvailableYears,
  normalizeScenarioDraftPeriodFields,
} from '../utils/scenarioDraft';
import { useScenarioDraft } from "../hooks";
import { PRODUCT_REQUIRED_DOCS, validateRequiredDocuments } from '../utils/scenarioDocumentValidation';

// Human-readable product names for error messages
const PRODUCT_DISPLAY_NAMES: Record<string, string> = {
  fnma_selling_guide: 'Fannie Mae',
  fhlmc_selling_guide: 'Freddie Mac',
  fha_handbook: 'FHA',
  usda_handbook: 'USDA',
  va_handbook: 'VA',
  non_qm_bank_statement: 'Bank Statement',
  irs_1099_income: '1099 Income',
};

// Non-QM products
const NON_QM_PRODUCTS = [
  { id: 'non_qm_bank_statement', display_name: 'Bank Statements', enabled: true },
  { id: 'irs_1099_income', display_name: 'IRS 1099 Income', enabled: true },
  { id: 'dscr', display_name: 'DSCR', enabled: false },
];

export function CreateScenarioPage() {
  const { caseId } = useParams<{ caseId: string }>();
  const navigate = useNavigate();
  const createScenarioMutation = useCreateScenarioMutation();
  const confirmTaxYearMutation = useConfirmTaxYearMutation();

  const {
    draft: scenarioDraft,
    setDraft,
    periodVariant,
  } = useScenarioDraft({
    initialDraft: DEFAULT_SCENARIO_DRAFT,
    resetKey: 'create-scenario',
  });

  const {
    approach,
    loanProductIds: selectedProducts,
    borrowerIds: selectedBorrowers,
    documentIds: selectedDocuments,
    y1Override: selectedY1Year,
    y2Override: selectedY2Year,
    statementPeriodMonths,
    note: scenarioNote,
  } = scenarioDraft;

  const [error, setError] = useState<string | null>(null);
  const taxYearsInitializedRef = useRef(false);
  const approachInitializedRef = useRef(false);
  const borrowerSelectionTouchedRef = useRef(false);
  const documentSelectionTouchedRef = useRef(false);

  const isSubmitting = createScenarioMutation.isPending || confirmTaxYearMutation.isPending;

  // Fetch case data
  const { data: caseResult, isLoading: caseLoading } = useCaseResult(caseId ?? '');
  const { data: readiness } = useIncomeReadiness(caseId ?? null, 'fannie_mae', {
    enabled: !!caseId && !!caseResult,
  });
  const { data: taxYearResolution } = useTaxYearResolution(caseId ?? null, {
    enabled: !!caseId && !!caseResult,
  });

  // Fetch loan products
  const { data: loanProductsResponse, isLoading: productsLoading } = useLoanProducts();

  const documents = useMemo(
    () => caseResult?.extractions?.documents ?? [],
    [caseResult],
  );
  const selectedDocumentsForValidation = useMemo(
    () => documents
      .filter((document) => selectedDocuments.includes(document.id))
      .map((document) => ({ documentType: document.document_type })),
    [documents, selectedDocuments],
  );

  // Extract borrowers from case
  const borrowers = useMemo(() => buildBorrowers(caseResult), [caseResult]);

  // Unique years from documents
  const documentYears = useMemo(
    () => getAvailableYears(documents),
    [documents],
  );

  const selectableYears = useMemo(() => {
    const years = new Set(documentYears);
    if (taxYearResolution?.y1) years.add(taxYearResolution.y1);
    if (taxYearResolution?.y2) years.add(taxYearResolution.y2);
    if (taxYearResolution?.y3) years.add(taxYearResolution.y3);
    return Array.from(years).sort((a, b) => b.localeCompare(a));
  }, [documentYears, taxYearResolution]);

  const taxYearSelectionReason = useMemo(() => {
    if (!taxYearResolution) return null;
    return `Auto-resolved default: Y1 ${taxYearResolution.y1 ?? '—'} / Y2 ${taxYearResolution.y2 ?? '—'}`;
  }, [taxYearResolution]);

  useEffect(() => {
    if (!taxYearResolution || taxYearsInitializedRef.current) return;
    setDraft((prev) => ({
      ...prev,
      y1Override: taxYearResolution.y1 ?? null,
      y2Override: taxYearResolution.y2 ?? null,
    }));
    taxYearsInitializedRef.current = true;
  }, [taxYearResolution, setDraft]);

  useEffect(() => {
    if (borrowerSelectionTouchedRef.current || borrowers.length === 0) return;
    const nextBorrowerIds = borrowers.map((borrower) => borrower.id);
    setDraft((prev) => (
      areDraftIdSetsEqual(prev.borrowerIds, nextBorrowerIds)
        ? prev
        : { ...prev, borrowerIds: nextBorrowerIds }
    ));
  }, [borrowers, setDraft]);

  useEffect(() => {
    if (documentSelectionTouchedRef.current || documents.length === 0) return;
    const nextDocumentIds = documents.map((document) => document.id);
    setDraft((prev) => (
      areDraftIdSetsEqual(prev.documentIds, nextDocumentIds)
        ? prev
        : { ...prev, documentIds: nextDocumentIds }
    ));
  }, [documents, setDraft]);

  const qmProducts = useMemo(() => {
    const products = loanProductsResponse?.products ?? [];
    return products.filter((p) => p.agency !== 'NON_QM');
  }, [loanProductsResponse]);

  useEffect(() => {
    if (!approachInitializedRef.current && documents.length > 0) {
      approachInitializedRef.current = true;
      const docTypes = new Set(documents.map((d) => d.document_type));
      const hasQmDocs = PRODUCT_REQUIRED_DOCS.fannie_mae?.some((t) => docTypes.has(t));
      const hasBsDocs = PRODUCT_REQUIRED_DOCS.non_qm_bank_statement?.some((t) => docTypes.has(t));
      const has1099Docs = PRODUCT_REQUIRED_DOCS.irs_1099_income?.some((t) => docTypes.has(t));
      if (hasQmDocs) {
        const enabled = qmProducts.filter((p) => p.enabled).map((p) => p.id);
        setDraft((prev) => ({ ...prev, loanProductIds: enabled }));
      } else if (hasBsDocs) {
        setDraft((prev) => ({ ...prev, approach: 'non_qualified_mortgage', loanProductIds: ['non_qm_bank_statement'] }));
      } else if (has1099Docs) {
        setDraft((prev) => ({ ...prev, approach: 'non_qualified_mortgage', loanProductIds: ['irs_1099_income'] }));
      } else {
        const enabled = qmProducts.filter((p) => p.enabled).map((p) => p.id);
        setDraft((prev) => ({ ...prev, loanProductIds: enabled }));
      }
      return;
    }
  }, [approach, documents, qmProducts, setDraft]);


  const documentValidation = useMemo(
    () => validateRequiredDocuments(selectedProducts, selectedDocumentsForValidation),
    [selectedProducts, selectedDocumentsForValidation],
  );
  const hasRequiredDocs = documentValidation.valid;
  const missingProductDocs = documentValidation.missing;

  const missingDocsError = useMemo(() => {
    if (hasRequiredDocs || missingProductDocs.length === 0) return null;

    const productNames = missingProductDocs
      .map((id) => PRODUCT_DISPLAY_NAMES[id] || id)
      .join(', ');

    const hasBankStatementMissing = missingProductDocs.includes('non_qm_bank_statement');
    const has1099Missing = missingProductDocs.includes('irs_1099_income');
    const hasQmMissing = missingProductDocs.some((id) =>
      ['fnma_selling_guide', 'fhlmc_selling_guide', 'fha_handbook', 'usda_handbook', 'va_handbook'].includes(id)
    );

    if (hasBankStatementMissing) {
      return 'Bank Statement income requires bank statement documents. Upload bank statements to continue.';
    }
    if (has1099Missing) {
      return '1099 Income requires 1099 form documents (1099-MISC, 1099-NEC, or 1099-K).';
    }
    if (hasQmMissing) {
      return `Qualified Mortgage products (${productNames}) require W-2, tax returns, or schedule documents.`;
    }
    return `Missing required documents for: ${productNames}`;
  }, [hasRequiredDocs, missingProductDocs]);

  const yearSelectionError = useMemo(() => {
    if (periodVariant === 'bank_statement') return null;
    if (selectedY1Year && selectedY2Year && selectedY1Year === selectedY2Year) {
      return 'Y1 and Y2 must be different years.';
    }
    if (approach === 'qualified_mortgage' && taxYearResolution?.needs_review && !selectedY1Year) {
      return 'Select Y1 before creating the scenario.';
    }
    return null;
  }, [approach, periodVariant, selectedY1Year, selectedY2Year, taxYearResolution?.needs_review]);

  const canRunScenario =
    !isSubmitting &&
    !!caseId &&
    selectedBorrowers.length > 0 &&
    selectedProducts.length > 0 &&
    selectedDocuments.length > 0 &&
    (readiness?.blocking_issues?.length ?? 0) === 0 &&
    hasRequiredDocs &&
    !yearSelectionError;

  const footerStatus = useMemo(() => {
    return `${selectedBorrowers.length} borrower${selectedBorrowers.length === 1 ? '' : 's'}, ` +
      `${selectedDocuments.length} document${selectedDocuments.length === 1 ? '' : 's'}, ` +
      `${selectedProducts.length} product${selectedProducts.length === 1 ? '' : 's'} selected`;
  }, [selectedBorrowers.length, selectedDocuments.length, selectedProducts.length]);

  const blockingIssues = useMemo(() => {
    const issues = [...(readiness?.blocking_issues ?? [])];
    if (missingDocsError) issues.push(missingDocsError);
    if (yearSelectionError) issues.push(yearSelectionError);
    return issues;
  }, [missingDocsError, readiness?.blocking_issues, yearSelectionError]);

  const handleSubmit = useCallback(async () => {
    if (!caseId || isSubmitting) return;

    const normalizedScenarioDraft = normalizeScenarioDraftPeriodFields(scenarioDraft, periodVariant);

    if (selectedBorrowers.length === 0) {
      setError('Please select at least one borrower');
      return;
    }
    if (selectedProducts.length === 0) {
      setError('Please select at least one loan product');
      return;
    }
    if (selectedDocuments.length === 0) {
      setError('Please select at least one document.');
      return;
    }

    const validation = validateRequiredDocuments(selectedProducts, selectedDocumentsForValidation);
    if (!validation.valid) {
      const missingNames = validation.missing
        .map((id) => PRODUCT_DISPLAY_NAMES[id] || id)
        .join(', ');
      setError(`Missing required documents for: ${missingNames}. Upload the required documents first.`);
      return;
    }

    if (yearSelectionError) {
      setError(yearSelectionError);
      return;
    }

    setError(null);

    try {
      if (periodVariant === 'qm' && (normalizedScenarioDraft.y1Override || normalizedScenarioDraft.y2Override)) {
        await confirmTaxYearMutation.mutateAsync({
          caseId,
          request: {
            confirmed: true,
            y1: normalizedScenarioDraft.y1Override || undefined,
            y2: normalizedScenarioDraft.y2Override || undefined,
          },
        });
      }

      const createResponse = await createScenarioMutation.mutateAsync({
        caseId,
        request: {
          approach,
          borrower_ids: selectedBorrowers,
          loan_product_ids: selectedProducts,
          document_ids: selectedDocuments,
          y1_override: normalizedScenarioDraft.y1Override || undefined,
          y2_override: normalizedScenarioDraft.y2Override || undefined,
          statement_period_months: normalizedScenarioDraft.statementPeriodMonths ?? undefined,
          note: scenarioNote.trim() || undefined,
        },
      });

      navigate(`/case/${caseId}/scenario/${createResponse.scenario_id}/summary`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create scenario');
    }
  }, [
    approach,
    caseId,
    confirmTaxYearMutation,
    createScenarioMutation,
    isSubmitting,
    navigate,
    periodVariant,
    scenarioDraft,
    scenarioNote,
    selectedBorrowers,
    selectedDocuments,
    selectedDocumentsForValidation,
    selectedProducts,
    yearSelectionError,
  ]);

  const toggleProduct = useCallback((id: string) => {
    setDraft((prev) => {
      const current = prev.loanProductIds;
      if (current.includes(id)) {
        return { ...prev, loanProductIds: current.filter((p) => p !== id) };
      }

      const isNonQm = NON_QM_PRODUCTS.some((p) => p.id === id);
      if (isNonQm) {
        return { ...prev, loanProductIds: [id] };
      }

      return { ...prev, loanProductIds: [...current, id] };
    });
  }, [setDraft]);

  if (caseLoading || productsLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 overflow-auto bg-slate-50">
      <div className="max-w-4xl mx-auto py-8 px-6 pb-24">
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-2xl font-semibold text-slate-800">New Scenario</h1>
            <p className="text-sm text-slate-500 mt-1">
              Configure and run a new income calculation
            </p>
          </div>
        </div>

        <div className="mb-8">
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
            Approach
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => setDraft((prev) => ({ ...prev, approach: 'qualified_mortgage' }))}
              disabled={isSubmitting}
              className={`p-4 rounded-lg border-2 text-left transition-all ${
                approach === 'qualified_mortgage'
                  ? 'border-amber-400 bg-amber-50'
                  : 'border-slate-200 bg-white hover:border-slate-300'
              } disabled:opacity-50`}
            >
              <h3 className="font-semibold text-slate-800">Qualified Mortgage</h3>
              <p className="text-sm text-slate-500 mt-1">
                Fannie Mae, Freddie Mac, FHA, USDA, VA
              </p>
            </button>

            <button
              type="button"
              onClick={() => setDraft((prev) => ({ ...prev, approach: 'non_qualified_mortgage' }))}
              disabled={isSubmitting}
              className={`p-4 rounded-lg border-2 text-left transition-all ${
                approach === 'non_qualified_mortgage'
                  ? 'border-amber-400 bg-amber-50'
                  : 'border-slate-200 bg-white hover:border-slate-300'
              } disabled:opacity-50`}
            >
              <h3 className="font-semibold text-slate-800">Non-Qualified Mortgage</h3>
              <p className="text-sm text-slate-500 mt-1">
                Bank Statements, IRS Forms (1099 etc), DSCR
              </p>
            </button>
          </div>
        </div>

        <div className="mb-8">
          <div className="bg-white rounded-lg border border-slate-200 p-4">
            <p className="text-sm text-slate-600 mb-3">
              {approach === 'qualified_mortgage'
                ? 'All loan products will be run'
                : 'Select Non-QM products to run'}
            </p>
            <div className="flex flex-wrap gap-2">
              {approach === 'qualified_mortgage'
                ? qmProducts.map((product) => (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => product.enabled && toggleProduct(product.id)}
                    disabled={!product.enabled || isSubmitting}
                    className={`px-3 py-1.5 text-sm font-medium rounded-full border transition-all ${
                      selectedProducts.includes(product.id)
                        ? 'bg-amber-100 border-amber-400 text-amber-800'
                        : product.enabled
                          ? 'bg-white border-slate-200 text-slate-600 hover:border-amber-300'
                          : 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
                    }`}
                  >
                    {product.display_name}
                    {!product.enabled && (
                      <span className="ml-1 text-xs text-slate-400">Soon</span>
                    )}
                  </button>
                ))
                : NON_QM_PRODUCTS.map((product) => (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => product.enabled && toggleProduct(product.id)}
                    disabled={!product.enabled || isSubmitting}
                    className={`px-3 py-1.5 text-sm font-medium rounded-full border transition-all ${
                      selectedProducts.includes(product.id)
                        ? 'bg-amber-100 border-amber-400 text-amber-800'
                        : product.enabled
                          ? 'bg-white border-slate-200 text-slate-600 hover:border-amber-300'
                          : 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
                    }`}
                  >
                    {product.display_name}
                    {!product.enabled && (
                      <span className="ml-1 text-xs text-slate-400">Soon</span>
                    )}
                  </button>
                ))}
            </div>
          </div>
        </div>

        {(error || blockingIssues.length > 0 || (readiness?.warnings?.length ?? 0) > 0) && (
          <div className="space-y-4 mb-8">
            {error && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {error}
              </div>
            )}
            <Warnings blockingIssues={blockingIssues} warnings={readiness?.warnings} />
          </div>
        )}

        <ScenarioDraftEditor
          periodsTabProps={{
            y1Override: selectedY1Year,
            y2Override: selectedY2Year,
            onY1Change: (value) => setDraft((prev) => ({ ...prev, y1Override: value })),
            onY2Change: (value) => setDraft((prev) => ({ ...prev, y2Override: value })),
            availableYears: selectableYears,
            mode: 'create',
            approach,
            loanProductIds: selectedProducts,
            statementPeriodMonths,
            onStatementPeriodChange: (months) => setDraft((prev) => ({ ...prev, statementPeriodMonths: months })),
            confidencePercent: taxYearResolution?.confidence != null
              ? Math.round(taxYearResolution.confidence * 100)
              : null,
            needsReview: taxYearResolution?.needs_review ?? false,
            warnings: taxYearResolution?.warnings ?? [],
            yearSelectionReason: taxYearSelectionReason,
          }}
          documentsTabProps={{
            caseId: caseId ?? '',
            documents,
            selectedIds: selectedDocuments,
            onSelectionChange: (ids) => {
              documentSelectionTouchedRef.current = true;
              setDraft((prev) => ({ ...prev, documentIds: ids }));
            },
            files: caseResult?.artifacts?.files,
            reviewConfirmLabel: 'Add to scenario',
          }}
          borrowersTabProps={{
            borrowers,
            selectedIds: selectedBorrowers,
            onSelectionChange: (ids) => {
              borrowerSelectionTouchedRef.current = true;
              setDraft((prev) => ({ ...prev, borrowerIds: ids }));
            },
          }}
          noteLabel="Scenario Note"
          noteValue={scenarioNote}
          notePlaceholder="Describe the rationale for this scenario configuration..."
          onNoteChange={(value) => setDraft((prev) => ({ ...prev, note: value }))}
          noteDisabled={isSubmitting}
          footerStatus={footerStatus}
          onSave={handleSubmit}
          saveLabel="Create Scenario"
          savingLabel="Creating..."
          isSaving={isSubmitting}
          saveDisabled={!canRunScenario}
        />
      </div>
    </div>
  );
}

export default CreateScenarioPage;
