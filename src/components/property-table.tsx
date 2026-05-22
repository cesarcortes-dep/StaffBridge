import Link from "next/link";
import type { PropertyRow } from "@/lib/types";
import { filtersToQs } from "@/lib/filters";
import type { Filters } from "@/lib/types";
import { fmtNum, fmtPct, fmtDate } from "@/lib/utils";

export function PropertyTable({
  rows,
  filters,
}: {
  rows: PropertyRow[];
  filters: Filters;
}) {
  const subKeys = [
    "cleanliness",
    "communication",
    "checkin",
    "accuracy",
    "location",
    "value",
  ] as const;

  return (
    <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
      <div className="flex items-baseline justify-between border-b border-neutral-200 px-4 py-3">
        <h2 className="text-sm font-semibold text-neutral-900">
          Properties — {rows.length}
        </h2>
        <p className="text-xs text-neutral-500">
          Sorted by avg rating, worst first
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500">
            <tr>
              <th className="px-3 py-2">Property</th>
              <th className="px-3 py-2 text-right">N</th>
              <th className="px-3 py-2 text-right">Avg</th>
              {subKeys.map((k) => (
                <th key={k} className="px-3 py-2 text-right" title={k}>
                  {k.slice(0, 4)}
                </th>
              ))}
              <th className="px-3 py-2 text-right">Resp%</th>
              <th className="px-3 py-2 text-right" title="≤2★ reviews in last 90 days">
                Low★90d
              </th>
              <th className="px-3 py-2 text-right">Last review</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.property_id}
                className="border-t border-neutral-100 hover:bg-neutral-50"
              >
                <td className="px-3 py-2">
                  <Link
                    href={`/property/${r.property_id}${filtersToQs(filters)}`}
                    className="font-medium text-neutral-900 hover:underline"
                  >
                    {r.property_name}
                  </Link>
                  <div className="text-xs text-neutral-500">
                    {r.city}, {r.country}
                  </div>
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {r.reviewCount}
                </td>
                <td
                  className={`px-3 py-2 text-right tabular-nums font-semibold ${
                    r.avgOverall < 3.5
                      ? "text-red-600"
                      : r.avgOverall < 4
                        ? "text-amber-600"
                        : "text-neutral-900"
                  }`}
                >
                  {fmtNum(r.avgOverall, 2)}
                </td>
                {subKeys.map((k) => (
                  <td
                    key={k}
                    className="px-3 py-2 text-right tabular-nums text-neutral-700"
                  >
                    {fmtNum(r.subAverages[k] ?? null, 1)}
                  </td>
                ))}
                <td className="px-3 py-2 text-right tabular-nums">
                  {fmtPct(r.responseRate, 0)}
                </td>
                <td
                  className={`px-3 py-2 text-right tabular-nums ${
                    r.lowStarLast90 > 0 ? "text-red-600" : "text-neutral-500"
                  }`}
                >
                  {r.lowStarLast90}
                </td>
                <td className="px-3 py-2 text-right text-neutral-500">
                  {fmtDate(r.lastReviewDate)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
