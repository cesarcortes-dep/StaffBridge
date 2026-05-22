# Guest Reviews & Sentiment Dashboard

A triage dashboard for property managers to make sense of 500+ multilingual guest reviews across 32 properties without reading them all.

Built for the Premium Propiedades developer exam (Phase 2). The Phase 1 plan lives in [`plan.md`](./plan.md).

**Live demo:** https://staff-bridge-tawny.vercel.app

---

## What it does

Three flows, designed for "5 minutes on Monday morning":

1. **[Portfolio overview](#)** — KPIs, 12-month rating trend, per-property table sorted worst-first. Spot chronic underperformers without hardcoding.
2. **[Unanswered queue](#)** — 317 reviews missing a host response, ranked by `severity × age_decay`. One click generates a draft reply in the review's original language, with the detected theme injected as context.
3. **[Themes](#)** — 12 recurring themes detected across the portfolio (e.g., "AC Not Working", "Pest Issues", "Safe, Walkable Neighborhood"). Click any theme to drill into the underlying reviews. The pipeline is multilingual: `"el aire era pésimo"` and `"the AC barely worked"` cluster together.

Every aggregate number on screen comes from SQL. The LLM only labels clusters and drafts replies.

---

## Run it locally

**Requirements:** Node 20.9+ and an Anthropic API key.

```bash
# 1. Install
npm install

# 2. Add your API key
echo "ANTHROPIC_API_KEY=sk-ant-..." > .env.local

# 3. Seed the SQLite DB from the CSV
npm run db:seed

# 4. Build the themes pipeline (one-time, ~5 seconds + one-time model download)
npm run themes:embed     # embed + cluster (no API key needed)
npm run themes:label     # name the 12 clusters via Claude Haiku (~$0.01)

# 5. Run
npm run dev
# → http://localhost:3000
```

If you skip step 4, the dashboard still works — the `/themes` page will show "table not found" and the draft-reply feature will skip theme injection.

---

## Architecture

```
data/guest_reviews.csv   (input — 585 reviews, 32 properties, 3 languages)
        │
        ▼
   scripts/seed-db.ts  →  data/reviews.db  (SQLite)
        │                       │
        │                       ├──→ Next.js app reads via better-sqlite3 (read-only)
        │                       │
        ▼                       ▼
scripts/embed-and-cluster.ts    src/app/{,queue,themes,property/[id]}/page.tsx
   (multilingual-e5-small)             │
        │                              ▼
        ▼                       src/components/{kpi-strip,monthly-trend,property-table,
   themes + review_clusters     review-card,filter-bar,draft-response}.tsx
        │                              │
        ▼                              ▼
scripts/label-clusters.ts ────→ src/app/api/draft-response/route.ts
   (Claude Haiku 4.5)              (Claude Haiku 4.5)
```

- **Next.js 16** with App Router, TypeScript, Tailwind v4.
- **SQLite** via `better-sqlite3`. CSV is seeded into a single `reviews` table with indexes. All aggregates are SQL.
- **`@huggingface/transformers`** runs `multilingual-e5-small` on Node — no embedding API cost, no data exfiltration.
- **Cosine k-means (k=12)** for clustering, written from scratch (~80 LOC). Converges in 7 iterations on 585 docs.
- **Claude Haiku 4.5** for the two LLM-driven surfaces: cluster naming (12 calls, one per cluster) and draft replies (one per click).
- **Filters** are URL search params, parsed in `lib/filters.ts`, composed into SQL in `lib/queries.ts`. Every page respects them.

### Why these choices

- **No vector DB.** 585 reviews × 384 dimensions fits in RAM; the cluster assignments persist in SQLite.
- **K-means, not HDBSCAN.** HDBSCAN handles density-varied clusters better but is harder to ship in Node; k-means with cosine on normalized embeddings produced clean clusters here. The cut-line in `plan.md` accepts cluster-quality risk.
- **Haiku, not Sonnet.** Haiku is fast and cheap, and the tone control held up in EN/ES/PT in my smoke tests. Easy to swap if quality drops.
- **No "send" button on drafts.** Spec requirement. The operator must explicitly copy.

---

## AI features — guardrails

| Surface | What the LLM does | What the LLM does NOT do | How to inspect |
|---|---|---|---|
| `/themes` cluster names | Names + 1-line description per cluster | Counts (SQL), assignment (k-means), drilldown | "🔍 What Claude saw" panel on selected theme |
| Draft reply (`/queue`) | Generates 2–4 sentence draft in review's language | Decides who to reply to, priority, send | "🔍 What was sent to Claude" panel under each draft |

The LLM never produces a number on screen.

**Estimated cost during development:** ~$0.20 in Anthropic credits. Receipts will be submitted for the $50 stipend.

---

## What's done vs. cut

**Done (everything in the plan):**
- Required: portfolio overview, per-property table, property detail, unanswered queue, composable filters
- AI #1: theme extraction (multilingual embeddings + k-means + Claude labels)
- AI #2: draft host response (language-aware, tone-aware, theme-aware)

**Cut from the plan:**
- _Anomaly flag_ (stretch) — sketched in `plan.md` but not implemented. With another day this is the next thing I'd ship.
- _Sentence-level theme splitting_ — multi-themed reviews (~7%) currently get assigned to one cluster. Sentence-split before embedding would split them across themes more cleanly. Documented in `plan.md` cut-line.

**Known issues:**
- Recharts logs an SSR warning about width/height. Harmless — chart renders correctly post-hydration. Would silence with a dynamic import on production polish pass.
- `c0` ("Thoughtful Host, Home Feel") and `c7` ("Thoughtful Host Details") are near-duplicates. The embedding model finds them as one concept but k-means split them. Merging logic would help; not worth the time today.

---

## AI tooling disclosure

- **Claude Code** as the primary IDE pair throughout the build (~5h). Representative prompts in [`prompts.md`](./prompts.md).
- **Anthropic Claude Haiku 4.5** in the shipped product for cluster naming and draft generation.
- **`@huggingface/transformers`** (formerly `@xenova/transformers`) for local embeddings — no embedding API used.
- Code I deliberately wrote without AI: the cosine k-means implementation, the SQL queries, the filter composition layer, and the unanswered-queue priority formula. I needed to own the math.

---

## File map

```
data/
  guest_reviews.csv          # input (585 rows)
  reviews.db                 # generated by db:seed (gitignored)
scripts/
  seed-db.ts                 # CSV → SQLite
  embed-and-cluster.ts       # embeddings + k-means (writes themes table)
  label-clusters.ts          # asks Claude to name each cluster
src/
  app/
    page.tsx                 # portfolio overview (KPIs + trend + table)
    queue/page.tsx           # unanswered queue ranked by priority
    themes/page.tsx          # theme cards + drilldown + debug panel
    property/[id]/page.tsx   # property detail
    api/draft-response/      # POST endpoint for host reply drafts
  components/
    filter-bar.tsx           # client, URL-param-driven filters
    kpi-strip.tsx
    monthly-trend.tsx        # Recharts (client)
    property-table.tsx
    review-card.tsx
    draft-response.tsx       # client, the "Generate draft" button
  lib/
    db.ts                    # read-only SQLite connection (singleton)
    queries.ts               # all SQL, all aggregates
    filters.ts               # URL params → Filters → WHERE clause
    types.ts
    utils.ts
plan.md                      # Phase 1 plan (the submitted version)
prompts.md                   # representative AI prompts used during the build
```
