/**
 * Phase 3a — Embeds all reviews with a multilingual sentence-transformer
 * and clusters them with cosine k-means. Writes:
 *   - themes(cluster_id, size, representative_review_ids)  [label/description left NULL]
 *   - review_clusters(review_id, cluster_id)
 *
 * Run with: npm run themes:embed
 * Idempotent: drops and recreates the two tables on each run.
 */
import Database from "better-sqlite3";
import { pipeline } from "@huggingface/transformers";
import path from "node:path";

const ROOT = process.cwd();
const DB_PATH = path.join(ROOT, "data", "reviews.db");

const K = 12;                  // number of clusters
const BATCH = 16;              // embedding batch size
const MAX_ITER = 60;
const SEED = 42;
const REPS_PER_CLUSTER = 6;    // reviews used as cluster exemplars for the labeling step

function dot(a: Float32Array, b: Float32Array): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

function normalize(v: Float32Array): Float32Array {
  let s = 0;
  for (const x of v) s += x * x;
  const n = Math.sqrt(s) || 1;
  const out = new Float32Array(v.length);
  for (let i = 0; i < v.length; i++) out[i] = v[i] / n;
  return out;
}

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function kmeansCosine(
  vectors: Float32Array[],
  k: number,
  maxIter: number,
  seed: number
) {
  const n = vectors.length;
  const d = vectors[0].length;
  const rnd = mulberry32(seed);

  // K-means++ init using (1 - cos_sim) as distance on normalized vectors.
  const centroids: Float32Array[] = [vectors[Math.floor(rnd() * n)].slice()];
  while (centroids.length < k) {
    const dists = new Float64Array(n);
    let sum = 0;
    for (let i = 0; i < n; i++) {
      let minD = Infinity;
      for (const c of centroids) {
        const d2 = Math.max(0, 1 - dot(vectors[i], c));
        if (d2 < minD) minD = d2;
      }
      dists[i] = minD * minD;
      sum += dists[i];
    }
    let r = rnd() * sum;
    let pick = 0;
    for (let i = 0; i < n; i++) {
      r -= dists[i];
      if (r <= 0) {
        pick = i;
        break;
      }
    }
    centroids.push(vectors[pick].slice());
  }

  const assign = new Int32Array(n);
  for (let iter = 0; iter < maxIter; iter++) {
    let changed = 0;
    // Assignment step.
    for (let i = 0; i < n; i++) {
      let best = 0;
      let bestSim = -Infinity;
      for (let c = 0; c < k; c++) {
        const sim = dot(vectors[i], centroids[c]);
        if (sim > bestSim) {
          bestSim = sim;
          best = c;
        }
      }
      if (assign[i] !== best) {
        assign[i] = best;
        changed++;
      }
    }
    if (changed === 0) {
      console.log(`Converged at iter ${iter}`);
      break;
    }
    // Update centroids: mean of assigned vectors, then renormalize.
    const sums: Float32Array[] = Array.from(
      { length: k },
      () => new Float32Array(d)
    );
    const counts = new Int32Array(k);
    for (let i = 0; i < n; i++) {
      const c = assign[i];
      counts[c]++;
      const v = vectors[i];
      const s = sums[c];
      for (let j = 0; j < d; j++) s[j] += v[j];
    }
    for (let c = 0; c < k; c++) {
      if (counts[c] === 0) continue;
      for (let j = 0; j < d; j++) sums[c][j] /= counts[c];
      centroids[c] = normalize(sums[c]);
    }
  }

  return { assign, centroids };
}

async function main() {
  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");

  const reviews = db
    .prepare(
      "SELECT review_id, language, review_text FROM reviews ORDER BY review_id"
    )
    .all() as { review_id: string; language: string; review_text: string }[];

  console.log(`Loaded ${reviews.length} reviews. Loading model…`);

  // multilingual-e5-small: 118 MB, 384-d, multilingual EN/ES/PT/+
  const extractor = await pipeline(
    "feature-extraction",
    "Xenova/multilingual-e5-small"
  );
  console.log("Model ready. Embedding…");

  // e5 expects "passage: " prefix for document encoding.
  const inputs = reviews.map((r) => `passage: ${r.review_text}`);
  const vectors: Float32Array[] = [];

  const t0 = Date.now();
  for (let i = 0; i < inputs.length; i += BATCH) {
    const batch = inputs.slice(i, i + BATCH);
    const out = await extractor(batch, {
      pooling: "mean",
      normalize: true,
    });
    const arr = out.tolist() as number[][];
    for (const v of arr) vectors.push(Float32Array.from(v));
    if (i % (BATCH * 5) === 0) {
      const pct = ((100 * (i + batch.length)) / inputs.length).toFixed(0);
      console.log(`  embedded ${i + batch.length}/${inputs.length} (${pct}%)`);
    }
  }
  console.log(`Embedding took ${((Date.now() - t0) / 1000).toFixed(1)}s`);

  console.log(`Clustering k=${K}…`);
  const { assign, centroids } = kmeansCosine(vectors, K, MAX_ITER, SEED);

  // Group reviews by cluster, then pick top-N exemplars closest to the centroid.
  const buckets: number[][] = Array.from({ length: K }, () => []);
  for (let i = 0; i < reviews.length; i++) buckets[assign[i]].push(i);

  const reps: string[][] = buckets.map((idxs, c) => {
    const scored = idxs.map((i) => ({
      i,
      s: dot(vectors[i], centroids[c]),
    }));
    scored.sort((a, b) => b.s - a.s);
    return scored.slice(0, REPS_PER_CLUSTER).map((x) => reviews[x.i].review_id);
  });

  // Write into SQLite (drop+recreate so the script is idempotent).
  db.exec(`
    DROP TABLE IF EXISTS review_clusters;
    DROP TABLE IF EXISTS themes;
    CREATE TABLE themes (
      cluster_id INTEGER PRIMARY KEY,
      size INTEGER NOT NULL,
      label TEXT,
      description TEXT,
      representative_review_ids TEXT NOT NULL,
      labeled_at TEXT
    );
    CREATE TABLE review_clusters (
      review_id TEXT PRIMARY KEY,
      cluster_id INTEGER NOT NULL,
      FOREIGN KEY (review_id) REFERENCES reviews(review_id)
    );
    CREATE INDEX idx_review_clusters_cluster ON review_clusters(cluster_id);
  `);

  const insertTheme = db.prepare(
    "INSERT INTO themes (cluster_id, size, representative_review_ids) VALUES (?, ?, ?)"
  );
  const insertAssign = db.prepare(
    "INSERT INTO review_clusters (review_id, cluster_id) VALUES (?, ?)"
  );

  const tx = db.transaction(() => {
    for (let c = 0; c < K; c++) {
      insertTheme.run(c, buckets[c].length, JSON.stringify(reps[c]));
    }
    for (let i = 0; i < reviews.length; i++) {
      insertAssign.run(reviews[i].review_id, assign[i]);
    }
  });
  tx();

  console.log("\nCluster sizes:");
  for (let c = 0; c < K; c++) {
    console.log(`  c${c}: ${buckets[c].length} reviews (reps: ${reps[c].slice(0, 3).join(", ")}…)`);
  }
  console.log(`\nWrote themes + review_clusters to ${DB_PATH}.`);
  console.log("Next step: run `npm run themes:label` to ask Claude to name each cluster.");
  db.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
