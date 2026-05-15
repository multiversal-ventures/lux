import react from "@vitejs/plugin-react";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const __dirname = dirname(fileURLToPath(import.meta.url));

function readPkgVersion(relativePath: string): string {
	const full = resolve(__dirname, relativePath);
	return JSON.parse(readFileSync(full, "utf8")).version as string;
}

const luxCoreVersion = readPkgVersion("../../packages/core/package.json");
const luxReactVersion = readPkgVersion("../../packages/react/package.json");
const sampleDashboardVersion = readPkgVersion("./package.json");

export default defineConfig({
	define: {
		__LUX_CORE_PKG_VERSION__: JSON.stringify(luxCoreVersion),
		__LUX_REACT_PKG_VERSION__: JSON.stringify(luxReactVersion),
		__LUX_SAMPLE_DASHBOARD_PKG_VERSION__: JSON.stringify(sampleDashboardVersion),
	},
	plugins: [react()],
	server: {
		port: 3332,
		proxy: {
			"/api": {
				target: process.env.VITE_LUX_PROXY_TARGET ?? "http://localhost:8000",
				changeOrigin: true,
				configure: (proxy) => {
					proxy.on("proxyRes", (proxyRes, req) => {
						if (req.url?.includes("/stream")) {
							proxyRes.headers["X-Accel-Buffering"] = "no";
							proxyRes.headers["Cache-Control"] = "no-cache";
							proxyRes.headers["Connection"] = "keep-alive";
						}
					});
				},
			},
		},
	},
});
