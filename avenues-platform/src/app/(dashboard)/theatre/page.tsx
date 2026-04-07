'use client';

import React from 'react';
import { Download, Upload } from 'lucide-react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
} from 'recharts';
import { StatCard } from '@/components/charts/stat-card';
import { Button } from '@/components/ui/button';
import { MONTHS } from '@/types';
import { formatCurrency, formatNumber, generateCSV, downloadCSV } from '@/lib/utils';
import { useDashboard } from '@/store';

interface ChartData {
  month: string;
  cases?: number;
  revenue?: number;
  utilization?: number;
  avgMinutes?: number;
  forecast?: number;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-lg">
        <p className="text-sm font-medium text-gray-900">{label}</p>
        {payload.map((entry: any, index: number) => (
          <p key={index} style={{ color: entry.color }} className="text-sm">
            {entry.name}: {typeof entry.value === 'number' ? entry.value.toFixed(1) : entry.value}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

const monthlyCasesData = [
  { month: 'Jan', cases: 95, utilizationRate: 68 },
  { month: 'Feb', cases: 102, utilizationRate: 72 },
  { month: 'Mar', cases: 118, utilizationRate: 78 },
  { month: 'Apr', cases: 125, utilizationRate: 76 },
  { month: 'May', cases: 142, utilizationRate: 82 },
  { month: 'Jun', cases: 156, utilizationRate: 85 },
  { month: 'Jul', cases: 165, utilizationRate: 88 },
  { month: 'Aug', cases: 159, utilizationRate: 86 },
  { month: 'Sep', cases: 148, utilizationRate: 81 },
  { month: 'Oct', cases: 132, utilizationRate: 75 },
  { month: 'Nov', cases: 118, utilizationRate: 70 },
  { month: 'Dec', cases: 128, utilizationRate: 76 },
];

const theaterUtilizationTrend = [
  { month: 'Jan', available: 1000, used: 680, emergency: 120, scheduled: 520, elective: 40 },
  { month: 'Feb', available: 1000, used: 720, emergency: 140, scheduled: 540, elective: 40 },
  { month: 'Mar', available: 1000, used: 780, emergency: 160, scheduled: 580, elective: 40 },
  { month: 'Apr', available: 1000, used: 760, emergency: 150, scheduled: 570, elective: 40 },
  { month: 'May', available: 1000, used: 820, emergency: 180, scheduled: 600, elective: 40 },
  { month: 'Jun', available: 1000, used: 850, emergency: 200, scheduled: 620, elective: 30 },
  { month: 'Jul', available: 1000, used: 880, emergency: 220, scheduled: 640, elective: 20 },
  { month: 'Aug', available: 1000, used: 860, emergency: 210, scheduled: 630, elective: 20 },
  { month: 'Sep', available: 1000, used: 810, emergency: 180, scheduled: 600, elective: 30 },
  { month: 'Oct', available: 1000, used: 750, emergency: 150, scheduled: 570, elective: 30 },
  { month: 'Nov', available: 1000, used: 700, emergency: 130, scheduled: 540, elective: 30 },
  { month: 'Dec', available: 1000, used: 760, emergency: 155, scheduled: 570, elective: 35 },
];

const occupancyTrendData = [
  { month: 'Jan', occupancy: 68, benchmark: 75 },
  { month: 'Feb', occupancy: 72, benchmark: 75 },
  { month: 'Mar', occupancy: 78, benchmark: 75 },
  { month: 'Apr', occupancy: 76, benchmark: 75 },
  { month: 'May', occupancy: 82, benchmark: 75 },
  { month: 'Jun', occupancy: 85, benchmark: 75 },
  { month: 'Jul', occupancy: 88, benchmark: 75 },
  { month: 'Aug', occupancy: 86, benchmark: 75 },
  { month: 'Sep', occupancy: 81, benchmark: 75 },
  { month: 'Oct', occupancy: 75, benchmark: 75 },
  { month: 'Nov', occupancy: 70, benchmark: 75 },
  { month: 'Dec', occupancy: 76, benchmark: 75 },
];

const peakUsageByHour = [
  { hour: '06:00', cases: 2 },
  { hour: '07:00', cases: 8 },
  { hour: '08:00', cases: 18 },
  { hour: '09:00', cases: 22 },
  { hour: '10:00', cases: 25 },
  { hour: '11:00', cases: 24 },
  { hour: '12:00', cases: 12 },
  { hour: '13:00', cases: 8 },
  { hour: '14:00', cases: 15 },
  { hour: '15:00', cases: 18 },
  { hour: '16:00', cases: 12 },
  { hour: '17:00', cases: 4 },
];

const efficiencyMetrics = [
  { metric: 'Avg Case Duration', value: '45.2 min', status: 'good' },
  { metric: 'Theater Turnover Time', value: '22 min', status: 'good' },
  { metric: 'Case Cancellation Rate', value: '3.2%', status: 'excellent' },
  { metric: 'Emergency Case %', value: '28%', status: 'good' },
  { metric: 'First Case On-Time', value: '94%', status: 'excellent' },
  { metric: 'Cost Per Case', value: '$2,850', status: 'good' },
];

export default function TheatrePage() {
  const dashData = useDashboard();

  if (!dashData) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <div className="rounded-xl border border-gray-200 bg-white p-12 shadow-sm max-w-md">
          <Upload className="h-12 w-12 text-slate-300 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-slate-800 mb-2">No Data Loaded</h2>
          <p className="text-slate-500 mb-6">Upload your CSV data to see theatre analytics here.</p>
          <a href="/upload" className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 transition-colors">
            Go to Upload
          </a>
        </div>
      </div>
    );
  }

  const metrics = dashData;

  // KPI Calculations
  const totalCases = metrics.theatreCases.reduce((a, b) => a + b, 0);
  const avgCasesPerMonth = totalCases / 12;
  const totalRevenue = metrics.monthRevenue.reduce((a, b) => a + b, 0);
  const revenuePerCase = totalRevenue / totalCases;
  const avgUtilization = metrics.theatreUtil.reduce((a, b) => a + b, 0) / metrics.theatreUtil.length;

  // Monthly cases data with trend
  const monthlyData: ChartData[] = MONTHS.map((month, idx) => ({
    month: month.substring(0, 3),
    cases: metrics.theatreCases[idx],
    utilization: metrics.theatreUtil[idx],
    revenue: metrics.monthRevenue[idx] * 0.4, // Estimate 40% from theatre
  }));

  // Revenue per case trend
  const revenuePerCaseData = MONTHS.map((month, idx) => ({
    month: month.substring(0, 3),
    revenue: (metrics.monthRevenue[idx] * 0.4) / metrics.theatreCases[idx],
  }));

  // Average minutes per case
  const minutesPerCaseData = MONTHS.map((month, idx) => ({
    month: month.substring(0, 3),
    avgMinutes: metrics.theatreMinutes[idx] / metrics.theatreCases[idx],
  }));

  // Utilization % with target color coding
  const utilizationData = MONTHS.map((month, idx) => {
    const util = metrics.theatreUtil[idx];
    return {
      month: month.substring(0, 3),
      utilization: util,
      target: 75,
      fill: util > 75 ? '#059669' : util > 50 ? '#d97706' : '#dc2626',
    };
  });

  // Monthly detail table
  const tableData = MONTHS.map((month, idx) => ({
    month,
    cases: metrics.theatreCases[idx],
    minutes: metrics.theatreMinutes[idx],
    revenue: (metrics.monthRevenue[idx] * 0.4),
    revenuePerCase: (metrics.monthRevenue[idx] * 0.4) / metrics.theatreCases[idx],
    utilization: metrics.theatreUtil[idx],
  }));

  const handleExport = () => {
    const exportData = [
      { metric: 'Total Cases', value: formatNumber(totalCases) },
      { metric: 'Avg Cases/Month', value: formatNumber(Math.round(avgCasesPerMonth)) },
      { metric: 'Total Revenue', value: formatCurrency(totalRevenue * 0.4) },
      { metric: 'Revenue/Case', value: formatCurrency(revenuePerCase) },
      { metric: 'Avg Utilization %', value: avgUtilization.toFixed(1) },
      ...tableData.map((row) => ({
        metric: `${row.month} - Cases`,
        value: formatNumber(row.cases),
      })),
    ];

    const csv = generateCSV(exportData);
    downloadCSV(csv, `theatre-${new Date().toISOString().split('T')[0]}.csv`);
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Theatre/OR Performance</h1>
          <p className="mt-1 text-sm text-gray-500">Surgical cases, utilization, and revenue analytics</p>
        </div>
        <Button onClick={handleExport} variant="outline" size="sm" className="gap-2">
          <Download className="h-4 w-4" />
          Export
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
          title="Avg Cases/Month"
          value={formatNumber(Math.round(avgCasesPerMonth))}
          trend="neutral"
          color="blue"
        />
        <StatCard
          title="Revenue"
          value={formatCurrency(totalRevenue * 0.4)}
          trend="neutral"
          color="green"
        />
        <StatCard
          title="Revenue/Case"
          value={formatCurrency(revenuePerCase)}
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
        {/* Monthly Cases Bar */}
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 px-5 py-4">
            <h2 className="text-sm font-semibold text-gray-900">Monthly Surgical Cases</h2>
            <p className="mt-1 text-xs text-gray-500">Cases with trend analysis</p>
          </div>
          <div className="px-5 pb-5">
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={monthlyData}>
                <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
                <XAxis dataKey="month" tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
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
            <p className="mt-1 text-xs text-gray-500">Target 75% (Green: &gt;75%, Amber: 50-75%, Red: &lt;50%)</p>
          </div>
          <div className="px-5 pb-5">
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={utilizationData}>
                <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
                <XAxis dataKey="month" tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
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
            <p className="mt-1 text-xs text-gray-500">Monthly average revenue per surgical case</p>
          </div>
          <div className="px-5 pb-5">
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={revenuePerCaseData}>
                <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
                <XAxis dataKey="month" tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} formatter={(value) => formatCurrency(value as number)} />
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
                <XAxis dataKey="month" tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="avgMinutes" fill="#d97706" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Monthly Detail Table */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 px-5 py-4">
          <h2 className="text-sm font-semibold text-gray-900">Monthly Detail</h2>
          <p className="mt-1 text-xs text-gray-500">Cases, minutes, revenue, and utilization by month</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-600">Month</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-gray-600">Cases</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-gray-600">Total Minutes</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-gray-600">Revenue</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-gray-600">Rev/Case</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-gray-600">Utilization %</th>
              </tr>
            </thead>
            <tbody>
              {tableData.map((row, idx) => (
                <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-5 py-3 text-sm text-gray-900">{row.month}</td>
                  <td className="px-5 py-3 text-right text-sm text-gray-600">{formatNumber(row.cases)}</td>
                  <td className="px-5 py-3 text-right text-sm text-gray-600">{formatNumber(row.minutes)}</td>
                  <td className="px-5 py-3 text-right text-sm text-gray-600">{formatCurrency(row.revenue)}</td>
                  <td className="px-5 py-3 text-right text-sm font-medium text-gray-900">{formatCurrency(row.revenuePerCase)}</td>
                  <td className="px-5 py-3 text-right text-sm text-gray-600">{row.utilization.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
