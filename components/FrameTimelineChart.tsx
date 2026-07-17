"use client";

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
    <div className="glass-card rounded-lg px-3 py-2 text-xs shadow-lg shadow-black/20">
      <p className="font-medium text-text">Frame {point.frame}</p>
      <p className="text-text-2">{point.score}% AI likelihood</p>
    </div>
  );
}

export default function FrameTimelineChart({ scores }: FrameTimelineChartProps) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const gridColor = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)";
  const tickColor = isDark ? "#71717A" : "#52525B";
  const lineColor = "#5B8CFF";

  const data: ChartPoint[] = scores.map((score, i) => ({ frame: i + 1, score }));

  return (
    <div className="glass-border rounded-2xl bg-elevated p-4 sm:p-5">
      <p className="mb-3 text-xs font-medium uppercase tracking-widest text-text-3">
        Per-Frame Analysis
      </p>
      <div className="h-40 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
            <defs>
              <linearGradient id="frameScoreFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={lineColor} stopOpacity={0.35} />
                <stop offset="95%" stopColor={lineColor} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
            <XAxis dataKey="frame" tick={{ fontSize: 11, fill: tickColor }} tickLine={false} />
            <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: tickColor }} tickLine={false} width={36} />
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
