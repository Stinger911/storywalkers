import path from 'path'
import { loadEnv } from 'vite'
import { defineConfig } from 'vitest/config'
import solid from 'vite-plugin-solid'

export default ({ mode }: { mode: string }) => {
  const env = { ...process.env, ...loadEnv(mode, process.cwd(), "") };

  const PROXY_TARGET = env.PROXY_TARGET || "https://storywalkers-b4fdf.firebaseapp.com/";
  return defineConfig({
    plugins: [solid()],
    test: {
      environment: "jsdom",
      setupFiles: "src/setupTests.ts",
      globals: true,
      include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    },
    server: {
      allowedHosts: ["683f-88-156-132-232.ngrok-free.app", "localhost"],
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
