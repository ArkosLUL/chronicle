/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SERVER_NAME: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
