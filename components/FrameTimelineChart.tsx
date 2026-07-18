"use client";

import { useEffect, useState } from "react";
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  type TooltipContentProps,
} from "recharts";
import { useTheme } from "./ThemeProvider";

function useIsNarrowScreen(breakpointPx: number): boolean {
  const [isNarrow, setIsNarrow] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia(`(max-width: ${breakpointPx}px)`).matches : false
  );

  useEffect(() => {
    const query = window.matchMedia(`(max-width: ${breakpointPx}px)`);
    const listener = (e: MediaQueryListEvent) => setIsNarrow(e.matches);
    query.addEventListener("change", listener);
    return () => query.removeEventListener("change", listener);
  }, [breakpointPx]);

  return isNarrow;
}

interface FrameTimelineChartProps {
  /** AI-likelihood percentage (0-100) per sampled frame, in order. */
  scores: number[];
}

interface ChartPoint {
  frame: number;
  score: number;
}

function CustomTooltip({ active, payload }: TooltipContentProps) {
  if (!active || !payload || payload.length === 0) return null;
  const point = payload[0]?.payload as ChartPoint | undefined;
  if (!point) return null;

  return (
    <div className="glass-card rounded-lg px-2 py-1.5 text-xs shadow-lg shadow-black/20 sm:px-3 sm:py-2">
      <p className="font-medium text-text">Frame {point.frame}</p>
      <p className="text-text-2">{point.score}% AI likelihood</p>
    </div>
  );
}

export default function FrameTimelineChart({ scores }: FrameTimelineChartProps) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const isVerySmallScreen = useIsNarrowScreen(360);
  const gridColor = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)";
  const tickColor = isDark ? "#71717A" : "#52525B";
  const lineColor = "#5B8CFF";

  const data: ChartPoint[] = scores.map((score, i) => ({ frame: i + 1, score }));

  return (
    <div className="glass-border rounded-xl bg-elevated p-3 sm:rounded-2xl sm:p-5">
      <p className="mb-2 text-xs font-medium uppercase tracking-widest text-text-3 sm:mb-3 sm:text-sm">
        Per-Frame Analysis
      </p>
      <div className="h-45 w-full sm:h-62.5">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={data}
            margin={{ top: 8, right: 8, bottom: 0, left: isVerySmallScreen ? -20 : -10 }}
          >
            <defs>
              <linearGradient id="frameScoreFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={lineColor} stopOpacity={0.35} />
                <stop offset="95%" stopColor={lineColor} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
            <XAxis dataKey="frame" tick={{ fontSize: 10, fill: tickColor }} tickLine={false} />
            {isVerySmallScreen ? (
              <YAxis domain={[0, 100]} tick={false} tickLine={false} width={8} axisLine={false} />
            ) : (
              <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: tickColor }} tickLine={false} width={36} />
            )}
            <Tooltip content={CustomTooltip} />
            <Area type="monotone" dataKey="score" stroke="none" fill="url(#frameScoreFill)" isAnimationActive />
            <Line
              type="monotone"
              dataKey="score"
              stroke={lineColor}
              strokeWidth={2}
              dot={{ r: 3, fill: lineColor, strokeWidth: 0 }}
              activeDot={{ r: 5 }}
              isAnimationActive
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
