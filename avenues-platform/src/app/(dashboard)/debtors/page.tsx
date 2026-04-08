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
import { getLatestNonZeroIndex, useDashboard } from '@/store';
import Link from 'next/link';

const COLORS = ['#0d9488', '#475569', '#d97706', '#e11d48'];

const CustomTooltip = ({ active, payload, label }: ChartTooltipProps) => {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-lg">
        <p className="text-sm font-medium text-gray-900">{label}</p>
        {payload.map((entry, idx: number) => (
          <p key={idx} style={{ color: entry.color }} className="text-sm">
            {entry.name}: {formatCurrency(Number(entry.value ?? 0))}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export default function DebtorsPage() {
  const dashData = useDashboard();

  // Empty state if no data loaded
  if (!dashData) {
    return (
      <div className="space-y-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Accounts Receivable</h1>
            <p className="mt-1 text-sm text-gray-500">Debtors reconciliation and collection analysis</p>
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

  // Build reconciliation data
  const reconciliationData = MONTHS.map((month, idx) => ({
    month: month.substring(0, 3),
    brought: dashData.debtRecon.brought[idx],
    revenue: dashData.debtRecon.revenue[idx],
    payments: dashData.debtRecon.payments[idx],
    sundries: dashData.debtRecon.sundries[idx],
    closing: dashData.debtRecon.total[idx],
  }));

  // Build trend data (closing balance)
  const trendData = reconciliationData.map(d => ({
    month: d.month,
    balance: d.closing,
  }));

  // Calculate DSO (Days Sales Outstanding)
  const dsoData = MONTHS.map((month, idx) => {
    const avgDailyRevenue = dashData.debtRecon.revenue[idx] / 30;
    const dso = avgDailyRevenue > 0 ? dashData.debtRecon.total[idx] / avgDailyRevenue : 0;
    return {
      month: month.substring(0, 3),
      dso: Math.min(dso, 120), // Cap at 120 for visualization
    };
  });

  // Calculate collection rate
  const collectionData = MONTHS.map((month, idx) => {
    const collectRate = dashData.debtRecon.revenue[idx] > 0
      ? (dashData.debtRecon.payments[idx] / dashData.debtRecon.revenue[idx]) * 100
      : 0;
    return {
      month: month.substring(0, 3),
      rate: Math.min(collectRate, 100),
    };
  });

  // Monthly detail table
  const monthlyDetailTable = reconciliationData.map((d, idx) => ({
    ...d,
    dso: dsoData[idx].dso,
    collectionRate: collectionData[idx].rate,
  }));

  // Calculations
  const openingBalance = dashData.debtRecon.brought[0];
  const totalRevenueBilled = dashData.debtRecon.revenue.reduce((a, b) => a + b, 0);
  const totalPaymentsReceived = dashData.debtRecon.payments.reduce((a, b) => a + b, 0);
  const latestDebtIdx = Math.max(getLatestNonZeroIndex(dashData.debtRecon.total), 0);
  const closingBalance = dashData.debtRecon.total[latestDebtIdx] || 0;
  const activeDSOMonths = dsoData.filter(d => d.dso > 0);
  const avgDSO = activeDSOMonths.length > 0 ? activeDSOMonths.reduce((a, b) => a + b.dso, 0) / activeDSOMonths.length : 0;
  const activeCollMonths = collectionData.filter(d => d.rate > 0);
  const avgCollectionRate = activeCollMonths.length > 0 ? activeCollMonths.reduce((a, b) => a + b.rate, 0) / activeCollMonths.length : 0;

  const handleExport = () => {
    const exportData = [
      { metric: 'Opening Balance', value: formatCurrency(openingBalance) },
      { metric: 'Revenue Billed', value: formatCurrency(totalRevenueBilled) },
      { metric: 'Payments Received', value: formatCurrency(totalPaymentsReceived) },
      { metric: 'Closing Balance', value: formatCurrency(closingBalance) },
      { metric: 'Avg DSO (Days)', value: avgDSO.toFixed(1) },
      { metric: 'Avg Collection Rate %', value: avgCollectionRate.toFixed(1) },
      ...monthlyDetailTable.map((d) => ({
        metric: `${d.month} - Closing Balance`,
        value: formatCurrency(d.closing),
      })),
    ];
    const csv = generateCSV(exportData);
    downloadCSV(csv, `debtors-export-${new Date().toISOString().split('T')[0]}.csv`);
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Accounts Receivable</h1>
          <p className="mt-1 text-sm text-gray-500">Debtors reconciliation and collection analysis</p>
        </div>
        <Button onClick={handleExport} variant="outline" size="sm" className="gap-2 w-fit">
          <Download className="h-4 w-4" />
          Export CSV
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Opening Balance"
          value={formatCurrency(openingBalance)}
          trend="neutral"
          color="amber"
        />
        <StatCard
          title="Revenue Billed"
          value={formatCurrency(totalRevenueBilled)}
          trend="neutral"
          color="teal"
        />
        <StatCard
          title="Payments Received"
          value={formatCurrency(totalPaymentsReceived)}
          trend="neutral"
          color="blue"
        />
        <StatCard
          title="Closing Balance"
          value={formatCurrency(closingBalance)}
          trend="neutral"
          color="rose"
        />
      </div>

      {/* Charts Row 1 */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Reconciliation Stacked Bar */}
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 px-5 py-4">
            <h2 className="text-sm font-semibold text-gray-900">Monthly Reconciliation</h2>
            <p className="mt-1 text-xs text-gray-500">Brought + Revenue - Payments ± Sundries = Closing</p>
          </div>
          <div className="px-5 pb-5">
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={reconciliationData}>
                <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
                <XAxis dataKey="month" tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Bar dataKey="brought" fill="#0d9488" radius={[4, 4, 0, 0]} stackId="a" />
                <Bar dataKey="revenue" fill="#475569" radius={[4, 4, 0, 0]} stackId="a" />
                <Bar dataKey="payments" fill="#d97706" radius={[4, 4, 0, 0]} stackId="a" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Closing Balance Trend */}
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 px-5 py-4">
            <h2 className="text-sm font-semibold text-gray-900">Closing Balance Trend</h2>
            <p className="mt-1 text-xs text-gray-500">Outstanding debtors over time</p>
          </div>
          <div className="px-5 pb-5">
            <ResponsiveContainer width="100%" height={320}>
              <AreaChart data={trendData}>
                <defs>
                  <linearGradient id="colorBalance" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#e11d48" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#e11d48" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
                <XAxis dataKey="month" tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Area
                  type="monotone"
                  dataKey="balance"
                  stroke="#e11d48"
                  strokeWidth={2}
                  fill="url(#colorBalance)"
                  dot={{ fill: '#e11d48', r: 3 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* DSO Trend */}
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 px-5 py-4">
            <h2 className="text-sm font-semibold text-gray-900">Days Sales Outstanding (DSO)</h2>
            <p className="mt-1 text-xs text-gray-500">Average days to collect payment</p>
          </div>
          <div className="px-5 pb-5">
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={dsoData}>
                <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
                <XAxis dataKey="month" tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Line
                  type="monotone"
                  dataKey="dso"
                  stroke="#d97706"
                  strokeWidth={3}
                  dot={{ fill: '#d97706', r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Collection Rate % */}
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 px-5 py-4">
            <h2 className="text-sm font-semibold text-gray-900">Collection Rate %</h2>
            <p className="mt-1 text-xs text-gray-500">Payments as % of revenue billed</p>
          </div>
          <div className="px-5 pb-5">
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={collectionData}>
                <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
                <XAxis dataKey="month" tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Line
                  type="monotone"
                  dataKey="rate"
                  stroke="#0284c7"
                  strokeWidth={3}
                  dot={{ fill: '#0284c7', r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Summary Metrics */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Key Metrics */}
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 px-5 py-4">
            <h2 className="text-sm font-semibold text-gray-900">Key Metrics</h2>
            <p className="mt-1 text-xs text-gray-500">Summary indicators</p>
          </div>
          <div className="space-y-4 px-5 py-5">
            <div className="flex items-center justify-between rounded-lg bg-gray-50 p-4">
              <span className="text-sm font-medium text-gray-600">Avg Days Sales Outstanding</span>
              <span className="text-2xl font-bold text-amber-600">{avgDSO.toFixed(1)} days</span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-gray-50 p-4">
              <span className="text-sm font-medium text-gray-600">Avg Collection Rate</span>
              <span className="text-2xl font-bold text-teal-600">{avgCollectionRate.toFixed(1)}%</span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-gray-50 p-4">
              <span className="text-sm font-medium text-gray-600">Outstanding Debtors</span>
              <span className="text-2xl font-bold text-rose-600">{formatCurrency(closingBalance)}</span>
            </div>
          </div>
        </div>

        {/* Monthly Detail Table */}
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 px-5 py-4">
            <h2 className="text-sm font-semibold text-gray-900">Monthly Detail</h2>
            <p className="mt-1 text-xs text-gray-500">Complete reconciliation breakdown</p>
          </div>
          <div className="overflow-x-auto max-h-96">
            <table className="w-full text-xs">
              <thead className="border-b border-gray-200 bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold text-gray-900">Month</th>
                  <th className="px-3 py-2 text-right font-semibold text-gray-900">Closing</th>
                  <th className="px-3 py-2 text-right font-semibold text-gray-900">DSO</th>
                  <th className="px-3 py-2 text-right font-semibold text-gray-900">Coll %</th>
                </tr>
              </thead>
              <tbody>
                {monthlyDetailTable.map((row, idx) => (
                  <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-3 py-2 text-gray-900 font-medium">{row.month.substring(0, 3)}</td>
                    <td className="px-3 py-2 text-right text-gray-700">{formatCurrency(row.closing)}</td>
                    <td className="px-3 py-2 text-right text-gray-600">{row.dso.toFixed(1)}</td>
                    <td className="px-3 py-2 text-right text-gray-600">{row.collectionRate.toFixed(1)}%</td>
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
