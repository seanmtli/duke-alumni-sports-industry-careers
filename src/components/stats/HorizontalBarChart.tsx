'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';

interface HorizontalBarChartProps {
  data: { label: string; count: number }[];
  color?: string;
  height?: number;
}

export function HorizontalBarChart({
  data,
  color = '#003087',
  height = 300,
}: HorizontalBarChartProps) {
  const sorted = [...data].sort((a, b) => b.count - a.count);

  return (
    <ResponsiveContainer width="100%" height={Math.max(height, sorted.length * 32)}>
      <BarChart
        data={sorted}
        layout="vertical"
        margin={{ top: 0, right: 16, left: 8, bottom: 0 }}
      >
        <XAxis type="number" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
        <YAxis
          type="category"
          dataKey="label"
          tick={{ fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          width={180}
        />
        <Tooltip
          cursor={{ fill: '#f0f4fd' }}
          contentStyle={{ fontSize: 12, border: '1px solid #e5e7eb', borderRadius: 6 }}
          formatter={(value) => [value ?? 0, 'Alumni']}
        />
        <Bar dataKey="count" radius={[0, 4, 4, 0]}>
          {sorted.map((entry, i) => (
            <Cell key={entry.label} fill={i === 0 ? '#003087' : '#4d79d4'} opacity={1 - i * 0.04} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
