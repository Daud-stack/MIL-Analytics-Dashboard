'use client';

import React from 'react';
import { StatCard, type StatCardProps } from '../charts/stat-card';

export interface KPIGridProps {
  metrics: StatCardProps[];
}

export const KPIGrid: React.FC<KPIGridProps> = ({ metrics }) => {
  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
      {metrics.map((metric, index) => (
        <StatCard key={index} {...metric} />
      ))}
    </div>
  );
};

KPIGrid.displayName = 'KPIGrid';
