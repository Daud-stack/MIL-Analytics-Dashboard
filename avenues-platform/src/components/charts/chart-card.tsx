'use client';

import React from 'react';

export interface ChartCardProps {
  title: string;
  description?: string;
  children: React.ReactNode;
  loading?: boolean;
  action?: React.ReactNode;
  className?: string;
}

export const ChartCard: React.FC<ChartCardProps> = ({
  title,
  description,
  children,
  loading = false,
  action,
  className = '',
}) => {
  return (
    <div
      className={`rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm ${className}`}
    >
      {/* Header */}
      <div className="flex items-start justify-between border-b border-slate-200 dark:border-slate-700 px-5 py-4">
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-semibold text-slate-900 dark:text-white">
            {title}
          </h3>
          {description && (
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {description}
            </p>
          )}
        </div>
        {action && (
          <div className="ml-4 flex-shrink-0">
            {action}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4">
        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <div className="text-center text-slate-500 dark:text-slate-400">
              <div className="mb-2 inline-block h-8 w-8 animate-spin rounded-full border-4 border-slate-200 dark:border-slate-700 border-t-teal-600" />
              <p className="text-sm">Loading chart...</p>
            </div>
          </div>
        ) : (
          <div>
            {children}
          </div>
        )}
      </div>
    </div>
  );
};

ChartCard.displayName = 'ChartCard';
