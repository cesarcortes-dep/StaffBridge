import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getDb } from "@/lib/db";
import type { Review, Theme } from "@/lib/types";

export const runtime = "nodejs";

const MODEL = "claude-haiku-4-5";

const SYSTEM = `You draft host responses to guest reviews for a vacation-rental property management company in Latin America, the US, and Europe.

Rules — follow strictly:
- Write in the SAME language as the review (en / es / pt).
- Match tone to the rating:
  * 1-2★: acknowledge the problem directly, apologize specifically (not generically), name the concrete fix you're taking. No defensiveness.
  * 3★: thank them, acknowledge what didn't work, mention a concrete step.
  * 4-5★: warm and short. Thank them. One specific detail they mentioned, if any. Invite them back.
- Length: 2-4 sentences. No corporate boilerplate. No emoji.
- If a theme is provided, reference the issue or strength directly.
- Do NOT promise refunds, discounts, comps, or specific dates.
- Do NOT sign with a name — the host will add their own sign-off.
- Output ONLY the response text. No preamble, no quotes.`;

type Body = { reviewId?: string };

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY missing. Set it in .env.local." },
      { status: 500 }
    );
  }

  const body = (await req.json()) as Body;
  if (!body.reviewId) {
    return NextResponse.json({ error: "reviewId required" }, { status: 400 });
  }

  const db = getDb();
  const review = db
    .prepare("SELECT * FROM reviews WHERE review_id = ?")
    .get(body.reviewId) as Review | undefined;
  if (!review) {
    return NextResponse.json({ error: "Review not found" }, { status: 404 });
  }

  // Look up the theme for this review (cluster + label).
  let theme: Pick<Theme, "label" | "description" | "cluster_id"> | null = null;
  try {
    const row = db
      .prepare(
        `SELECT t.cluster_id, t.label, t.description
         FROM review_clusters rc
         JOIN themes t ON t.cluster_id = rc.cluster_id
         WHERE rc.review_id = ?`
      )
      .get(body.reviewId) as
      | { cluster_id: number; label: string | null; description: string | null }
      | undefined;
    if (row && row.label) theme = row;
  } catch {
    // themes pipeline not run yet — that's fine, theme stays null.
  }

  const langName =
    { en: "English", es: "Spanish", pt: "Portuguese" }[review.language] ?? "English";

  const userMsg = [
    `Guest review (${review.rating_overall}★, ${langName}):`,
    `"""${review.review_text}"""`,
    "",
    theme
      ? `Detected theme: "${theme.label}" — ${theme.description}`
      : `(No theme detected.)`,
    "",
    "Draft the response now. Respond in the same language as the review.",
  ].join("\n");

  const client = new Anthropic();

  const t0 = Date.now();
  const resp = await client.messages.create({
    model: MODEL,
    max_tokens: 350,
    system: SYSTEM,
    messages: [{ role: "user", content: userMsg }],
  });
  const latencyMs = Date.now() - t0;

  const textBlock = resp.content.find((b) => b.type === "text");
  const draft =
    textBlock && textBlock.type === "text" ? textBlock.text.trim() : "";

  return NextResponse.json({
    draft,
    language: review.language,
    rating: review.rating_overall,
    theme: theme
      ? { id: theme.cluster_id, label: theme.label, description: theme.description }
      : null,
    debug: {
      model: MODEL,
      latencyMs,
      inputTokens: resp.usage.input_tokens,
      outputTokens: resp.usage.output_tokens,
      systemPrompt: SYSTEM,
      userPrompt: userMsg,
    },
  });
}
