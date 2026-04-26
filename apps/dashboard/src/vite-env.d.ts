/// <reference types="vite/client" />

declare const __LUX_CORE_PKG_VERSION__: string;
declare const __LUX_REACT_PKG_VERSION__: string;
declare const __LUX_SAMPLE_DASHBOARD_PKG_VERSION__: string;

declare const __APP_VERSION__: string;
declare const __GIT_HASH__: string;
declare const __GIT_BRANCH__: string;
declare const __BUILD_TIME__: string;

interface ImportMetaEnv {
	readonly VITE_FIREBASE_MEASUREMENT_ID?: string;
	readonly VITE_MIXPANEL_TOKEN?: string;
	/** Absolute Gunnr API origin (no trailing slash). See apps/dashboard/README.md */
	readonly VITE_GUNNR_API_URL?: string;
	readonly VITE_DEV_UI_ONLY?: string;
}
