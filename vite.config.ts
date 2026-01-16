import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import Icons from 'unplugin-icons/vite'
import { resolve } from 'path'
import dts from 'vite-plugin-dts'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const isPluginBuild = mode === 'plugin'

  return {
    plugins: [
      vue(),
      Icons({
        compiler: 'vue3',
        autoInstall: true,
      }),
      dts({
        include: ['src/**/*.ts', 'src/**/*.vue'],
        outDir: 'dist/types',
      }),
    ],
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src'),
        '@components': resolve(__dirname, 'src/components'),
        '@stores': resolve(__dirname, 'src/stores'),
        '@types': resolve(__dirname, 'src/types'),
        '@utils': resolve(__dirname, 'src/utils'),
        '@mock': resolve(__dirname, 'src/mock'),
        '@assets': resolve(__dirname, 'src/assets'),
      },
    },
    define: {
      __DEV__: JSON.stringify(!isPluginBuild),
      __MOCK_ENABLED__: JSON.stringify(!isPluginBuild),
    },
    build: isPluginBuild
      ? {
          outDir: 'dist/plugin',
          lib: {
            entry: resolve(__dirname, 'src/plugin-entry.ts'),
            name: 'PhoneSimulator',
            formats: ['iife'],
            fileName: () => 'script.js',
          },
          rollupOptions: {
            external: [],
            output: {
              globals: {},
              assetFileNames: (assetInfo) => {
                if (assetInfo.name === 'style.css') return 'style.css'
                return assetInfo.name || 'asset'
              },
            },
          },
          cssCodeSplit: false,
          minify: 'terser',
          terserOptions: {
            compress: {
              drop_console: true,
              drop_debugger: true,
            },
          },
        }
      : {
          outDir: 'dist/dev',
          sourcemap: true,
        },
    server: {
      port: 5173,
      open: true,
      cors: true,
    },
    css: {
      postcss: './postcss.config.js',
    },
    test: {
      globals: true,
      environment: 'jsdom',
      coverage: {
        provider: 'v8',
        reporter: ['text', 'json', 'html'],
      },
    },
  }
})