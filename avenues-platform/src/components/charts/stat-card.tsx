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
  color?: 'teal' | 'blue' | 'green' | 'amber' | 'rose' | 'red' | 'violet' | 'purple' | 'yellow' | 'slate' | 'orange' | 'cyan' | 'emerald';
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
  const getAccentBorder = () => {
    const colors: Record<string, string> = {
      teal: 'border-l-teal-500',
      blue: 'border-l-sky-500',
      green: 'border-l-emerald-500',
      amber: 'border-l-amber-500',
      rose: 'border-l-rose-500',
      red: 'border-l-red-500',
      violet: 'border-l-purple-500',
      purple: 'border-l-purple-500',
      yellow: 'border-l-amber-400',
      slate: 'border-l-slate-400',
      orange: 'border-l-orange-500',
      cyan: 'border-l-cyan-500',
      emerald: 'border-l-emerald-500',
    };
    return colors[color] || colors.teal;
  };

  const getIconBg = () => {
    const colors: Record<string, string> = {
      teal: 'bg-teal-50 text-teal-600 dark:bg-teal-950/40 dark:text-teal-400 border border-teal-200/50 dark:border-teal-800/50',
      blue: 'bg-sky-50 text-sky-600 dark:bg-sky-950/40 dark:text-sky-400 border border-sky-200/50 dark:border-sky-800/50',
      green: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-800/50',
      amber: 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-200/50 dark:border-amber-800/50',
      rose: 'bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400 border border-rose-200/50 dark:border-rose-800/50',
      red: 'bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400 border border-red-200/50 dark:border-red-800/50',
      violet: 'bg-purple-50 text-purple-600 dark:bg-purple-950/40 dark:text-purple-400 border border-purple-200/50 dark:border-purple-800/50',
      purple: 'bg-purple-50 text-purple-600 dark:bg-purple-950/40 dark:text-purple-400 border border-purple-200/50 dark:border-purple-800/50',
      yellow: 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-200/50 dark:border-amber-800/50',
      slate: 'bg-slate-50 text-slate-600 dark:bg-slate-900/40 dark:text-slate-400 border border-slate-200/50 dark:border-slate-800/50',
      orange: 'bg-orange-50 text-orange-600 dark:bg-orange-950/40 dark:text-orange-400 border border-orange-200/50 dark:border-orange-800/50',
      cyan: 'bg-cyan-50 text-cyan-600 dark:bg-cyan-950/40 dark:text-cyan-400 border border-cyan-200/50 dark:border-cyan-800/50',
      emerald: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-800/50',
    };
    return colors[color] || colors.teal;
  };

  const TrendIcon =
    trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;

  const changeBg = trend === 'up'
    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60'
    : trend === 'down'
    ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-400 border border-rose-200 dark:border-rose-800/60'
    : 'bg-slate-100 text-slate-700 dark:bg-slate-800/60 dark:text-slate-400 border border-slate-200 dark:border-slate-700';

  return (
    <div
      className={clsx(
        'rounded-xl border border-slate-200/80 dark:border-slate-800/80',
        'bg-white/80 dark:bg-slate-900/80 backdrop-blur-md',
        'border-l-4',
        getAccentBorder(),
        'p-4 sm:p-5',
        'shadow-sm hover:shadow-lg transition-all duration-200 hover:-translate-y-0.5',
        'flex flex-col min-w-0 min-h-[140px] justify-between overflow-hidden'
      )}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 truncate">
            {title}
          </p>
        </div>
        {Icon && (
          <div className={clsx(
            'rounded-lg p-2 shrink-0 transition-transform hover:scale-105',
            getIconBg()
          )}>
            <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
          </div>
        )}
      </div>

      <div className="my-1 min-w-0">
        {loading ? (
          <div className="h-7 w-28 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
        ) : (
          <h3 className="font-heading font-bold text-xl sm:text-2xl text-slate-900 dark:text-slate-100 tracking-tight card-value-responsive leading-tight">
            {value}
          </h3>
        )}

        {subtitle && (
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 truncate">
            {subtitle}
          </p>
        )}
      </div>

      {change !== undefined && (
        <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800/50 flex items-center justify-between gap-2">
          <div className={clsx(
            'inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold shrink-0',
            changeBg
          )}>
            <TrendIcon className="h-3 w-3 shrink-0" />
            <span>{Math.abs(change)}%</span>
          </div>
          <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500 truncate">vs benchmark</span>
        </div>
      )}
    </div>
  );
};

StatCard.displayName = 'StatCard';
