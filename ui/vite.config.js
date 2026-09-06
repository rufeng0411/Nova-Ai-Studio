import path from 'path'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'url'
import { getConnectableHost, normalizeLoopbackHost } from './shared/networkHosts.js'
import { novaPrecompressPlugin } from './scripts/compress-dist-assets.mjs'
import { viteMarketingProxyPlugin } from './scripts/viteMarketingProxyPlugin.mjs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const repoRoot = path.resolve(__dirname, '..')

export default defineConfig(({ mode }) => {
  // Load the single root .env and let exported shell vars override file values.
  const env = {
    ...loadEnv(mode, repoRoot, ''),
    ...process.env,
  }

  const configuredHost = env.HOST || '0.0.0.0'
  // if the host is not a loopback address, it should be used directly. 
  // This allows the vite server to EXPOSE all interfaces when the host 
  // is set to '0.0.0.0' or '::', while still using 'localhost' for browser 
  // URLs and proxy targets.
  const host = normalizeLoopbackHost(configuredHost)
  
  const proxyHost = env.PROXY_HOST || getConnectableHost(configuredHost)
  // TODO: Remove support for legacy PORT variables in all locations in a future major release, leaving only SERVER_PORT.
  const serverPort = env.SERVER_PORT || env.PORT || 3001
  // Always resolve React from repo root to avoid duplicate copies (ui/ vs workspace root).
  const localNodeModules = (...segments) =>
    path.resolve(repoRoot, 'node_modules', ...segments)

  const disableLocalAuth =
    env.PILOTDECK_DISABLE_LOCAL_AUTH !== '0' &&
    env.PILOTDECK_DISABLE_LOCAL_AUTH !== 'false'
  const saasMode =
    env.PILOTDECK_SAAS_MODE === '1' || env.PILOTDECK_SAAS_MODE === 'true'
  const tailMessagePagination =
    env.VITE_TAIL_MESSAGE_PAGINATION === '1' ||
    env.VITE_TAIL_MESSAGE_PAGINATION === 'true'

  const distDir = path.resolve(__dirname, 'dist')
  const marketingOn =
    env.PILOTDECK_MARKETING_SITE === '1'
    || env.PILOTDECK_MARKETING_SITE === 'true'
    || env.VITE_PILOTDECK_MARKETING_SITE === '1'
    || env.VITE_PILOTDECK_MARKETING_SITE === 'true'

  return {
    define: {
      'import.meta.env.VITE_DISABLE_LOCAL_AUTH': JSON.stringify(disableLocalAuth ? 'true' : 'false'),
      // PD-SAAS-FORK: expose SaaS mode to the React client
      'import.meta.env.VITE_PILOTDECK_SAAS_MODE': JSON.stringify(saasMode ? 'true' : 'false'),
      'import.meta.env.VITE_TAIL_MESSAGE_PAGINATION': JSON.stringify(tailMessagePagination ? 'true' : 'false'),
    },
    plugins: [
      react(),
      // PD-SAAS-FORK: Vite `/` → Bridge marketing HTML (same product entry as production)
      viteMarketingProxyPlugin({
        proxyHost,
        serverPort,
        marketingOn,
      }),
      ...(mode === 'production' ? [novaPrecompressPlugin(distDir)] : []),
    ],
    resolve: {
      dedupe: ['react', 'react-dom', 'react-i18next'],
      alias: {
        react: localNodeModules('react'),
        'react-dom': localNodeModules('react-dom'),
        'react/jsx-runtime': localNodeModules('react', 'jsx-runtime.js'),
        'react/jsx-dev-runtime': localNodeModules('react', 'jsx-dev-runtime.js'),
        // PD-SAAS-FORK: pptxviewjs optional chart peer — stub keeps bundle lean
        'chart.js/auto': path.resolve(__dirname, 'src/components/document-canvas/utils/chartJsStub.ts'),
        // PD-SAAS-FORK: UI imports sdmSlotMatching → stabilityEvents; keep node:fs out of browser.
        [path.resolve(repoRoot, 'src/telemetry/stabilityEvents.ts')]: path.resolve(
          __dirname,
          'src/shared/stabilityEventsBrowserStub.ts',
        ),
        [path.resolve(repoRoot, 'src/telemetry/stabilityEvents.js')]: path.resolve(
          __dirname,
          'src/shared/stabilityEventsBrowserStub.ts',
        ),
      }
    },
    // PD-SAAS-FORK: keep recharts (if reintroduced) on the same React instance as the app
    optimizeDeps: {
      include: [
        'react',
        'react-dom',
        'react/jsx-runtime',
        'react/jsx-dev-runtime',
        'recharts',
        '@tldraw/tldraw',
      ],
    },
    server: {
      host,
      port: parseInt(env.VITE_PORT) || 5173,
      // PD-SAAS-FORK: pinned VITE_PORT must not silently bump (Playwright harness)
      strictPort: Boolean(env.VITE_PORT),
      proxy: {
        '/api': {
          target: `http://${proxyHost}:${serverPort}`,
          changeOrigin: true,
        },
        // PD-SAAS-FORK: public markdown share SSR (must not fall through to SPA).
        // Bare `/s` prefix steals `/src/**` → Bridge SPA HTML → MIME white-screen; keep `/s/`.
        '/s/': {
          target: `http://${proxyHost}:${serverPort}`,
          changeOrigin: true,
        },
        // Bare `/share` steals Vite `/shared/*.mjs`; SPA also owns `/share/markdown` — only proxy `/share/doc/`.
        '/share': {
          target: `http://${proxyHost}:${serverPort}`,
          changeOrigin: true,
          bypass(req) {
            const p = String(req.url || '').split('?')[0] || '';
            if (p === '/share/doc' || p.startsWith('/share/doc/')) return undefined;
            return req.url;
          },
        },
        '/memory-dashboard': {
          target: `http://${proxyHost}:${serverPort}`,
          changeOrigin: true,
        },
        '/ws': {
          target: `ws://${proxyHost}:${serverPort}`,
          ws: true,
          changeOrigin: true,
          timeout: 0,
          proxyTimeout: 0,
        },
        '/shell': {
          target: `ws://${proxyHost}:${serverPort}`,
          ws: true,
          changeOrigin: true,
          timeout: 0,
          proxyTimeout: 0,
        },
      }
    },
    build: {
      outDir: 'dist',
      chunkSizeWarningLimit: 1000,
      rollupOptions: {
        output: {
          manualChunks: {
            'vendor-react': ['react', 'react-dom', 'react-router-dom'],
            'vendor-codemirror': [
              '@uiw/react-codemirror',
              '@codemirror/lang-css',
              '@codemirror/lang-html',
              '@codemirror/lang-javascript',
              '@codemirror/lang-json',
              '@codemirror/lang-markdown',
              '@codemirror/lang-python',
              '@codemirror/theme-one-dark'
            ],
            'vendor-xterm': ['@xterm/xterm', '@xterm/addon-fit', '@xterm/addon-clipboard', '@xterm/addon-webgl'],
            'document-office': ['docx-preview', 'pptxviewjs'],
          }
        }
      }
    },
    test: {
      environment: 'jsdom',
      setupFiles: ['./src/test/vitest.setup.ts'],
      exclude: [
        '**/node_modules/**',
        '**/dist/**',
        '**/e2e/**',
        // PD-SAAS-FORK: node:test server tests run via `node --test` (npm run test:saas:* / test:server),
        // not vitest — exclude each so vite does not try to bundle the "node:test" builtin.
        // NOTE: saas/ and utils/ mix vitest + node:test files, so node:test *.test.js must be
        // listed explicitly (the saas/**/*.test.mjs glob only covers .mjs node:test files).
        'server/saas/billing/billing.test.js',
        'server/saas/analytics/analytics.test.js',
        'server/saas/cache/cacheKeys.test.js',
        'server/saas/storage/ossConfig.test.js',
        'server/saas/usage/usage.test.js',
        'server/utils/precompressedStatic.test.js',
        'server/utils/validateDeliverables.html.test.mjs',
        'server/saas/**/*.test.mjs',
        'shared/**/*.test.mjs',
        'scripts/**/*.test.mjs',
      ],
      server: {
        deps: {
          inline: ['react', 'react-dom', 'react-i18next', 'lucide-react', '@radix-ui/react-slot']
        }
      }
    }
  }
})
