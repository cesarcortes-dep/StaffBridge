import Link from "next/link";
import { FilterBar } from "@/components/filter-bar";
import { ReviewCard } from "@/components/review-card";
import { DraftResponseButton } from "@/components/draft-response";
import { parseFilters, filtersToQs } from "@/lib/filters";
import { getUnansweredQueue } from "@/lib/queries";

export const dynamic = "force-dynamic";

type SP = Record<string, string | string[] | undefined>;

export default async function QueuePage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  const sp = await searchParams;
  const filters = parseFilters(sp);
  const queue = getUnansweredQueue(filters, 100);

  return (
    <div className="space-y-6">
      <section>
        <h1 className="mb-1 text-xl font-semibold">Unanswered queue</h1>
        <p className="mb-4 text-sm text-neutral-500">
          Ranked by{" "}
          <code className="rounded bg-neutral-200 px-1 py-0.5 text-xs">
            severity × age_decay
          </code>{" "}
          — severity is (6 − rating), age halves every 14 days. 5★ unanswered
          stay in the list but sink to the bottom.
        </p>
        <FilterBar />
      </section>

      <section className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-semibold">
            {queue.length} review{queue.length === 1 ? "" : "s"} need a reply
          </h2>
          <p className="text-xs text-neutral-500">
            Showing top 100 by priority
          </p>
        </div>

        {queue.length === 0 ? (
          <div className="rounded-lg border border-dashed border-neutral-300 bg-white p-8 text-center text-sm text-neutral-500">
            No unanswered reviews match these filters. Inbox zero.
          </div>
        ) : (
          queue.map((r, i) => (
            <div key={r.review_id} className="flex flex-col gap-2">
              <div className="flex items-baseline justify-between text-xs text-neutral-500">
                <div className="flex items-baseline gap-3">
                  <span className="font-mono text-neutral-700">#{i + 1}</span>
                  <Link
                    href={`/property/${r.property_id}${filtersToQs(filters)}`}
                    className="font-medium text-neutral-700 hover:underline"
                  >
                    {r.property_name}
                  </Link>
                  <span>
                    {r.city}, {r.country}
                  </span>
                </div>
                <div className="flex items-baseline gap-3">
                  <span title="age in days">{r.ageDays}d old</span>
                  <span title="priority score">
                    priority{" "}
                    <span className="font-semibold text-neutral-700">
                      {r.priority.toFixed(2)}
                    </span>
                  </span>
                </div>
              </div>
              <ReviewCard
                review={r}
                badge={
                  <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                    needs reply
                  </span>
                }
              />
              <DraftResponseButton reviewId={r.review_id} />
            </div>
          ))
        )}
      </section>
    </div>
  );
}
