import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig(({ mode }) => {
	const env = loadEnv(mode, process.cwd(), "VITE_");
	const projectId = env.VITE_FIREBASE_PROJECT_ID || "";

	return {
		plugins: [react(), tailwindcss()],
		server: {
			port: 3332,
			proxy: {
				// Dashboard is multi-tenant — user's JWT is the Bearer.
				// Tenant resolved from user lookup in Veritas, not from proxy.
				"/api/v1": {
					target: "http://localhost:8000",
					changeOrigin: true,
					rewrite: (path) => path.replace(/^\/api\/v1/, ""),
					configure: (proxy) => {
						proxy.on("proxyReq", (proxyReq) => {
							// JWT stays as Bearer — Veritas validates via JWKS
							// Inject JWKS verification params
							proxyReq.setHeader(
								"X-Auth-JWKS-URL",
								"https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com",
							);
							if (projectId) {
								proxyReq.setHeader("X-Auth-Audience", projectId);
								proxyReq.setHeader(
									"X-Auth-Issuer",
									`https://securetoken.google.com/${projectId}`,
								);
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
