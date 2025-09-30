import { defineConfig } from 'vite';

// Configuración mínima de Vite
export default defineConfig({
  server: {
    host: '127.0.0.1',
    port: 5173
  },
  preview: {
    host: '127.0.0.1',
    port: 5173
  }
});
