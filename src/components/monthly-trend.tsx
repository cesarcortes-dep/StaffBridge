"use client";

import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { MonthlyPoint } from "@/lib/types";

export function MonthlyTrend({ data }: { data: MonthlyPoint[] }) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-sm font-semibold text-neutral-900">
          Last 12 months — avg rating & volume
        </h2>
        <p className="text-xs text-neutral-500">
          Window anchored to most recent review in dataset
        </p>
      </div>
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={data}
            margin={{ top: 8, right: 8, bottom: 8, left: 8 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
            <XAxis
              dataKey="ym"
              tick={{ fontSize: 11, fill: "#737373" }}
              tickMargin={6}
            />
            <YAxis
              yAxisId="left"
              domain={[0, 5]}
              tick={{ fontSize: 11, fill: "#737373" }}
              width={28}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              tick={{ fontSize: 11, fill: "#737373" }}
              width={28}
            />
            <Tooltip
              contentStyle={{
                fontSize: 12,
                borderRadius: 6,
                border: "1px solid #e5e5e5",
              }}
              labelStyle={{ fontWeight: 600 }}
            />
            <Bar
              yAxisId="right"
              dataKey="reviewCount"
              fill="#e5e5e5"
              name="Reviews"
              radius={[2, 2, 0, 0]}
            />
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="avgRating"
              stroke="#171717"
              strokeWidth={2}
              dot={{ r: 3, fill: "#171717" }}
              name="Avg rating"
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
