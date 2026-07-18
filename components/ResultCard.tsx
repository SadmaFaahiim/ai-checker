"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import clsx from "clsx";
import { Info } from "lucide-react";
import type { Verdict } from "@/lib/scoring";

interface ResultCardProps {
  percentage: number;
  verdict: Verdict;
  provider: string;
  children?: React.ReactNode;
}

const COUNT_DURATION_MS = 900;

function useCountUp(target: number, durationMs: number): number {
  const [value, setValue] = useState(0);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    const start = performance.now();
    const from = 0;

    function tick(now: number) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / durationMs, 1);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(from + (target - from) * eased));

      if (progress < 1) {
        frameRef.current = requestAnimationFrame(tick);
      }
    }

    frameRef.current = requestAnimationFrame(tick);

    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    };
  }, [target, durationMs]);

  return value;
}

function verdictStyles(percentage: number) {
  if (percentage < 35) {
    return {
      gradient: "linear-gradient(135deg, #22C55E, #4ADE80)",
      textColor: "text-success",
      badgeBg: "rgba(34,197,94,0.1)",
      badgeBorder: "rgba(34,197,94,0.35)",
      glowColor: "rgba(34,197,94,0.45)",
      dot: "bg-success",
      glow: "shadow-success/20",
    };
  }
  if (percentage <= 65) {
    return {
      gradient: "linear-gradient(135deg, #F59E0B, #FBBF24)",
      textColor: "text-warning",
      badgeBg: "rgba(245,158,11,0.1)",
      badgeBorder: "rgba(245,158,11,0.35)",
      glowColor: "rgba(245,158,11,0.45)",
      dot: "bg-warning",
      glow: "shadow-warning/20",
    };
  }
  return {
    gradient: "linear-gradient(135deg, #EF4444, #F87171)",
    textColor: "text-danger",
    badgeBg: "rgba(239,68,68,0.1)",
    badgeBorder: "rgba(239,68,68,0.35)",
    glowColor: "rgba(239,68,68,0.45)",
    dot: "bg-danger",
    glow: "shadow-danger/20",
  };
}

export default function ResultCard({ percentage, verdict, provider, children }: ResultCardProps) {
  const animatedPercentage = useCountUp(percentage, COUNT_DURATION_MS);
  const styles = verdictStyles(percentage);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      whileHover={{ y: -2 }}
      className={clsx(
        "relative w-full rounded-xl border border-black/[0.08] bg-white p-5 shadow-lg backdrop-blur-xl transition-colors sm:rounded-2xl sm:p-8 dark:border-white/[0.08] dark:bg-white/[0.03] dark:shadow-2xl dark:shadow-black/20",
        styles.glow
      )}
    >
      {/* Row 1 — percentage (left) / verdict badge (right), stacks on very small screens */}
      <div className="flex flex-col items-center gap-5 text-center sm:flex-row sm:items-center sm:justify-between sm:text-left">
        <motion.div
          initial={{ opacity: 0, x: -16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 26, delay: 0.05 }}
        >
          <span
            className="text-4xl font-bold tabular-nums sm:text-5xl md:text-6xl"
            style={{
              backgroundImage: styles.gradient,
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              color: "transparent",
              textShadow: `0 0 28px ${styles.glowColor}`,
            }}
          >
            {animatedPercentage}%
          </span>
          <p className="mt-1 text-[10px] font-medium uppercase tracking-wider text-text-3 sm:text-xs">
            AI Probability Score
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 16, scale: 0.9 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 22, delay: 0.15 }}
          className="flex flex-col items-center sm:items-end"
        >
          <span
            className={clsx(
              "inline-flex items-center rounded-full border px-3.5 py-1.5 text-sm font-semibold",
              styles.textColor
            )}
            style={{ backgroundColor: styles.badgeBg, borderColor: styles.badgeBorder }}
          >
            {verdict}
          </span>
          <p className="mt-1 text-[10px] font-medium uppercase tracking-wider text-text-3 sm:text-xs">
            Detection Verdict
          </p>
        </motion.div>
      </div>

      {/* Row 2 — progress bar with percentage markers */}
      <div className="mt-6 sm:mt-8">
        <div className="progress-shimmer h-2.5 w-full overflow-hidden rounded-full bg-elevated backdrop-blur-sm sm:h-3">
          <motion.div
            className="h-full rounded-full"
            style={{ backgroundImage: styles.gradient }}
            initial={{ width: 0 }}
            animate={{ width: `${animatedPercentage}%` }}
            transition={{ type: "spring", stiffness: 120, damping: 20 }}
          />
        </div>
        <div className="relative mt-1.5 h-3.5 text-[10px] text-text-3">
          <span className="absolute left-0">0%</span>
          <span className="absolute -translate-x-1/2" style={{ left: "35%" }}>
            35%
          </span>
          <span className="absolute -translate-x-1/2" style={{ left: "65%" }}>
            65%
          </span>
          <span className="absolute right-0">100%</span>
        </div>
      </div>

      {children && <div className="mt-5 sm:mt-6">{children}</div>}

      {/* Row 3 — footer: provider attribution (left) / disclaimer (right) */}
      <div className="mt-5 flex flex-col items-center gap-2 border-t border-line pt-4 text-center text-xs text-text-3 sm:mt-6 sm:flex-row sm:items-center sm:justify-between sm:text-left">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-brand" aria-hidden />
          via <span className="font-medium capitalize text-text-2">{provider}</span>
        </span>
        <span className="flex items-center gap-1.5">
          <Info className="h-3 w-3 shrink-0" aria-hidden />
          Detection signal, not proof.
        </span>
      </div>
    </motion.div>
  );
}
