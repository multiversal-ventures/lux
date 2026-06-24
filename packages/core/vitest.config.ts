import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		passWithNoTests: true,
		// Only run the TypeScript sources — never compiled copies under dist/.
		include: ["src/**/*.{test,spec}.{ts,tsx}"],
		exclude: [...configDefaults.exclude, "**/dist/**"],
	},
});
