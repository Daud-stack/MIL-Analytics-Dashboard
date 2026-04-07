'use client';

import React from 'react';
import { Download, AlertCircle, TrendingUp } from 'lucide-react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
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

const COLORS = ['#0d9488', '#475569', '#d97706', '#e11d48', '#7c3aed', '#0284c7', '#059669', '#dc2626'];

const CustomTooltip = ({ active, payload, label }: ChartTooltipProps) => {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-lg">
        <p className="text-sm font-medium text-gray-900">{label}</p>
        {payload.map((entry, idx: number) => (
          <p key={idx} style={{ color: entry.color }} className="text-sm">
            {entry.name}: {typeof entry.value === 'number'
              ? entry.dataKey?.includes('Rev') || entry.dataKey?.includes('value')
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

  // Empty state if no data loaded
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
  const monthlyRevenueData = MONTHS.map((month, idx) => ({
    month: month.substring(0, 3),
    value: dashData.monthRevenue[idx],
  }));

  const revPerPatDayData = MONTHS.map((month, idx) => ({
    month: month.substring(0, 3),
    value: dashData.revPerPatDay[idx],
  }));

  const paymentsCollectionData = MONTHS.map((month, idx) => ({
    month: month.substring(0, 3),
    deposits: dashData.payments.deposits[idx],
    individual: dashData.payments.individual[idx],
    medAid: dashData.payments.medAid[idx],
    batched: dashData.payments.batched[idx],
  }));

  const revLocationData = Object.entries(dashData.revLocation)
    .map(([name, values]) => ({
      name: name.substring(0, 15),
      value: values.reduce((a, b) => a + b, 0),
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);

  // Calculate KPI totals
  const totalRevenue = dashData.monthRevenue.reduce((a, b) => a + b, 0);
  const activeMonths = dashData.monthRevenue.filter(v => v > 0).length || 1;
  const monthlyAvg = totalRevenue / activeMonths;
  const totalLabAdmissions = dashData.admLab.reduce((a, b) => a + b, 0);
  const revenuePerAdmission = totalLabAdmissions > 0 ? totalRevenue / totalLabAdmissions : 0;
  const activeRevPatDayMonths = dashData.revPerPatDay.filter(v => v > 0).length || 1;
  const avgRevPerPatDay = dashData.revPerPatDay.reduce((a, b) => a + b, 0) / activeRevPatDayMonths;
  const totalPayments =
    dashData.payments.deposits.reduce((a, b) => a + b, 0) +
    dashData.payments.individual.reduce((a, b) => a + b, 0) +
    dashData.payments.medAid.reduce((a, b) => a + b, 0) +
    dashData.payments.batched.reduce((a, b) => a + b, 0);

  const handleExport = () => {
    const exportData = [
      { metric: 'Total Revenue', value: formatCurrency(totalRevenue) },
      { metric: 'Monthly Average', value: formatCurrency(monthlyAvg) },
      { metric: 'Revenue per Lab Admission', value: formatCurrency(revenuePerAdmission) },
      { metric: 'Avg Revenue per Patient Day', value: formatCurrency(avgRevPerPatDay) },
      { metric: 'Total Payments Received', value: formatCurrency(totalPayments) },
      ...monthlyRevenueData.map((d) => ({
        metric: `Revenue - ${d.month}`,
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
          <p className="mt-1 text-sm text-gray-500">Comprehensive financial performance analysis</p>
        </div>
        <Button onClick={handleExport} variant="outline" size="sm" className="gap-2">
          <Download className="h-4 w-4" />
          Export CSV
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard
          title="Total Revenue"
          value={formatCurrency(totalRevenue)}
          trend="neutral"
          icon={TrendingUp}
          color="green"
        />
        <StatCard
          title="Monthly Avg"
          value={formatCurrency(monthlyAvg)}
          trend="neutral"
          color="blue"
        />
        <StatCard
          title="Revenue/Lab Adm"
          value={formatCurrency(revenuePerAdmission)}
          trend="neutral"
          color="purple"
        />
        <StatCard
          title="Avg Rev/Pat Day"
          value={formatCurrency(avgRevPerPatDay)}
          trend="neutral"
          color="amber"
        />
        <StatCard
          title="Total Payments"
          value={formatCurrency(totalPayments)}
          trend="neutral"
          color="rose"
        />
      </div>

      {/* Charts Row 1 */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Monthly Revenue */}
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 px-5 py-4">
            <h2 className="text-sm font-semibold text-gray-900">Monthly Revenue</h2>
            <p className="mt-1 text-xs text-gray-500">12-month revenue trend</p>
          </div>
          <div className="px-5 pb-5">
            <ResponsiveContainer width="100%" height={320}>
              <AreaChart data={monthlyRevenueData}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
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
                  fill="url(#colorRevenue)"
                  dot={{ fill: '#0d9488', r: 3 }}
                />
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
            <ResponsiveContainer width="100%" height={320}>
              <PieChart>
                <Pie
                  data={revLocationData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={110}
                  labelLine={false}
                  label={({ name, value }) => `${name}: ${formatCurrency(Number(value ?? 0)).slice(0, 10)}`}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {revLocationData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => formatCurrency(value as number)} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Revenue per Patient Day Trend */}
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 px-5 py-4">
            <h2 className="text-sm font-semibold text-gray-900">Revenue per Patient Day Trend</h2>
            <p className="mt-1 text-xs text-gray-500">Monthly efficiency metric</p>
          </div>
          <div className="px-5 pb-5">
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={revPerPatDayData}>
                <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
                <XAxis dataKey="month" tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="#0284c7"
                  strokeWidth={3}
                  dot={{ fill: '#0284c7', r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Payments Collection Trend */}
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 px-5 py-4">
            <h2 className="text-sm font-semibold text-gray-900">Payments Collection Trend</h2>
            <p className="mt-1 text-xs text-gray-500">Stacked payment sources by month</p>
          </div>
          <div className="px-5 pb-5">
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={paymentsCollectionData}>
                <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
                <XAxis dataKey="month" tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
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

      {/* Monthly Detail Table */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 px-5 py-4">
          <h2 className="text-sm font-semibold text-gray-900">Monthly Detail</h2>
          <p className="mt-1 text-xs text-gray-500">12-month revenue breakdown</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-200 bg-gray-50">
              <tr>
                <th className="px-5 py-3 text-left font-semibold text-gray-900">Month</th>
                <th className="px-5 py-3 text-right font-semibold text-gray-900">Revenue</th>
                <th className="px-5 py-3 text-right font-semibold text-gray-900">Rev/Pat Day</th>
                <th className="px-5 py-3 text-right font-semibold text-gray-900">Payments</th>
              </tr>
            </thead>
            <tbody>
              {MONTHS.map((month, idx) => (
                <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-5 py-3 text-gray-900">{month}</td>
                  <td className="px-5 py-3 text-right text-gray-700 font-medium">{formatCurrency(dashData.monthRevenue[idx])}</td>
                  <td className="px-5 py-3 text-right text-gray-600">{formatCurrency(dashData.revPerPatDay[idx])}</td>
                  <td className="px-5 py-3 text-right text-gray-600">{formatCurrency(
                    dashData.payments.deposits[idx] +
                    dashData.payments.individual[idx] +
                    dashData.payments.medAid[idx] +
                    dashData.payments.batched[idx]
                  )}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
