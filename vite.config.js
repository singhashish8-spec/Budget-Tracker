import { readFileSync } from 'node:fs'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The live web-bundle version, read from web-version.txt at build time and
// exposed to the app so Settings can display exactly which version is running.
// This is the same number the over-the-air updater compares against, so it is
// the single source of truth for "what version am I on".
const webVersion = readFileSync(new URL('./web-version.txt', import.meta.url), 'utf8').trim()

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(webVersion),
  },
})
