import fs from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import { createAccount, deleteAccount, parseAccountInput, updateAccount } from "./accounts";
import {
  activeDbPath,
  exportSnapshot,
  getDb,
  importSnapshot,
  inConceptContext,
  runInConceptContext,
  schemaVersion,
  startConceptMode,
  stopConceptMode,
} from "./db";
import { buildHistory } from "./history";
import { createHolding, deleteHolding, parseHoldingInput, updateHolding } from "./holdings";
import { buildPortfolio } from "./portfolio";
import { clearQuoteOverride, getQuoteProvider, setQuoteOverride } from "./quotes";
import { createSale, deleteSale, parseSaleInput, updateSale } from "./sales";
import { getSetting, setSetting } from "./settings";
import { deleteStock, normalizeTicker, parseStockInput, updateStock } from "./stocks";
import type { AppSettings, HealthResponse } from "../src/types/api";

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

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const body = await readBody(req);
  if (body.length === 0) throw new Error("Empty body — send a JSON object");
  try {
    return JSON.parse(body.toString("utf8")) as unknown;
  } catch {
    throw new Error("Body is not valid JSON");
  }
}

function parseSettingsInput(body: unknown): AppSettings {
  if (typeof body !== "object" || body === null) throw new Error("Expected a JSON object");
  const b = body as Record<string, unknown>;
  if (b.provider !== "yahoo" && b.provider !== "finnhub") {
    throw new Error('Unknown provider — expected "yahoo" or "finnhub"');
  }
  return {
    provider: b.provider,
    finnhubApiKey: typeof b.finnhubApiKey === "string" ? b.finnhubApiKey.trim() : "",
  };
}

function currentSettings(): AppSettings {
  return {
    provider: getQuoteProvider(),
    finnhubApiKey: getSetting("finnhub_api_key") ?? "",
  };
}

function health(): HealthResponse {
  const db = getDb();
  const { v } = db.prepare("SELECT sqlite_version() AS v").get() as { v: string };
  return {
    ok: true,
    sqliteVersion: v,
    schemaVersion: schemaVersion(db),
    dbSizeBytes: fs.statSync(activeDbPath()).size,
  };
}

/**
 * Connect-style handler mounted at `/api` by the Vite plugin — the mount
 * strips the prefix, so routes here match on e.g. `/health`.
 *
 * A request carrying `x-concept: 1` (sent by the client while concept mode
 * is on) runs entirely against the concept sandbox DB — see server/db.ts.
 */
export function handleApiRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
  return runInConceptContext(req.headers["x-concept"] === "1", () => routeRequest(req, res));
}

async function routeRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
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
      if (inConceptContext()) {
        sendJson(res, 400, { error: "Leave concept mode before importing a backup" });
        return;
      }
      const body = await readBody(req);
      if (body.length === 0) {
        sendJson(res, 400, { error: "Empty body — send the .db file as the request body" });
        return;
      }
      importSnapshot(body);
      sendJson(res, 200, health());
      return;
    }

    // ── Concept mode ─────────────────────────────────────────────────────
    // Enter forks a fresh sandbox copy of the DB, leave discards it. The
    // active flag itself travels as the x-concept header on every request.

    if (req.method === "POST" && url === "/concept") {
      try {
        const body = (await readJsonBody(req)) as { active?: unknown };
        if (typeof body.active !== "boolean") throw new Error("Expected { active: boolean }");
        if (body.active) startConceptMode();
        else stopConceptMode();
        sendJson(res, 200, { active: body.active });
      } catch (err) {
        sendJson(res, 400, { error: errorMessage(err) });
      }
      return;
    }

    const query = new URLSearchParams((req.url ?? "").split("?")[1] ?? "");
    const accountParam = query.get("account");
    const accountScope =
      accountParam !== null && /^\d+$/.test(accountParam) ? Number(accountParam) : null;

    if (req.method === "GET" && url === "/portfolio") {
      sendJson(
        res,
        200,
        await buildPortfolio({ force: query.get("refresh") === "1", accountId: accountScope }),
      );
      return;
    }

    if (req.method === "GET" && url === "/history") {
      sendJson(res, 200, await buildHistory(accountScope));
      return;
    }

    // ── Holdings (lots) ──────────────────────────────────────────────────
    // Validation, "account not found" and ledger conflicts are caller
    // mistakes → 400.

    if (req.method === "POST" && url === "/holdings") {
      try {
        sendJson(res, 201, createHolding(parseHoldingInput(await readJsonBody(req))));
      } catch (err) {
        sendJson(res, 400, { error: errorMessage(err) });
      }
      return;
    }

    const holdingRoute = url.match(/^\/holdings\/(\d+)$/);
    if (holdingRoute && req.method === "DELETE") {
      const id = Number(holdingRoute[1]);
      try {
        if (deleteHolding(id)) sendJson(res, 200, { ok: true });
        else sendJson(res, 404, { error: `No holding with id ${id}` });
      } catch (err) {
        sendJson(res, 400, { error: errorMessage(err) });
      }
      return;
    }

    if (holdingRoute && req.method === "PUT") {
      const id = Number(holdingRoute[1]);
      try {
        const updated = updateHolding(id, parseHoldingInput(await readJsonBody(req)));
        if (updated) sendJson(res, 200, updated);
        else sendJson(res, 404, { error: `No holding with id ${id}` });
      } catch (err) {
        sendJson(res, 400, { error: errorMessage(err) });
      }
      return;
    }

    // ── Sales ────────────────────────────────────────────────────────────

    if (req.method === "POST" && url === "/sales") {
      try {
        sendJson(res, 201, await createSale(parseSaleInput(await readJsonBody(req))));
      } catch (err) {
        sendJson(res, 400, { error: errorMessage(err) });
      }
      return;
    }

    const saleRoute = url.match(/^\/sales\/(\d+)$/);
    if (saleRoute && req.method === "PUT") {
      const id = Number(saleRoute[1]);
      try {
        const updated = await updateSale(id, parseSaleInput(await readJsonBody(req)));
        if (updated) sendJson(res, 200, updated);
        else sendJson(res, 404, { error: `No sale with id ${id}` });
      } catch (err) {
        sendJson(res, 400, { error: errorMessage(err) });
      }
      return;
    }

    if (saleRoute && req.method === "DELETE") {
      const id = Number(saleRoute[1]);
      if (deleteSale(id)) sendJson(res, 200, { ok: true });
      else sendJson(res, 404, { error: `No sale with id ${id}` });
      return;
    }

    // ── Quote price overrides (concept mode only) ────────────────────────
    // Guarded so the override table in the real DB can never gain rows.

    const quoteRoute = url.match(/^\/quotes\/([^/]+)$/);
    if (quoteRoute && (req.method === "PUT" || req.method === "DELETE")) {
      if (!inConceptContext()) {
        sendJson(res, 400, { error: "Prices can only be set in concept mode" });
        return;
      }
      const ticker = normalizeTicker(decodeURIComponent(quoteRoute[1]));
      if (req.method === "DELETE") {
        clearQuoteOverride(ticker);
        sendJson(res, 200, { ok: true });
        return;
      }
      try {
        const body = (await readJsonBody(req)) as { price?: unknown };
        if (typeof body.price !== "number" || !Number.isFinite(body.price) || body.price <= 0) {
          throw new Error("Price must be a positive number");
        }
        setQuoteOverride(ticker, body.price);
        sendJson(res, 200, { ok: true });
      } catch (err) {
        sendJson(res, 400, { error: errorMessage(err) });
      }
      return;
    }

    // ── Stocks (per-ticker fields) ───────────────────────────────────────

    const stockRoute = url.match(/^\/stocks\/([^/]+)$/);
    if (stockRoute && req.method === "PUT") {
      const ticker = normalizeTicker(decodeURIComponent(stockRoute[1]));
      try {
        const updated = updateStock(ticker, parseStockInput(await readJsonBody(req)));
        if (updated) sendJson(res, 200, updated);
        else sendJson(res, 404, { error: `No stock ${ticker}` });
      } catch (err) {
        sendJson(res, 400, { error: errorMessage(err) });
      }
      return;
    }

    if (stockRoute && req.method === "DELETE") {
      const ticker = normalizeTicker(decodeURIComponent(stockRoute[1]));
      if (deleteStock(ticker)) sendJson(res, 200, { ok: true });
      else sendJson(res, 404, { error: `No stock ${ticker}` });
      return;
    }

    // ── Accounts ─────────────────────────────────────────────────────────

    if (req.method === "POST" && url === "/accounts") {
      try {
        sendJson(res, 201, createAccount(parseAccountInput(await readJsonBody(req))));
      } catch (err) {
        sendJson(res, 400, { error: errorMessage(err) });
      }
      return;
    }

    const accountRoute = url.match(/^\/accounts\/(\d+)$/);
    if (accountRoute && req.method === "PUT") {
      const id = Number(accountRoute[1]);
      try {
        const updated = updateAccount(id, parseAccountInput(await readJsonBody(req)));
        if (updated) sendJson(res, 200, updated);
        else sendJson(res, 404, { error: `No account with id ${id}` });
      } catch (err) {
        sendJson(res, 400, { error: errorMessage(err) });
      }
      return;
    }

    if (accountRoute && req.method === "DELETE") {
      const id = Number(accountRoute[1]);
      if (deleteAccount(id)) sendJson(res, 200, { ok: true });
      else sendJson(res, 404, { error: `No account with id ${id}` });
      return;
    }

    if (req.method === "GET" && url === "/settings") {
      sendJson(res, 200, currentSettings());
      return;
    }

    if (req.method === "PUT" && url === "/settings") {
      let input: AppSettings;
      try {
        input = parseSettingsInput(await readJsonBody(req));
      } catch (err) {
        sendJson(res, 400, { error: errorMessage(err) });
        return;
      }
      setSetting("quote_provider", input.provider);
      setSetting("finnhub_api_key", input.finnhubApiKey);
      sendJson(res, 200, currentSettings());
      return;
    }

    sendJson(res, 404, { error: `No route: ${req.method} /api${url}` });
  } catch (err) {
    sendJson(res, 500, { error: errorMessage(err) });
  }
}
