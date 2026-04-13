'use client';

import React from 'react';
import { Download, AlertCircle, TrendingUp } from 'lucide-react';
import {
  LineChart, Line, BarChart, Bar, AreaChart, Area,
  PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { StatCard } from '@/components/charts/stat-card';
import { Button } from '@/components/ui/button';
import { ChartTooltipProps } from '@/types';
import { formatCurrency, formatNumber, generateCSV, downloadCSV } from '@/lib/utils';
import { useDashboard } from '@/store';
import { useDrillDown, useDrillDownRecord, useFilteredTotal } from '@/hooks/useDrillDown';
import { useFilterStore } from '@/store/filter';
import Link from 'next/link';

const COLORS = ['#0d9488', '#475569', '#d97706', '#e11d48', '#7c3aed', '#0284c7', '#059669', '#dc2626'];

const CustomTooltip = ({ active, payload, label }: ChartTooltipProps) => {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-lg">
        <p className="text-sm font-medium text-gray-900">{label}</p>
        {payload.map((entry, idx: number) => (
          <p key={idx} style={{ color: entry.color }} className="text-sm">
            {entry.name}: {typeof entry.value === 'number'
              ? String(entry.dataKey).includes('Rev') || String(entry.dataKey).includes('value')
                ? formatCurrency(entry.value)
                : formatNumber(entry.value)
              : entry.value}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export default function RevenuePage() {
  const dashData = useDashboard();
  const { granularity } = useFilterStore();

  // Drill-down on monthly arrays
  const revenue = useDrillDown(dashData?.monthRevenue);
  const revPerPatDay = useDrillDown(dashData?.revPerPatDay);
  const deposits = useDrillDown(dashData?.payments?.deposits);
  const individual = useDrillDown(dashData?.payments?.individual);
  const medAid = useDrillDown(dashData?.payments?.medAid);
  const batched = useDrillDown(dashData?.payments?.batched);
  const admLab = useDrillDown(dashData?.admLab);
  const revLocationDrill = useDrillDownRecord(dashData?.revLocation);

  // Empty state
  if (!dashData) {
    return (
      <div className="space-y-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Revenue Analytics</h1>
            <p className="mt-1 text-sm text-gray-500">Comprehensive financial performance analysis</p>
          </div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-12">
          <div className="flex flex-col items-center justify-center gap-4">
            <AlertCircle className="h-12 w-12 text-gray-400" />
            <div className="text-center">
              <h2 className="text-lg font-semibold text-gray-900">No data loaded yet</h2>
              <p className="mt-2 text-sm text-gray-500">Upload your Management Dashboard CSV to get started.</p>
              <Link href="/upload"><Button className="mt-4">Upload CSV</Button></Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Build chart data from drill-down results
  const revenueChartData = revenue.labels.map((label, i) => ({
    period: label,
    value: revenue.values[i],
  }));

  const revPerPatDayChartData = revPerPatDay.labels.map((label, i) => ({
    period: label,
    value: revPerPatDay.values[i],
  }));

  // Payments: merge all four drill-downs into one chart dataset
  const paymentsChartData = deposits.labels.map((label, i) => ({
    period: label,
    deposits: deposits.values[i],
    individual: individual.values[i],
    medAid: medAid.values[i],
    batched: batched.values[i],
  }));

  // Revenue by location — aggregate per-location drill-downs
  const revLocationSorted = Array.from(revLocationDrill.entries())
    .map(([name, dd]) => ({ name, value: dd.total }))
    .filter(d => d.value > 0)
    .sort((a, b) => b.value - a.value);
  // Top 6 + "Other" bucket to prevent label overcrowding
  const TOP_N = 6;
  const revLocationData = revLocationSorted.length <= TOP_N + 1
    ? revLocationSorted
    : [
        ...revLocationSorted.slice(0, TOP_N),
        { name: 'Other', value: revLocationSorted.slice(TOP_N).reduce((s, d) => s + d.value, 0) },
      ];

  // KPIs
  const totalRevenue = revenue.total;
  const activePoints = revenue.values.filter(v => v > 0).length || 1;
  const periodAvg = totalRevenue / activePoints;
  const totalAdmissions = admLab.total;
  const revenuePerAdmission = totalAdmissions > 0 ? totalRevenue / totalAdmissions : 0;
  const activeRevPD = revPerPatDay.values.filter(v => v > 0).length || 1;
  const avgRevPerPatDay = revPerPatDay.total / activeRevPD;
  const totalPayments = deposits.total + individual.total + medAid.total + batched.total;

  const periodLabel = granularity === 'year' ? 'Annual'
    : granularity === 'quarter' ? 'Quarter'
    : granularity === 'week' ? 'Weekly'
    : granularity === 'day' ? 'Daily'
    : revenue.isFiltered ? 'Period' : 'Monthly';

  const handleExport = () => {
    const exportData = [
      { metric: 'Total Revenue', value: formatCurrency(totalRevenue) },
      { metric: `${periodLabel} Average`, value: formatCurrency(periodAvg) },
      { metric: 'Revenue per Lab Admission', value: formatCurrency(revenuePerAdmission) },
      { metric: 'Avg Revenue per Patient Day', value: formatCurrency(avgRevPerPatDay) },
      { metric: 'Total Payments Received', value: formatCurrency(totalPayments) },
      ...revenueChartData.map((d) => ({
        metric: `Revenue - ${d.period}`,
        value: formatCurrency(d.value),
      })),
    ];
    const csv = generateCSV(exportData);
    downloadCSV(csv, `revenue-export-${new Date().toISOString().split('T')[0]}.csv`);
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Revenue Analytics</h1>
          <p className="mt-1 text-sm text-gray-500">
            {revenue.isFiltered ? `Filtered view · ${revenue.points.length} ${granularity}(s)` : 'Comprehensive financial performance analysis'}
          </p>
        </div>
        <Button onClick={handleExport} variant="outline" size="sm" className="gap-2">
          <Download className="h-4 w-4" />
          Export CSV
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard title="Total Revenue" value={formatCurrency(totalRevenue)} trend="neutral" icon={TrendingUp} color="green" />
        <StatCard title={`${periodLabel} Avg`} value={formatCurrency(periodAvg)} trend="neutral" color="blue" />
        <StatCard title="Revenue/Lab Adm" value={formatCurrency(revenuePerAdmission)} trend="neutral" color="purple" />
        <StatCard title="Avg Rev/Pat Day" value={formatCurrency(avgRevPerPatDay)} trend="neutral" color="amber" />
        <StatCard title="Total Payments" value={formatCurrency(totalPayments)} trend="neutral" color="rose" />
      </div>

      {/* Charts Row 1 */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Revenue Trend */}
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 px-5 py-4">
            <h2 className="text-sm font-semibold text-gray-900">{periodLabel} Revenue</h2>
            <p className="mt-1 text-xs text-gray-500">{revenue.points.length} data point(s)</p>
          </div>
          <div className="px-5 pb-5">
            <ResponsiveContainer width="100%" height={320}>
              <AreaChart data={revenueChartData}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0d9488" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#0d9488" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
                <XAxis dataKey="period" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} interval={granularity === 'day' ? 29 : granularity === 'week' ? 3 : 0} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="value" stroke="#0d9488" strokeWidth={2} fill="url(#colorRevenue)" dot={granularity === 'day' ? false : { fill: '#0d9488', r: 3 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Revenue by Centre Doughnut */}
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 px-5 py-4">
            <h2 className="text-sm font-semibold text-gray-900">Top Centres by Revenue</h2>
            <p className="mt-1 text-xs text-gray-500">Geographic revenue distribution</p>
          </div>
          <div className="px-5 pb-5">
            <div className="flex items-center gap-4" style={{ minHeight: 320 }}>
              {/* Doughnut chart — compact, no labels */}
              <div className="flex-shrink-0" style={{ width: 200, height: 200 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={revLocationData} cx="50%" cy="50%" innerRadius={45} outerRadius={90}
                      fill="#8884d8" dataKey="value" stroke="#fff" strokeWidth={2}>
                      {revLocationData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => formatCurrency(value as number)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              {/* Legend list — clean, readable */}
              <div className="flex-1 min-w-0 space-y-2">
                {revLocationData.map((entry, index) => {
                  const total = revLocationData.reduce((s, d) => s + d.value, 0);
                  const pct = total > 0 ? ((entry.value / total) * 100).toFixed(1) : '0';
                  return (
                    <div key={entry.name} className="flex items-center gap-2 text-xs">
                      <span className="flex-shrink-0 h-3 w-3 rounded-sm" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                      <span className="truncate font-medium text-gray-700 min-w-0">{entry.name}</span>
                      <span className="flex-shrink-0 ml-auto text-gray-500">{pct}%</span>
                      <span className="flex-shrink-0 font-semibold text-gray-900 w-24 text-right">{formatCurrency(entry.value)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Revenue per Patient Day */}
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 px-5 py-4">
            <h2 className="text-sm font-semibold text-gray-900">Revenue per Patient Day</h2>
            <p className="mt-1 text-xs text-gray-500">{periodLabel} efficiency metric</p>
          </div>
          <div className="px-5 pb-5">
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={revPerPatDayChartData}>
                <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
                <XAxis dataKey="period" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} interval={granularity === 'day' ? 29 : granularity === 'week' ? 3 : 0} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Line type="monotone" dataKey="value" stroke="#0284c7" strokeWidth={3} dot={granularity === 'day' ? false : { fill: '#0284c7', r: 4 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Payments Collection */}
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 px-5 py-4">
            <h2 className="text-sm font-semibold text-gray-900">Payments Collection</h2>
            <p className="mt-1 text-xs text-gray-500">Stacked payment sources by {granularity}</p>
          </div>
          <div className="px-5 pb-5">
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={paymentsChartData}>
                <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
                <XAxis dataKey="period" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} interval={granularity === 'day' ? 29 : granularity === 'week' ? 3 : 0} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Bar dataKey="deposits" fill="#0d9488" name="Deposits" stackId="a" radius={[4, 4, 0, 0]} />
                <Bar dataKey="individual" fill="#475569" name="Individual" stackId="a" radius={[4, 4, 0, 0]} />
                <Bar dataKey="medAid" fill="#d97706" name="Med Aid" stackId="a" radius={[4, 4, 0, 0]} />
                <Bar dataKey="batched" fill="#e11d48" name="Batched" stackId="a" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Detail Table */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 px-5 py-4">
          <h2 className="text-sm font-semibold text-gray-900">{periodLabel} Detail</h2>
          <p className="mt-1 text-xs text-gray-500">{revenue.points.length} period(s) · {revenue.isFiltered ? 'Filtered' : 'Full year'}</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-200 bg-gray-50">
              <tr>
                <th className="px-5 py-3 text-left font-semibold text-gray-900">Period</th>
                <th className="px-5 py-3 text-right font-semibold text-gray-900">Revenue</th>
                <th className="px-5 py-3 text-right font-semibold text-gray-900">Rev/Pat Day</th>
                <th className="px-5 py-3 text-right font-semibold text-gray-900">Payments</th>
              </tr>
            </thead>
            <tbody>
              {revenue.points.map((pt, idx) => (
                <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-5 py-3 text-gray-900">{pt.label}</td>
                  <td className="px-5 py-3 text-right text-gray-700 font-medium">{formatCurrency(pt.value)}</td>
                  <td className="px-5 py-3 text-right text-gray-600">{formatCurrency(revPerPatDay.values[idx] || 0)}</td>
                  <td className="px-5 py-3 text-right text-gray-600">{formatCurrency(
                    (deposits.values[idx] || 0) + (individual.values[idx] || 0) +
                    (medAid.values[idx] || 0) + (batched.values[idx] || 0)
                  )}</td>
                </tr>
              ))}
              {/* Totals row */}
              <tr className="bg-gray-50 font-semibold">
                <td className="px-5 py-3 text-gray-900">Total</td>
                <td className="px-5 py-3 text-right text-gray-900">{formatCurrency(revenue.total)}</td>
                <td className="px-5 py-3 text-right text-gray-700">{formatCurrency(revPerPatDay.average)}</td>
                <td className="px-5 py-3 text-right text-gray-700">{formatCurrency(totalPayments)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
