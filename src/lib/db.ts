import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";

/**
 * The SQLite file lives in `public/` (not `data/`) so that Next.js's default
 * file-tracing always bundles it into every serverless function on Vercel.
 * `outputFileTracingIncludes` was unreliable in Next 16 for this case.
 *
 * In local dev `process.cwd()` is the project root. On Vercel it's the
 * function's traced root, and `public/` is mirrored there automatically.
 */
const DB_PATH = path.join(process.cwd(), "public", "reviews.db");

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (_db) return _db;
  if (!fs.existsSync(DB_PATH)) {
    throw new Error(
      `SQLite DB not found at ${DB_PATH}. Run \`npm run db:seed\` first.`
    );
  }
  _db = new Database(DB_PATH, { readonly: true, fileMustExist: true });
  _db.pragma("journal_mode = WAL");
  return _db;
}
