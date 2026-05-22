import type { Review } from "@/lib/types";
import { fmtDate } from "@/lib/utils";

const LANG_LABEL: Record<string, string> = {
  en: "English",
  es: "Español",
  pt: "Português",
};

function Stars({ n }: { n: number }) {
  return (
    <span
      className={`text-sm tabular-nums font-semibold ${
        n <= 2 ? "text-red-600" : n === 3 ? "text-amber-600" : "text-neutral-700"
      }`}
      aria-label={`${n} of 5 stars`}
    >
      {"★".repeat(n)}
      <span className="text-neutral-300">{"★".repeat(5 - n)}</span>
    </span>
  );
}

export function ReviewCard({
  review,
  badge,
}: {
  review: Review;
  badge?: React.ReactNode;
}) {
  return (
    <article className="rounded-lg border border-neutral-200 bg-white p-4">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="flex items-baseline gap-3">
          <Stars n={review.rating_overall} />
          <span className="text-xs text-neutral-500">
            {fmtDate(review.review_date)} · {review.channel} ·{" "}
            {LANG_LABEL[review.language] ?? review.language}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {badge}
          <span className="text-xs text-neutral-500">{review.review_id}</span>
        </div>
      </header>
      <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-neutral-800">
        {review.review_text}
      </p>
      {review.host_response ? (
        <div className="mt-3 border-l-2 border-neutral-300 pl-3">
          <div className="text-xs uppercase tracking-wide text-neutral-500">
            Host responded {fmtDate(review.host_response_date)}
          </div>
          <p className="mt-1 text-sm text-neutral-700">
            {review.host_response}
          </p>
        </div>
      ) : (
        <div className="mt-3 text-xs italic text-neutral-500">
          No host response
        </div>
      )}
    </article>
  );
}
