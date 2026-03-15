import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const configuredHost = (env.VITE_PUBLIC_POSTHOG_HOST || '').replace(/\/+$/, '');
  const proxyTarget = (configuredHost && configuredHost.startsWith('http')
    ? configuredHost
    : 'https://us.i.posthog.com');

  return {
    plugins: [react()],
    server: {
      proxy: {
        '/ingest': {
          target: proxyTarget,
          changeOrigin: true,
          secure: true,
          rewrite: (path) => path.replace(/^\/ingest/, ''),
        },
      },
    },
  };
});
