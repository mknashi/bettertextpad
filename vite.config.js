import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Remove externalization - let both builds bundle @tauri-apps
  // The web version won't use it, desktop version needs it
})
