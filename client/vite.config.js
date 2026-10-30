import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The API the dev server proxies to. Keep in step with server/.env PORT.
const API_TARGET = process.env.VITE_DEV_API_TARGET || 'http://localhost:5000';

export default defineConfig({
  plugins: [react()],
  // REACT_APP_ is accepted so a key copied from a Create React App project works.
  envPrefix: ['VITE_', 'REACT_APP_'],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: API_TARGET, changeOrigin: true },
      '/uploads': { target: API_TARGET, changeOrigin: true },
      '/socket.io': { target: API_TARGET, ws: true },
    },
  },
  build: {
    // Charts and the Maps wrapper are large and only needed on some routes;
    // splitting them keeps the initial download small.
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          charts: ['recharts'],
          maps: ['@react-google-maps/api'],
          realtime: ['socket.io-client'],
        },
      },
    },
    chunkSizeWarningLimit: 700,
  },
});
