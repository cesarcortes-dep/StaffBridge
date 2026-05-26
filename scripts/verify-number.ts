/**
 * Demo helper — verifies any property's KPIs against raw SQL, side by side.
 * Useful for proving in real time that the numbers in the UI come from
 * deterministic computation, not from an LLM.
 *
 * Usage:
 *   npm run verify P022
 *   npm run verify P028
 */
import Database from "better-sqlite3";
import path from "node:path";

const ROOT = process.cwd();
const DB_PATH = path.join(ROOT, "public", "reviews.db");

const SUB_FIELDS = [
  "cleanliness",
  "communication",
  "checkin",
  "accuracy",
  "location",
  "value",
] as const;

function main() {
  const propertyId = process.argv[2];
  if (!propertyId) {
    console.error("Usage: npm run verify <property_id>");
    console.error("  e.g. npm run verify P022");
    process.exit(1);
  }

  const db = new Database(DB_PATH, { readonly: true });

  const meta = db
    .prepare(
      `SELECT property_id, property_name, city, country, property_type, bedrooms
       FROM reviews WHERE property_id = ? LIMIT 1`
    )
    .get(propertyId) as
    | {
        property_id: string;
        property_name: string;
        city: string;
        country: string;
        property_type: string;
        bedrooms: number;
      }
    | undefined;

  if (!meta) {
    console.error(`Property "${propertyId}" not found.`);
    process.exit(1);
  }

  const agg = db
    .prepare(
      `SELECT AVG(rating_overall) AS avg_overall,
              COUNT(*) AS n,
              SUM(CASE WHEN host_response IS NOT NULL AND host_response != '' THEN 1 ELSE 0 END) AS answered,
              MAX(review_date) AS last_review
       FROM reviews WHERE property_id = ?`
    )
    .get(propertyId) as {
      avg_overall: number;
      n: number;
      answered: number;
      last_review: string;
    };

  const distRows = db
    .prepare(
      `SELECT rating_overall AS r, COUNT(*) AS n
       FROM reviews WHERE property_id = ?
       GROUP BY rating_overall ORDER BY r ASC`
    )
    .all(propertyId) as { r: number; n: number }[];

  const subSelect = SUB_FIELDS.map(
    (s) => `AVG(rating_${s}) AS avg_${s}, COUNT(rating_${s}) AS n_${s}`
  ).join(",\n              ");
  const subs = db
    .prepare(
      `SELECT ${subSelect}
       FROM reviews WHERE property_id = ?`
    )
    .get(propertyId) as Record<string, number | null>;

  const pad = (n: number, w: number) => String(n).padStart(w);
  const bar = (n: number) => "█".repeat(n);

  console.log("");
  console.log(`  Property: ${meta.property_name} (${meta.property_id})`);
  console.log(
    `            ${meta.city}, ${meta.country} · ${meta.property_type} · ${meta.bedrooms} bedroom${
      meta.bedrooms === 1 ? "" : "s"
    }`
  );
  console.log("");
  console.log("  SQL executed:");
  console.log("");
  console.log("    SELECT AVG(rating_overall) AS avg_overall,");
  console.log("           COUNT(*) AS n,");
  console.log(
    "           SUM(CASE WHEN host_response IS NOT NULL AND host_response != '' THEN 1 ELSE 0 END) AS answered,"
  );
  console.log("           MAX(review_date) AS last_review");
  console.log("    FROM reviews");
  console.log(`    WHERE property_id = '${meta.property_id}'`);
  console.log("");
  console.log("  Result:");
  console.log(
    `    avg_overall:    ${agg.avg_overall.toFixed(4)}   (UI shows ${agg.avg_overall.toFixed(2)})`
  );
  console.log(`    review count:   ${agg.n}`);
  console.log(
    `    answered:       ${agg.answered} / ${agg.n} = ${((100 * agg.answered) / agg.n).toFixed(0)}%`
  );
  console.log(`    last review:    ${agg.last_review}`);
  console.log("");
  console.log("  Rating distribution:");
  for (let star = 1; star <= 5; star++) {
    const n = distRows.find((d) => d.r === star)?.n ?? 0;
    console.log(`    ${star}★: ${pad(n, 2)}  ${bar(n)}`);
  }
  console.log("");
  console.log("  Sub-rating averages (UI renders '—' when n < 5):");
  for (const s of SUB_FIELDS) {
    const avg = subs[`avg_${s}`];
    const n = subs[`n_${s}`] ?? 0;
    const label = s.padEnd(13);
    if (n >= 5 && avg != null) {
      console.log(`    ${label} ${avg.toFixed(2)}   (n=${n})`);
    } else {
      console.log(`    ${label} —      (n=${n}, below threshold)`);
    }
  }
  console.log("");
  db.close();
}

main();
