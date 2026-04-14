#!/usr/bin/env node
/**
 * Codegen wrapper for openapi-typescript.
 *
 * Usage:
 *   pnpm codegen                                       # ./openapi.json
 *   pnpm codegen --url http://localhost:8000/openapi.json
 *   pnpm codegen ./path/to/spec.json                   # positional input
 *   VERITAS_OPENAPI=http://... pnpm codegen            # env var
 *
 * Extra flags pass through to openapi-typescript, e.g.:
 *   pnpm codegen --url http://... --immutable
 */
import { spawnSync } from "node:child_process";

const args = process.argv.slice(2);
let input = process.env.VERITAS_OPENAPI || "./openapi.json";

const urlIdx = args.findIndex((a) => a === "--url" || a === "-u");
if (urlIdx !== -1) {
	const value = args[urlIdx + 1];
	if (!value) {
		console.error("codegen: --url requires a value");
		process.exit(1);
	}
	input = value;
	args.splice(urlIdx, 2);
} else if (args.length > 0 && !args[0].startsWith("-")) {
	input = args.shift();
}

const output = "packages/core/src/generated.ts";
console.log(`[codegen] ${input} → ${output}`);

const result = spawnSync(
	"openapi-typescript",
	[input, "-o", output, ...args],
	{ stdio: "inherit", shell: true },
);
process.exit(result.status ?? 1);
