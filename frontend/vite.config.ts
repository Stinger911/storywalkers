import path from 'path'
import { defineConfig, loadEnv } from 'vite'
import solid from 'vite-plugin-solid'

export default ({ mode }: { mode: string }) => {
  const env = { ...process.env, ...loadEnv(mode, process.cwd(), "") };

  const PROXY_TARGET = env.PROXY_TARGET || "https://storywalkers-b4fdf.firebaseapp.com/";
return defineConfig({
  plugins: [solid()],
  server: {
    proxy: {
      '/api': {
        target: PROXY_TARGET,
        changeOrigin: true,
        secure: false,
          headers: {
            "Content-Type": "application/json",
          },
          configure: (proxy, _options) => {
            proxy.on("error", (err, _req, _res) => {
              console.log("proxy error", err);
            });
            proxy.on("proxyRes", (proxyRes, req, _res) => {
              console.log("Received Response from the Target:", proxyRes.statusCode, req.url);
            });
          },
          }
    }
  },
  resolve: {
    alias: {
      "~": path.resolve(__dirname, "./src")
    }
  }
})
}