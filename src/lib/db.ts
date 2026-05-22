import Database from "better-sqlite3";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { REVIEWS_DB_BASE64 } from "./reviews-db.generated";

/**
 * The seeded SQLite DB is embedded as a base64 string at build time
 * (see scripts/embed-db.ts). At first call we materialize it under the
 * OS temp dir and open it read-only. This avoids the Vercel-serverless
 * gotchas: `public/` is served by the CDN and not on disk inside the
 * function, and `outputFileTracingIncludes` was unreliable in Next 16.
 *
 * Cost: ~440KB of base64 in each function bundle. For our 320KB DB
 * that's fine; a larger dataset would warrant Turso/libsql instead.
 */
const TMP_DB_PATH = path.join(os.tmpdir(), "reviews.db");

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (_db) return _db;
  if (!fs.existsSync(TMP_DB_PATH)) {
    fs.writeFileSync(
      TMP_DB_PATH,
      Buffer.from(REVIEWS_DB_BASE64, "base64")
    );
  }
  _db = new Database(TMP_DB_PATH, { readonly: true, fileMustExist: true });
  _db.pragma("journal_mode = WAL");
  return _db;
}
