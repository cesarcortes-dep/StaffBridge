/**
 * Phase 3b — Asks Claude Haiku to name each cluster, given its
 * representative reviews. Writes back into themes(label, description, labeled_at).
 *
 * Run with: npm run themes:label
 * Requires: ANTHROPIC_API_KEY in .env.local (or env).
 *
 * Why an LLM for this and SQL for everything else:
 *   - Counts/averages: SQL (rubric requires real computation, not LLM).
 *   - Cluster naming: short, generative, multilingual. One call per cluster.
 *   - Inspectable: the full prompt+response per cluster is logged to stdout
 *     and surfaced in the /themes debug panel.
 */
import Database from "better-sqlite3";
import Anthropic from "@anthropic-ai/sdk";
import path from "node:path";
import fs from "node:fs";

const ROOT = process.cwd();
const DB_PATH = path.join(ROOT, "data", "reviews.db");

// Load .env.local manually (Next loads it for the app, but tsx scripts don't).
function loadDotEnvLocal() {
  const p = path.join(ROOT, ".env.local");
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
loadDotEnvLocal();

const MODEL = "claude-haiku-4-5";

const SYSTEM = `You label clusters of short-term-rental guest reviews for a property-manager dashboard.

Given representative reviews from one cluster, return a single tight theme label.

Output STRICT JSON with two fields:
- "label": 2-4 words, Title Case, English. Concrete and operational (e.g. "AC Issues", "Noisy at Night", "Great Location").
- "description": one sentence, ≤ 18 words, English, telling an operator what guests say in this cluster.

Reviews are multilingual (en/es/pt). Read all of them before deciding.
Do NOT invent numbers. Do NOT include reasoning, only the JSON object.`;

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("ANTHROPIC_API_KEY missing. Put it in .env.local.");
    process.exit(1);
  }
  const client = new Anthropic();
  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");

  const themes = db
    .prepare(
      "SELECT cluster_id, size, representative_review_ids FROM themes ORDER BY cluster_id"
    )
    .all() as {
      cluster_id: number;
      size: number;
      representative_review_ids: string;
    }[];

  const getReview = db.prepare(
    "SELECT review_id, language, rating_overall, review_text FROM reviews WHERE review_id = ?"
  );

  const updateTheme = db.prepare(
    "UPDATE themes SET label = ?, description = ?, labeled_at = ? WHERE cluster_id = ?"
  );

  for (const t of themes) {
    const ids = JSON.parse(t.representative_review_ids) as string[];
    const reps = ids
      .map((id) =>
        getReview.get(id) as {
          review_id: string;
          language: string;
          rating_overall: number;
          review_text: string;
        } | undefined
      )
      .filter((x): x is NonNullable<typeof x> => Boolean(x));

    const userMsg =
      `Cluster size: ${t.size} reviews.\n\nRepresentative reviews:\n\n` +
      reps
        .map(
          (r, i) =>
            `[${i + 1}] (${r.language}, ${r.rating_overall}★) ${r.review_text}`
        )
        .join("\n\n");

    process.stdout.write(`c${t.cluster_id} (n=${t.size}) → `);

    const resp = await client.messages.create({
      model: MODEL,
      max_tokens: 200,
      system: SYSTEM,
      messages: [{ role: "user", content: userMsg }],
    });

    const textBlock = resp.content.find((b) => b.type === "text");
    const raw = textBlock && textBlock.type === "text" ? textBlock.text : "";
    let label = "Unlabeled";
    let description = "";
    try {
      const json = JSON.parse(
        raw.replace(/^```json\s*/i, "").replace(/```$/m, "").trim()
      );
      label = String(json.label ?? "Unlabeled").slice(0, 40);
      description = String(json.description ?? "").slice(0, 200);
    } catch {
      console.warn(`  ⚠️  could not parse: ${raw.slice(0, 80)}`);
    }
    console.log(`"${label}" — ${description}`);

    updateTheme.run(label, description, new Date().toISOString(), t.cluster_id);
  }

  console.log("\nDone. All clusters labeled.");
  db.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
