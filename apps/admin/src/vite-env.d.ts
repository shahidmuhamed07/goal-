/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Where the API lives. Defaults to http://localhost:3002 in development. */
  readonly VITE_API_URL?: string;
  /** Set to "true" to use browser storage instead of the API (practice mode). */
  readonly VITE_USE_MOCK?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
