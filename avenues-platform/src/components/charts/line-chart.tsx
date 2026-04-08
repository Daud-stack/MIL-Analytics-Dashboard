'use client';

import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { ChartRecord } from '@/types';

export interface LineConfig {
  key: string;
  color: string;
  name: string;
  dashed?: boolean;
}

export interface LineChartProps {
  data: ChartRecord[];
  xKey: string;
  lines: LineConfig[];
  height?: number;
  showGrid?: boolean;
  showLegend?: boolean;
  formatY?: (value: number) => string;
}

export const LineChartComponent: React.FC<LineChartProps> = ({
  data,
  xKey,
  lines,
  height = 300,
  showGrid = true,
  showLegend = true,
  formatY,
}) => {
  const formatYAxisTick = (value: number) => {
    return formatY ? formatY(value) : value.toString();
  };

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
        {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />}
        <XAxis dataKey={xKey} stroke="#666" />
        <YAxis tickFormatter={formatYAxisTick} stroke="#666" />
        <Tooltip
          formatter={((value: string | number) =>
            typeof value === 'number' && formatY ? formatY(value) : value ?? ''
          ) as never}
          contentStyle={{ backgroundColor: '#fff', border: '1px solid #ccc', borderRadius: '4px' }}
        />
        {showLegend && <Legend />}
        {lines.map((line) => (
          <Line
            key={line.key}
            type="monotone"
            dataKey={line.key}
            stroke={line.color}
            name={line.name}
            strokeWidth={2}
            dot={false}
            strokeDasharray={line.dashed ? '5 5' : undefined}
            isAnimationActive={true}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
};

LineChartComponent.displayName = 'LineChart';
