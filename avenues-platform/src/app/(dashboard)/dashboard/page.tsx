'use client';

import React from 'react';
import { Download, DollarSign, Beaker, AlertCircle, Activity, TrendingUp } from 'lucide-react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
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

const COLORS = ['#0d9488', '#475569', '#d97706', '#e11d48', '#7c3aed', '#0284c7'];

const CustomTooltip = ({ active, payload, label }: ChartTooltipProps) => {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-lg">
        <p className="text-sm font-medium text-gray-900">{label}</p>
        {payload.map((entry, index: number) => (
          <p key={index} style={{ color: entry.color }} className="text-sm">
            {entry.name}: {typeof entry.value === 'number' && String(entry.dataKey).includes('Revenue')
              ? formatCurrency(Number(entry.value ?? 0))
              : formatNumber(Number(entry.value ?? 0))}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export default function DashboardPage() {
  const dashData = useDashboard();

  // Empty state if no data loaded
  if (!dashData) {
    return (
      <div className="space-y-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Executive Dashboard</h1>
            <p className="mt-1 text-sm text-gray-500">Key performance indicators and metrics</p>
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

  // Prepare chart data from store
  const revenueData = MONTHS.map((month, idx) => ({
    month: month.substring(0, 3),
    value: dashData.monthRevenue[idx],
  }));

  const labAdmissionsData = MONTHS.map((month, idx) => ({
    month: month.substring(0, 3),
    value: dashData.admLab[idx],
  }));

  const paymentsData = MONTHS.map((month, idx) => ({
    month: month.substring(0, 3),
    deposits: dashData.payments.deposits[idx],
    individual: dashData.payments.individual[idx],
    medAid: dashData.payments.medAid[idx],
    batched: dashData.payments.batched[idx],
  }));

  const debtorsTrendData = MONTHS.map((month, idx) => ({
    month: month.substring(0, 3),
    balance: dashData.debtRecon.total[idx],
  }));

  const revLocationData = Object.entries(dashData.revLocation)
    .map(([name, values]) => ({
      name: name.substring(0, 15),
      value: values.reduce((a, b) => a + b, 0),
    }))
    .sort((a, b) => b.value - a.value);

  // Calculate KPI totals
  const totalRevenue = dashData.monthRevenue.reduce((a, b) => a + b, 0);
  const totalLabAdmissions = dashData.admLab.reduce((a, b) => a + b, 0);
  const totalCasualtyAdmissions = dashData.admCasualty.reduce((a, b) => a + b, 0);
  const totalEpisodesFinalised = dashData.epsFinalised.reduce((a, b) => a + b, 0);
  const totalPrescriptions = dashData.pharmacyRx.reduce((a, b) => a + b, 0);
  const totalPayments =
    dashData.payments.deposits.reduce((a, b) => a + b, 0) +
    dashData.payments.individual.reduce((a, b) => a + b, 0) +
    dashData.payments.medAid.reduce((a, b) => a + b, 0) +
    dashData.payments.batched.reduce((a, b) => a + b, 0);

  const handleExport = () => {
    const exportData = [
      { metric: 'Total Revenue', value: formatCurrency(totalRevenue) },
      { metric: 'Lab Admissions', value: formatNumber(totalLabAdmissions) },
      { metric: 'Casualty Admissions', value: formatNumber(totalCasualtyAdmissions) },
      { metric: 'Episodes Finalised', value: formatNumber(totalEpisodesFinalised) },
      { metric: 'Total Prescriptions', value: formatNumber(totalPrescriptions) },
      { metric: 'Total Payments', value: formatCurrency(totalPayments) },
      ...revenueData.map((d) => ({
        metric: `Revenue - ${d.month}`,
        value: formatCurrency(d.value),
      })),
    ];

    const csv = generateCSV(exportData);
    downloadCSV(csv, `dashboard-export-${new Date().toISOString().split('T')[0]}.csv`);
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Executive Dashboard</h1>
          <p className="mt-1 text-sm text-gray-500">Key performance indicators and metrics</p>
        </div>
        <Button
          onClick={handleExport}
          variant="outline"
          size="sm"
          className="gap-2"
        >
          <Download className="h-4 w-4" />
          Export
        </Button>
      </div>

      {/* KPI Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard
          title="Total Revenue"
          value={formatCurrency(totalRevenue)}
          trend="neutral"
          icon={DollarSign}
          color="green"
        />
        <StatCard
          title="Lab Admissions"
          value={formatNumber(totalLabAdmissions)}
          trend="neutral"
          icon={Beaker}
          color="blue"
        />
        <StatCard
          title="Casualty Admissions"
          value={formatNumber(totalCasualtyAdmissions)}
          trend="neutral"
          icon={AlertCircle}
          color="amber"
        />
        <StatCard
          title="Episodes Finalised"
          value={formatNumber(totalEpisodesFinalised)}
          trend="neutral"
          icon={Activity}
          color="purple"
        />
        <StatCard
          title="Total Prescriptions"
          value={formatNumber(totalPrescriptions)}
          trend="neutral"
          icon={TrendingUp}
          color="rose"
        />
        <StatCard
          title="Total Payments"
          value={formatCurrency(totalPayments)}
          trend="neutral"
          color="teal"
        />
      </div>

      {/* Charts Row 1 */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Monthly Revenue Trend */}
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 px-5 py-4">
            <h2 className="text-sm font-semibold text-gray-900">Monthly Revenue Trend</h2>
            <p className="mt-1 text-xs text-gray-500">12-month revenue performance</p>
          </div>
          <div className="px-5 pb-5">
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={revenueData}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0d9488" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#0d9488" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#f1f5f9" strokeDasharray="3 3" />
                <XAxis
                  dataKey="month"
                  tick={{ fill: '#94a3b8', fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: '#94a3b8', fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                />
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

        {/* Monthly Lab Admissions */}
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 px-5 py-4">
            <h2 className="text-sm font-semibold text-gray-900">Monthly Lab Admissions</h2>
            <p className="mt-1 text-xs text-gray-500">Laboratory admission trends</p>
          </div>
          <div className="px-5 pb-5">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={labAdmissionsData}>
                <CartesianGrid stroke="#f1f5f9" strokeDasharray="3 3" />
                <XAxis
                  dataKey="month"
                  tick={{ fill: '#94a3b8', fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: '#94a3b8', fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar
                  dataKey="value"
                  fill="#0d9488"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Revenue by Centre */}
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 px-5 py-4">
            <h2 className="text-sm font-semibold text-gray-900">Revenue by Centre</h2>
            <p className="mt-1 text-xs text-gray-500">Geographic revenue distribution</p>
          </div>
          <div className="px-5 pb-5">
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={revLocationData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
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

        {/* Debtors Reconciliation Trend */}
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 px-5 py-4">
            <h2 className="text-sm font-semibold text-gray-900">Debtors Closing Balance</h2>
            <p className="mt-1 text-xs text-gray-500">Outstanding accounts receivable</p>
          </div>
          <div className="px-5 pb-5">
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={debtorsTrendData}>
                <defs>
                  <linearGradient id="colorDebtors" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#e11d48" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#e11d48" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#f1f5f9" strokeDasharray="3 3" />
                <XAxis
                  dataKey="month"
                  tick={{ fill: '#94a3b8', fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: '#94a3b8', fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<CustomTooltip />} />
                <Area
                  type="monotone"
                  dataKey="balance"
                  stroke="#e11d48"
                  strokeWidth={2}
                  fill="url(#colorDebtors)"
                  dot={{ fill: '#e11d48', r: 3 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Charts Row 3 */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Payments Breakdown */}
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 px-5 py-4">
            <h2 className="text-sm font-semibold text-gray-900">Payments Breakdown</h2>
            <p className="mt-1 text-xs text-gray-500">Stacked payment sources by month</p>
          </div>
          <div className="px-5 pb-5">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={paymentsData}>
                <CartesianGrid stroke="#f1f5f9" strokeDasharray="3 3" />
                <XAxis
                  dataKey="month"
                  tick={{ fill: '#94a3b8', fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: '#94a3b8', fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                />
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

        {/* Monthly Revenue Summary Table */}
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 px-5 py-4">
            <h2 className="text-sm font-semibold text-gray-900">Monthly Summary</h2>
            <p className="mt-1 text-xs text-gray-500">Key metrics by month</p>
          </div>
          <div className="overflow-x-auto max-h-96">
            <table className="w-full text-xs">
              <thead className="border-b border-gray-200 bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-4 py-2 text-left font-semibold text-gray-900">Month</th>
                  <th className="px-4 py-2 text-right font-semibold text-gray-900">Revenue</th>
                  <th className="px-4 py-2 text-right font-semibold text-gray-900">Lab Adm</th>
                  <th className="px-4 py-2 text-right font-semibold text-gray-900">Episodes</th>
                </tr>
              </thead>
              <tbody>
                {MONTHS.map((month, idx) => (
                  <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-2 text-gray-900 font-medium">{month.substring(0, 3)}</td>
                    <td className="px-4 py-2 text-right text-gray-700">{formatCurrency(dashData.monthRevenue[idx])}</td>
                    <td className="px-4 py-2 text-right text-gray-700">{formatNumber(dashData.admLab[idx])}</td>
                    <td className="px-4 py-2 text-right text-gray-700">{formatNumber(dashData.epsFinalised[idx])}</td>
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
