import { FilterBar } from "@/components/filter-bar";
import { KpiStrip } from "@/components/kpi-strip";
import { MonthlyTrend } from "@/components/monthly-trend";
import { PropertyTable } from "@/components/property-table";
import { parseFilters } from "@/lib/filters";
import {
  getMonthlyTrend,
  getPortfolioKpis,
  getPropertyTable,
} from "@/lib/queries";

export const dynamic = "force-dynamic";

type SP = Record<string, string | string[] | undefined>;

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  const sp = await searchParams;
  const filters = parseFilters(sp);

  const kpis = getPortfolioKpis(filters);
  const trend = getMonthlyTrend(filters, 12);
  const properties = getPropertyTable(filters);

  return (
    <div className="space-y-6">
      <section>
        <h1 className="mb-1 text-xl font-semibold">Portfolio overview</h1>
        <p className="mb-4 text-sm text-neutral-500">
          Triage view — everything respects the filters below.
        </p>
        <FilterBar />
      </section>

      {kpis.totalReviews === 0 ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          No reviews match the current filters. The dataset runs from
          2024-11-07 to 2026-05-01 — try widening the date range or removing a
          filter.
        </div>
      ) : null}

      <KpiStrip kpis={kpis} />

      <MonthlyTrend data={trend} />

      <PropertyTable rows={properties} filters={filters} />
    </div>
  );
}
