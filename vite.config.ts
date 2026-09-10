import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { version } from './package.json'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Shown in the corner of every screen so playtesters can say which build they saw
  define: { __APP_VERSION__: JSON.stringify(version) },
})
