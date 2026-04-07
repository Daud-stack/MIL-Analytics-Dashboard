'use client';

import React from 'react';
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { BarConfig } from './bar-chart';
import { LineConfig } from './line-chart';

export interface ComboChartProps {
  data: any[];
  xKey: string;
  bars?: BarConfig[];
  lines?: LineConfig[];
  height?: number;
  showGrid?: boolean;
  showLegend?: boolean;
  formatY?: (value: number) => string;
}

export const ComboChartComponent: React.FC<ComboChartProps> = ({
  data,
  xKey,
  bars = [],
  lines = [],
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
      <ComposedChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
        {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />}
        <XAxis dataKey={xKey} stroke="#666" />
        <YAxis tickFormatter={formatYAxisTick} stroke="#666" />
        <Tooltip
          formatter={(value: any) => formatY ? formatY(value) : value}
          contentStyle={{ backgroundColor: '#fff', border: '1px solid #ccc', borderRadius: '4px' }}
        />
        {showLegend && <Legend />}

        {bars.map((bar) => (
          <Bar
            key={bar.key}
            dataKey={bar.key}
            fill={bar.color}
            name={bar.name}
            stackId={bar.stackId}
            isAnimationActive={true}
          />
        ))}

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
      </ComposedChart>
    </ResponsiveContainer>
  );
};

ComboChartComponent.displayName = 'ComboChart';
