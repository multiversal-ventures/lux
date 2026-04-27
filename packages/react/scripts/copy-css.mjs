#!/usr/bin/env node
/**
 * Post-tsc step: copy *.module.css files from src/ to dist/.
 * tsc doesn't process non-TS assets; we ship these alongside compiled JS
 * so component consumers (Vite, webpack, etc.) can resolve the relative
 * "./Foo.module.css" imports that survive compilation.
 */
import { readdirSync, statSync, mkdirSync, copyFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const srcDir = join(root, "src");
const dstDir = join(root, "dist");

let copied = 0;
function walk(dir) {
	for (const entry of readdirSync(dir)) {
		const full = join(dir, entry);
		const st = statSync(full);
		if (st.isDirectory()) { walk(full); continue; }
		if (!entry.endsWith(".module.css")) continue;
		const relPath = relative(srcDir, full);
		const target = join(dstDir, relPath);
		mkdirSync(join(target, ".."), { recursive: true });
		copyFileSync(full, target);
		copied += 1;
	}
}
walk(srcDir);
console.log(`[copy-css] ${copied} .module.css files copied to dist/`);
