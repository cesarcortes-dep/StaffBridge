import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";

const DB_PATH = path.join(process.cwd(), "data", "reviews.db");

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
