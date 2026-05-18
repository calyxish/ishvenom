'use client';

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

interface Point {
  day: string;
  encounters: number;
  bites: number;
}

// IshVenom design tokens (hardcoded here because Recharts only accepts hex/rgb,
// not Tailwind class names)
const COLORS = {
  border:   '#2E2B3A', // ish-border
  muted:    '#6B6580', // ish-text-muted
  text:     '#F5F3FF', // ish-text
  surface:  '#1A1725', // ish-surface
  accent:   '#7C5AFF', // ish-accent  — encounters (primary metric)
  danger:   '#EF4444', // ish-danger  — bites
};

export function TimeSeries({ data }: { data: Point[] }) {
  const formatted = data.map((d) => ({
    ...d,
    label: new Date(d.day).toLocaleDateString('en-GB', {
      month: 'short',
      day: 'numeric',
    }),
  }));

  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart
        data={formatted}
        margin={{ top: 10, right: 20, left: 0, bottom: 10 }}
      >
        <CartesianGrid stroke={COLORS.border} strokeDasharray="3 3" />
        <XAxis
          dataKey="label"
          stroke={COLORS.muted}
          tick={{ fontSize: 11, fill: COLORS.muted }}
          tickLine={false}
        />
        <YAxis
          stroke={COLORS.muted}
          tick={{ fontSize: 11, fill: COLORS.muted }}
          tickLine={false}
          axisLine={false}
          allowDecimals={false}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: COLORS.surface,
            border: `1px solid ${COLORS.border}`,
            borderRadius: 12,
            fontSize: 12,
          }}
          labelStyle={{ color: COLORS.text }}
          itemStyle={{ color: COLORS.text }}
        />
        <Legend
          wrapperStyle={{ fontSize: 12, paddingTop: 12, color: COLORS.muted }}
          iconType="line"
        />
        <Line
          type="monotone"
          dataKey="encounters"
          stroke={COLORS.accent}
          strokeWidth={2}
          dot={false}
          name="Encounters"
        />
        <Line
          type="monotone"
          dataKey="bites"
          stroke={COLORS.danger}
          strokeWidth={2}
          dot={false}
          name="Bites"
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
