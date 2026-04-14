import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
	plugins: [react(), tailwindcss()],
	server: {
		port: 3332,
		proxy: {
			// /api/v1/* → Veritas API (strip /api/v1 prefix)
			// Dashboard sends: GET /api/v1/auth/me
			// Veritas receives: GET /auth/me
			"/api/v1": {
				target: "http://localhost:8000",
				changeOrigin: true,
				rewrite: (path) => path.replace(/^\/api\/v1/, ""),
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
			// /api/* (no v1) → Veritas API direct (for portal, cases, etc.)
			"/api": {
				target: "http://localhost:8000",
				changeOrigin: true,
				rewrite: (path) => path.replace(/^\/api/, ""),
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
