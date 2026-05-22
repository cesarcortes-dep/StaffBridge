import type { Channel, Filters, Language } from "./types";

const CHANNELS = new Set<Channel>(["Airbnb", "VRBO", "Booking.com", "Direct"]);
const LANGUAGES = new Set<Language>(["en", "es", "pt"]);

export function parseFilters(
  sp: Record<string, string | string[] | undefined>
): Filters {
  const pick = (k: string) =>
    typeof sp[k] === "string" ? (sp[k] as string) : undefined;

  const channel = pick("channel");
  const language = pick("language");
  const ratingMin = pick("ratingMin");
  const ratingMax = pick("ratingMax");

  return {
    from: pick("from"),
    to: pick("to"),
    channel:
      channel && CHANNELS.has(channel as Channel)
        ? (channel as Channel)
        : undefined,
    language:
      language && LANGUAGES.has(language as Language)
        ? (language as Language)
        : undefined,
    ratingMin: ratingMin ? Number(ratingMin) : undefined,
    ratingMax: ratingMax ? Number(ratingMax) : undefined,
    propertyId: pick("propertyId"),
  };
}

export function buildWhere(f: Filters): { sql: string; params: unknown[] } {
  const c: string[] = [];
  const p: unknown[] = [];
  if (f.from) {
    c.push("review_date >= ?");
    p.push(f.from);
  }
  if (f.to) {
    c.push("review_date <= ?");
    p.push(f.to);
  }
  if (f.channel) {
    c.push("channel = ?");
    p.push(f.channel);
  }
  if (f.language) {
    c.push("language = ?");
    p.push(f.language);
  }
  if (f.ratingMin != null && !Number.isNaN(f.ratingMin)) {
    c.push("rating_overall >= ?");
    p.push(f.ratingMin);
  }
  if (f.ratingMax != null && !Number.isNaN(f.ratingMax)) {
    c.push("rating_overall <= ?");
    p.push(f.ratingMax);
  }
  if (f.propertyId) {
    c.push("property_id = ?");
    p.push(f.propertyId);
  }
  return {
    sql: c.length ? `WHERE ${c.join(" AND ")}` : "",
    params: p,
  };
}

export function filtersToQs(f: Filters): string {
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries(f)) {
    if (v !== undefined && v !== "" && !Number.isNaN(v as number)) {
      u.set(k, String(v));
    }
  }
  const s = u.toString();
  return s ? `?${s}` : "";
}
