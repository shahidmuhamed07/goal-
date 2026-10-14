import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// The admin runs on its own port so it can sit next to the app (3000) in development.
export default defineConfig({
  plugins: [react()],
  server: { port: 3001, host: '0.0.0.0' },
});
