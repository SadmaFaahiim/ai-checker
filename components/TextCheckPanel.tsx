"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import { AnimatePresence, motion } from "framer-motion";
import { Search, Sparkles } from "lucide-react";
import ResultCard from "./ResultCard";
import type { CheckResult } from "@/lib/scoring";

const MIN_CHARS = 20;

function ResultSkeleton() {
  return (
    <div className="glass-card shimmer w-full rounded-xl p-4 sm:rounded-2xl sm:p-6 md:p-8">
      <div className="flex flex-col items-center gap-3">
        <div className="h-12 w-28 rounded-lg bg-elevated" />
        <div className="h-6 w-40 rounded-full bg-elevated" />
      </div>
      <div className="mt-6 h-2.5 w-full rounded-full bg-elevated" />
      <div className="mt-4 h-3 w-24 mx-auto rounded bg-elevated" />
    </div>
  );
}

function EmptyState() {
  return (
    <div
      className="glass-card flex w-full flex-col items-center gap-3 rounded-xl px-4 py-10 text-center sm:rounded-2xl sm:px-6 sm:py-12"
      style={{ background: "var(--glass-bg-muted)" }}
    >
      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-surface">
        <Search className="h-5 w-5 text-text-3" aria-hidden />
      </div>
      <p className="text-sm text-text-2">Analysis results will appear here</p>
    </div>
  );
}

export default function TextCheckPanel() {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CheckResult | null>(null);

  const trimmedLength = text.trim().length;
  const canSubmit = trimmedLength >= MIN_CHARS && !loading;

  async function handleCheck() {
    if (!canSubmit) return;

    setLoading(true);
    setResult(null);

    try {
      const res = await fetch("/api/check/text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data?.error ?? "Something went wrong. Please try again.");
        return;
      }

      setResult(data as CheckResult);
    } catch {
      toast.error("Network error — please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 sm:gap-6">
      <div className="glass-card rounded-xl p-4 sm:rounded-2xl sm:p-5">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Paste or type text here..."
          rows={8}
          className="min-h-30 w-full resize-y bg-transparent text-sm text-text placeholder:text-text-3 outline-none sm:min-h-40 sm:text-base"
        />
        <div className="mt-3 flex items-center justify-between gap-2 border-t border-line pt-3 text-xs text-text-3">
          <span>{trimmedLength < MIN_CHARS ? `At least ${MIN_CHARS} characters required` : " "}</span>
          <span className="shrink-0 tabular-nums">{text.length.toLocaleString()} chars</span>
        </div>
      </div>

      <motion.button
        type="button"
        onClick={handleCheck}
        disabled={!canSubmit}
        whileTap={canSubmit ? { scale: 0.98 } : undefined}
        className="btn-gradient inline-flex w-full min-h-11 items-center justify-center gap-2 rounded-lg px-5 py-2.5 text-sm shadow-lg shadow-brand/20 outline-none focus-visible:ring-2 focus-visible:ring-brand/50 disabled:cursor-not-allowed disabled:bg-elevated disabled:text-text-3 disabled:shadow-none disabled:opacity-60 sm:w-auto sm:self-end"
      >
        <Sparkles className="h-4 w-4" aria-hidden />
        {loading ? "Analyzing..." : "Check Text"}
      </motion.button>

      <div className="relative">
      <AnimatePresence mode="popLayout">
        {loading && (
          <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, pointerEvents: "none" }}>
            <ResultSkeleton />
          </motion.div>
        )}
        {!loading && result && (
          <motion.div key="result" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, pointerEvents: "none" }}>
            <ResultCard percentage={result.percentage} verdict={result.verdict} provider={result.provider} />
          </motion.div>
        )}
        {!loading && !result && (
          <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, pointerEvents: "none" }}>
            <EmptyState />
          </motion.div>
        )}
      </AnimatePresence>
      </div>
    </div>
  );
}
