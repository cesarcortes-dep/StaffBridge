"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useTransition } from "react";

const CHANNELS = ["Airbnb", "VRBO", "Booking.com", "Direct"];
const LANGUAGES = [
  { value: "en", label: "English" },
  { value: "es", label: "Español" },
  { value: "pt", label: "Português" },
];

export function FilterBar() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(sp.toString());
    if (value === "" || value == null) next.delete(key);
    else next.set(key, value);
    startTransition(() => {
      router.push(`${pathname}?${next.toString()}`);
    });
  };

  const reset = () => {
    startTransition(() => {
      router.push(pathname);
    });
  };

  const v = (k: string) => sp.get(k) ?? "";
  const inputBase =
    "h-9 rounded-md border border-neutral-300 bg-white px-2 text-sm text-neutral-900 focus:border-neutral-900 focus:outline-none";

  return (
    <div
      className={`flex flex-wrap items-end gap-3 rounded-lg border border-neutral-200 bg-neutral-50 p-3 ${
        isPending ? "opacity-60" : ""
      }`}
    >
      <Field label="From">
        <input
          type="date"
          value={v("from")}
          onChange={(e) => setParam("from", e.target.value)}
          className={inputBase}
        />
      </Field>
      <Field label="To">
        <input
          type="date"
          value={v("to")}
          onChange={(e) => setParam("to", e.target.value)}
          className={inputBase}
        />
      </Field>
      <Field label="Channel">
        <select
          value={v("channel")}
          onChange={(e) => setParam("channel", e.target.value)}
          className={inputBase}
        >
          <option value="">All</option>
          {CHANNELS.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Language">
        <select
          value={v("language")}
          onChange={(e) => setParam("language", e.target.value)}
          className={inputBase}
        >
          <option value="">All</option>
          {LANGUAGES.map((l) => (
            <option key={l.value} value={l.value}>
              {l.label}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Rating ≥">
        <select
          value={v("ratingMin")}
          onChange={(e) => setParam("ratingMin", e.target.value)}
          className={inputBase}
        >
          <option value="">Any</option>
          {[1, 2, 3, 4, 5].map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Rating ≤">
        <select
          value={v("ratingMax")}
          onChange={(e) => setParam("ratingMax", e.target.value)}
          className={inputBase}
        >
          <option value="">Any</option>
          {[1, 2, 3, 4, 5].map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </Field>
      <button
        type="button"
        onClick={reset}
        className="h-9 rounded-md border border-neutral-300 bg-white px-3 text-sm text-neutral-700 hover:bg-neutral-100"
      >
        Reset
      </button>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs text-neutral-600">
      <span>{label}</span>
      {children}
    </label>
  );
}
