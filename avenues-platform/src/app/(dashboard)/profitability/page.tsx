'use client';

import React, { useMemo, useState } from 'react';
import { 
  BarChart3, 
  TrendingUp, 
  Search, 
  Target, 
  Zap, 
  Activity, 
  ShieldAlert, 
  BadgePercent,
  Layers,
  Star,
  Skull
} from 'lucide-react';
import { useDashboard, useClaims } from '@/store';
import { analyzeSchemeProfitability, SchemeProfitability } from '@/lib/finance';
import { StatCard } from '@/components/charts/stat-card';
import { formatCurrency, formatNumber } from '@/lib/utils';
import {
  ScatterChart, Scatter,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ZAxis,
  BarChart, Bar, Cell
} from 'recharts';

export default function ProfitabilityPage() {
  const dashData = useDashboard();
  const claimsData = useClaims();
  const [searchTerm, setSearchTerm] = useState('');

  const analysis = useMemo(() => {
    if (!dashData || !claimsData) return [];
    return analyzeSchemeProfitability(dashData, claimsData);
  }, [dashData, claimsData]);

  const filteredAnalysis = useMemo(() => {
    return analysis.filter(s => s.name.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [analysis, searchTerm]);

  // Aggregate stats
  const stats = useMemo(() => {
    if (analysis.length === 0) return null;
    const strategic = analysis.filter(s => s.category === 'Strategic').length;
    const investigate = analysis.filter(s => s.category === 'Investigate').length;
    const avgScore = analysis.reduce((acc, s) => acc + s.score, 0) / analysis.length;
    return { strategic, investigate, avgScore };
  }, [analysis]);

  if (!dashData || !claimsData) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Target className="h-6 w-6 text-indigo-600" />
            Scheme Profitability Analysis
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Efficiency-weighted ranking of medical aid schemes
          </p>
        </div>
      </div>

      {/* KPI Overview */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Strategic Partners" value={String(stats?.strategic || 0)} trend="neutral" color="violet" icon={Star} />
        <StatCard title="Average Efficiency" value={`${stats?.avgScore.toFixed(1)}%`} trend="neutral" color="blue" icon={BadgePercent} />
        <StatCard title="Schemes Under Review" value={String(stats?.investigate || 0)} trend="neutral" color="amber" icon={ShieldAlert} />
        <div className="p-4 rounded-xl border border-indigo-100 bg-indigo-50/30">
          <p className="text-xs font-semibold uppercase tracking-wider text-indigo-700">Top Revenue Generator</p>
          <p className="mt-1 text-xl font-bold text-indigo-900 truncate">
            {analysis[0]?.name || '—'}
          </p>
          <p className="text-[10px] text-indigo-600 font-medium">Efficiency Score: {analysis[0]?.score.toFixed(1)}</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Profitability Scatter Plot */}
        <div className="lg:col-span-2 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-gray-900">Profitability Matrix</h3>
            <p className="text-xs text-gray-500 mt-1">X-Axis: Approval Rate % | Y-Axis: Revenue Volume | Bubble: Efficiency Score</p>
          </div>
          
          <ResponsiveContainer width="100%" height={380}>
            <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis 
                type="number" 
                dataKey="collectionRate" 
                name="Approval Rate" 
                unit="%" 
                domain={[0, 100]}
                tick={{ fontSize: 10 }}
                axisLine={false}
              />
              <YAxis 
                type="number" 
                dataKey="revenue" 
                name="Revenue" 
                tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} 
                tick={{ fontSize: 10 }}
                axisLine={false}
              />
              <ZAxis type="number" dataKey="score" range={[50, 400]} name="Score" />
              <Tooltip cursor={{ strokeDasharray: '3 3' }} />
              <Scatter name="Schemes" data={analysis}>
                {analysis.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={
                      entry.category === 'Strategic' ? '#10b981' : 
                      entry.category === 'Exit' ? '#ef4444' : 
                      entry.category === 'Investigate' ? '#f59e0b' : 
                      '#3b82f6'
                    } 
                  />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </div>

        {/* Legend / Category Breakdown */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm flex flex-col">
          <h3 className="text-sm font-semibold text-gray-900 mb-6">Strategic Categorization</h3>
          <div className="space-y-4">
            <div className="p-3 rounded-lg border border-emerald-100 bg-emerald-50">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-900">Strategic</span>
                <Star className="h-3 w-3 text-emerald-600" />
              </div>
              <p className="text-[10px] text-emerald-700 mt-1">High volume, high approval rate. Prioritize these partners.</p>
            </div>
            <div className="p-3 rounded-lg border border-blue-100 bg-blue-50">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-blue-900">Maintain</span>
                <Activity className="h-3 w-3 text-blue-600" />
              </div>
              <p className="text-[10px] text-blue-700 mt-1">Normal performance. Continue standard business processes.</p>
            </div>
            <div className="p-3 rounded-lg border border-amber-100 bg-amber-50">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-900">Investigate</span>
                <ShieldAlert className="h-3 w-3 text-amber-600" />
              </div>
              <p className="text-[10px] text-amber-700 mt-1">High rejection rates or low speed. Review clinical coding or billing.</p>
            </div>
            <div className="p-3 rounded-lg border border-red-100 bg-red-50">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-red-900">Risk / Exit</span>
                <Skull className="h-3 w-3 text-red-600" />
              </div>
              <p className="text-[10px] text-red-700 mt-1">Unprofitable or high default risk. Consider strict pre-auth or cash upfront.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Scheme Table */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="p-5 border-b border-gray-200 bg-gray-50/50 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900">Scheme Performance Index</h3>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input 
              type="text" 
              placeholder="Filter schemes..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 py-1.5 text-xs rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 outline-none w-64"
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-white border-b border-gray-200">
                <th className="text-left px-6 py-3 font-semibold text-gray-900">Scheme Name</th>
                <th className="text-right px-6 py-3 font-semibold text-gray-900">Billed Revenue</th>
                <th className="text-right px-6 py-3 font-semibold text-gray-900">Approv. Rate</th>
                <th className="text-right px-6 py-3 font-semibold text-gray-900">Rej. Rate</th>
                <th className="text-center px-6 py-3 font-semibold text-gray-900">Efficiency Score</th>
                <th className="text-left px-6 py-3 font-semibold text-gray-900">Category</th>
              </tr>
            </thead>
            <tbody>
              {filteredAnalysis.map((scheme, idx) => (
                <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-3 font-medium text-gray-900">{scheme.name}</td>
                  <td className="px-6 py-3 text-right text-gray-600 font-mono">{formatCurrency(scheme.revenue)}</td>
                  <td className="px-6 py-3 text-right text-gray-600">{scheme.collectionRate.toFixed(1)}%</td>
                  <td className="px-6 py-3 text-right text-red-600">{scheme.rejectionRate.toFixed(1)}%</td>
                  <td className="px-6 py-3 text-center">
                    <div className="inline-flex items-center gap-2">
                      <div className="w-16 bg-gray-100 rounded-full h-1.5">
                        <div 
                          className={`h-full rounded-full ${
                            scheme.score > 75 ? 'bg-emerald-500' : 
                            scheme.score < 40 ? 'bg-red-500' : 
                            'bg-indigo-500'
                          }`}
                          style={{ width: `${scheme.score}%` }}
                        />
                      </div>
                      <span className="text-[11px] font-bold text-gray-700">{scheme.score.toFixed(0)}</span>
                    </div>
                  </td>
                  <td className="px-6 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                      scheme.category === 'Strategic' ? 'bg-emerald-100 text-emerald-700' : 
                      scheme.category === 'Exit' ? 'bg-red-100 text-red-700' : 
                      scheme.category === 'Investigate' ? 'bg-amber-100 text-amber-700' : 
                      'bg-blue-100 text-blue-700'
                    }`}>
                      {scheme.category}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
