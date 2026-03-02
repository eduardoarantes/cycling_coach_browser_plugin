/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_PLANMYPEAK_TARGET?: 'local' | 'production';
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
