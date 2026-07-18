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
      badge: "bg-success/10 text-success",
      dot: "bg-success",
      glow: "shadow-success/20",
    };
  }
  if (percentage <= 65) {
    return {
      gradient: "linear-gradient(135deg, #F59E0B, #FBBF24)",
      badge: "bg-warning/10 text-warning",
      dot: "bg-warning",
      glow: "shadow-warning/20",
    };
  }
  return {
    gradient: "linear-gradient(135deg, #EF4444, #F87171)",
    badge: "bg-danger/10 text-danger",
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
        "glass-card w-full rounded-xl p-4 shadow-2xl shadow-black/20 sm:rounded-2xl sm:p-6 md:p-8",
        styles.glow
      )}
    >
      <div className="flex flex-col items-center gap-1 text-center">
        <span
          className="text-4xl font-bold tabular-nums sm:text-5xl md:text-6xl"
          style={{
            backgroundImage: styles.gradient,
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            color: "transparent",
          }}
        >
          {animatedPercentage}%
        </span>
        <span
          className={clsx(
            "mt-1 inline-flex items-center rounded-full px-3 py-1 text-sm font-medium",
            styles.badge
          )}
        >
          {verdict}
        </span>
      </div>

      <div className="mt-5 h-2 w-full overflow-hidden rounded-full bg-elevated sm:mt-6 sm:h-3">
        <motion.div
          className="h-full rounded-full"
          style={{ backgroundImage: styles.gradient }}
          initial={{ width: 0 }}
          animate={{ width: `${animatedPercentage}%` }}
          transition={{ type: "spring", stiffness: 120, damping: 20 }}
        />
      </div>

      <p className="mt-3 flex items-center justify-center gap-1.5 text-center text-xs text-text-3">
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-brand" aria-hidden />
        via <span className="font-medium capitalize text-text-2">{provider}</span>
      </p>

      {children && <div className="mt-5 sm:mt-6">{children}</div>}

      <div className="mt-5 flex items-start gap-2 rounded-lg bg-elevated px-3 py-2.5 text-xs leading-relaxed text-text-3 sm:mt-6">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
        <span>This is a detection signal, not proof. Treat it as one input among several.</span>
      </div>
    </motion.div>
  );
}
