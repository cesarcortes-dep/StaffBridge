import { getDb } from "./db";
import { buildWhere } from "./filters";
import type {
  Filters,
  MonthlyPoint,
  PortfolioKpis,
  PropertyMeta,
  PropertyRow,
  QueueItem,
  Review,
  Theme,
} from "./types";
import { daysBetween } from "./utils";

function themesTableExists(): boolean {
  const db = getDb();
  const row = db
    .prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='themes' LIMIT 1"
    )
    .get();
  return Boolean(row);
}

const SUB = [
  ["cleanliness", "rating_cleanliness"],
  ["communication", "rating_communication"],
  ["checkin", "rating_checkin"],
  ["accuracy", "rating_accuracy"],
  ["location", "rating_location"],
  ["value", "rating_value"],
] as const;

export function getDatasetMaxDate(): string {
  const db = getDb();
  const r = db
    .prepare("SELECT MAX(review_date) as d FROM reviews")
    .get() as { d: string };
  return r.d;
}

export function getPortfolioKpis(f: Filters): PortfolioKpis {
  const db = getDb();
  const { sql, params } = buildWhere(f);

  const base = db
    .prepare(
      `SELECT COUNT(*) AS total,
              AVG(rating_overall) AS avg_overall,
              SUM(CASE WHEN host_response IS NOT NULL AND host_response != '' THEN 1 ELSE 0 END) AS answered,
              SUM(CASE WHEN host_response IS NULL OR host_response = '' THEN 1 ELSE 0 END) AS unanswered
       FROM reviews ${sql}`
    )
    .get(...params) as {
      total: number;
      avg_overall: number | null;
      answered: number | null;
      unanswered: number | null;
    };

  // Median latency (days) over answered reviews matching filters.
  const latencies = db
    .prepare(
      `SELECT review_date, host_response_date
       FROM reviews ${sql ? sql + " AND" : "WHERE"} host_response_date IS NOT NULL AND host_response_date != ''`
    )
    .all(...params) as { review_date: string; host_response_date: string }[];

  const days = latencies
    .map((r) => daysBetween(r.review_date, r.host_response_date))
    .filter((d) => Number.isFinite(d) && d >= 0)
    .sort((a, b) => a - b);

  const median =
    days.length === 0
      ? null
      : days.length % 2 === 1
        ? days[(days.length - 1) / 2]
        : (days[days.length / 2 - 1] + days[days.length / 2]) / 2;

  const answered = base.answered ?? 0;
  const unanswered = base.unanswered ?? 0;

  return {
    totalReviews: base.total,
    avgOverall: base.avg_overall ?? 0,
    responseRate: base.total === 0 ? 0 : answered / base.total,
    medianResponseLatencyDays: median,
    unansweredCount: unanswered,
  };
}

export function getMonthlyTrend(
  f: Filters,
  monthsBack: number = 12
): MonthlyPoint[] {
  const db = getDb();
  const maxDate = getDatasetMaxDate();

  // Window end = end of maxDate's month; start = monthsBack-1 months earlier.
  const end = new Date(maxDate + "T00:00:00Z");
  const start = new Date(
    Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - (monthsBack - 1), 1)
  );
  const startStr = start.toISOString().slice(0, 10);

  const { sql, params } = buildWhere({ ...f, from: f.from ?? startStr });

  const rows = db
    .prepare(
      `SELECT substr(review_date, 1, 7) AS ym,
              AVG(rating_overall) AS avg_rating,
              COUNT(*) AS n
       FROM reviews ${sql}
       GROUP BY ym
       ORDER BY ym`
    )
    .all(...params) as { ym: string; avg_rating: number; n: number }[];

  // Fill missing months with zeros so the chart line stays contiguous.
  const out: MonthlyPoint[] = [];
  const byYm = new Map(rows.map((r) => [r.ym, r]));
  for (let i = 0; i < monthsBack; i++) {
    const d = new Date(
      Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + i, 1)
    );
    const ym = d.toISOString().slice(0, 7);
    const hit = byYm.get(ym);
    out.push({
      ym,
      avgRating: hit ? Number(hit.avg_rating.toFixed(2)) : 0,
      reviewCount: hit ? hit.n : 0,
    });
  }
  return out;
}

export function getPropertyTable(f: Filters): PropertyRow[] {
  const db = getDb();
  const { sql, params } = buildWhere(f);

  // Main per-property aggregates.
  const rows = db
    .prepare(
      `SELECT property_id, property_name, city, country,
              COUNT(*) AS n,
              AVG(rating_overall) AS avg_overall,
              SUM(CASE WHEN host_response IS NOT NULL AND host_response != '' THEN 1 ELSE 0 END) AS answered,
              MAX(review_date) AS last_review
       FROM reviews ${sql}
       GROUP BY property_id
       ORDER BY avg_overall ASC, n DESC`
    )
    .all(...params) as {
      property_id: string;
      property_name: string;
      city: string;
      country: string;
      n: number;
      avg_overall: number;
      answered: number;
      last_review: string;
    }[];

  // Sub-rating averages (computed only where >=5 non-null values exist).
  const subStmts = SUB.map(([key, col]) => ({
    key,
    stmt: db.prepare(
      `SELECT property_id,
              AVG(${col}) AS avg_sub,
              COUNT(${col}) AS n_sub
       FROM reviews ${sql}
       GROUP BY property_id`
    ),
  }));
  const subByProp: Record<string, PropertyRow["subAverages"]> = {};
  for (const { key, stmt } of subStmts) {
    const subRows = stmt.all(...params) as {
      property_id: string;
      avg_sub: number | null;
      n_sub: number;
    }[];
    for (const r of subRows) {
      if (!subByProp[r.property_id]) subByProp[r.property_id] = {};
      subByProp[r.property_id][key] =
        r.n_sub >= 5 && r.avg_sub != null ? Number(r.avg_sub.toFixed(2)) : null;
    }
  }

  // Low-star (<=2) count in last 90 days from dataset max.
  const maxDate = getDatasetMaxDate();
  const cutoff = new Date(maxDate + "T00:00:00Z");
  cutoff.setUTCDate(cutoff.getUTCDate() - 90);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  const lowStmt = db.prepare(
    `SELECT property_id, COUNT(*) AS n_low
     FROM reviews ${sql ? sql + " AND" : "WHERE"} rating_overall <= 2 AND review_date >= ?
     GROUP BY property_id`
  );
  const lowRows = lowStmt.all(...params, cutoffStr) as {
    property_id: string;
    n_low: number;
  }[];
  const lowByProp = new Map(lowRows.map((r) => [r.property_id, r.n_low]));

  return rows.map((r) => ({
    property_id: r.property_id,
    property_name: r.property_name,
    city: r.city,
    country: r.country,
    reviewCount: r.n,
    avgOverall: Number(r.avg_overall.toFixed(2)),
    responseRate: r.n === 0 ? 0 : r.answered / r.n,
    lastReviewDate: r.last_review,
    lowStarLast90: lowByProp.get(r.property_id) ?? 0,
    subAverages: subByProp[r.property_id] ?? {},
  }));
}

export function getPropertyMeta(propertyId: string): PropertyMeta | null {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT property_id, property_name, city, country, property_type, bedrooms
       FROM reviews WHERE property_id = ? LIMIT 1`
    )
    .get(propertyId) as PropertyMeta | undefined;
  return row ?? null;
}

export function getReviewsList(f: Filters, limit = 100): Review[] {
  const db = getDb();
  const { sql, params } = buildWhere(f);
  return db
    .prepare(
      `SELECT * FROM reviews ${sql}
       ORDER BY review_date DESC
       LIMIT ?`
    )
    .all(...params, limit) as Review[];
}

/**
 * Unanswered queue priority = severity × age_decay.
 *  - severity = (6 - rating)   → 1★ weighs 5, 5★ weighs 1
 *  - age_decay = 0.5 ^ (age_days / 14)   → halves every 14 days
 * "Age" is days from the review_date to the dataset's most recent review
 * (so the score is stable across runs of a static dataset).
 */
export function getUnansweredQueue(f: Filters, limit = 100): QueueItem[] {
  const db = getDb();
  // Force "no host_response" on top of the user filters.
  const { sql, params } = buildWhere(f);
  const where = sql
    ? `${sql} AND (host_response IS NULL OR host_response = '')`
    : `WHERE (host_response IS NULL OR host_response = '')`;

  const rows = db
    .prepare(`SELECT * FROM reviews ${where}`)
    .all(...params) as Review[];

  const anchor = new Date(getDatasetMaxDate() + "T00:00:00Z").getTime();
  const HALF_LIFE_DAYS = 14;

  const scored: QueueItem[] = rows.map((r) => {
    const ageDays = Math.max(
      0,
      (anchor - new Date(r.review_date + "T00:00:00Z").getTime()) /
        86_400_000
    );
    const severity = 6 - r.rating_overall;
    const ageDecay = Math.pow(0.5, ageDays / HALF_LIFE_DAYS);
    const priority = severity * ageDecay;
    return { ...r, priority: Number(priority.toFixed(4)), ageDays: Math.round(ageDays) };
  });

  scored.sort((a, b) => b.priority - a.priority);
  return scored.slice(0, limit);
}

/**
 * Themes are pre-computed offline (scripts/embed-and-cluster.ts).
 * Returns null if the themes table doesn't exist yet (pipeline not run).
 * `propertyId` filters the size counts to a single property — the cluster
 * assignment itself is portfolio-wide.
 */
export function getThemes(propertyId?: string): Theme[] | null {
  if (!themesTableExists()) return null;
  const db = getDb();

  const sizes = propertyId
    ? db
        .prepare(
          `SELECT rc.cluster_id AS cluster_id, COUNT(*) AS n
           FROM review_clusters rc
           JOIN reviews r ON r.review_id = rc.review_id
           WHERE r.property_id = ?
           GROUP BY rc.cluster_id`
        )
        .all(propertyId)
    : db
        .prepare(
          `SELECT cluster_id, COUNT(*) AS n FROM review_clusters GROUP BY cluster_id`
        )
        .all();

  const sizeMap = new Map(
    (sizes as { cluster_id: number; n: number }[]).map((r) => [
      r.cluster_id,
      r.n,
    ])
  );

  const themes = db
    .prepare(
      `SELECT cluster_id, size, label, description, representative_review_ids, labeled_at
       FROM themes ORDER BY size DESC`
    )
    .all() as {
      cluster_id: number;
      size: number;
      label: string | null;
      description: string | null;
      representative_review_ids: string;
      labeled_at: string | null;
    }[];

  return themes
    .map((t) => ({
      cluster_id: t.cluster_id,
      size: propertyId ? (sizeMap.get(t.cluster_id) ?? 0) : t.size,
      label: t.label,
      description: t.description,
      representative_review_ids: JSON.parse(t.representative_review_ids),
      labeled_at: t.labeled_at,
    }))
    .filter((t) => t.size > 0)
    .sort((a, b) => b.size - a.size);
}

export function getReviewsByCluster(
  clusterId: number,
  filters: Filters,
  limit = 100
): Review[] {
  const db = getDb();
  const { sql, params } = buildWhere(filters);
  const where = sql
    ? `${sql} AND review_id IN (SELECT review_id FROM review_clusters WHERE cluster_id = ?)`
    : `WHERE review_id IN (SELECT review_id FROM review_clusters WHERE cluster_id = ?)`;
  return db
    .prepare(
      `SELECT * FROM reviews ${where} ORDER BY review_date DESC LIMIT ?`
    )
    .all(...params, clusterId, limit) as Review[];
}

export function getReviewsByIds(ids: string[]): Review[] {
  if (ids.length === 0) return [];
  const db = getDb();
  const placeholders = ids.map(() => "?").join(",");
  return db
    .prepare(`SELECT * FROM reviews WHERE review_id IN (${placeholders})`)
    .all(...ids) as Review[];
}
