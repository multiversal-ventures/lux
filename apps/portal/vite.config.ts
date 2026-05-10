import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig(({ mode }) => {
	const env = loadEnv(mode, process.cwd(), ["VITE_", "VERITAS_"]);
	const veritasBearer = env.VERITAS_BEARER_TOKEN || "";
	const apiTarget = env.VITE_VERITAS_API_URL || env.VITE_API_TARGET || "http://localhost:8000";

	return {
		plugins: [react(), tailwindcss()],
		server: {
			port: 3331,
			proxy: {
				"/api": {
					target: apiTarget,
					changeOrigin: true,
					configure: (proxy) => {
						proxy.on("proxyReq", (proxyReq) => {
							// Tenant credential as primary auth
							if (veritasBearer) {
								proxyReq.setHeader("Authorization", `Bearer ${veritasBearer}`);
							}
						});
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
	};
});
