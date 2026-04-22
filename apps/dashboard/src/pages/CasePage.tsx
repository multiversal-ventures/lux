import { useParams, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Sidebar, DocumentsTab, CaseDetailSidebar, CaseActionBar, DownloadAsExcelModal } from '../components/layout';
import { IncomeTab, GraphTab, BankStatementsTab, CreditReportTab, RatiosTab } from '../components/results';
import { CreditTab } from '../components/credit';
import { useGunnrCase, useCaseHistory } from '../hooks';
import { useCaseScenarios } from '../hooks/useCaseQueries';
import {
  getScenario,
} from '../hooks/useApi';
import { useAppDispatch } from '../store';
import { setCurrentCaseId, setCurrentCaseName, collapseSidebarForView } from '../store/appSlice';
import type { SourceRef } from '../types';
import { isOngoing } from '../lib/phases';
import { ExtractionTab } from '../components/review';
import { getCaseDisplayName } from '../utils/caseNameUtils';
import { CreateScenarioPage } from './CreateScenarioPage';
import { ScenarioPage } from './ScenarioPage';
import { ScenarioSummaryPage } from './ScenarioSummaryPage';
import { ScenarioIncomeTab } from './ScenarioIncomeTab';
import { ScenarioRefinePage } from './ScenarioRefinePage';
import { ComparePage } from './ComparePage';
import { CompliancePage } from '../pages/CompliancePage';
import { trackCaseViewed, trackExtractionCompleted, trackFunnelStep } from '../lib/analytics';
import { useCaseEventStore } from '../stores/caseEventStore';
import { getCaseCompletionRedirect } from './caseCompletionNavigation';

// Pending file from navigation state (for immediate skeleton display)
interface PendingFile {
  filename: string;
  tempId: string;
}

interface LocationState {
  pendingFiles?: PendingFile[];
}

export function CasePage() {
  const { caseId } = useParams<{ caseId: string }>();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const location = useLocation();

  // Get pending files from navigation state for immediate skeleton display
  const locationState = location.state as LocationState | null;
  const pendingFiles = locationState?.pendingFiles || [];

  // Single source of truth: useGunnrCase combines SSE + data fetching
  const { status, result, events, streamStatus, loadedFiles, firstScenarioId, loading, error, refetch, reconnect } = useGunnrCase({
    caseId: caseId || null,
    autoConnect: true,
  });

  // Case history for localStorage persistence and case name
  const { cases, updateCaseProgress, touchCase } = useCaseHistory();
  const currentCase = useMemo(() => cases.find((c) => c.case_id === caseId) ?? null, [cases, caseId]);
  const { data: scenariosData, isLoading: scenariosLoading } = useCaseScenarios(caseId ?? null);

  // Fetch full detail for the most-recently-completed scenario so we have its
  // latest_refinement_id.  This lets IncomeTab load the scenario-specific
  // income result instead of always showing the last-written snapshot.
  const latestCompletedScenario = scenariosData?.scenarios?.find(
    (s) => s.status === 'completed'
  ) ?? scenariosData?.scenarios?.[0] ?? null;
  const { data: latestScenarioDetail } = useQuery({
    queryKey: ['scenario-detail', caseId, latestCompletedScenario?.scenario_id],
    queryFn: () => getScenario(caseId!, latestCompletedScenario!.scenario_id),
    enabled: !!caseId && !!latestCompletedScenario?.scenario_id,
    staleTime: 30_000,
  });
  const latestRefinementId = latestScenarioDetail?.latest_refinement_id ?? null;
  const caseName = getCaseDisplayName(currentCase, cases);
  const lastSyncedStatus = useRef<string | null>(null);

  // Update header with case name immediately so it displays right away
  useEffect(() => {
    if (caseId && caseName) {
      dispatch(setCurrentCaseName(caseName));
    }
    return () => {
      dispatch(setCurrentCaseName(null));
    };
  }, [caseId, caseName, dispatch]);

  // Touch case on open to update lastOpenedAt and track view
  useEffect(() => {
    if (caseId) {
      touchCase(caseId);

      // Determine source of navigation
      const source = locationState?.pendingFiles?.length
        ? 'upload'
        : document.referrer.includes('/app')
          ? 'history'
          : 'direct_link';

      // Track case viewed
      trackCaseViewed({
        case_id: caseId,
        tab: location.pathname.split('/').pop() || 'extraction',
        source,
      });
    }
  }, [caseId, location.pathname, locationState?.pendingFiles?.length, touchCase]);

  // Sync case progress to localStorage when status changes
  useEffect(() => {
    if (!caseId || !status?.status.code) return;

    const statusCode = status.status.code;

    // Only sync if status actually changed
    if (statusCode === lastSyncedStatus.current) return;
    lastSyncedStatus.current = statusCode;

    // Map status codes to case progress
    if (statusCode === 'completed') {
      updateCaseProgress(caseId, 'completed');

      // Track extraction completed
      trackExtractionCompleted({
        case_id: caseId,
        document_count: result?.extractions?.documents?.length || 0,
      });
      trackFunnelStep({ case_id: caseId, step: 'extraction' });
    } else if (statusCode === 'failed' || statusCode === 'cancelled') {
      updateCaseProgress(caseId, 'failed');
    } else if (['classifying', 'extracting', 'validating', 'tier4', 'reextract', 'summary', 'cross_doc', 'unification', 'income_verification'].includes(statusCode)) {
      updateCaseProgress(caseId, 'processing');
    }
  }, [caseId, status?.status.code, updateCaseProgress, result?.extractions?.documents?.length]);

  // Check for PAGE_LIMIT_EXCEEDED error and show popup
  const setTenantRestriction = useCaseEventStore((s) => s.setTenantRestriction);
  useEffect(() => {
    if (!status?.error) return;

    // Parse the error format: "PAGE_LIMIT_EXCEEDED|totalPages|pageLimit"
    const errorStr = status.error;
    if (errorStr.startsWith('PAGE_LIMIT_EXCEEDED|')) {
      const parts = errorStr.split('|');
      if (parts.length >= 3) {
        const totalPages = parseInt(parts[1], 10);
        const pageLimit = parseInt(parts[2], 10);
        setTenantRestriction({
          code: 'PAGE_LIMIT_EXCEEDED',
          message: `Case exceeds ${pageLimit} page limit (${totalPages} pages)`,
          totalPages,
          pageLimit,
        });
      }
    }
  }, [status?.error, setTenantRestriction]);

  // Collapse right sidebar (Agent Log / Info) when on primary case tabs
  const basePathForEffect = caseId ? `/case/${caseId}` : '';
  useEffect(() => {
    if (!basePathForEffect) return;
    const path = location.pathname;
    const onView = path === `${basePathForEffect}/view`;
    const onScenario = path === `${basePathForEffect}/new-scenario`;
    const onIncome = path === `${basePathForEffect}/income`;
    const onCredit = path === `${basePathForEffect}/credit`;
    const onCreditReport = path === `${basePathForEffect}/credit-report`;
    const onRatios = path === `${basePathForEffect}/ratios`;
    const onBankStatements = path === `${basePathForEffect}/bank-statements`;
    const onCompare = path === `${basePathForEffect}/compare`;
    const onCompliance = path === `${basePathForEffect}/compliance`;
    const onExtraction = path === basePathForEffect || path === `${basePathForEffect}/`;
    if (onView || onScenario || onIncome || onCredit || onCreditReport || onRatios || onBankStatements || onCompare || onCompliance || onExtraction) {
      dispatch(collapseSidebarForView());
    }
  }, [basePathForEffect, location.pathname, dispatch]);

  // Download as Excel modal
  const [excelModalOpen, setExcelModalOpen] = useState(false);
  // Track if we've already navigated after extraction completes
  const extractionNavDoneRef = useRef(false);

  // When extraction completes on the base case page, navigate to an existing
  // scenario summary if one already exists; otherwise send the user to the
  // New Scenario flow once scenario lookup has resolved.
  useEffect(() => {
    if (location.pathname !== `/case/${caseId}`) return;

    const redirectPath = getCaseCompletionRedirect({
      caseId,
      isComplete: status?.status.code === 'completed' || status?.status.intent === 'success',
      firstScenarioId,
      scenariosReady: !scenariosLoading,
      scenarioIds: scenariosData?.scenarios?.map((scenario) => scenario.scenario_id) ?? [],
    });

    if (!redirectPath || extractionNavDoneRef.current) return;

    extractionNavDoneRef.current = true;
    navigate(redirectPath, { replace: true });
  }, [
    caseId,
    firstScenarioId,
    location.pathname,
    navigate,
    scenariosData,
    scenariosLoading,
    status,
  ]);


  // Set current case in store (for other components that need it)
  useEffect(() => {
    dispatch(setCurrentCaseId(caseId || null));
    return () => {
      dispatch(setCurrentCaseId(null));
    };
  }, [caseId, dispatch]);

  // When Sidebar is rendered outside DocumentsTab (e.g. on income tab), navigate to view with URL params
  const handleSourceClick = useCallback(
    (source: SourceRef) => {
      if (!caseId) return;
      const dc = source.document_class?.toLowerCase() ?? '';
      if (dc.includes('bankstatement') || dc.includes('bank_statement') || dc === 'unifiedbankstatement') {
        navigate(`/case/${caseId}/bank-statements`);
        return;
      }
      const viewPath = `/case/${caseId}/view`;
      const params = new URLSearchParams();
      if (source.file_id) params.set('file', source.file_id);
      if (source.page_number != null) params.set('page', String(source.page_number));
      navigate(`${viewPath}?${params.toString()}`);
    },
    [caseId, navigate]
  );

  const isExtracting = useMemo(() => {
    if (!status) return true;
    const code = status.status?.code;
    if (!code) return true;
    // isOngoing covers all non-terminal phase codes plus their aliases
    return isOngoing(code);
  }, [status]);

  if (!caseId) {
    return <Navigate to="/" replace />;
  }

  const basePath = `/case/${caseId}`;
  const isDocumentsView = location.pathname === `${basePath}/view`;

  return (
    <div className="h-full flex flex-col">
      <CaseActionBar caseName={caseName} files={result?.artifacts?.files} onExportExcel={() => setExcelModalOpen(true)} />
      {caseId && (
        <DownloadAsExcelModal isOpen={excelModalOpen} onClose={() => setExcelModalOpen(false)} caseId={caseId} />
      )}
      <div className="flex-1 flex relative overflow-hidden">
      {/* Case Detail Sidebar */}
      <CaseDetailSidebar isExtractionInProgress={isExtracting} hasStatus={!!status} hasError={!!error} />

      
        <div className="flex-1 flex flex-col overflow-hidden min-h-0">
          <div className="flex-1 flex overflow-hidden min-h-0">
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-slate-100">
              {error ? (
                <div className="p-6 flex items-center justify-center h-full">
                  <div className="max-w-md p-6 bg-amber-50 border border-amber-200 rounded-xl text-center">
                    <div className="text-4xl mb-4">⏰</div>
                    <h2 className="text-lg font-semibold text-amber-800 mb-2">
                      {error.includes('expire') || error.includes('not found') ? 'Case Expired' : 'Error'}
                    </h2>
                    <p className="text-amber-700 mb-4">{error}</p>
                    <button
                      onClick={() => navigate('/')}
                      className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors"
                    >
                      Start a New Case
                    </button>
                  </div>
                </div>
              ) : !status ? (
                <div className="flex items-center justify-center h-full">
                  <div className="spinner" />
                </div>
              ) : (
                <Routes>
                  {/* Base path: show ExtractionTab while extracting or when
                      complete with no scenario yet (user sees the completed
                      stepper + stats). Only redirect to scenario summary when
                      a first-scenario actually exists and is queryable. */}
                  <Route
                    index
                    element={
                      !isExtracting && !scenariosLoading && scenariosData?.scenarios && scenariosData.scenarios.length > 0 ? (
                        <Navigate
                          to={`${basePath}/scenario/${scenariosData.scenarios[0].scenario_id}/summary`}
                          replace
                        />
                      ) : (
                        <ExtractionTab
                          status={status}
                          caseId={caseId}
                          onRefetch={refetch}
                          result={result}
                          events={events}
                        />
                      )
                    }
                  />
                  {/* Extraction progress view */}
                  <Route
                    path="extraction"
                    element={
                      <ExtractionTab
                        status={status}
                        caseId={caseId}
                        onRefetch={refetch}
                        result={result}
                        events={events}
                      />
                    }
                  />
                  <Route
                    path="view"
                    element={
                      loading && !result ? (
                        <div className="flex items-center justify-center h-full">
                          <div className="spinner" />
                        </div>
                      ) : (
                        <DocumentsTab
                          caseId={caseId}
                          basePath={basePath}
                          result={result}
                          status={status}
                          events={events}
                          streamStatus={streamStatus}
                          loadedFiles={loadedFiles}
                          pendingFiles={pendingFiles}
                          caseName={caseName}
                          loading={loading}
                          onRefetch={refetch}
                        />
                      )
                    }
                  />
                
                  <Route path="graph" element={<GraphTab caseId={caseId} />} />
                  <Route
                    path="income"
                    element={
                      <IncomeTab
                        caseId={caseId}
                        onStartVerification={reconnect}
                        refinementId={latestRefinementId}
                      />
                    }
                  />
                  <Route
                    path="credit"
                    element={<CreditTab caseId={caseId} onStartVerification={reconnect} />}
                  />
                  <Route
                    path="credit-report"
                    element={<CreditReportTab caseId={caseId} />}
                  />
                  <Route
                    path="ratios"
                    element={<RatiosTab caseId={caseId} />}
                  />
                  <Route
                    path="bank-statements"
                    element={<BankStatementsTab caseId={caseId} />}
                  />
                  <Route
                    path="compare"
                    element={<ComparePage caseId={caseId} />}
                  />
                  <Route
                    path="compliance"
                    element={<CompliancePage />}
                  />
                  <Route
                    path="new-scenario"
                    element={<CreateScenarioPage />}
                  />
                  {/* Scenario routes with nested layout */}
                  <Route path="scenario/:scenarioId" element={<ScenarioPage />}>
                    <Route index element={<Navigate to="summary" replace />} />
                    <Route path="summary" element={<ScenarioSummaryPage />} />
                    <Route path=":productId" element={<ScenarioIncomeTab />} />
                  </Route>
                  {/* Scenario routes with refinement in path */}
                  <Route path="scenario/:scenarioId/refinement/:refinementId" element={<ScenarioPage />}>
                    <Route index element={<Navigate to="summary" replace />} />
                    <Route path="summary" element={<ScenarioSummaryPage />} />
                    <Route path=":productId" element={<ScenarioIncomeTab />} />
                  </Route>
                  {/* Scenario refinement page (standalone, not nested) */}
                  <Route
                    path="scenario/:scenarioId/refine"
                    element={<ScenarioRefinePage onStartRefinement={reconnect} />}
                  />
                </Routes>
              )}
            </div>
            {!isDocumentsView && (<Sidebar
              events={events}
              status={status}
                streamStatus={streamStatus}
                onSourceClick={handleSourceClick}
              />
            )}
          </div>
        </div>
      

    </div>
    </div>
  );
}

export default CasePage;
