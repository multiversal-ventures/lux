import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig(({ mode }) => {
	const env = loadEnv(mode, process.cwd(), ["VITE_", "VERITAS_"]);
	const veritasBearer = env.VERITAS_BEARER_TOKEN || "";

	return {
		plugins: [react(), tailwindcss()],
		server: {
			port: 3331,
			proxy: {
				"/api": {
					target: "http://localhost:8000",
					changeOrigin: true,
					rewrite: (path) => path.replace(/^\/api/, ""),
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
