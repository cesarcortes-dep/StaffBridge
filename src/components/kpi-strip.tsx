import type { PortfolioKpis } from "@/lib/types";
import { fmtNum, fmtPct } from "@/lib/utils";

export function KpiStrip({ kpis }: { kpis: PortfolioKpis }) {
  const items: Array<{ label: string; value: string; sub?: string }> = [
    { label: "Reviews", value: kpis.totalReviews.toLocaleString() },
    { label: "Avg overall", value: fmtNum(kpis.avgOverall, 2), sub: "/ 5" },
    { label: "Response rate", value: fmtPct(kpis.responseRate, 0) },
    {
      label: "Median response latency",
      value:
        kpis.medianResponseLatencyDays == null
          ? "—"
          : fmtNum(kpis.medianResponseLatencyDays, 1),
      sub: kpis.medianResponseLatencyDays == null ? undefined : "days",
    },
    {
      label: "Unanswered",
      value: kpis.unansweredCount.toLocaleString(),
    },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {items.map((it) => (
        <div
          key={it.label}
          className="rounded-lg border border-neutral-200 bg-white p-4"
        >
          <div className="text-xs uppercase tracking-wide text-neutral-500">
            {it.label}
          </div>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="text-2xl font-semibold text-neutral-900">
              {it.value}
            </span>
            {it.sub && (
              <span className="text-xs text-neutral-500">{it.sub}</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
