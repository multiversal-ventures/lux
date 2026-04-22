import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
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
