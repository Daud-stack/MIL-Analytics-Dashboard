'use client';

import React from 'react';
import { LucideIcon, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import clsx from 'clsx';

export interface StatCardProps {
  title: string;
  value: string;
  change?: number;
  icon?: LucideIcon;
  trend?: 'up' | 'down' | 'neutral';
  color?: 'teal' | 'blue' | 'green' | 'amber' | 'rose' | 'red' | 'violet' | 'purple' | 'yellow';
  subtitle?: string;
  loading?: boolean;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  change,
  icon: Icon,
  trend = 'neutral',
  color = 'teal',
  subtitle,
  loading = false,
}) => {
  const getTrendColor = () => {
    if (trend === 'up') return 'text-green-600 dark:text-green-400';
    if (trend === 'down') return 'text-red-600 dark:text-red-400';
    return 'text-slate-600 dark:text-slate-400';
  };

  const getAccentColor = () => {
    const colors: Record<string, string> = {
      teal: 'border-l-teal-600',
      blue: 'border-l-blue-600',
      green: 'border-l-green-600',
      amber: 'border-l-amber-600',
      rose: 'border-l-rose-600',
      red: 'border-l-red-600',
      violet: 'border-l-violet-600',
      purple: 'border-l-purple-600',
      yellow: 'border-l-yellow-600',
    };
    return colors[color] || colors.teal;
  };

  const getIconBg = () => {
    const colors: Record<string, string> = {
      teal: 'bg-teal-50 text-teal-600 dark:bg-teal-900/20 dark:text-teal-400',
      blue: 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400',
      green: 'bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400',
      amber: 'bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400',
      rose: 'bg-rose-50 text-rose-600 dark:bg-rose-900/20 dark:text-rose-400',
      red: 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400',
      violet: 'bg-violet-50 text-violet-600 dark:bg-violet-900/20 dark:text-violet-400',
      purple: 'bg-purple-50 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400',
      yellow: 'bg-yellow-50 text-yellow-600 dark:bg-yellow-900/20 dark:text-yellow-400',
    };
    return colors[color] || colors.teal;
  };

  const TrendIcon =
    trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;

  const changeBg = trend === 'up'
    ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400'
    : trend === 'down'
    ? 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400'
    : 'bg-slate-50 text-slate-700 dark:bg-slate-900/20 dark:text-slate-400';

  return (
    <div
      className={clsx(
        'rounded-xl border border-slate-200 dark:border-slate-700',
        'bg-white dark:bg-slate-900',
        'border-l-4',
        getAccentColor(),
        'p-5',
        'shadow-sm hover:shadow-md transition-shadow',
        'flex flex-col'
      )}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">
            {title}
          </p>
        </div>
        {Icon && (
          <div className={clsx(
            'rounded-lg p-2 ml-2 flex-shrink-0',
            getIconBg()
          )}>
            <Icon className="h-5 w-5" />
          </div>
        )}
      </div>

      {loading ? (
        <div className="h-8 w-32 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
      ) : (
        <p className="text-2xl font-semibold text-slate-900 dark:text-white mb-2">
          {value}
        </p>
      )}

      {subtitle && (
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
          {subtitle}
        </p>
      )}

      {change !== undefined && (
        <div className="mt-auto flex items-center gap-2">
          <div className={clsx(
            'inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium',
            changeBg
          )}>
            <TrendIcon className="h-3 w-3" />
            <span>{Math.abs(change)}%</span>
          </div>
          <span className="text-xs text-slate-500 dark:text-slate-400">YoY</span>
        </div>
      )}
    </div>
  );
};

StatCard.displayName = 'StatCard';
