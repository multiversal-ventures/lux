/// <reference types="vite/client" />

declare const __LUX_CORE_PKG_VERSION__: string;
declare const __LUX_REACT_PKG_VERSION__: string;
declare const __LUX_SAMPLE_DASHBOARD_PKG_VERSION__: string;

interface ImportMetaEnv {
	/** Optional API origin for initLux baseUrl (no trailing slash). */
	readonly VITE_LUX_BASE_URL?: string;
	/** Absolute Gunnr API origin (no trailing slash). See apps/dashboard/README.md */
	readonly VITE_GUNNR_API_URL?: string;
	readonly VITE_DEV_UI_ONLY?: string;
}
