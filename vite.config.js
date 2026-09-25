import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [vue()],
    server: {
      proxy: {
        '/hf-api': {
          target: 'https://api-inference.huggingface.co',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/hf-api/, ''),
        },
        // Local dev: forward /api/ocr and /api/tts to a deployed copy of the
        // serverless functions (e.g. VITE_API_PROXY=https://<app>.vercel.app)
        ...(env.VITE_API_PROXY
          ? { '/api': { target: env.VITE_API_PROXY, changeOrigin: true } }
          : {}),
      }
    }
  }
})
