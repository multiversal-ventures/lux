/**
 * Mixpanel analytics for Gunnr
 *
 * Uses VITE_MIXPANEL_TOKEN from env. Autocapture and Session Replay enabled.
 * Do not include sensitive user data in track calls.
 */

import mixpanel from "mixpanel-browser";

const MIXPANEL_TOKEN = import.meta.env.VITE_MIXPANEL_TOKEN as string | undefined;

let initialized = false;

/**
 * Initialize Mixpanel (call once at app entry)
 */
export function initMixpanel(): void {
	if (typeof window === "undefined") return;
	if (!MIXPANEL_TOKEN) {
		console.warn("[Mixpanel] VITE_MIXPANEL_TOKEN not set - skipping init");
		return;
	}

	try {
		mixpanel.init(MIXPANEL_TOKEN, {
			debug: import.meta.env.DEV,
			track_pageview: true,
			persistence: "localStorage",
			autocapture: true,
			//record_sessions_percent: 100,
		});
		initialized = true;
		console.log("[Mixpanel] Initialized");
	} catch (error) {
		console.warn("[Mixpanel] Failed to initialize:", error);
	}
}

/**
 * Identify user (call after login)
 */
export function identifyMixpanel(userId: string, properties?: Record<string, string>): void {
	if (!initialized || !mixpanel) return;

	try {
		mixpanel.identify(userId);
		if (properties) {
			mixpanel.people.set(properties);
		}
	} catch (error) {
		console.warn("[Mixpanel] Failed to identify:", error);
	}
}

/**
 * Reset identity (call on logout)
 */
export function resetMixpanel(): void {
	if (!initialized || !mixpanel) return;

	try {
		mixpanel.reset();
	} catch (error) {
		console.warn("[Mixpanel] Failed to reset:", error);
	}
}

/**
 * Track a custom event
 */
export function trackMixpanel(
	eventName: string,
	properties?: Record<string, string | number | boolean>,
): void {
	if (!initialized || !mixpanel) return;

	try {
		mixpanel.track(eventName, properties);
	} catch (error) {
		console.warn(`[Mixpanel] Failed to track "${eventName}":`, error);
	}
}

// ============================================================================
// TYPED EVENT HELPERS (per installation guide)
// ============================================================================

export function trackSignUp(params: {
	user_id: string;
	email?: string;
	signup_method?: string;
	utm_source?: string;
	utm_medium?: string;
	utm_campaign?: string;
}): void {
	trackMixpanel("Sign Up", params);
}

export function trackSignIn(params: {
	user_id: string;
	login_method?: string;
	success: boolean;
}): void {
	trackMixpanel("Sign In", params);
}

export function trackPageView(params: {
	page_url?: string;
	page_title?: string;
	user_id?: string;
}): void {
	trackMixpanel("Page View", params);
}

export function trackSearch(params: {
	search_query: string;
	user_id?: string;
	results_count?: number;
}): void {
	trackMixpanel("Search", params);
}

export function trackError(params: {
	error_type: string;
	error_message?: string;
	error_code?: string;
	page_url?: string;
	user_id?: string;
}): void {
	trackMixpanel("Error", params);
}

export function trackPurchase(params: {
	user_id: string;
	transaction_id: string;
	revenue: number;
	currency?: string;
}): void {
	trackMixpanel("Purchase", params);
}

export function trackConversion(params: {
	"Conversion Type": string;
	"Conversion Value"?: number;
}): void {
	trackMixpanel("Conversion", params);
}
