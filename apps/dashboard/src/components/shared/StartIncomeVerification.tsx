/**
 * StartIncomeVerification - Shared CTA component for starting income and credit verification.
 *
 * Features:
 * - CTA-style button with loading/disabled states
 * - Starts both income and credit verification with the same product options (direct API, no navigation-then-trigger)
 * - When navigateAfterStart is true and not on income tab: navigates to income tab after successful start
 * - Handles errors and displays them; credit failure is shown as non-blocking if income started
 *
 * Used by:
 * - PartiesTab, ReviewView
 */

import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
	getIncomeVerification,
	startCreditVerificationWithOptions,
	startIncomeVerification,
	startIncomeVerificationForAllProducts,
	startIncomeVerificationWithOptions,
} from "../../hooks/useApi";
import { useCaseQueryInvalidation } from "../../hooks/useCaseQueries";
import { trackFunnelStep, trackIncomeVerificationStarted } from "../../lib/analytics";
import { useAppSelector } from "../../store";

type IncomeRunIntent = {
	mode: "single" | "selected" | "all";
	requested_product_ids: string[];
	queued_count: number | null;
	timestamp: string;
	response_message?: string;
};

const incomeRunIntentKey = (caseId: string) => `income_run_intent:${caseId}`;

function parseQueuedProductCount(message?: string): number | null {
	if (!message) return null;
	const match = message.match(/started for\s+(\d+)\s+product/i);
	if (!match) return null;
	const parsed = Number.parseInt(match[1], 10);
	return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function saveIncomeRunIntent(caseId: string, intent: IncomeRunIntent): void {
	if (typeof window === "undefined") return;
	try {
		window.sessionStorage.setItem(incomeRunIntentKey(caseId), JSON.stringify(intent));
	} catch {
		// Best-effort UI hint only.
	}
}

export interface StartIncomeVerificationProps {
	/** Case ID for verification */
	caseId: string;
	/** Loan product ID (defaults to 'fannie_mae') */
	loanProductId?: string;
	/** Run all enabled loan products in one workflow */
	runAllProducts?: boolean;
	/** Explicit product subset to run (takes precedence over runAllProducts) */
	selectedProductIds?: string[];
	/** Result storage mode for grouped execution */
	resultStorageMode?: "combined" | "separate";
	/** Callback for SSE stream reconnection */
	onStartVerification?: () => void;
	/** Called when user clicks but no loan product is selected (instead of starting) */
	onNoProductSelected?: () => void;
	/** If false, do not navigate to income tab after starting (e.g. when used on Review tab). Default true */
	navigateAfterStart?: boolean;
	/** When true, show "Verification running..." and disable (e.g. from workflow status on Review tab). */
	workflowRunning?: boolean;
	/** Disable button */
	disabled?: boolean;
	/** Additional CSS classes */
	className?: string;
	/** Button text (defaults to 'Start') */
	buttonText?: string;
}

export function StartIncomeVerification({
	caseId,
	loanProductId: loanProductIdProp,
	runAllProducts = false,
	selectedProductIds,
	resultStorageMode = "combined",
	onStartVerification,
	onNoProductSelected,
	navigateAfterStart = true,
	workflowRunning = false,
	disabled = false,
	className = "",
	buttonText = "Start",
}: StartIncomeVerificationProps) {
	const navigate = useNavigate();
	const location = useLocation();
	const { invalidateWorkflows } = useCaseQueryInvalidation();
	const delayedInvalidationRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	// Clean up delayed invalidation on unmount so we don't trigger from an unmounted component
	useEffect(() => {
		return () => {
			if (delayedInvalidationRef.current) {
				clearTimeout(delayedInvalidationRef.current);
				delayedInvalidationRef.current = null;
			}
		};
	}, []);

	// Get loan product from Redux state, fall back to prop, then to default
	const selectedLoanProduct = useAppSelector((state) => state.app.selectedLoanProduct);
	const loanProductId = selectedLoanProduct ?? loanProductIdProp ?? "fannie_mae";

	// Check if we're currently on the income tab
	const isOnIncomeTab = location.pathname.includes("/income");

	// Check for existing verification results
	const [hasExistingResults, setHasExistingResults] = useState(false);

	// Verification state
	const [isStartingVerification, setIsStartingVerification] = useState(false);
	const [startVerificationError, setStartVerificationError] = useState<string | null>(null);
	// Optimistic: show Verifying immediately after API returns 'started', before workflow status refetch
	const [optimisticVerifying, setOptimisticVerifying] = useState(false);
	const hadWorkflowRunningRef = useRef(false);

	// Clear optimistic state only when workflow has actually completed (was running, now is not).
	// Do NOT clear when workflowRunning is false before it has started - that causes a brief "Start" flash.
	useEffect(() => {
		if (workflowRunning) {
			hadWorkflowRunningRef.current = true;
		}
		if (hadWorkflowRunningRef.current && !workflowRunning && optimisticVerifying) {
			setOptimisticVerifying(false);
			hadWorkflowRunningRef.current = false;
		}
	}, [workflowRunning, optimisticVerifying]);

	// Check for existing verification results on mount
	useEffect(() => {
		async function checkExistingResults() {
			try {
				const response = await getIncomeVerification(caseId);
				setHasExistingResults(response.income_verification !== null);
			} catch (err) {
				// If error, assume no results (might be 404 or other error)
				setHasExistingResults(false);
			}
		}
		checkExistingResults();
	}, [caseId]);

	const startVerification = async () => {
		// When selectedProductIds is explicitly provided and empty, treat as "no selection" - don't fall back to Redux
		if (selectedProductIds && selectedProductIds.length === 0) {
			onNoProductSelected?.();
			return;
		}
		if (
			!runAllProducts &&
			!loanProductId &&
			(!selectedProductIds || selectedProductIds.length === 0)
		)
			return;

		try {
			setIsStartingVerification(true);
			setStartVerificationError(null);
			const selectedIds =
				selectedProductIds && selectedProductIds.length > 0 ? [...selectedProductIds] : [];
			const intentMode: IncomeRunIntent["mode"] =
				selectedIds.length > 0 ? "selected" : runAllProducts ? "all" : "single";
			const requestedProductIds = selectedIds.length > 0 ? selectedIds : [loanProductId];

			// Track income verification started
			trackIncomeVerificationStarted({
				case_id: caseId,
				loan_product_id: selectedIds.length
					? `selected:${selectedIds.join(",")}`
					: runAllProducts
						? "all_enabled"
						: loanProductId,
				source_tab: isOnIncomeTab ? "income" : "other",
			});
			trackFunnelStep({ case_id: caseId, step: "income_started" });

			// Reconnect SSE stream to receive verification events
			onStartVerification?.();

			// Build credit request from same product selection as income
			const creditRequest =
				selectedIds.length > 0
					? {
							selected_products: selectedIds,
							result_storage_mode: resultStorageMode,
							loan_product_id: selectedIds[0],
						}
					: runAllProducts
						? { run_all_products: true, result_storage_mode: resultStorageMode }
						: { loan_product_id: loanProductId };

			// Start income and credit verification in parallel
			const [incomeSettled, creditSettled] = await Promise.allSettled([
				selectedIds.length > 0
					? startIncomeVerificationWithOptions(caseId, {
							selected_products: selectedIds,
							result_storage_mode: resultStorageMode,
							loan_product_id: selectedIds[0],
						})
					: runAllProducts
						? startIncomeVerificationForAllProducts(caseId, undefined, resultStorageMode)
						: startIncomeVerification(caseId, loanProductId),
				startCreditVerificationWithOptions(caseId, creditRequest),
			]);

			const incomeResponse = incomeSettled.status === "fulfilled" ? incomeSettled.value : undefined;
			const creditResponse = creditSettled.status === "fulfilled" ? creditSettled.value : undefined;
			const incomeFailed = !incomeResponse || incomeResponse.status !== "started";
			const creditFailed = !creditResponse || creditResponse.status !== "started";

			if (incomeFailed) {
				setStartVerificationError(incomeResponse?.message || "Failed to start verification");
				setIsStartingVerification(false);
				return;
			}

			setOptimisticVerifying(true);
			invalidateWorkflows(caseId);
			if (delayedInvalidationRef.current) clearTimeout(delayedInvalidationRef.current);
			delayedInvalidationRef.current = setTimeout(() => {
				delayedInvalidationRef.current = null;
				invalidateWorkflows(caseId);
			}, 3000);
			saveIncomeRunIntent(caseId, {
				mode: intentMode,
				requested_product_ids: requestedProductIds,
				queued_count: parseQueuedProductCount(incomeResponse.message),
				timestamp: new Date().toISOString(),
				response_message: incomeResponse.message,
			});

			if (creditFailed) {
				const creditReason =
					creditSettled.status === "rejected"
						? (creditSettled.reason?.message ?? "Unknown error")
						: (creditResponse?.message ?? "Failed to start credit verification");
				setStartVerificationError(`Income started. Credit could not be started: ${creditReason}`);
			}

			// Successfully started income - navigate to income tab only if not already on it and caller allows it
			if (navigateAfterStart && !isOnIncomeTab) {
				navigate(`/case/${caseId}/income`);
			}
		} catch (err) {
			setStartVerificationError(
				err instanceof Error ? err.message : "Failed to start verification",
			);
			setIsStartingVerification(false);
		} finally {
			setIsStartingVerification(false);
		}
	};

	const handleVerifyClick = async () => {
		if (selectedProductIds && selectedProductIds.length === 0) {
			onNoProductSelected?.();
			return;
		}
		if (
			!runAllProducts &&
			!loanProductId &&
			(!selectedProductIds || selectedProductIds.length === 0)
		)
			return;
		await startVerification();
	};

	const getButtonStyles = () => {
		if (disabled) {
			return "bg-slate-200 text-slate-400 cursor-not-allowed";
		}
		if (isStartingVerification) {
			return "bg-cta text-white hover:bg-cta-hover transition-colors cursor-not-allowed";
		}
		return "bg-cta text-white hover:bg-cta-hover transition-colors cursor-pointer";
	};

	const getDisplayText = () => {
		if (isStartingVerification) {
			return "Starting...";
		}
		if (isOnIncomeTab) {
			return hasExistingResults ? "Rerun" : "Run";
		}
		return buttonText;
	};

	// When verification is running (from workflow status or optimistic update), show status indicator
	const isVerifying = workflowRunning || optimisticVerifying;
	if (isVerifying) {
		return (
			<div
				className={`inline-flex items-center gap-2 px-3 py-2 rounded-md bg-slate-50/90 border border-slate-100 ${className}`}
				aria-live="polite"
				aria-busy="true"
			>
				<svg
					className="w-3.5 h-3.5 shrink-0 animate-spin text-slate-500"
					fill="none"
					viewBox="0 0 24 24"
					aria-hidden
				>
					<circle
						className="opacity-20"
						cx="12"
						cy="12"
						r="10"
						stroke="currentColor"
						strokeWidth="3"
					/>
					<path
						className="opacity-75"
						fill="currentColor"
						d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
					/>
				</svg>
				<span className="text-sm text-slate-600 tracking-tight">Verifying</span>
			</div>
		);
	}

	return (
		<>
			<button
				onClick={handleVerifyClick}
				disabled={disabled || isStartingVerification}
				className={`px-5 py-2.5 rounded-lg font-semibold transition-colors min-w-[200px] ${getButtonStyles()} ${className}`}
			>
				{getDisplayText()}
			</button>

			{/* Error message */}
			{startVerificationError && (
				<p className="text-xs text-red-600 mt-2">{startVerificationError}</p>
			)}
		</>
	);
}
