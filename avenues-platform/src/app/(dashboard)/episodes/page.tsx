'use client';

import React from 'react';
import { Download, AlertCircle, TrendingUp } from 'lucide-react';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { StatCard } from '@/components/charts/stat-card';
import { Button } from '@/components/ui/button';
import { ChartTooltipProps, MONTHS, CHART_COLORS as COLORS } from '@/types';
import { formatCurrency, formatNumber, generateCSV, downloadCSV } from '@/lib/utils';
import { useDashboard } from '@/store';
import Link from 'next/link';

const CustomTooltip = ({ active, payload, label }: ChartTooltipProps) => {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-lg">
        <p className="text-sm font-medium text-gray-900">{label}</p>
        {payload.map((entry, idx: number) => (
          <p key={idx} style={{ color: entry.color }} className="text-sm">
            {entry.name}: {typeof entry.value === 'number'
              ? String(entry.dataKey).includes('Revenue')
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

export default function EpisodesPage() {
  const dashData = useDashboard();

  // Empty state if no data loaded
  if (!dashData) {
    return (
      <div className="space-y-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Episode Analytics</h1>
            <p className="mt-1 text-sm text-gray-500">Episodes and clinical performance analysis</p>
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-12">
          <div className="flex flex-col items-center justify-center gap-4">
            <AlertCircle className="h-12 w-12 text-gray-400" />
            <div className="text-center">
              <h2 className="text-lg font-semibold text-gray-900">No data loaded yet</h2>
              <p className="mt-2 text-sm text-gray-500">Upload your Management Dashboard CSV to get started.</p>
              <Link href="/upload">
                <Button className="mt-4">Upload CSV</Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Chart data preparation
  const episodesByMonthData = MONTHS.map((month, idx) => ({
    month: month.substring(0, 3),
    value: dashData.epsFinalised[idx],
  }));

  const revenueByMonthData = MONTHS.map((month, idx) => ({
    month: month.substring(0, 3),
    value: dashData.monthRevenue[idx],
  }));

  // Episodes finalized vs not finalized
  const finalizationData = MONTHS.map((month, idx) => ({
    month: month.substring(0, 3),
    finalised: dashData.epsFinalised[idx],
    notFinalised: dashData.dischNotFinalised[idx],
  }));

  // Revenue per episode trend
  const revPerEpisodeData = MONTHS.map((month, idx) => ({
    month: month.substring(0, 3),
    value: dashData.epsFinalised[idx] > 0 ? dashData.monthRevenue[idx] / dashData.epsFinalised[idx] : 0,
  }));

  // Calculations
  // "Discharges Not Finalised" is a cumulative running total — use the latest month only
  const totalEpisodesFinalised = dashData.epsFinalised.reduce((a, b) => a + b, 0);
  const latestNotFinalised = dashData.dischNotFinalised.reduce((max, v) => Math.max(max, v), 0);
  const totalEpisodes = totalEpisodesFinalised + latestNotFinalised;
  const finalisationRate = totalEpisodes > 0 ? (totalEpisodesFinalised / totalEpisodes) * 100 : 0;
  const totalRevenue = dashData.monthRevenue.reduce((a, b) => a + b, 0);
  const avgRevenuePerEpisode = totalEpisodesFinalised > 0 ? totalRevenue / totalEpisodesFinalised : 0;
  const activeEpMonths = dashData.epsFinalised.filter(v => v > 0).length || 1;
  const avgMonthlyEpisodes = totalEpisodesFinalised / activeEpMonths;

  const handleExport = () => {
    const exportData = [
      { metric: 'Total Episodes Finalised', value: formatNumber(totalEpisodesFinalised) },
      { metric: 'Episodes Not Finalised', value: formatNumber(latestNotFinalised) },
      { metric: 'Finalisation Rate %', value: finalisationRate.toFixed(1) },
      { metric: 'Total Revenue', value: formatCurrency(totalRevenue) },
      { metric: 'Avg Revenue per Episode', value: formatCurrency(avgRevenuePerEpisode) },
      ...episodesByMonthData.map((d) => ({
        metric: `Episodes Finalised - ${d.month}`,
        value: formatNumber(d.value),
      })),
    ];
    const csv = generateCSV(exportData);
    downloadCSV(csv, `episodes-export-${new Date().toISOString().split('T')[0]}.csv`);
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Episode Analytics</h1>
          <p className="mt-1 text-sm text-gray-500">Episodes and clinical performance analysis</p>
        </div>
        <Button onClick={handleExport} variant="outline" size="sm" className="gap-2">
          <Download className="h-4 w-4" />
          Export CSV
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Episodes Finalised"
          value={formatNumber(totalEpisodesFinalised)}
          trend="neutral"
          icon={TrendingUp}
          color="teal"
        />
        <StatCard
          title="Not Finalised"
          value={formatNumber(latestNotFinalised)}
          trend="neutral"
          color="amber"
        />
        <StatCard
          title="Finalisation Rate"
          value={`${finalisationRate.toFixed(1)}%`}
          trend="neutral"
          color="blue"
        />
        <StatCard
          title="Avg Revenue/Episode"
          value={formatCurrency(avgRevenuePerEpisode)}
          trend="neutral"
          color="purple"
        />
      </div>

      {/* Charts Row 1 */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Episodes by Month */}
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 px-5 py-4">
            <h2 className="text-sm font-semibold text-gray-900">Episodes by Month</h2>
            <p className="mt-1 text-xs text-gray-500">12-month episode trend</p>
          </div>
          <div className="px-5 pb-5">
            <ResponsiveContainer width="100%" height={320}>
              <AreaChart data={episodesByMonthData}>
                <defs>
                  <linearGradient id="colorEpisodes" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0d9488" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#0d9488" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
                <XAxis dataKey="month" tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="#0d9488"
                  strokeWidth={2}
                  fill="url(#colorEpisodes)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Revenue by Month */}
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 px-5 py-4">
            <h2 className="text-sm font-semibold text-gray-900">Revenue by Month</h2>
            <p className="mt-1 text-xs text-gray-500">12-month revenue comparison</p>
          </div>
          <div className="px-5 pb-5">
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={revenueByMonthData}>
                <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
                <XAxis dataKey="month" tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="#0284c7"
                  strokeWidth={3}
                  dot={{ fill: '#0284c7', r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Episodes Finalized vs Not Finalized */}
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 px-5 py-4">
            <h2 className="text-sm font-semibold text-gray-900">Episodes: Finalised vs Not Finalised</h2>
            <p className="mt-1 text-xs text-gray-500">Monthly breakdown by finalization status</p>
          </div>
          <div className="px-5 pb-5">
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={finalizationData}>
                <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
                <XAxis dataKey="month" tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Bar dataKey="finalised" fill="#0d9488" name="Finalised" radius={[4, 4, 0, 0]} />
                <Bar dataKey="notFinalised" fill="#e11d48" name="Not Finalised" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Revenue per Episode Trend */}
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 px-5 py-4">
            <h2 className="text-sm font-semibold text-gray-900">Revenue per Episode Trend</h2>
            <p className="mt-1 text-xs text-gray-500">Monthly average revenue per episode</p>
          </div>
          <div className="px-5 pb-5">
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={revPerEpisodeData}>
                <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
                <XAxis dataKey="month" tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} formatter={(value) => formatCurrency(value as number)} />
                <Line type="monotone" dataKey="value" stroke="#d97706" strokeWidth={3} dot={{ fill: '#d97706', r: 4 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Summary Section */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Episode Summary</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="p-4 bg-gray-50 rounded-lg">
            <p className="text-xs font-medium text-gray-600 uppercase">Monthly Avg Episodes</p>
            <p className="text-2xl font-bold text-gray-900 mt-2">{formatNumber(avgMonthlyEpisodes)}</p>
          </div>
          <div className="p-4 bg-gray-50 rounded-lg">
            <p className="text-xs font-medium text-gray-600 uppercase">Total Episodes</p>
            <p className="text-2xl font-bold text-gray-900 mt-2">{formatNumber(totalEpisodes)}</p>
          </div>
          <div className="p-4 bg-gray-50 rounded-lg">
            <p className="text-xs font-medium text-gray-600 uppercase">Finalisation Rate</p>
            <p className="text-2xl font-bold text-gray-900 mt-2">{finalisationRate.toFixed(1)}%</p>
          </div>
          <div className="p-4 bg-gray-50 rounded-lg">
            <p className="text-xs font-medium text-gray-600 uppercase">Total Revenue</p>
            <p className="text-2xl font-bold text-gray-900 mt-2">{formatCurrency(totalRevenue)}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
