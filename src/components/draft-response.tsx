"use client";

import { useState } from "react";

type DraftResponse = {
  draft: string;
  language: string;
  rating: number;
  theme: { id: number; label: string; description: string } | null;
  debug: {
    model: string;
    latencyMs: number;
    inputTokens: number;
    outputTokens: number;
    systemPrompt: string;
    userPrompt: string;
  };
};

export function DraftResponseButton({ reviewId }: { reviewId: string }) {
  const [state, setState] = useState<
    | { kind: "idle" }
    | { kind: "loading" }
    | { kind: "ok"; data: DraftResponse; draft: string }
    | { kind: "err"; message: string }
  >({ kind: "idle" });
  const [copied, setCopied] = useState(false);

  async function generate() {
    setState({ kind: "loading" });
    try {
      const r = await fetch("/api/draft-response", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reviewId }),
      });
      if (!r.ok) {
        const e = await r.json().catch(() => ({ error: "Request failed" }));
        setState({ kind: "err", message: e.error ?? "Request failed" });
        return;
      }
      const data = (await r.json()) as DraftResponse;
      setState({ kind: "ok", data, draft: data.draft });
    } catch (e) {
      setState({
        kind: "err",
        message: e instanceof Error ? e.message : "Network error",
      });
    }
  }

  async function copy() {
    if (state.kind !== "ok") return;
    await navigator.clipboard.writeText(state.draft);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  if (state.kind === "idle") {
    return (
      <button
        type="button"
        onClick={generate}
        className="rounded-md border border-neutral-900 bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-neutral-700"
      >
        Generate draft reply
      </button>
    );
  }

  if (state.kind === "loading") {
    return (
      <div className="inline-flex items-center gap-2 text-xs text-neutral-500">
        <span className="h-2 w-2 animate-pulse rounded-full bg-neutral-400" />
        Drafting…
      </div>
    );
  }

  if (state.kind === "err") {
    return (
      <div className="space-y-2">
        <p className="text-xs text-red-600">⚠️ {state.message}</p>
        <button
          type="button"
          onClick={generate}
          className="rounded-md border border-neutral-300 px-3 py-1.5 text-xs text-neutral-700 hover:bg-neutral-100"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2 rounded-md border border-neutral-300 bg-neutral-50 p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="text-xs text-neutral-500">
          Draft in <span className="font-medium">{state.data.language}</span> ·{" "}
          rating {state.data.rating}★
          {state.data.theme ? (
            <>
              {" "}· theme{" "}
              <span className="rounded bg-amber-100 px-1.5 py-0.5 text-amber-800">
                {state.data.theme.label}
              </span>
            </>
          ) : null}
        </div>
        <div className="text-[11px] text-neutral-400">
          {state.data.debug.model} · {state.data.debug.latencyMs}ms ·{" "}
          {state.data.debug.inputTokens}→{state.data.debug.outputTokens} tok
        </div>
      </div>
      <textarea
        value={state.draft}
        onChange={(e) =>
          setState({
            kind: "ok",
            data: state.data,
            draft: e.target.value,
          })
        }
        rows={Math.min(8, state.draft.split("\n").length + 3)}
        className="w-full rounded-md border border-neutral-300 bg-white p-2 text-sm text-neutral-900 focus:border-neutral-900 focus:outline-none"
      />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={copy}
            className="rounded-md border border-neutral-900 bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-neutral-700"
          >
            {copied ? "Copied ✓" : "Copy to clipboard"}
          </button>
          <button
            type="button"
            onClick={generate}
            className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-xs text-neutral-700 hover:bg-neutral-100"
          >
            Regenerate
          </button>
        </div>
        <span className="text-[11px] italic text-neutral-500">
          Review & edit before sending. Nothing is sent automatically.
        </span>
      </div>
      <details className="text-[11px] text-neutral-600">
        <summary className="cursor-pointer text-neutral-500">
          🔍 What was sent to Claude
        </summary>
        <div className="mt-2 space-y-2">
          <div>
            <div className="font-semibold text-neutral-700">System:</div>
            <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap rounded bg-white p-2 font-mono text-[10px]">
              {state.data.debug.systemPrompt}
            </pre>
          </div>
          <div>
            <div className="font-semibold text-neutral-700">User:</div>
            <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap rounded bg-white p-2 font-mono text-[10px]">
              {state.data.debug.userPrompt}
            </pre>
          </div>
        </div>
      </details>
    </div>
  );
}
