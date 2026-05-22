## 1. Problem framing

The operator's job-to-be-done is **triage in five minutes on Monday morning**: which properties are getting worse, which reviews still owe a host response, and what guests are actually complaining about right now. They don't want to read 585 reviews; they want a ranked list of things that need a human decision today.

A dashboard worth opening every Monday answers three questions in this order:
1. **Is anything on fire?** — properties whose rating just dropped, or that have a pile of unanswered low-star reviews.
2. **What do I owe a reply to?** — a prioritized queue of unanswered reviews, with a draft I can copy and edit.
3. **What's the pattern this week?** — recurring themes across the portfolio (AC, noise, wifi, check-in), so the ops team can fix the root cause instead of replying to each guest individually.

Everything else (per-property browsing, individual review reading) is supporting infrastructure for those three flows.

## 2. Metrics & views

Six things, ordered by how often the operator will look at them:

1. **Portfolio KPIs (header strip)** — total reviews in window, avg overall rating, **response rate** (currently 45.8% — clear room to move), median response latency, **# unanswered**. These are the "is anything obviously off" glance.
2. **12-month rating trend** — line chart of monthly avg rating + monthly review volume. Detects portfolio-wide drift.
3. **Per-property table** — sortable on: review count, avg rating (overall + each sub-rating where ≥ 5 ratings exist), response rate, last review date, # low-star (≤2) reviews in last 90 days. The "find the laggards" view.
4. **Property detail** — header with KPIs, a chart of rating-over-time for that property, then the review list (filterable by rating range / date / channel / language) with full text and host response inline.
5. **Unanswered queue** — single ranked list across the portfolio. Priority = `rating_severity × age_decay`, where severity favors 1-2★ over 5★ and age_decay halves every 14 days. Each row has a "Draft response" action.
6. **Themes panel** — top recurring themes detected across reviews, with counts. Filterable to portfolio or one property; clicking a theme drills into the underlying reviews. This is what turns "guests complain about AC" from a hunch into a number.

Sub-ratings are 41–70% populated (real OTA inconsistency). Averages and the table will compute over filled values only and render `—` when missing — never `0`.

## 3. AI integration (opinionated)

**Two AI features ship.** Both are designed so the LLM never produces a number that appears in the UI.

- **Theme extraction.** Embed all 585 reviews with a **multilingual** model (`multilingual-e5-small` via `@xenova/transformers`, server-side, no external embedding API). Cluster with HDBSCAN (or k-means with k chosen by silhouette). The LLM is called **once per cluster** to assign a short label and 1-line description, given the cluster's top-N representative review snippets. Counts come from SQL (`COUNT reviews IN cluster`), not the LLM. A debug panel exposes: cluster size, the snippets sent to the LLM, and the label returned.
- **Draft host response.** Per unanswered review, a "Generate draft" button opens a modal showing: detected language, detected primary theme(s) from feature #1, and the generated draft. Tone is anchored by rating bucket (1–2 / 3 / 4–5) using few-shot examples in the prompt. Draft is generated **in the original language** of the review. The operator must explicitly copy to clipboard — there is no "send" button.

**Where AI is deliberately not used:**
- All counts, averages, percentages, response rates → SQL only.
- Filters → deterministic.
- Unanswered-queue priority ordering → deterministic formula above.
- Translation of review text → on demand only (per-review toggle), never automatic, never as the basis for any aggregate.

**Multilingual strategy (committed).** Reviews display in their original language. Themes work across languages because embeddings are multilingual — `"el aire era pésimo"` and `"the AC barely worked"` cluster together. Drafts answer in the review's language. The operator UI chrome stays in English. **I am not translating everything; that's the trap the instructions warn about.**

## 4. Tech stack

- **Next.js 15 (App Router) + TypeScript + Tailwind + shadcn/ui** — produces a presentable single-page app fast without a separate backend.
- **SQLite via `better-sqlite3`**, loaded from the CSV at server start. All aggregates are SQL.
- **Recharts** for the trend chart.
- **Anthropic SDK** — Claude Haiku 4.5 for theme labels (cheap, batched) and Sonnet 4.6 for draft responses (better tone control in ES/PT).
- **`@xenova/transformers`** for embeddings — runs locally, zero per-call cost, keeps review text inside the app for the spec's "no data exfiltration" constraint at scale.
- **Deploy:** Vercel.
- **Estimated AI cost during dev:** ~$5–10 in Anthropic credits. Will submit receipts for the $50 stipend.

## 5. Phased build order

| Phase | Time | Output | First to cut |
|---|---|---|---|
| 0. Scaffold | 30 min | Next.js app, SQLite loaded from CSV, base layout | — |
| 1. Deterministic core | 90 min | Portfolio KPIs, 12-mo trend, per-property table, **filters composing across all views** | — |
| 2. Property detail + unanswered queue | 60 min | Drill-down page, ranked unanswered list (no AI yet) | — |
| 3. Theme extraction | 90 min | Embedding pipeline, clustering, LLM labeling, themes panel, debug view | drop sentence-level splitting; embed whole review |
| 4. Draft host response | 90 min | Modal with detected language + theme + draft, copy-to-clipboard | drop tone-by-rating few-shot; one generic prompt |
| 5. Polish + 1 stretch | 30 min | README, prompts.md, anomaly flag (one stretch only) | drop anomaly flag; just polish the README |

**Cut-line, in order:** anomaly flag → theme-extraction UI polish → draft tone variation. **Never cut:** filters composing across every view, response-rate KPI, unanswered queue, inspectability of AI output.

## 6. Risks & open questions

**Risks**
- **Cluster quality on 585 docs.** Small corpus + multilingual may yield noisy clusters. Mitigation: minimum cluster size, manual review of top clusters during build, fall back to TF-IDF + curated stoplist if clusters fail by hour 4.
- **Multi-themed reviews (~7% mix positive + negative cues).** Whole-review embeddings may smooth this out. Mitigation noted in cut-line — sentence-split only if time.
- **LLM tone drift on Spanish/Portuguese drafts.** Mitigation: language-specific few-shot anchors; the debug view exposes the prompt so I can iterate.
- **Sub-rating sparsity** (cleanliness 56%, accuracy 41%). Mitigation: render `—`, exclude from averages, never display as `0`.
- **Time risk on Phase 3.** Theme extraction is the longest pole; the cut-line above keeps Phase 4 (draft response) safe.

**Open questions (sending in the batched email):**
1. Does the **unanswered queue** include 5★ reviews, or only ≤ 4★? Default if unanswered: include all, sort by severity so 5★ sink naturally.
2. Is the **"last 12 months"** window relative to today (2026-05-19) or to the most recent review (2026-05-01)? Default: most recent review date.
3. Spec says "9 cities" but the data has **13**. Confirming this is a copy in the spec, not a data issue.

## 7. AI-collaboration plan

**During the build I will use:**
- **Claude Code** as the primary pair — scaffolding, SQL queries, React components, prompt iteration. I'll save representative prompts in `prompts.md`.
- **Claude Sonnet 4.6 / Opus 4.7** in chat for design questions when I'm stuck on a trade-off.
- **Anthropic API (Haiku 4.5 + Sonnet 4.6)** inside the shipped product for the two AI features.
- **`@xenova/transformers`** for local embeddings — no external embedding API.

**Where I will not use AI:**
- Writing the SQL for aggregates (response rate, averages, counts) — I want to own the math and be able to explain every number on screen in the demo.
- The unanswered-queue priority formula — business logic, not generation.
- Filter composition logic — deterministic, easier to test by hand than to verify an LLM got it right.

**Honest disclosure (will be repeated in README):** code-gen via Claude Code; in-product LLM is Anthropic Claude; multilingual embeddings via `@xenova/transformers`; estimated dev cost ~$5–10.
