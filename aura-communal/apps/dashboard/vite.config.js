import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react()],
    define: {
      'process.env.MQTT_WS_URL': JSON.stringify(env.MQTT_WS_URL || ''),
      global: 'globalThis',
    },
    resolve: {
      alias: {
        buffer: 'buffer',
        events: 'events',
        util: 'util',
        stream: 'stream-browserify',
        crypto: 'crypto-browserify',
        path: 'path-browserify',
        os: 'os-browserify/browser',
      },
    },
    optimizeDeps: {
      include: ['buffer', 'events', 'util', 'stream-browserify', 'crypto-browserify'],
    },
  };
});
