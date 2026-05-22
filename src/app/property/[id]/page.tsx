import Link from "next/link";
import { notFound } from "next/navigation";
import { FilterBar } from "@/components/filter-bar";
import { KpiStrip } from "@/components/kpi-strip";
import { MonthlyTrend } from "@/components/monthly-trend";
import { ReviewCard } from "@/components/review-card";
import { parseFilters, filtersToQs } from "@/lib/filters";
import {
  getMonthlyTrend,
  getPortfolioKpis,
  getPropertyMeta,
  getReviewsList,
} from "@/lib/queries";

export const dynamic = "force-dynamic";

type SP = Record<string, string | string[] | undefined>;

export default async function PropertyPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<SP>;
}) {
  const { id } = await params;
  const sp = await searchParams;

  const meta = getPropertyMeta(id);
  if (!meta) notFound();

  const filters = { ...parseFilters(sp), propertyId: id };
  const kpis = getPortfolioKpis(filters);
  const trend = getMonthlyTrend(filters, 12);
  const reviews = getReviewsList(filters, 200);

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <Link
            href={`/${filtersToQs(parseFilters(sp))}`}
            className="text-xs text-neutral-500 hover:text-neutral-900"
          >
            ← Back to portfolio
          </Link>
          <h1 className="mt-1 text-xl font-semibold">{meta.property_name}</h1>
          <p className="text-sm text-neutral-500">
            {meta.city}, {meta.country} · {meta.property_type} ·{" "}
            {meta.bedrooms} bedroom{meta.bedrooms === 1 ? "" : "s"} · {id}
          </p>
        </div>
      </section>

      <FilterBar />

      <KpiStrip kpis={kpis} />

      <MonthlyTrend data={trend} />

      <section>
        <h2 className="mb-3 text-sm font-semibold">
          Reviews — {reviews.length}{" "}
          <span className="font-normal text-neutral-500">
            (most recent first, capped at 200)
          </span>
        </h2>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {reviews.length === 0 ? (
            <div className="col-span-full rounded-lg border border-dashed border-neutral-300 bg-white p-8 text-center text-sm text-neutral-500">
              No reviews match the current filters.
            </div>
          ) : (
            reviews.map((r) => <ReviewCard key={r.review_id} review={r} />)
          )}
        </div>
      </section>
    </div>
  );
}
