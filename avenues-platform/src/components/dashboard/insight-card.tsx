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
        border: 'border-green-200',
        bg: 'bg-green-50',
        icon: 'text-green-600',
        title: 'text-green-900',
      },
      warning: {
        border: 'border-yellow-200',
        bg: 'bg-yellow-50',
        icon: 'text-yellow-600',
        title: 'text-yellow-900',
      },
      bad: {
        border: 'border-red-200',
        bg: 'bg-red-50',
        icon: 'text-red-600',
        title: 'text-red-900',
      },
      info: {
        border: 'border-blue-200',
        bg: 'bg-blue-50',
        icon: 'text-blue-600',
        title: 'text-blue-900',
      },
      violet: {
        border: 'border-purple-200',
        bg: 'bg-purple-50',
        icon: 'text-purple-600',
        title: 'text-purple-900',
      },
    };
    return styles[type];
  };

  const styles = getStyles();

  return (
    <div
      className={clsx(
        'rounded-lg border p-6 transition-all hover:shadow-md',
        styles.border,
        styles.bg
      )}
    >
      <div className="flex gap-4">
        {Icon && (
          <div className={clsx('mt-1 flex-shrink-0', styles.icon)}>
            <Icon className="h-6 w-6" />
          </div>
        )}
        <div className="flex-1">
          <h3 className={clsx('font-semibold', styles.title)}>
            {title}
          </h3>
          <p className="mt-1 text-sm text-gray-700">
            {description}
          </p>
          {metric && (
            <div className="mt-3 flex items-center gap-2">
              <span className={clsx('text-lg font-bold', styles.icon)}>
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
