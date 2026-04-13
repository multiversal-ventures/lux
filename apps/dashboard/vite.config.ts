import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
	plugins: [react(), tailwindcss()],
	server: {
		port: 3002,
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
