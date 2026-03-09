import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'
import { readFileSync, writeFileSync } from 'fs'
import { resolve } from 'path'

const outDir = '../wishlist-dist'

export default defineConfig({
  plugins: [
    react(),
    viteSingleFile(),
    {
      // Post-process the emitted HTML to strip file://-incompatible attributes
      name: 'clean-for-file-protocol',
      enforce: 'post',
      closeBundle() {
        const htmlPath = resolve(__dirname, outDir, 'index.html')
        const html = readFileSync(htmlPath, 'utf8')
          .replace(/<link rel="modulepreload"[^>]*>\s*/g, '')
          .replace(/ crossorigin/g, '')
          // Convert module script to classic script so file:// works on iOS Safari
          .replace(/<script type="module">/g, '<script>')
        writeFileSync(htmlPath, html)
      },
    },
  ],
  build: {
    outDir,
    emptyOutDir: true,
    modulePreload: { polyfill: false },
    assetsInlineLimit: 100_000_000,
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
        format: 'iife',
      },
    },
  },
})
