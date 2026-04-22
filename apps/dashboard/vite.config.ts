import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const __dirname = dirname(fileURLToPath(import.meta.url));
const packageJson = JSON.parse(readFileSync(join(__dirname, "package.json"), "utf-8")) as {
	version: string;
};

function getGitHash(): string {
	try {
		return execSync("git rev-parse --short HEAD").toString().trim();
	} catch {
		return "unknown";
	}
}

function getGitBranch(): string {
	try {
		return execSync("git rev-parse --abbrev-ref HEAD").toString().trim();
	} catch {
		return "unknown";
	}
}

export default defineConfig({
	plugins: [react(), tailwindcss()],
	define: {
		__APP_VERSION__: JSON.stringify(packageJson.version),
		__GIT_HASH__: JSON.stringify(getGitHash()),
		__GIT_BRANCH__: JSON.stringify(getGitBranch()),
		__BUILD_TIME__: JSON.stringify(new Date().toISOString()),
	},
	server: {
		port: 3332,
		proxy: {
			"/api": {
				target: "http://localhost:8000",
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
