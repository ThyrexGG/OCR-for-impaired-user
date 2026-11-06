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
        // Local dev: forward /api/tts, /api/analyze, /api/lexicon to local KhmerNeuralTTS engine (port 5055),
        // or forward /api to VITE_API_PROXY if explicitly configured (sent as if from that site's own pages,
        // which the deployed functions require: api/_appAccess.js)
        ...(env.VITE_API_PROXY
          ? { '/api': { target: env.VITE_API_PROXY, changeOrigin: true, headers: { origin: new URL(env.VITE_API_PROXY).origin } } }
          : {
              '/api/tts': { target: 'http://127.0.0.1:5055', changeOrigin: true },
              '/api/analyze': { target: 'http://127.0.0.1:5055', changeOrigin: true },
              '/api/lexicon': { target: 'http://127.0.0.1:5055', changeOrigin: true },
            }),
      }
    }
  }
})
