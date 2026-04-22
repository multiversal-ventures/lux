/**
 * Local UI preview: set `VITE_DEV_UI_ONLY=true` in `apps/dashboard/.env` and restart Vite.
 * Skips health polling and skips login/tenant checks on protected routes.
 */
export function isDevUiOnlyBypass(): boolean {
	return import.meta.env.VITE_DEV_UI_ONLY === "true";
}
