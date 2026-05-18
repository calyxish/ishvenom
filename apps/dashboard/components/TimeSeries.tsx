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
import { useThemeTokens } from '@/lib/useThemeTokens';

interface Point {
  day: string;
  encounters: number;
  bites: number;
}

export function TimeSeries({ data }: { data: Point[] }) {
  // Read live theme colors so the chart re-renders correctly when the user
  // flips between light and dark mode. Recharts only accepts hex/rgb in JS,
  // not Tailwind class names, so we can't use `text-ish-*` classes here.
  const t = useThemeTokens();

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
        <CartesianGrid stroke={t.border} strokeDasharray="3 3" />
        <XAxis
          dataKey="label"
          stroke={t.textMuted}
          tick={{ fontSize: 11, fill: t.textMuted }}
          tickLine={false}
        />
        <YAxis
          stroke={t.textMuted}
          tick={{ fontSize: 11, fill: t.textMuted }}
          tickLine={false}
          axisLine={false}
          allowDecimals={false}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: t.surface,
            border: `1px solid ${t.border}`,
            borderRadius: 12,
            fontSize: 12,
            color: t.text,
          }}
          labelStyle={{ color: t.text }}
          itemStyle={{ color: t.text }}
        />
        <Legend
          wrapperStyle={{ fontSize: 12, paddingTop: 12, color: t.textSecondary }}
          iconType="line"
        />
        <Line
          type="monotone"
          dataKey="encounters"
          stroke={t.accent}
          strokeWidth={2}
          dot={false}
          name="Encounters"
        />
        <Line
          type="monotone"
          dataKey="bites"
          stroke={t.danger}
          strokeWidth={2}
          dot={false}
          name="Bites"
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
