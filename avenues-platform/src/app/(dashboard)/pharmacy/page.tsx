'use client';

import React from 'react';
import { Download, AlertCircle } from 'lucide-react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  AreaChart,
  Area,
  ComposedChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { StatCard } from '@/components/charts/stat-card';
import { Button } from '@/components/ui/button';
import { ChartTooltipProps, MONTHS } from '@/types';
import { formatCurrency, formatNumber, generateCSV, downloadCSV } from '@/lib/utils';
import { useDashboard } from '@/store';
import Link from 'next/link';

const COLORS = ['#0d9488', '#475569', '#d97706', '#e11d48', '#7c3aed'];

const CustomTooltip = ({ active, payload, label }: ChartTooltipProps) => {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-lg">
        <p className="text-sm font-medium text-gray-900">{label}</p>
        {payload.map((entry, idx: number) => (
          <p key={idx} style={{ color: entry.color }} className="text-sm">
            {entry.name}: {typeof entry.value === 'number'
              ? String(entry.dataKey).includes('Rev')
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

export default function PharmacyPage() {
  const dashData = useDashboard();

  // Empty state if no data loaded
  if (!dashData) {
    return (
      <div className="space-y-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Pharmacy Analytics</h1>
            <p className="mt-1 text-sm text-gray-500">Pharmaceutical dispensing and revenue performance</p>
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
  const monthlyData = MONTHS.map((month, idx) => ({
    month: month.substring(0, 3),
    scripts: dashData.pharmacyRx[idx],
    revenue: dashData.pharmacyRev[idx],
    revPerScript: dashData.pharmacyRx[idx] > 0 ? dashData.pharmacyRev[idx] / dashData.pharmacyRx[idx] : 0,
  }));

  const composedData = monthlyData.map(d => ({
    month: d.month,
    scripts: d.scripts,
    revenue: d.revenue,
  }));

  const trendData = monthlyData.map(d => ({
    month: d.month,
    value: d.revPerScript,
  }));

  const monthlyDetailTable = monthlyData.map((d, idx) => ({
    month: MONTHS[idx],
    scripts: d.scripts,
    revenue: d.revenue,
    revPerScript: d.revPerScript,
  }));

  // Calculations
  const totalScripts = dashData.pharmacyRx.reduce((a, b) => a + b, 0);
  const totalRevenue = dashData.pharmacyRev.reduce((a, b) => a + b, 0);
  const activeRxMonths = dashData.pharmacyRx.filter(v => v > 0).length || 1;
  const avgScripts = totalScripts / activeRxMonths;
  const revenuePerScript = totalScripts > 0 ? totalRevenue / totalScripts : 0;
  const grossProfitMargin = 35; // Typical pharmacy margin
  const grossProfit = totalRevenue * (grossProfitMargin / 100);

  const handleExport = () => {
    const exportData = [
      { metric: 'Total Scripts', value: formatNumber(totalScripts) },
      { metric: 'Total Revenue', value: formatCurrency(totalRevenue) },
      { metric: 'Revenue per Script', value: formatCurrency(revenuePerScript) },
      { metric: 'Monthly Avg Scripts', value: formatNumber(avgScripts) },
      { metric: 'Gross Profit Margin %', value: `${grossProfitMargin}%` },
      ...monthlyDetailTable.map((d) => ({
        metric: `${d.month} - Scripts`,
        value: formatNumber(d.scripts),
      })),
      ...monthlyDetailTable.map((d) => ({
        metric: `${d.month} - Revenue`,
        value: formatCurrency(d.revenue),
      })),
    ];
    const csv = generateCSV(exportData);
    downloadCSV(csv, `pharmacy-export-${new Date().toISOString().split('T')[0]}.csv`);
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Pharmacy Analytics</h1>
          <p className="mt-1 text-sm text-gray-500">Pharmaceutical dispensing and revenue performance</p>
        </div>
        <Button onClick={handleExport} variant="outline" size="sm" className="gap-2 w-fit">
          <Download className="h-4 w-4" />
          Export CSV
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Scripts"
          value={formatNumber(totalScripts)}
          trend="neutral"
          color="teal"
        />
        <StatCard
          title="Total Revenue"
          value={formatCurrency(totalRevenue)}
          trend="neutral"
          color="blue"
        />
        <StatCard
          title="Revenue/Script"
          value={formatCurrency(revenuePerScript)}
          trend="neutral"
          color="amber"
        />
        <StatCard
          title="Monthly Avg Scripts"
          value={formatNumber(avgScripts)}
          trend="neutral"
          color="rose"
        />
      </div>

      {/* Charts Row 1 */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Monthly Scripts Dispensed */}
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 px-5 py-4">
            <h2 className="text-sm font-semibold text-gray-900">Monthly Scripts Dispensed</h2>
            <p className="mt-1 text-xs text-gray-500">Number of prescriptions filled</p>
          </div>
          <div className="px-5 pb-5">
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={monthlyData}>
                <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
                <XAxis dataKey="month" tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="scripts" fill="#0d9488" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Monthly Pharmacy Revenue */}
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 px-5 py-4">
            <h2 className="text-sm font-semibold text-gray-900">Monthly Pharmacy Revenue</h2>
            <p className="mt-1 text-xs text-gray-500">Revenue with gradient fill</p>
          </div>
          <div className="px-5 pb-5">
            <ResponsiveContainer width="100%" height={320}>
              <AreaChart data={monthlyData}>
                <defs>
                  <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#d97706" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#d97706" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
                <XAxis dataKey="month" tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="#d97706"
                  strokeWidth={2}
                  fill="url(#colorRev)"
                  dot={{ fill: '#d97706', r: 3 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Revenue per Script Trend */}
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 px-5 py-4">
            <h2 className="text-sm font-semibold text-gray-900">Revenue per Script Trend</h2>
            <p className="mt-1 text-xs text-gray-500">Average transaction value</p>
          </div>
          <div className="px-5 pb-5">
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={trendData}>
                <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
                <XAxis dataKey="month" tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="#7c3aed"
                  strokeWidth={3}
                  dot={{ fill: '#7c3aed', r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Dual Axis: Scripts + Revenue */}
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 px-5 py-4">
            <h2 className="text-sm font-semibold text-gray-900">Scripts vs Revenue</h2>
            <p className="mt-1 text-xs text-gray-500">Dual-axis comparison</p>
          </div>
          <div className="px-5 pb-5">
            <ResponsiveContainer width="100%" height={320}>
              <ComposedChart data={composedData}>
                <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
                <XAxis dataKey="month" tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="left" tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="right" orientation="right" tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Bar yAxisId="left" dataKey="scripts" fill="#0d9488" radius={[4, 4, 0, 0]} />
                <Line yAxisId="right" type="monotone" dataKey="revenue" stroke="#e11d48" strokeWidth={2} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Gross Profit & Margins */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Profit Indicators */}
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 px-5 py-4">
            <h2 className="text-sm font-semibold text-gray-900">Gross Profit Analysis</h2>
            <p className="mt-1 text-xs text-gray-500">Margin and profitability metrics</p>
          </div>
          <div className="space-y-4 px-5 py-5">
            <div className="flex items-center justify-between rounded-lg bg-gray-50 p-4">
              <span className="text-sm font-medium text-gray-600">Gross Profit Margin</span>
              <span className="text-2xl font-bold text-green-600">{grossProfitMargin}%</span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-gray-50 p-4">
              <span className="text-sm font-medium text-gray-600">Estimated Gross Profit</span>
              <span className="text-2xl font-bold text-teal-600">{formatCurrency(grossProfit)}</span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-gray-50 p-4">
              <span className="text-sm font-medium text-gray-600">Cost of Goods Sold</span>
              <span className="text-2xl font-bold text-amber-600">{formatCurrency(totalRevenue * (1 - grossProfitMargin / 100))}</span>
            </div>
          </div>
        </div>

        {/* Monthly Detail Table */}
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 px-5 py-4">
            <h2 className="text-sm font-semibold text-gray-900">Monthly Detail</h2>
            <p className="mt-1 text-xs text-gray-500">12-month breakdown</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-gray-200 bg-gray-50">
                <tr>
                  <th className="px-5 py-3 text-left font-semibold text-gray-900">Month</th>
                  <th className="px-5 py-3 text-right font-semibold text-gray-900">Scripts</th>
                  <th className="px-5 py-3 text-right font-semibold text-gray-900">Revenue</th>
                  <th className="px-5 py-3 text-right font-semibold text-gray-900">Rev/Script</th>
                </tr>
              </thead>
              <tbody>
                {monthlyDetailTable.map((row, idx) => (
                  <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-5 py-3 text-gray-900 font-medium">{row.month}</td>
                    <td className="px-5 py-3 text-right text-gray-700">{formatNumber(row.scripts)}</td>
                    <td className="px-5 py-3 text-right text-gray-700 font-medium">{formatCurrency(row.revenue)}</td>
                    <td className="px-5 py-3 text-right text-gray-600">{formatCurrency(row.revPerScript)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
