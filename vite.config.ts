import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { crx } from '@crxjs/vite-plugin';
import rawManifest from './public/manifest.json';
import path from 'path';

const LOCAL_HOST_PERMISSIONS = [
  'http://localhost:3004/*',
  'http://127.0.0.1:3004/*',
  'http://localhost:3006/*',
  'http://127.0.0.1:3006/*',
  'http://127.0.0.1:54341/*',
  'http://localhost:54341/*',
  'http://127.0.0.1:54361/*',
  'http://localhost:54361/*',
];

const LOCAL_CONTENT_SCRIPT_MATCHES = [
  'http://localhost:3004/*',
  'http://127.0.0.1:3004/*',
  'http://localhost:3006/*',
  'http://127.0.0.1:3006/*',
];

function withLocalDevelopmentHosts(): typeof rawManifest {
  return {
    ...rawManifest,
    host_permissions: [
      ...(rawManifest.host_permissions ?? []),
      ...LOCAL_HOST_PERMISSIONS,
    ],
    content_scripts: (rawManifest.content_scripts ?? []).map((script) => ({
      ...script,
      matches: [...script.matches, ...LOCAL_CONTENT_SCRIPT_MATCHES],
    })),
  };
}

// https://vitejs.dev/config/
export default defineConfig(() => {
  const isLocalPlanMyPeakTarget =
    process.env.VITE_PLANMYPEAK_TARGET === 'local';
  const manifest = isLocalPlanMyPeakTarget
    ? withLocalDevelopmentHosts()
    : rawManifest;

  return {
    plugins: [react(), crx({ manifest })],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, './src'),
      },
    },
    build: {
      rollupOptions: {
        input: {
          popup: 'src/popup/index.html',
        },
      },
    },
  };
});
