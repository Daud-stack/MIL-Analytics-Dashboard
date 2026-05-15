'use client';

import React from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { ChartRecord } from '@/types';

export interface YKeyConfig {
  key: string;
  color: string;
  name: string;
}

export interface AreaChartProps {
  data: ChartRecord[];
  xKey: string;
  yKeys: YKeyConfig[];
  height?: number;
  showGrid?: boolean;
  showLegend?: boolean;
  formatY?: (value: number) => string;
}

export const AreaChartComponent: React.FC<AreaChartProps> = ({
  data,
  xKey,
  yKeys,
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
      <AreaChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
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
        {yKeys.map((yKey) => (
          <Area
            key={yKey.key}
            type="monotone"
            dataKey={yKey.key}
            stroke={yKey.color}
            fill={yKey.color}
            name={yKey.name}
            fillOpacity={0.3}
            isAnimationActive={true}
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
};

AreaChartComponent.displayName = 'AreaChart';
