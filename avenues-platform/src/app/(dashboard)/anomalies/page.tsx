'use client';

import React, { useMemo } from 'react';
import { Zap, AlertTriangle, TrendingUp, TrendingDown, Info, Activity, ShieldAlert, ArrowRight } from 'lucide-react';
import { useDashboard } from '@/store';
import { generateAIInsights, IntelligenceFinding } from '@/lib/intelligence';
import { StatCard } from '@/components/charts/stat-card';
import { formatCurrency, formatNumber } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceArea, AreaChart, Area
} from 'recharts';

export default function AnomaliesPage() {
  const dashData = useDashboard();
  
  const findings = useMemo(() => {
    return generateAIInsights(dashData);
  }, [dashData]);

  const anomalyStats = useMemo(() => {
    const high = findings.filter(f => f.severity === 'high').length;
    const med = findings.filter(f => f.severity === 'medium').length;
    const anomalies = findings.filter(f => f.type === 'anomaly').length;
    return { high, med, anomalies };
  }, [findings]);

  // Prepare a multi-line chart for anomaly visualization (Revenue)
  const chartData = useMemo(() => {
    if (!dashData?.monthRevenue) return [];
    
    // Calculate mean and std for shading "Normal" range
    const data = dashData.monthRevenue;
    const n = data.length;
    const mean = data.reduce((a, b) => a + b, 0) / n;
    const std = Math.sqrt(data.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / n) || 1;
    
    return data.map((val, i) => ({
      name: `M${i+1}`,
      value: val,
      lowerBound: mean - 2 * std,
      upperBound: mean + 2 * std,
      isAnomaly: Math.abs((val - mean) / std) > 2
    }));
  }, [dashData]);

  if (!dashData) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Zap className="h-6 w-6 text-blue-600" />
            Anomaly Pulse
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Real-time statistical monitoring for operational outliers
          </p>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard title="Total Findings" value={String(findings.length)} trend="neutral" color="blue" />
        <StatCard title="Critical (High)" value={String(anomalyStats.high)} trend="neutral" color="rose" />
        <StatCard title="Statistical Anomalies" value={String(anomalyStats.anomalies)} trend="neutral" color="amber" />
        <div className="p-4 rounded-xl border border-teal-100 bg-teal-50">
          <p className="text-xs font-semibold text-teal-700 uppercase tracking-wider">Confidence Interval</p>
          <p className="mt-1 text-2xl font-bold text-teal-900">95% (2σ)</p>
          <p className="text-[10px] text-teal-600 font-medium">Standard outlier threshold</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Anomaly Visualizer */}
        <div className="lg:col-span-2 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-gray-900">Statistical Variance Monitor: Revenue</h3>
            <p className="text-xs text-gray-500 mt-1">Shaded area represents the 2-Sigma confidence interval (normal range)</p>
          </div>
          
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="colorNormal" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#94a3b8" stopOpacity={0.1} />
                  <stop offset="95%" stopColor="#94a3b8" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} axisLine={false} />
              <YAxis tick={{ fontSize: 10 }} axisLine={false} tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} />
              <Tooltip />
              
              {/* Normal Range Area */}
              <Area 
                type="monotone" 
                dataKey="upperBound" 
                stroke="transparent" 
                fill="#f1f5f9" 
                activeDot={false}
              />
              <Area 
                type="monotone" 
                dataKey="lowerBound" 
                stroke="transparent" 
                fill="#ffffff" 
                activeDot={false}
              />

              <Line 
                type="monotone" 
                dataKey="value" 
                stroke="#0d9488" 
                strokeWidth={2} 
                dot={(props) => {
                  const { cx, cy, payload } = props;
                  if (payload.isAnomaly) {
                    return <circle cx={cx} cy={cy} r={6} fill="#ef4444" stroke="#fff" strokeWidth={2} />;
                  }
                  return <circle cx={cx} cy={cy} r={4} fill="#0d9488" />;
                }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Findings Timeline/List */}
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm flex flex-col">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900">Intelligence Feed</h3>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-bold uppercase">
              Auto-Scan
            </span>
          </div>
          <div className="flex-1 overflow-y-auto max-h-[400px]">
            {findings.length === 0 ? (
              <div className="p-8 text-center">
                <ShieldAlert className="h-8 w-8 text-gray-200 mx-auto mb-2" />
                <p className="text-sm text-gray-400">No anomalies detected in current period.</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {findings.map((f) => (
                  <div key={f.id} className="p-4 hover:bg-gray-50 transition-colors group">
                    <div className="flex items-start gap-3">
                      <div className={`mt-0.5 p-1.5 rounded-md ${
                        f.severity === 'high' ? 'bg-red-50 text-red-600' :
                        f.severity === 'medium' ? 'bg-amber-50 text-amber-600' :
                        'bg-blue-50 text-blue-600'
                      }`}>
                        {f.type === 'anomaly' ? <Zap className="h-3.5 w-3.5" /> : <TrendingUp className="h-3.5 w-3.5" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-gray-900 line-clamp-1">{f.title}</p>
                        <p className="mt-0.5 text-[11px] text-gray-500 line-clamp-2 leading-relaxed">
                          {f.description}
                        </p>
                        <div className="mt-2 flex items-center justify-between">
                          <span className="text-[10px] font-medium text-gray-400 uppercase">
                            {f.metric}
                          </span>
                          {f.link && (
                            <Link href={f.link} className="text-[10px] font-bold text-blue-600 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              Drill Down <ArrowRight className="h-2.5 w-2.5" />
                            </Link>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="p-3 bg-slate-50 border-t border-gray-100 text-center">
            <p className="text-[10px] text-slate-400">
              Analysis based on standard deviation and linear trend residuals.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
