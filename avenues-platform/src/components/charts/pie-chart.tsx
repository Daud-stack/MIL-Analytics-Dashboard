'use client';

import React from 'react';
import {
  PieChart,
  Pie,
  Cell,
  Legend,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

export interface PieDataItem {
  name: string;
  value: number;
  color: string;
}

export interface PieChartProps {
  data: PieDataItem[];
  height?: number;
  showLegend?: boolean;
  innerRadius?: number;
  formatValue?: (value: number) => string;
}

export const PieChartComponent: React.FC<PieChartProps> = ({
  data,
  height = 300,
  showLegend = true,
  innerRadius,
  formatValue,
}) => {
  const isDonut = innerRadius !== undefined && innerRadius > 0;

  const formatTooltip = (value: string | number) => {
    if (typeof value === 'number') {
      return formatValue ? formatValue(value) : value.toString();
    }
    return String(value ?? '');
  };

  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={isDonut ? innerRadius : 0}
          outerRadius={80}
          paddingAngle={2}
          dataKey="value"
          isAnimationActive={true}
        >
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.color} />
          ))}
        </Pie>
        <Tooltip
          formatter={formatTooltip as never}
          contentStyle={{ backgroundColor: '#fff', border: '1px solid #ccc', borderRadius: '4px' }}
        />
        {showLegend && <Legend />}
      </PieChart>
    </ResponsiveContainer>
  );
};

PieChartComponent.displayName = 'PieChart';
