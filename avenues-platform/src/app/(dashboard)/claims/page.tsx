'use client';

import React, { useState } from 'react';
import { Download, Upload } from 'lucide-react';
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
import { MONTHS } from '@/types';
import { formatCurrency, formatNumber, generateCSV, downloadCSV } from '@/lib/utils';
import { useClaims } from '@/store';

const COLORS = ['#0d9488', '#475569', '#d97706', '#e11d48', '#7c3aed', '#0284c7', '#059669', '#dc2626'];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-lg">
        <p className="text-sm font-medium text-gray-900">{label}</p>
        {payload.map((entry: any, idx: number) => (
          <p key={idx} style={{ color: entry.color }} className="text-sm">
            {entry.name}: {typeof entry.value === 'number'
              ? entry.dataKey?.includes('Amount') || entry.dataKey?.includes('Claimed')
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

export default function ClaimsPage() {
  const [sortBy, setSortBy] = useState<'amount' | 'count'>('amount');
  const claims = useClaims();

  if (!claims) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <div className="rounded-xl border border-gray-200 bg-white p-12 shadow-sm max-w-md">
          <Upload className="h-12 w-12 text-slate-300 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-slate-800 mb-2">No Data Loaded</h2>
          <p className="text-slate-500 mb-6">Upload your Claims CSV to see analytics here.</p>
          <a href="/upload" className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 transition-colors">
            Go to Upload
          </a>
        </div>
      </div>
    );
  }

  // Monthly comparison data
  const monthlyData = MONTHS.map((month, idx) => ({
    month: month.substring(0, 3),
    submitted: claims.totalClaims_monthly[idx],
    approved: claims.approvedClaims_monthly[idx],
    rejected: claims.rejectedClaims_monthly[idx],
    pending: claims.pendingClaims_monthly[idx],
  }));

  // Claims by medical aid
  const schemeData = Object.entries(claims.byScheme)
    .map(([name, data]) => ({
      name: name.substring(0, 18),
      submitted: data.submitted,
      approved: data.approved,
      rejected: data.rejected,
      amount: data.totalClaimed,
    }))
    .sort((a, b) => b.submitted - a.submitted);

  // Claims status distribution
  const statusData = [
    { name: 'Approved', value: claims.approved },
    { name: 'Rejected', value: claims.rejected },
    { name: 'Pending', value: claims.pending },
  ];

  // Rejection reasons
  const rejectionData = Object.entries(claims.rejectionReasons)
    .map(([reason, count]) => ({
      name: reason,
      value: count,
    }))
    .sort((a, b) => b.value - a.value);

  // Monthly claim amount trend
  const amountTrendData = MONTHS.map((month, idx) => ({
    month: month.substring(0, 3),
    amount: claims.claimAmounts_monthly[idx],
  }));

  // Top doctors by claims
  const doctorsData = Object.entries(claims.byDoctor)
    .map(([name, data]) => ({
      name: name.split(' ')[1],
      claims: data.claims,
      approved: data.approved,
      amount: data.amount,
    }))
    .sort((a, b) => sortBy === 'amount' ? b.amount - a.amount : b.claims - a.claims)
    .slice(0, 10);

  // Scheme performance
  const schemePerformanceData = Object.entries(claims.byScheme)
    .map(([name, data]) => {
      const approvalRate = data.submitted > 0 ? (data.approved / data.submitted) * 100 : 0;
      return {
        name: name.substring(0, 18),
        submitted: data.submitted,
        approved: data.approved,
        rejected: data.rejected,
        approvalRate: approvalRate,
      };
    })
    .sort((a, b) => b.submitted - a.submitted);

  // Calculations
  const totalClaims = claims.totalClaims;
  const totalClaimed = claims.totalClaimed;
  const approvalRate = (claims.approved / claims.totalClaims) * 100;
  const rejectionRate = (claims.rejected / claims.totalClaims) * 100;
  const avgProcessingDays = 10; // Typical healthcare claim

  const handleExportClaims = () => {
    const exportData = [
      { metric: 'Total Claims', value: formatNumber(totalClaims) },
      { metric: 'Total Claimed Amount', value: formatCurrency(totalClaimed) },
      { metric: 'Approval Rate %', value: approvalRate.toFixed(1) },
      { metric: 'Rejection Rate %', value: rejectionRate.toFixed(1) },
      { metric: 'Avg Processing Days', value: avgProcessingDays },
      ...monthlyData.map((d) => ({
        metric: `${d.month} - Submitted`,
        value: formatNumber(d.submitted),
      })),
    ];
    const csv = generateCSV(exportData);
    downloadCSV(csv, `claims-overview-${new Date().toISOString().split('T')[0]}.csv`);
  };

  const handleExportDoctors = () => {
    const exportData = doctorsData.map((d) => ({
      doctor: d.name,
      claims: formatNumber(d.claims),
      approved: formatNumber(d.approved),
      amount: formatCurrency(d.amount),
    }));
    const csv = generateCSV(exportData);
    downloadCSV(csv, `claims-by-doctor-${new Date().toISOString().split('T')[0]}.csv`);
  };

  const handleExportSchemes = () => {
    const exportData = schemePerformanceData.map((d) => ({
      scheme: d.name,
      submitted: formatNumber(d.submitted),
      approved: formatNumber(d.approved),
      rejected: formatNumber(d.rejected),
      approvalRate: d.approvalRate.toFixed(1),
    }));
    const csv = generateCSV(exportData);
    downloadCSV(csv, `claims-by-scheme-${new Date().toISOString().split('T')[0]}.csv`);
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Claims Processing Analytics</h1>
          <p className="mt-1 text-sm text-gray-500">Medical aid claims status and performance</p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={handleExportClaims} variant="outline" size="sm" className="gap-2">
            <Download className="h-4 w-4" />
            Export Overview
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard
          title="Total Claims"
          value={formatNumber(totalClaims)}
          trend="neutral"
          color="teal"
        />
        <StatCard
          title="Total Claimed"
          value={formatCurrency(totalClaimed)}
          trend="neutral"
          color="blue"
        />
        <StatCard
          title="Approval Rate %"
          value={`${approvalRate.toFixed(1)}%`}
          trend="neutral"
          color="green"
        />
        <StatCard
          title="Rejection Rate %"
          value={`${rejectionRate.toFixed(1)}%`}
          trend="neutral"
          color="rose"
        />
        <StatCard
          title="Avg Processing Days"
          value={`${avgProcessingDays} days`}
          trend="neutral"
          color="purple"
        />
      </div>

      {/* Charts Row 1 */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Monthly Claims Comparison */}
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 px-5 py-4">
            <h2 className="text-sm font-semibold text-gray-900">Monthly Claims Comparison</h2>
            <p className="mt-1 text-xs text-gray-500">Submitted, approved, rejected, and pending</p>
          </div>
          <div className="px-5 pb-5">
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={monthlyData}>
                <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
                <XAxis dataKey="month" tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Bar dataKey="submitted" fill="#0d9488" radius={[4, 4, 0, 0]} />
                <Bar dataKey="approved" fill="#059669" radius={[4, 4, 0, 0]} />
                <Bar dataKey="rejected" fill="#dc2626" radius={[4, 4, 0, 0]} />
                <Bar dataKey="pending" fill="#d97706" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Claims by Medical Aid Scheme */}
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 px-5 py-4">
            <h2 className="text-sm font-semibold text-gray-900">Claims by Medical Aid Scheme</h2>
            <p className="mt-1 text-xs text-gray-500">Volume by scheme provider</p>
          </div>
          <div className="px-5 pb-5">
            <ResponsiveContainer width="100%" height={320}>
              <BarChart
                data={schemeData}
                layout="vertical"
                margin={{ top: 5, right: 30, left: 200 }}
              >
                <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
                <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis
                  dataKey="name"
                  type="category"
                  tick={{ fill: '#94a3b8', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  width={195}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="submitted" fill="#0284c7" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Claims Status Distribution */}
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 px-5 py-4">
            <h2 className="text-sm font-semibold text-gray-900">Claims Status Distribution</h2>
            <p className="mt-1 text-xs text-gray-500">Overall breakdown by status</p>
          </div>
          <div className="px-5 pb-5">
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }) => `${name}: ${formatNumber(value as number)}`}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {statusData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => formatNumber(value as number)} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Rejection Reasons */}
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 px-5 py-4">
            <h2 className="text-sm font-semibold text-gray-900">Rejection Reasons Breakdown</h2>
            <p className="mt-1 text-xs text-gray-500">Common denial causes</p>
          </div>
          <div className="px-5 pb-5">
            <ResponsiveContainer width="100%" height={320}>
              <BarChart
                data={rejectionData}
                layout="vertical"
                margin={{ top: 5, right: 30, left: 200 }}
              >
                <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
                <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis
                  dataKey="name"
                  type="category"
                  tick={{ fill: '#94a3b8', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  width={195}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="value" fill="#e11d48" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Charts Row 3 */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 px-5 py-4">
          <h2 className="text-sm font-semibold text-gray-900">Monthly Claim Amount Trend</h2>
          <p className="mt-1 text-xs text-gray-500">Total value of claims submitted</p>
        </div>
        <div className="px-5 pb-5">
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={amountTrendData}>
              <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
              <XAxis dataKey="month" tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Line
                type="monotone"
                dataKey="amount"
                stroke="#7c3aed"
                strokeWidth={3}
                dot={{ fill: '#7c3aed', r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Tables Row */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Top 10 Doctors by Claims */}
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 px-5 py-4 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-gray-900">Top 10 Doctors by Claims</h2>
              <p className="mt-1 text-xs text-gray-500">Ranked by volume or amount</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSortBy('count')}
                className={`px-3 py-1 text-xs font-medium rounded ${sortBy === 'count' ? 'bg-teal-100 text-teal-700' : 'bg-gray-100 text-gray-700'}`}
              >
                Count
              </button>
              <button
                onClick={() => setSortBy('amount')}
                className={`px-3 py-1 text-xs font-medium rounded ${sortBy === 'amount' ? 'bg-teal-100 text-teal-700' : 'bg-gray-100 text-gray-700'}`}
              >
                Amount
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-gray-200 bg-gray-50">
                <tr>
                  <th className="px-5 py-3 text-left font-semibold text-gray-900">Doctor</th>
                  <th className="px-5 py-3 text-right font-semibold text-gray-900">Claims</th>
                  <th className="px-5 py-3 text-right font-semibold text-gray-900">Approved</th>
                  <th className="px-5 py-3 text-right font-semibold text-gray-900">Amount</th>
                </tr>
              </thead>
              <tbody>
                {doctorsData.map((doc, idx) => (
                  <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-5 py-3 text-gray-900 font-medium">{doc.name}</td>
                    <td className="px-5 py-3 text-right text-gray-700">{formatNumber(doc.claims)}</td>
                    <td className="px-5 py-3 text-right text-gray-700">{formatNumber(doc.approved)}</td>
                    <td className="px-5 py-3 text-right text-gray-700 font-medium">{formatCurrency(doc.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="border-t border-gray-200 px-5 py-3">
            <Button onClick={handleExportDoctors} variant="outline" size="sm" className="gap-2">
              <Download className="h-4 w-4" />
              Export
            </Button>
          </div>
        </div>

        {/* Scheme Performance */}
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 px-5 py-4">
            <h2 className="text-sm font-semibold text-gray-900">Scheme Performance</h2>
            <p className="mt-1 text-xs text-gray-500">Approval rates by medical aid</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-gray-200 bg-gray-50">
                <tr>
                  <th className="px-5 py-3 text-left font-semibold text-gray-900">Scheme</th>
                  <th className="px-5 py-3 text-right font-semibold text-gray-900">Submitted</th>
                  <th className="px-5 py-3 text-right font-semibold text-gray-900">Approved</th>
                  <th className="px-5 py-3 text-right font-semibold text-gray-900">Rate %</th>
                </tr>
              </thead>
              <tbody>
                {schemePerformanceData.map((scheme, idx) => (
                  <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-5 py-3 text-gray-900 font-medium">{scheme.name}</td>
                    <td className="px-5 py-3 text-right text-gray-700">{formatNumber(scheme.submitted)}</td>
                    <td className="px-5 py-3 text-right text-gray-700">{formatNumber(scheme.approved)}</td>
                    <td className="px-5 py-3 text-right text-gray-700 font-medium">{scheme.approvalRate.toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="border-t border-gray-200 px-5 py-3">
            <Button onClick={handleExportSchemes} variant="outline" size="sm" className="gap-2">
              <Download className="h-4 w-4" />
              Export
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
