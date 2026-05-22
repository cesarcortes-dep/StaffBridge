# Prompts

A small set of representative AI interactions used during the build. The intent is to be honest about how the code came together — not to claim all of it was AI-generated, and not to hide where it was.

Conventions:
- **Me** = my message to the AI
- **AI** = paraphrased summary of what came back. I do not paste raw model output here; the prompts are what's reproducible.

---

## Build-time prompts (Claude Code, my IDE pair)

### 1. Scaffolding the SQL aggregates

**Me:** "I have a `reviews` table with rating_overall (int), rating_cleanliness/communication/checkin/accuracy/location/value (int or NULL), host_response (text or empty), review_date (ISO date). Write me the SQL for: total reviews, avg overall, response rate, count unanswered. Then a SEPARATE query for the median host-response latency (days). Filter clause goes in `${sql}`. Use better-sqlite3 placeholder syntax."

**AI:** Returned the four-aggregate query and the latencies query. I rewrote the median in TS (sort + middle index) because doing it in SQLite needs window functions and would be slower than letting JS sort ~270 numbers.

**Why I asked:** the boring boilerplate I was going to write the same way regardless. Owning the schema design (which fields, which indexes) was on me.

---

### 2. K-means initialization

**Me:** "I'm doing cosine k-means in TypeScript on 585 normalized 384-d vectors. Write the k-means++ initialization — pick first centroid randomly, then each next centroid with probability proportional to squared distance from the nearest existing centroid. Use a seeded Mulberry32 RNG so the result is reproducible. Return centroids as a Float32Array[]."

**AI:** Returned a clean implementation. I added the assignment loop and the centroid update myself because I wanted to be sure cosine sim (`dot(a,b)` on normalized vectors) was used consistently and not euclidean.

**Why I asked:** k-means++ is fiddly and easy to get subtly wrong. Bug there = bad clusters and I wouldn't know why.

---

### 3. Recharts ComposedChart

**Me:** "Recharts ComposedChart with a Bar for `reviewCount` on the right Y axis (auto-scale) and a Line for `avgRating` on the left Y axis (0-5 domain). Tooltip, CartesianGrid, no legend, dark line, light grey bars. Container height 256px. Tailwind classes only on the wrapper."

**AI:** Returned the JSX I used in `monthly-trend.tsx` with minor renaming.

**Why I asked:** Recharts has 40 props per component and I don't memorize them. Faster to describe the chart and iterate.

---

### 4. Migrating to Next.js 16 async params

**Me:** "I scaffolded with the latest create-next-app and got Next 16, not 15 like I planned. The `params` and `searchParams` props are now Promises. Show me the type and the await pattern for a dynamic route like `/property/[id]/page.tsx` that also reads searchParams."

**AI:** Returned the `params: Promise<{ id: string }>` + `await params` pattern. Saved me from going to the upgrade notes.

---

## Product prompts (run from inside the app)

### 5. Cluster naming — `scripts/label-clusters.ts`

This is the system prompt currently shipping. The labeling script uses **Claude Haiku 4.5**:

```
You label clusters of short-term-rental guest reviews for a property-manager dashboard.

Given representative reviews from one cluster, return a single tight theme label.

Output STRICT JSON with two fields:
- "label": 2-4 words, Title Case, English. Concrete and operational
  (e.g. "AC Issues", "Noisy at Night", "Great Location").
- "description": one sentence, ≤ 18 words, English, telling an operator
  what guests say in this cluster.

Reviews are multilingual (en/es/pt). Read all of them before deciding.
Do NOT invent numbers. Do NOT include reasoning, only the JSON object.
```

The user message is built from the 6 representative reviews of the cluster (closest-to-centroid):

```
Cluster size: 95 reviews.

Representative reviews:

[1] (es, 5★) Una de las mejores estancias…
[2] (en, 4★) Stayed here for our anniversary…
…
```

What I iterated on:
- Initial version asked for "themes" plural and got vague labels like "Mixed feedback". Forcing a single label + description fixed it.
- Initial version didn't say "English" for labels — got mixed-language labels which the UI couldn't render consistently. Fixed by being explicit.

---

### 6. Draft host response — `src/app/api/draft-response/route.ts`

This is the system prompt currently shipping. **Claude Haiku 4.5**, one call per "Generate draft" click:

```
You draft host responses to guest reviews for a vacation-rental property
management company in Latin America, the US, and Europe.

Rules — follow strictly:
- Write in the SAME language as the review (en / es / pt).
- Match tone to the rating:
  * 1-2★: acknowledge the problem directly, apologize specifically (not
    generically), name the concrete fix you're taking. No defensiveness.
  * 3★: thank them, acknowledge what didn't work, mention a concrete step.
  * 4-5★: warm and short. Thank them. One specific detail they mentioned,
    if any. Invite them back.
- Length: 2-4 sentences. No corporate boilerplate. No emoji.
- If a theme is provided, reference the issue or strength directly.
- Do NOT promise refunds, discounts, comps, or specific dates.
- Do NOT sign with a name — the host will add their own sign-off.
- Output ONLY the response text. No preamble, no quotes.
```

The user message injects the review text, language, rating, and (if available) the detected theme:

```
Guest review (1★, English):
"""Stayed here for our anniversary and we had to buy a fan from the store
because the AC was so weak. Hard to recommend at this price."""

Detected theme: "AC Not Working" — Guests report air conditioning failures
forcing them to open windows in hot conditions.

Draft the response now. Respond in the same language as the review.
```

What I iterated on:
- Initial system prompt allowed "best regards" sign-offs. Got corporate-feeling drafts. Forbidding sign-offs made them feel personal.
- I added the "do not promise refunds" rule after seeing a draft offer 20% off. Compensation is a business policy decision, not an LLM call.
- The "in the SAME language as the review" instruction wins reliably — I tested EN, ES, and PT smoke cases.

---

## Things I asked AI for and rejected

- **Auto-translation pipeline.** I asked Claude Code to add a translate-on-load feature for the property detail page so all reviews show in English. I scrapped this after reading the spec instructions again: "Multilingual is a trap." On-demand per-review translation is the better answer. Not shipping for time.
- **Vibe score per property using LLM sentiment.** Would have been a third AI feature. Decided in plan.md to ship 2 well rather than 3 mediocre. Stayed disciplined.
- **A chat panel ("Ask your reviews").** Mentioned as a Stretch. Rejected in plan.md for the same reason as the vibe score, plus the rubric's hard rule that LLMs can't invent numbers — a chat that does counts is one bad answer away from disqualification.
