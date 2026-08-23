import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { crx } from '@crxjs/vite-plugin';
import rawManifest from './public/manifest.json';
import path from 'path';

// Loopback patterns for local-target builds only; production builds never see
// them. They carry no port on purpose: a match pattern without a port matches
// every port, so the app and Supabase ports stay freely configurable at runtime
// (see the Local Dev Ports panel) without a manifest edit and rebuild.
const LOCAL_LOOPBACK_MATCHES = [
  'https://localhost/*',
  'https://127.0.0.1/*',
  'http://localhost/*',
  'http://127.0.0.1/*',
];

const LOCAL_HOST_PERMISSIONS = LOCAL_LOOPBACK_MATCHES;

const LOCAL_CONTENT_SCRIPT_MATCHES = LOCAL_LOOPBACK_MATCHES;

// web_accessible_resources is not declared here: @crxjs/vite-plugin derives it
// from the content scripts' own chunk graph and matches, which covers the
// import overlay's lazily-imported chunk on both production and local origins.
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
