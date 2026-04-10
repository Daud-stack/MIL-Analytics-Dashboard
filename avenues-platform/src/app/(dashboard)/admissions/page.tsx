'use client';

import React from 'react';
import { Download, AlertCircle, TrendingUp } from 'lucide-react';
import {
  LineChart,
  Line,
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
import { ChartTooltipProps } from '@/types';
import { formatCurrency, formatNumber, generateCSV, downloadCSV } from '@/lib/utils';
import { useDashboard } from '@/store';
import { useDrillDown } from '@/hooks/useDrillDown';
import { useFilterStore } from '@/store/filter';
import Link from 'next/link';

const COLORS = ['#0d9488', '#475569', '#d97706', '#e11d48', '#7c3aed', '#0284c7', '#059669', '#dc2626'];

const CustomTooltip = ({ active, payload, label }: ChartTooltipProps) => {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-lg">
        <p className="text-sm font-medium text-gray-900">{label}</p>
        {payload.map((entry, index: number) => (
          <p key={index} style={{ color: entry.color }} className="text-sm">
            {entry.name}: {formatNumber(Number(entry.value ?? 0))}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export default function AdmissionsPage() {
  const dashData = useDashboard();
  const { granularity } = useFilterStore();
  const casualtyDrill = useDrillDown(dashData?.admCasualty);
  const labDrill = useDrillDown(dashData?.admLab);
  const transferDrill = useDrillDown(dashData?.casToInpatient);

  // Empty state if no data loaded
  if (!dashData) {
    return (
      <div className="space-y-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Admissions Analytics</h1>
            <p className="mt-1 text-sm text-gray-500">Comprehensive admission patterns and trends</p>
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

  // KPI calculations using drill-down totals
  const casualtyTotal = casualtyDrill.total;
  const labTotal = labDrill.total;
  const totalAdmissions = casualtyTotal + labTotal;
  const totalTransfers = transferDrill.total;
  const transferRate = totalAdmissions > 0 ? (totalTransfers / totalAdmissions) * 100 : 0;

  // Chart data from drill-down results
  const monthlyChartData = casualtyDrill.labels.map((label, i) => ({
    period: label,
    casualty: casualtyDrill.values[i],
    lab: labDrill.values[i],
  }));

  const trendData = casualtyDrill.labels.map((label, i) => ({
    period: label,
    value: casualtyDrill.values[i] + labDrill.values[i],
  }));

  const transferRateData = casualtyDrill.labels.map((label, i) => {
    const totalAdm = casualtyDrill.values[i] + labDrill.values[i];
    return {
      period: label,
      rate: totalAdm > 0 ? (transferDrill.values[i] / totalAdm) * 100 : 0,
    };
  });

  // Admission mix pie
  const mixData = [
    { name: 'Casualty', value: casualtyTotal },
    { name: 'Laboratory', value: labTotal },
  ];

  // Period label for display
  const periodLabel = granularity === 'year' ? 'Annual'
    : granularity === 'quarter' ? 'Quarter'
    : granularity === 'week' ? 'Weekly'
    : granularity === 'day' ? 'Daily'
    : casualtyDrill.isFiltered ? 'Period' : 'Monthly';

  const handleExport = () => {
    const exportData = [
      { metric: 'Total Admissions', value: formatNumber(totalAdmissions) },
      { metric: 'Casualty Admissions', value: formatNumber(casualtyTotal) },
      { metric: 'Laboratory Admissions', value: formatNumber(labTotal) },
      { metric: 'Transfers to Inpatient', value: formatNumber(totalTransfers) },
      { metric: 'Transfer Rate %', value: transferRate.toFixed(1) },
      ...casualtyDrill.points.map((pt, idx) => ({
        metric: `${pt.label} - Total Admissions`,
        value: formatNumber(casualtyDrill.values[idx] + labDrill.values[idx]),
      })),
    ];

    const csv = generateCSV(exportData);
    downloadCSV(csv, `admissions-${new Date().toISOString().split('T')[0]}.csv`);
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Admissions Analytics</h1>
          <p className="mt-1 text-sm text-gray-500">
            {casualtyDrill.isFiltered ? `Filtered view · ${casualtyDrill.points.length} ${granularity}(s)` : 'Comprehensive admission patterns and trends'}
          </p>
        </div>
        <Button onClick={handleExport} variant="outline" size="sm" className="gap-2">
          <Download className="h-4 w-4" />
          Export CSV
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Admissions"
          value={formatNumber(totalAdmissions)}
          trend="neutral"
          color="teal"
        />
        <StatCard
          title="Casualty Admissions"
          value={formatNumber(casualtyTotal)}
          trend="neutral"
          color="blue"
        />
        <StatCard
          title="Laboratory Admissions"
          value={formatNumber(labTotal)}
          trend="neutral"
          color="amber"
        />
        <StatCard
          title="Casualty to Inpatient"
          value={formatNumber(totalTransfers)}
          trend="neutral"
          color="rose"
        />
      </div>

      {/* Charts Row 1 */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Stacked Bar */}
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 px-5 py-4">
            <h2 className="text-sm font-semibold text-gray-900">{periodLabel} Admission Breakdown</h2>
            <p className="mt-1 text-xs text-gray-500">Casualty and Laboratory admissions breakdown</p>
          </div>
          <div className="px-5 pb-5">
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={monthlyChartData}>
                <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
                <XAxis dataKey="period" tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} interval={granularity === 'day' ? 29 : granularity === 'week' ? 3 : 0} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Bar dataKey="casualty" fill="#0d9488" name="Casualty" radius={[4, 4, 0, 0]} />
                <Bar dataKey="lab" fill="#475569" name="Laboratory" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Admission Mix Pie */}
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 px-5 py-4">
            <h2 className="text-sm font-semibold text-gray-900">Admission Type Mix</h2>
            <p className="mt-1 text-xs text-gray-500">Annual distribution across admission types</p>
          </div>
          <div className="px-5 pb-5">
            <ResponsiveContainer width="100%" height={320}>
              <PieChart>
                <Pie
                  data={mixData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  labelLine={false}
                  label={({ name, value }) => `${name}: ${formatNumber(value)}`}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {mixData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => formatNumber(value as number)} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Admission Trend Line */}
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 px-5 py-4">
            <h2 className="text-sm font-semibold text-gray-900">{periodLabel} Admission Trend</h2>
            <p className="mt-1 text-xs text-gray-500">{casualtyDrill.points.length} data point(s)</p>
          </div>
          <div className="px-5 pb-5">
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={trendData}>
                <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
                <XAxis dataKey="period" tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} interval={granularity === 'day' ? 29 : granularity === 'week' ? 3 : 0} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Line type="monotone" dataKey="value" stroke="#0d9488" strokeWidth={2} dot={granularity === 'day' ? false : { r: 3 }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Transfer Rate % */}
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 px-5 py-4">
            <h2 className="text-sm font-semibold text-gray-900">Casualty to Inpatient Transfer Rate</h2>
            <p className="mt-1 text-xs text-gray-500">{periodLabel} transfer rate percentage</p>
          </div>
          <div className="px-5 pb-5">
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={transferRateData}>
                <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
                <XAxis dataKey="period" tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} interval={granularity === 'day' ? 29 : granularity === 'week' ? 3 : 0} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} formatter={(value) => `${(value as number).toFixed(1)}%`} />
                <Line type="monotone" dataKey="rate" stroke="#d97706" strokeWidth={3} dot={granularity === 'day' ? false : { fill: '#d97706', r: 4 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Detail Table */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 px-5 py-4">
          <h2 className="text-sm font-semibold text-gray-900">{periodLabel} Detail</h2>
          <p className="mt-1 text-xs text-gray-500">{casualtyDrill.points.length} period(s) · {casualtyDrill.isFiltered ? 'Filtered' : 'Full year'}</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-200 bg-gray-50">
              <tr>
                <th className="px-5 py-3 text-left font-semibold text-gray-900">Period</th>
                <th className="px-5 py-3 text-right font-semibold text-gray-900">Casualty</th>
                <th className="px-5 py-3 text-right font-semibold text-gray-900">Laboratory</th>
                <th className="px-5 py-3 text-right font-semibold text-gray-900">Transfers</th>
                <th className="px-5 py-3 text-right font-semibold text-gray-900">Total</th>
              </tr>
            </thead>
            <tbody>
              {casualtyDrill.points.map((pt, idx) => (
                <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-5 py-3 text-gray-900">{pt.label}</td>
                  <td className="px-5 py-3 text-right text-gray-700 font-medium">{formatNumber(casualtyDrill.values[idx])}</td>
                  <td className="px-5 py-3 text-right text-gray-600">{formatNumber(labDrill.values[idx])}</td>
                  <td className="px-5 py-3 text-right text-gray-600">{formatNumber(transferDrill.values[idx])}</td>
                  <td className="px-5 py-3 text-right text-gray-700 font-medium">{formatNumber(casualtyDrill.values[idx] + labDrill.values[idx])}</td>
                </tr>
              ))}
              {/* Totals row */}
              <tr className="bg-gray-50 font-semibold">
                <td className="px-5 py-3 text-gray-900">Total</td>
                <td className="px-5 py-3 text-right text-gray-900">{formatNumber(casualtyTotal)}</td>
                <td className="px-5 py-3 text-right text-gray-700">{formatNumber(labTotal)}</td>
                <td className="px-5 py-3 text-right text-gray-700">{formatNumber(totalTransfers)}</td>
                <td className="px-5 py-3 text-right text-gray-900">{formatNumber(totalAdmissions)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
