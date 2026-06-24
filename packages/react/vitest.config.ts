import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		environment: "happy-dom",
		globals: true,
		setupFiles: ["./src/test-setup.ts"],
		css: { modules: { classNameStrategy: "non-scoped" } },
		passWithNoTests: true,
		// Only run the TypeScript sources — never the compiled copies under
		// dist/ (stale duplicates that also break on externalized imports).
		include: ["src/**/*.{test,spec}.{ts,tsx}"],
		exclude: [...configDefaults.exclude, "**/dist/**"],
	},
});
