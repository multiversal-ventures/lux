/**
 * Firebase Analytics wrapper for Gunnr
 *
 * Usage:
 *   import { trackEvent, trackPageView, trackTiming } from './lib/analytics';
 *
 *   trackEvent('file_upload_started', { file_count: 3 });
 *   trackPageView('income_tab', { case_id: '123' });
 */

import { getAnalytics, logEvent, setUserId, setUserProperties } from "firebase/analytics";
import type { Analytics } from "firebase/analytics";

let analytics: Analytics | null = null;

/**
 * Initialize Firebase Analytics (call once in main.tsx after initializeApp)
 */
export function initAnalytics(): Analytics | null {
	// Only initialize in browser environment
	if (typeof window === "undefined") return null;

	try {
		analytics = getAnalytics();
		console.log("[Analytics] Initialized");
		return analytics;
	} catch (error) {
		console.warn("[Analytics] Failed to initialize:", error);
		return null;
	}
}

/**
 * Get the analytics instance (for advanced use)
 */
export function getAnalyticsInstance(): Analytics | null {
	return analytics;
}

// ============================================================================
// EVENT DEFINITIONS - Key events for friendlies launch
// ============================================================================

/**
 * Track a custom event
 */
export function trackEvent(
	eventName: string,
	params?: Record<string, string | number | boolean>,
): void {
	if (!analytics) return;

	try {
		logEvent(analytics, eventName, params);
	} catch (error) {
		console.warn(`[Analytics] Failed to track event "${eventName}":`, error);
	}
}

/**
 * Set user ID for analytics (call after login)
 */
export function setAnalyticsUserId(userId: string | null): void {
	if (!analytics) return;

	try {
		setUserId(analytics, userId);
	} catch (error) {
		console.warn("[Analytics] Failed to set user ID:", error);
	}
}

/**
 * Set user properties (e.g., tenant, plan)
 */
export function setAnalyticsUserProperties(properties: Record<string, string>): void {
	if (!analytics) return;

	try {
		setUserProperties(analytics, properties);
	} catch (error) {
		console.warn("[Analytics] Failed to set user properties:", error);
	}
}

// ============================================================================
// TYPED EVENT HELPERS - For type safety and consistency
// ============================================================================

// ----- File Upload Events -----

export function trackFileUploadStarted(params: {
	file_count: number;
	total_size_bytes?: number;
	file_types?: string[];
}): void {
	trackEvent("file_upload_started", {
		file_count: params.file_count,
		...(params.total_size_bytes && { total_size_bytes: params.total_size_bytes }),
		...(params.file_types && { file_types: params.file_types.join(",") }),
	});
}

export function trackFileUploadCompleted(params: {
	case_id: string;
	file_count: number;
	duration_ms?: number;
}): void {
	trackEvent("file_upload_completed", {
		case_id: params.case_id,
		file_count: params.file_count,
		...(params.duration_ms && { duration_ms: params.duration_ms }),
	});
}

export function trackFileUploadFailed(params: {
	error_message: string;
	file_count?: number;
}): void {
	trackEvent("file_upload_failed", {
		error_message: params.error_message.substring(0, 100), // Truncate
		...(params.file_count && { file_count: params.file_count }),
	});
}

// ----- Case Events -----

export function trackCaseViewed(params: {
	case_id: string;
	tab?: string;
	source?: "upload" | "history" | "direct_link";
}): void {
	trackEvent("case_viewed", {
		case_id: params.case_id,
		...(params.tab && { tab: params.tab }),
		...(params.source && { source: params.source }),
	});
}

export function trackTabSwitched(params: {
	case_id: string;
	from_tab: string;
	to_tab: string;
}): void {
	trackEvent("tab_switched", params);
}

export function trackExtractionCompleted(params: {
	case_id: string;
	document_count: number;
	duration_ms?: number;
}): void {
	trackEvent("extraction_completed", {
		case_id: params.case_id,
		document_count: params.document_count,
		...(params.duration_ms && { duration_ms: params.duration_ms }),
	});
}

// ----- Income Verification Events -----

export function trackIncomeVerificationStarted(params: {
	case_id: string;
	loan_product_id: string;
	source_tab?: string;
}): void {
	trackEvent("income_verification_started", params);
}

export function trackIncomeVerificationCompleted(params: {
	case_id: string;
	total_income?: number;
	duration_ms?: number;
	success: boolean;
}): void {
	trackEvent("income_verification_completed", {
		case_id: params.case_id,
		success: params.success,
		...(params.total_income && { total_income: params.total_income }),
		...(params.duration_ms && { duration_ms: params.duration_ms }),
	});
}

// ----- Party Events -----

export function trackPartiesSelected(params: {
	case_id: string;
	borrower_count: number;
}): void {
	trackEvent("parties_selected", params);
}

// ----- Document Interaction Events -----

export function trackDocumentViewed(params: {
	case_id: string;
	document_type?: string;
	file_id?: string;
}): void {
	trackEvent("document_viewed", params);
}

export function trackSourceClicked(params: {
	case_id: string;
	field_name: string;
	source_type: "fact" | "calculation" | "worksheet";
}): void {
	trackEvent("source_clicked", params);
}

// ----- Export Events -----

export function trackIncomeExported(params: {
	case_id: string;
	format: "csv" | "excel" | "pdf";
	total_income?: number;
}): void {
	trackEvent("income_exported", params);
}

// ----- Funnel Summary Event (for dashboards) -----

export function trackFunnelStep(params: {
	case_id: string;
	step: "upload" | "extraction" | "parties" | "income_started" | "income_completed";
}): void {
	trackEvent("funnel_step", params);
}
