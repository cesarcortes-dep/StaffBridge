/**
 * One-shot seeder: reads data/guest_reviews.csv into a fresh SQLite DB.
 * Run with: npm run db:seed
 */
import Database from "better-sqlite3";
import { parse } from "csv-parse/sync";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const CSV_PATH = path.join(ROOT, "data", "guest_reviews.csv");
const DB_PATH = path.join(ROOT, "data", "reviews.db");

function intOrNull(v: string): number | null {
  if (v === "" || v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function strOrNull(v: string): string | null {
  return v === "" || v == null ? null : v;
}

function main() {
  if (!fs.existsSync(CSV_PATH)) {
    throw new Error(`CSV not found at ${CSV_PATH}`);
  }
  if (fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH);

  const csv = fs.readFileSync(CSV_PATH, "utf8");
  const rows = parse(csv, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as Record<string, string>[];

  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");

  db.exec(`
    CREATE TABLE reviews (
      review_id            TEXT PRIMARY KEY,
      property_id          TEXT NOT NULL,
      property_name        TEXT NOT NULL,
      city                 TEXT NOT NULL,
      country              TEXT NOT NULL,
      property_type        TEXT NOT NULL,
      bedrooms             INTEGER NOT NULL,
      channel              TEXT NOT NULL,
      guest_first_name     TEXT,
      guest_country        TEXT,
      stay_start_date      TEXT,
      stay_end_date        TEXT,
      nights               INTEGER,
      review_date          TEXT NOT NULL,
      rating_overall       INTEGER NOT NULL,
      rating_cleanliness   INTEGER,
      rating_communication INTEGER,
      rating_checkin       INTEGER,
      rating_accuracy      INTEGER,
      rating_location      INTEGER,
      rating_value         INTEGER,
      language             TEXT NOT NULL,
      review_text          TEXT NOT NULL,
      host_response        TEXT,
      host_response_date   TEXT
    );

    CREATE INDEX idx_reviews_property        ON reviews(property_id);
    CREATE INDEX idx_reviews_review_date     ON reviews(review_date);
    CREATE INDEX idx_reviews_channel         ON reviews(channel);
    CREATE INDEX idx_reviews_language        ON reviews(language);
    CREATE INDEX idx_reviews_rating          ON reviews(rating_overall);
    CREATE INDEX idx_reviews_has_response    ON reviews(host_response);
  `);

  const insert = db.prepare(`
    INSERT INTO reviews VALUES (
      @review_id, @property_id, @property_name, @city, @country, @property_type, @bedrooms,
      @channel, @guest_first_name, @guest_country, @stay_start_date, @stay_end_date,
      @nights, @review_date, @rating_overall, @rating_cleanliness, @rating_communication,
      @rating_checkin, @rating_accuracy, @rating_location, @rating_value, @language,
      @review_text, @host_response, @host_response_date
    )
  `);

  const insertMany = db.transaction((batch: Record<string, unknown>[]) => {
    for (const r of batch) insert.run(r);
  });

  const mapped = rows.map((r) => ({
    review_id: r.review_id,
    property_id: r.property_id,
    property_name: r.property_name,
    city: r.city,
    country: r.country,
    property_type: r.property_type,
    bedrooms: intOrNull(r.bedrooms) ?? 0,
    channel: r.channel,
    guest_first_name: strOrNull(r.guest_first_name),
    guest_country: strOrNull(r.guest_country),
    stay_start_date: strOrNull(r.stay_start_date),
    stay_end_date: strOrNull(r.stay_end_date),
    nights: intOrNull(r.nights),
    review_date: r.review_date,
    rating_overall: intOrNull(r.rating_overall) ?? 0,
    rating_cleanliness: intOrNull(r.rating_cleanliness),
    rating_communication: intOrNull(r.rating_communication),
    rating_checkin: intOrNull(r.rating_checkin),
    rating_accuracy: intOrNull(r.rating_accuracy),
    rating_location: intOrNull(r.rating_location),
    rating_value: intOrNull(r.rating_value),
    language: r.language,
    review_text: r.review_text,
    host_response: strOrNull(r.host_response),
    host_response_date: strOrNull(r.host_response_date),
  }));

  insertMany(mapped);

  const count = db.prepare("SELECT COUNT(*) as n FROM reviews").get() as {
    n: number;
  };
  console.log(`Seeded ${count.n} reviews into ${DB_PATH}`);
  db.close();
}

main();
