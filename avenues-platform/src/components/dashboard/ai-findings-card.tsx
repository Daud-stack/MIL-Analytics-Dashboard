'use client';

import React, { useMemo } from 'react';
import { Sparkles, AlertTriangle, TrendingUp, ArrowUpRight, ArrowDownRight, Info } from 'lucide-react';
import { generateAIInsights, IntelligenceFinding } from '@/lib/intelligence';
import { useDashboard } from '@/store';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

interface AIFindingsCardProps {
  /** Static findings to display instead of the auto-generated store insights. */
  findings?: string[];
  /** Visual tone for static findings. */
  type?: 'positive' | 'neutral' | 'anomaly';
}

export function AIFindingsCard({ findings: staticFindings, type = 'neutral' }: AIFindingsCardProps) {
  const dashData = useDashboard();

  const findings = useMemo<IntelligenceFinding[]>(() => {
    if (staticFindings && staticFindings.length > 0) {
      return staticFindings.map((text, i) => ({
        id: `static-${i}`,
        type: type === 'neutral' ? 'trend' : type,
        severity: 'low',
        title: text.split('.')[0],
        description: text,
        metric: 'Insight',
        value: '',
      }));
    }
    return generateAIInsights(dashData);
  }, [dashData, staticFindings, type]);

  if ((!dashData && !staticFindings) || findings.length === 0) return null;

  return (
    <div className="rounded-xl border border-teal-100 bg-gradient-to-br from-white to-teal-50/30 shadow-sm overflow-hidden">
      <div className="border-b border-teal-100 px-5 py-3 flex items-center justify-between bg-white">
        <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-teal-600" />
          Top AI Intelligence Findings
          <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-teal-100 text-teal-700 ml-2">
            Beta
          </span>
        </h2>
        <Link href="/anomalies">
          <Button variant="ghost" size="sm" className="text-xs h-7 text-teal-700 hover:text-teal-800 hover:bg-teal-100">
            View All Insights
          </Button>
        </Link>
      </div>
      
      <div className="p-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {findings.slice(0, 3).map((finding) => (
          <div 
            key={finding.id} 
            className="flex flex-col p-3 rounded-lg border border-teal-200/50 bg-white/60 hover:shadow-md transition-all group"
          >
            <div className="flex items-start justify-between mb-2">
              <div className={`p-1.5 rounded-md ${
                finding.type === 'anomaly' ? 'bg-amber-100 text-amber-700' :
                finding.type === 'positive' ? 'bg-green-100 text-green-700' :
                'bg-blue-100 text-blue-700'
              }`}>
                {finding.type === 'anomaly' ? <AlertTriangle className="h-4 w-4" /> :
                 finding.type === 'positive' ? <ArrowUpRight className="h-4 w-4" /> :
                 <TrendingUp className="h-4 w-4" />}
              </div>
              {finding.change !== undefined && (
                <span className={`text-[10px] font-bold ${finding.change > 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {finding.change > 0 ? '+' : ''}{finding.change.toFixed(0)}%
                </span>
              )}
            </div>
            
            <h3 className="text-xs font-bold text-gray-900 line-clamp-1">{finding.title}</h3>
            <p className="mt-1 text-[11px] text-gray-500 line-clamp-2 leading-relaxed">
              {finding.description}
            </p>
            
            <div className="mt-auto pt-3 flex items-center justify-between border-t border-gray-100 mt-3">
              <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">
                {finding.metric}
              </span>
              {finding.link && (
                <Link href={finding.link} className="text-[10px] font-semibold text-teal-600 hover:underline">
                  Analyze →
                </Link>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
