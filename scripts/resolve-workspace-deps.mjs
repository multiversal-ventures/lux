#!/usr/bin/env node
/**
 * Rewrite `workspace:*` references in publishable package.json files to
 * concrete version ranges (e.g. "^0.1.0") so that packed tarballs are
 * installable outside this monorepo.
 *
 * Only touches packages under packages/ — apps are private and never packed.
 *
 * Run after `pnpm build` and before `pnpm pack`.
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const packagesDir = join(import.meta.dirname, "..", "packages");
const packageDirs = readdirSync(packagesDir, { withFileTypes: true })
	.filter((d) => d.isDirectory())
	.map((d) => join(packagesDir, d.name));

const versionMap = new Map();
for (const dir of packageDirs) {
	const pkgPath = join(dir, "package.json");
	const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
	versionMap.set(pkg.name, pkg.version);
}

let totalRewrites = 0;

for (const dir of packageDirs) {
	const pkgPath = join(dir, "package.json");
	const raw = readFileSync(pkgPath, "utf8");
	const pkg = JSON.parse(raw);
	let changed = false;

	for (const depField of ["dependencies", "peerDependencies", "devDependencies"]) {
		const deps = pkg[depField];
		if (!deps) continue;
		for (const [name, version] of Object.entries(deps)) {
			if (typeof version === "string" && version.startsWith("workspace:")) {
				const resolved = versionMap.get(name);
				if (!resolved) {
					console.warn(`[resolve-workspace-deps] ${pkg.name}: cannot resolve ${name} (not in packages/)`);
					continue;
				}
				deps[name] = `^${resolved}`;
				changed = true;
				totalRewrites++;
			}
		}
	}

	if (changed) {
		writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
		console.log(`[resolve-workspace-deps] ${pkg.name}: rewrote workspace references`);
	}
}

console.log(`[resolve-workspace-deps] ${totalRewrites} workspace references resolved`);
