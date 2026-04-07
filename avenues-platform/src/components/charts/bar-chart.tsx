'use client';

import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { ChartRecord, ChartPrimitive } from '@/types';

export interface BarConfig {
  key: string;
  color: string;
  name: string;
  stackId?: string;
}

export interface BarChartProps {
  data: ChartRecord[];
  xKey: string;
  bars: BarConfig[];
  height?: number;
  showGrid?: boolean;
  showLegend?: boolean;
  formatY?: (value: number) => string;
  layout?: 'vertical' | 'horizontal';
}

export const BarChartComponent: React.FC<BarChartProps> = ({
  data,
  xKey,
  bars,
  height = 300,
  showGrid = true,
  showLegend = true,
  formatY,
  layout = 'vertical',
}) => {
  const formatYAxisTick = (value: number) => {
    return formatY ? formatY(value) : value.toString();
  };

  const isVertical = layout === 'vertical';

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={data}
        layout={isVertical ? 'vertical' : 'horizontal'}
        margin={{ top: 20, right: 30, left: 0, bottom: 0 }}
      >
        {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />}
        {isVertical ? (
          <>
            <XAxis type="category" dataKey={xKey} stroke="#666" />
            <YAxis type="number" tickFormatter={formatYAxisTick} stroke="#666" />
          </>
        ) : (
          <>
            <XAxis type="number" tickFormatter={formatYAxisTick} stroke="#666" />
            <YAxis type="category" dataKey={xKey} stroke="#666" width={80} />
          </>
        )}
        <Tooltip
          formatter={(value: ChartPrimitive) =>
            typeof value === 'number' && formatY ? formatY(value) : value ?? ''
          }
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
      </BarChart>
    </ResponsiveContainer>
  );
};

BarChartComponent.displayName = 'BarChart';
