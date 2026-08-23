// Request/response types shared between the client (src/) and the API
// (server/). The server imports these with a relative path; the client uses
// `@/types/api`.

export type HealthResponse = {
  ok: true;
  sqliteVersion: string;
  schemaVersion: number;
  dbSizeBytes: number;
};

export type ApiError = {
  error: string;
};
