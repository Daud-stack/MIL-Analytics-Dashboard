'use client';

import React from 'react';
import { Download, AlertCircle } from 'lucide-react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
} from 'recharts';
import { StatCard } from '@/components/charts/stat-card';
import { Button } from '@/components/ui/button';
import { ChartTooltipProps } from '@/types';
import { formatCurrency, formatNumber, generateCSV, downloadCSV } from '@/lib/utils';
import { useDashboard } from '@/store';
import { useDrillDown } from '@/hooks/useDrillDown';
import { useFilterStore } from '@/store/filter';
import Link from 'next/link';

const CustomTooltip = ({ active, payload, label }: ChartTooltipProps) => {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-lg">
        <p className="text-sm font-medium text-gray-900">{label}</p>
        {payload.map((entry, idx: number) => (
          <p key={idx} style={{ color: entry.color }} className="text-sm">
            {entry.name}: {typeof entry.value === 'number'
              ? String(entry.dataKey).includes('utilization') || String(entry.dataKey).includes('target')
                ? entry.value.toFixed(1)
                : String(entry.dataKey).includes('revenue') || String(entry.dataKey).includes('Rev')
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

export default function TheatrePage() {
  const dashData = useDashboard();
  const { granularity } = useFilterStore();

  // Drill-down on monthly arrays
  const casesDrill = useDrillDown(dashData?.theatreCases);
  const minutesDrill = useDrillDown(dashData?.theatreMinutes);
  const utilDrill = useDrillDown(dashData?.theatreUtil);
  const theatreRevenueSeries = React.useMemo(() => {
    if (!dashData?.rawColumns) return undefined;
    const entry = Object.entries(dashData.rawColumns).find(([name]) => {
      const normalized = name.toLowerCase();
      return normalized.includes('theatre') && (normalized.includes('revenue') || normalized.includes('rev'));
    });
    return entry?.[1];
  }, [dashData]);
  const revDrill = useDrillDown(theatreRevenueSeries);
  const hasTheatreRevenue = !!theatreRevenueSeries?.some((value) => value > 0);

  // Empty state
  if (!dashData) {
    return (
      <div className="space-y-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Theatre/OR Performance</h1>
            <p className="mt-1 text-sm text-gray-500">Surgical cases, utilization, and revenue analytics</p>
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

  // KPI Calculations
  const totalCases = casesDrill.total;
  const activePoints = casesDrill.values.filter(v => v > 0).length || 1;
  const avgCasesPerPeriod = totalCases / activePoints;
  const totalRevenue = hasTheatreRevenue ? revDrill.total : 0;
  const revenuePerCase = totalCases > 0 ? totalRevenue / totalCases : 0;
  const activeUtil = utilDrill.values.filter(v => v > 0).length || 1;
  const avgUtilization = utilDrill.total / activeUtil;

  // Chart data
  const monthlyData = casesDrill.labels.map((label, i) => ({
    period: label,
    cases: casesDrill.values[i],
    utilization: utilDrill.values[i],
    revenue: hasTheatreRevenue ? revDrill.values[i] : 0,
  }));

  const revenuePerCaseData = casesDrill.labels.map((label, i) => ({
    period: label,
    revenue: hasTheatreRevenue && casesDrill.values[i] > 0 ? revDrill.values[i] / casesDrill.values[i] : 0,
  }));

  const minutesPerCaseData = casesDrill.labels.map((label, i) => ({
    period: label,
    avgMinutes: casesDrill.values[i] > 0 ? minutesDrill.values[i] / casesDrill.values[i] : 0,
  }));

  const utilizationData = casesDrill.labels.map((label, i) => {
    const util = utilDrill.values[i];
    return {
      period: label,
      utilization: util,
      target: 75,
      fill: util > 75 ? '#059669' : util > 50 ? '#d97706' : '#dc2626',
    };
  });

  const periodLabel = granularity === 'year' ? 'Annual'
    : granularity === 'quarter' ? 'Quarter'
    : granularity === 'week' ? 'Weekly'
    : granularity === 'day' ? 'Daily'
    : casesDrill.isFiltered ? 'Period' : 'Monthly';

  const handleExport = () => {
    const exportData = [
      { metric: 'Total Cases', value: formatNumber(totalCases) },
      { metric: `${periodLabel} Average`, value: formatNumber(Math.round(avgCasesPerPeriod)) },
      { metric: 'Theatre Revenue', value: hasTheatreRevenue ? formatCurrency(totalRevenue) : 'Not available' },
      { metric: 'Revenue/Case', value: hasTheatreRevenue ? formatCurrency(revenuePerCase) : 'Not available' },
      { metric: 'Avg Utilization %', value: avgUtilization.toFixed(1) },
      ...casesDrill.points.map((pt, idx) => ({
        metric: `${pt.label} - Cases`,
        value: formatNumber(pt.value),
      })),
    ];

    const csv = generateCSV(exportData);
    downloadCSV(csv, `theatre-${new Date().toISOString().split('T')[0]}.csv`);
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Theatre/OR Performance</h1>
          <p className="mt-1 text-sm text-gray-500">
            {casesDrill.isFiltered ? `Filtered view · ${casesDrill.points.length} ${granularity}(s)` : 'Surgical cases, utilization, and revenue analytics'}
          </p>
          {!hasTheatreRevenue && <p className="mt-2 text-xs text-amber-600 flex items-center gap-1">
            <AlertCircle className="h-3 w-3" />
            Theatre revenue is unavailable because no theatre-specific revenue column was detected.
          </p>}
        </div>
        <Button onClick={handleExport} variant="outline" size="sm" className="gap-2">
          <Download className="h-4 w-4" />
          Export CSV
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard
          title="Total Cases"
          value={formatNumber(totalCases)}
          trend="neutral"
          color="teal"
        />
        <StatCard
          title={`${periodLabel} Avg`}
          value={formatNumber(Math.round(avgCasesPerPeriod))}
          trend="neutral"
          color="blue"
        />
        <StatCard
          title="Theatre Revenue"
          value={hasTheatreRevenue ? formatCurrency(totalRevenue) : 'N/A'}
          trend="neutral"
          color="green"
        />
        <StatCard
          title="Revenue/Case"
          value={hasTheatreRevenue ? formatCurrency(revenuePerCase) : 'N/A'}
          trend="neutral"
          color="amber"
        />
        <StatCard
          title="Utilization %"
          value={`${avgUtilization.toFixed(1)}%`}
          trend="neutral"
          color="violet"
        />
      </div>

      {/* Charts Row 1 */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Surgical Cases Bar */}
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 px-5 py-4">
            <h2 className="text-sm font-semibold text-gray-900">{periodLabel} Surgical Cases</h2>
            <p className="mt-1 text-xs text-gray-500">{casesDrill.points.length} data point(s)</p>
          </div>
          <div className="px-5 pb-5">
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={monthlyData}>
                <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
                <XAxis dataKey="period" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} interval={granularity === 'day' ? 29 : granularity === 'week' ? 3 : 0} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="cases" fill="#0d9488" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Utilization % with Target */}
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 px-5 py-4">
            <h2 className="text-sm font-semibold text-gray-900">Utilization %</h2>
            <p className="mt-1 text-xs text-gray-500">Target 75% (Green: {'>'}75%, Amber: 50-75%, Red: {'<'}50%)</p>
          </div>
          <div className="px-5 pb-5">
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={utilizationData}>
                <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
                <XAxis dataKey="period" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} interval={granularity === 'day' ? 29 : granularity === 'week' ? 3 : 0} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <ReferenceLine
                  y={75}
                  stroke="#cbd5e1"
                  strokeDasharray="3 3"
                  label={{ value: '75% Target', position: 'right', fill: '#94a3b8' }}
                />
                <Bar dataKey="utilization" radius={[4, 4, 0, 0]}>
                  {utilizationData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Revenue per Case Trend */}
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 px-5 py-4">
            <h2 className="text-sm font-semibold text-gray-900">Revenue per Case Trend</h2>
            <p className="mt-1 text-xs text-gray-500">{periodLabel.toLowerCase()} average revenue per surgical case</p>
          </div>
          <div className="px-5 pb-5">
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={revenuePerCaseData}>
                <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
                <XAxis dataKey="period" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} interval={granularity === 'day' ? 29 : granularity === 'week' ? 3 : 0} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Line type="monotone" dataKey="revenue" stroke="#0284c7" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Average Minutes per Case */}
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 px-5 py-4">
            <h2 className="text-sm font-semibold text-gray-900">Average Minutes per Case</h2>
            <p className="mt-1 text-xs text-gray-500">Case duration efficiency trend</p>
          </div>
          <div className="px-5 pb-5">
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={minutesPerCaseData}>
                <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
                <XAxis dataKey="period" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} interval={granularity === 'day' ? 29 : granularity === 'week' ? 3 : 0} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="avgMinutes" fill="#d97706" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Detail Table */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 px-5 py-4">
          <h2 className="text-sm font-semibold text-gray-900">{periodLabel} Detail</h2>
          <p className="mt-1 text-xs text-gray-500">{casesDrill.points.length} period(s) · {casesDrill.isFiltered ? 'Filtered' : 'Full year'}</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-200 bg-gray-50">
              <tr>
                <th className="px-5 py-3 text-left font-semibold text-gray-900">Period</th>
                <th className="px-5 py-3 text-right font-semibold text-gray-900">Cases</th>
                <th className="px-5 py-3 text-right font-semibold text-gray-900">Total Minutes</th>
                <th className="px-5 py-3 text-right font-semibold text-gray-900">Revenue</th>
                <th className="px-5 py-3 text-right font-semibold text-gray-900">Rev/Case</th>
                <th className="px-5 py-3 text-right font-semibold text-gray-900">Utilization %</th>
              </tr>
            </thead>
            <tbody>
              {casesDrill.points.map((pt, idx) => (
                <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-5 py-3 text-gray-900">{pt.label}</td>
                  <td className="px-5 py-3 text-right text-gray-700 font-medium">{formatNumber(pt.value)}</td>
                  <td className="px-5 py-3 text-right text-gray-600">{formatNumber(minutesDrill.values[idx] || 0)}</td>
                  <td className="px-5 py-3 text-right text-gray-600">{hasTheatreRevenue ? formatCurrency(revDrill.values[idx] || 0) : 'N/A'}</td>
                  <td className="px-5 py-3 text-right text-gray-700 font-medium">
                    {hasTheatreRevenue && pt.value > 0 ? formatCurrency((revDrill.values[idx] || 0) / pt.value) : 'N/A'}
                  </td>
                  <td className="px-5 py-3 text-right text-gray-600">{(utilDrill.values[idx] || 0).toFixed(1)}%</td>
                </tr>
              ))}
              {/* Totals row */}
              <tr className="bg-gray-50 font-semibold">
                <td className="px-5 py-3 text-gray-900">Total</td>
                <td className="px-5 py-3 text-right text-gray-900">{formatNumber(totalCases)}</td>
                <td className="px-5 py-3 text-right text-gray-700">{formatNumber(minutesDrill.total)}</td>
                <td className="px-5 py-3 text-right text-gray-700">{hasTheatreRevenue ? formatCurrency(totalRevenue) : 'N/A'}</td>
                <td className="px-5 py-3 text-right text-gray-900">{hasTheatreRevenue ? formatCurrency(revenuePerCase) : 'N/A'}</td>
                <td className="px-5 py-3 text-right text-gray-700">{avgUtilization.toFixed(1)}%</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
