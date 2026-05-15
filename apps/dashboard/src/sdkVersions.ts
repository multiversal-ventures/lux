/** Package versions injected at build time from each package.json. */
export const LUX_SAMPLE_PKG_VERSIONS = {
	luxCore: __LUX_CORE_PKG_VERSION__,
	luxReact: __LUX_REACT_PKG_VERSION__,
	sampleDashboard: __LUX_SAMPLE_DASHBOARD_PKG_VERSION__,
} as const;
