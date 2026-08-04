'use client';

import React from 'react';
import { LucideIcon } from 'lucide-react';
import clsx from 'clsx';

export type InsightType = 'good' | 'warning' | 'bad' | 'info' | 'violet';

export interface InsightCardProps {
  type: InsightType;
  title: string;
  description: string;
  metric?: string;
  icon?: LucideIcon;
}

export const InsightCard: React.FC<InsightCardProps> = ({
  type,
  title,
  description,
  metric,
  icon: Icon,
}) => {
  const getStyles = () => {
    const styles: Record<InsightType, { border: string; bg: string; icon: string; title: string }> = {
      good: {
        border: 'border-emerald-500/40 dark:border-emerald-500/30 border-l-4 border-l-emerald-500',
        bg: 'bg-emerald-50/60 dark:bg-emerald-950/20',
        icon: 'text-emerald-600 dark:text-emerald-400',
        title: 'text-emerald-950 dark:text-emerald-200',
      },
      warning: {
        border: 'border-amber-500/40 dark:border-amber-500/30 border-l-4 border-l-amber-500',
        bg: 'bg-amber-50/60 dark:bg-amber-950/20',
        icon: 'text-amber-600 dark:text-amber-400',
        title: 'text-amber-950 dark:text-amber-200',
      },
      bad: {
        border: 'border-rose-500/40 dark:border-rose-500/30 border-l-4 border-l-rose-500',
        bg: 'bg-rose-50/60 dark:bg-rose-950/20',
        icon: 'text-rose-600 dark:text-rose-400',
        title: 'text-rose-950 dark:text-rose-200',
      },
      info: {
        border: 'border-sky-500/40 dark:border-sky-500/30 border-l-4 border-l-sky-500',
        bg: 'bg-sky-50/60 dark:bg-sky-950/20',
        icon: 'text-sky-600 dark:text-sky-400',
        title: 'text-sky-950 dark:text-sky-200',
      },
      violet: {
        border: 'border-purple-500/40 dark:border-purple-500/30 border-l-4 border-l-purple-500',
        bg: 'bg-purple-50/60 dark:bg-purple-950/20',
        icon: 'text-purple-600 dark:text-purple-400',
        title: 'text-purple-950 dark:text-purple-200',
      },
    };
    return styles[type];
  };

  const styles = getStyles();

  return (
    <div
      className={clsx(
        'rounded-xl p-4 sm:p-5 backdrop-blur-md transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md min-w-0',
        styles.border,
        styles.bg
      )}
    >
      <div className="flex gap-3 sm:gap-4 items-start min-w-0">
        {Icon && (
          <div className={clsx('mt-0.5 shrink-0 p-2 rounded-lg bg-white/60 dark:bg-slate-900/60 shadow-xs', styles.icon)}>
            <Icon className="h-5 w-5" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h3 className={clsx('font-heading font-bold text-sm sm:text-base leading-snug truncate', styles.title)}>
            {title}
          </h3>
          <p className="mt-1 text-xs sm:text-sm text-slate-600 dark:text-slate-300 break-words leading-relaxed">
            {description}
          </p>
          {metric && (
            <div className="mt-2.5 flex items-center gap-2">
              <span className={clsx('font-heading text-base sm:text-lg font-bold card-value-responsive', styles.icon)}>
                {metric}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

InsightCard.displayName = 'InsightCard';
