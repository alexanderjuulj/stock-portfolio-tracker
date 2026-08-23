import fs from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import { DB_PATH, exportSnapshot, getDb, importSnapshot, schemaVersion } from "./db";
import type { HealthResponse } from "../src/types/api";

// Uploads larger than this are rejected — far beyond any plausible portfolio DB.
const MAX_IMPORT_BYTES = 100 * 1024 * 1024;

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}

function readBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_IMPORT_BYTES) {
        reject(new Error(`Body exceeds ${MAX_IMPORT_BYTES} bytes`));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function health(): HealthResponse {
  const db = getDb();
  const { v } = db.prepare("SELECT sqlite_version() AS v").get() as { v: string };
  return {
    ok: true,
    sqliteVersion: v,
    schemaVersion: schemaVersion(db),
    dbSizeBytes: fs.statSync(DB_PATH).size,
  };
}

/**
 * Connect-style handler mounted at `/api` by the Vite plugin — the mount
 * strips the prefix, so routes here match on e.g. `/health`.
 */
export async function handleApiRequest(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const url = (req.url ?? "/").split("?")[0];
  try {
    if (req.method === "GET" && url === "/health") {
      sendJson(res, 200, health());
      return;
    }

    if (req.method === "GET" && url === "/export") {
      const snapshot = exportSnapshot();
      const stamp = new Date().toISOString().slice(0, 10);
      res.statusCode = 200;
      res.setHeader("Content-Type", "application/octet-stream");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="rahamasin-${stamp}.db"`,
      );
      res.end(snapshot);
      return;
    }

    if (req.method === "POST" && url === "/import") {
      const body = await readBody(req);
      if (body.length === 0) {
        sendJson(res, 400, { error: "Empty body — send the .db file as the request body" });
        return;
      }
      importSnapshot(body);
      sendJson(res, 200, health());
      return;
    }

    sendJson(res, 404, { error: `No route: ${req.method} /api${url}` });
  } catch (err) {
    sendJson(res, 500, { error: err instanceof Error ? err.message : String(err) });
  }
}
