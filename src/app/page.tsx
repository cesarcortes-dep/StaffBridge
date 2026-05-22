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

      <KpiStrip kpis={kpis} />

      <MonthlyTrend data={trend} />

      <PropertyTable rows={properties} filters={filters} />
    </div>
  );
}
