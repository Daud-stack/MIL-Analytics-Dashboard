'use client';

import React, { useState } from 'react';
import { Download, AlertCircle, BedDouble, Activity, ArrowRightLeft, Users, Building2, ClipboardList } from 'lucide-react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
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
import { ChartTooltipProps } from '@/types';
import { formatCurrency, formatNumber, generateCSV, downloadCSV } from '@/lib/utils';
import { useDashboard } from '@/store';
import { useDrillDown, useDrillDownRecord } from '@/hooks/useDrillDown';
import { useFilterStore } from '@/store/filter';
import Link from 'next/link';

const COLORS = ['#0d9488', '#475569', '#d97706', '#e11d48', '#7c3aed', '#0284c7', '#059669', '#dc2626', '#6366f1', '#f59e0b'];

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

type TabKey = 'overview' | 'inpatient' | 'wards' | 'discharges';

export default function AdmissionsPage() {
  const dashData = useDashboard();
  const { granularity } = useFilterStore();
  const [activeTab, setActiveTab] = useState<TabKey>('overview');

  // ── Drill-down hooks for all admission types ──
  const casualtyDrill = useDrillDown(dashData?.admCasualty);
  const inpatientDrill = useDrillDown(dashData?.admInpatient);
  const dayDrill = useDrillDown(dashData?.admDay);
  const labDrill = useDrillDown(dashData?.admLab);
  const transferDrill = useDrillDown(dashData?.casToInpatient);
  const dischNotFinDrill = useDrillDown(dashData?.dischNotFinalised);
  const dischNotFinValDrill = useDrillDown(dashData?.dischNotFinalisedValue);
  const epsFinalDrill = useDrillDown(dashData?.epsFinalised);
  const patientDaysDrill = useDrillDown(dashData?.occMidnight);

  // ── Record-based drill-downs ──
  const admPerWardDrill = useDrillDownRecord(dashData?.admPerWard);
  const dischargesDrill = useDrillDownRecord(dashData?.discharges);
  const dischPerWardDrill = useDrillDownRecord(dashData?.dischargesPerWard);

  // Empty state
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
              <Link href="/upload"><Button className="mt-4">Upload CSV</Button></Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── KPI calculations ──
  const casualtyTotal = casualtyDrill.total;
  const inpatientTotal = inpatientDrill.total;
  const dayTotal = dayDrill.total;
  const labTotal = labDrill.total;
  const totalAdmissions = casualtyTotal + inpatientTotal + dayTotal + labTotal;
  const totalTransfers = transferDrill.total;
  const transferRate = casualtyTotal > 0 ? (totalTransfers / casualtyTotal) * 100 : 0;

  // Inpatient-specific KPIs
  const totalPatientDays = patientDaysDrill.total;
  const avgLOS = inpatientTotal > 0 ? totalPatientDays / inpatientTotal : 0;
  const totalDischNotFin = dischNotFinDrill.total;
  const totalEpsFinal = epsFinalDrill.total;

  // ── Chart data ──
  const allAdmissionsChart = casualtyDrill.labels.map((label, i) => ({
    period: label,
    casualty: casualtyDrill.values[i],
    inpatient: inpatientDrill.values[i],
    day: dayDrill.values[i],
    lab: labDrill.values[i],
  }));

  const inpatientTrendChart = inpatientDrill.labels.map((label, i) => ({
    period: label,
    admissions: inpatientDrill.values[i],
    transfers: transferDrill.values[i],
    patientDays: patientDaysDrill.values[i],
  }));

  // ALOS per period (patient days / inpatient admissions)
  const alosChart = inpatientDrill.labels.map((label, i) => ({
    period: label,
    alos: inpatientDrill.values[i] > 0
      ? Math.round((patientDaysDrill.values[i] / inpatientDrill.values[i]) * 10) / 10
      : 0,
  }));

  // Admission mix pie (all four types)
  const mixData = [
    { name: 'Casualty', value: casualtyTotal },
    { name: 'In-Patient', value: inpatientTotal },
    { name: 'Day Patient', value: dayTotal },
    { name: 'Laboratory', value: labTotal },
  ].filter(d => d.value > 0);

  // Ward admission data
  const wardEntries = Array.from(admPerWardDrill.entries())
    .sort((a, b) => b[1].total - a[1].total);
  const topWards = wardEntries.slice(0, 10);
  const wardBarData = topWards.map(([name, drill]) => ({
    ward: name.length > 20 ? name.substring(0, 20) + '...' : name,
    fullName: name,
    admissions: drill.total,
  }));

  // Discharge data
  const dischargeEntries = Array.from(dischargesDrill.entries())
    .sort((a, b) => b[1].total - a[1].total);
  const dischPerWardEntries = Array.from(dischPerWardDrill.entries())
    .sort((a, b) => b[1].total - a[1].total);

  // Transfer rate over time
  const transferRateChart = casualtyDrill.labels.map((label, i) => ({
    period: label,
    rate: casualtyDrill.values[i] > 0
      ? Math.round((transferDrill.values[i] / casualtyDrill.values[i]) * 1000) / 10
      : 0,
  }));

  // Period label for display
  const periodLabel = granularity === 'year' ? 'Annual'
    : granularity === 'quarter' ? 'Quarterly'
    : granularity === 'week' ? 'Weekly'
    : granularity === 'day' ? 'Daily'
    : casualtyDrill.isFiltered ? 'Filtered' : 'Monthly';

  const handleExport = () => {
    const exportData = [
      { metric: 'Total Admissions', value: formatNumber(totalAdmissions) },
      { metric: 'Casualty Admissions', value: formatNumber(casualtyTotal) },
      { metric: 'In-Patient Admissions', value: formatNumber(inpatientTotal) },
      { metric: 'Day Patient Admissions', value: formatNumber(dayTotal) },
      { metric: 'Laboratory Admissions', value: formatNumber(labTotal) },
      { metric: 'Casualty to Inpatient Transfers', value: formatNumber(totalTransfers) },
      { metric: 'Transfer Rate %', value: transferRate.toFixed(1) },
      { metric: 'Total Patient Days', value: formatNumber(totalPatientDays) },
      { metric: 'Average Length of Stay (days)', value: avgLOS.toFixed(1) },
      ...casualtyDrill.points.map((pt, idx) => ({
        metric: `${pt.label} - Total`,
        value: formatNumber(
          casualtyDrill.values[idx] + inpatientDrill.values[idx] + dayDrill.values[idx] + labDrill.values[idx]
        ),
      })),
    ];
    const csv = generateCSV(exportData);
    downloadCSV(csv, `admissions-${new Date().toISOString().split('T')[0]}.csv`);
  };

  const tabs: { key: TabKey; label: string; icon: React.ReactNode }[] = [
    { key: 'overview', label: 'Overview', icon: <Activity className="h-4 w-4" /> },
    { key: 'inpatient', label: 'Inpatient', icon: <BedDouble className="h-4 w-4" /> },
    { key: 'wards', label: 'By Ward', icon: <Building2 className="h-4 w-4" /> },
    { key: 'discharges', label: 'Discharges', icon: <ClipboardList className="h-4 w-4" /> },
  ];

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Admissions Analytics</h1>
          <p className="mt-1 text-sm text-gray-500">
            {casualtyDrill.isFiltered
              ? `Filtered view · ${casualtyDrill.points.length} ${granularity}(s)`
              : 'Comprehensive admission patterns and trends'}
          </p>
        </div>
        <Button onClick={handleExport} variant="outline" size="sm" className="gap-2">
          <Download className="h-4 w-4" />
          Export CSV
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard title="Total Admissions" value={formatNumber(totalAdmissions)} trend="neutral" color="teal" />
        <StatCard title="Casualty" value={formatNumber(casualtyTotal)} trend="neutral" color="blue" />
        <StatCard title="In-Patient" value={formatNumber(inpatientTotal)} trend="neutral" color="violet" />
        <StatCard title="Day Patient" value={formatNumber(dayTotal)} trend="neutral" color="amber" />
        <StatCard title="Laboratory" value={formatNumber(labTotal)} trend="neutral" color="slate" />
      </div>

      {/* Secondary KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Casualty → Inpatient" value={formatNumber(totalTransfers)} trend="neutral" color="rose" />
        <StatCard title="Transfer Rate" value={`${transferRate.toFixed(1)}%`} trend="neutral" color="orange" />
        <StatCard title="Patient Days" value={formatNumber(totalPatientDays)} trend="neutral" color="cyan" />
        <StatCard title="Avg Length of Stay" value={`${avgLOS.toFixed(1)} days`} trend="neutral" color="emerald" />
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex gap-6" aria-label="Tabs">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 border-b-2 px-1 py-3 text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? 'border-teal-500 text-teal-600'
                  : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* ═══════════════════════ OVERVIEW TAB ═══════════════════════ */}
      {activeTab === 'overview' && (
        <>
          {/* Stacked Bar + Pie */}
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
              <div className="border-b border-gray-200 px-5 py-4">
                <h2 className="text-sm font-semibold text-gray-900">{periodLabel} Admission Breakdown</h2>
                <p className="mt-1 text-xs text-gray-500">All admission types by period</p>
              </div>
              <div className="px-5 pb-5">
                <ResponsiveContainer width="100%" height={340}>
                  <BarChart data={allAdmissionsChart}>
                    <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
                    <XAxis dataKey="period" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} interval={granularity === 'day' ? 29 : granularity === 'week' ? 3 : 0} />
                    <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                    <Bar dataKey="casualty" stackId="a" fill="#0284c7" name="Casualty" />
                    <Bar dataKey="inpatient" stackId="a" fill="#7c3aed" name="In-Patient" />
                    <Bar dataKey="day" stackId="a" fill="#d97706" name="Day Patient" />
                    <Bar dataKey="lab" stackId="a" fill="#475569" name="Laboratory" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
              <div className="border-b border-gray-200 px-5 py-4">
                <h2 className="text-sm font-semibold text-gray-900">Admission Type Mix</h2>
                <p className="mt-1 text-xs text-gray-500">Distribution across admission types</p>
              </div>
              <div className="px-5 pb-5">
                <ResponsiveContainer width="100%" height={340}>
                  <PieChart>
                    <Pie
                      data={mixData}
                      cx="50%"
                      cy="50%"
                      innerRadius={65}
                      outerRadius={110}
                      labelLine={false}
                      label={({ name, value, percent }) => `${name}: ${formatNumber(value)} (${((percent ?? 0) * 100).toFixed(0)}%)`}
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

          {/* Trend + Transfer Rate */}
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
              <div className="border-b border-gray-200 px-5 py-4">
                <h2 className="text-sm font-semibold text-gray-900">{periodLabel} Total Admission Trend</h2>
                <p className="mt-1 text-xs text-gray-500">Combined admissions across all types</p>
              </div>
              <div className="px-5 pb-5">
                <ResponsiveContainer width="100%" height={320}>
                  <AreaChart data={allAdmissionsChart.map(d => ({
                    period: d.period,
                    total: d.casualty + d.inpatient + d.day + d.lab,
                  }))}>
                    <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
                    <XAxis dataKey="period" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} interval={granularity === 'day' ? 29 : granularity === 'week' ? 3 : 0} />
                    <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Area type="monotone" dataKey="total" stroke="#0d9488" fill="#0d948820" strokeWidth={2} name="Total Admissions" dot={granularity === 'day' ? false : { r: 3 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
              <div className="border-b border-gray-200 px-5 py-4">
                <h2 className="text-sm font-semibold text-gray-900">Casualty → Inpatient Transfer Rate</h2>
                <p className="mt-1 text-xs text-gray-500">{periodLabel} transfer rate percentage</p>
              </div>
              <div className="px-5 pb-5">
                <ResponsiveContainer width="100%" height={320}>
                  <LineChart data={transferRateChart}>
                    <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
                    <XAxis dataKey="period" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} interval={granularity === 'day' ? 29 : granularity === 'week' ? 3 : 0} />
                    <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} unit="%" />
                    <Tooltip formatter={(value) => `${(value as number).toFixed(1)}%`} />
                    <Line type="monotone" dataKey="rate" stroke="#d97706" strokeWidth={3} name="Transfer Rate" dot={granularity === 'day' ? false : { fill: '#d97706', r: 4 }} activeDot={{ r: 6 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Detail Table */}
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-200 px-5 py-4">
              <h2 className="text-sm font-semibold text-gray-900">{periodLabel} Admission Detail</h2>
              <p className="mt-1 text-xs text-gray-500">{casualtyDrill.points.length} period(s)</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-gray-200 bg-gray-50">
                  <tr>
                    <th className="px-5 py-3 text-left font-semibold text-gray-900">Period</th>
                    <th className="px-5 py-3 text-right font-semibold text-gray-900">Casualty</th>
                    <th className="px-5 py-3 text-right font-semibold text-gray-900">In-Patient</th>
                    <th className="px-5 py-3 text-right font-semibold text-gray-900">Day Patient</th>
                    <th className="px-5 py-3 text-right font-semibold text-gray-900">Laboratory</th>
                    <th className="px-5 py-3 text-right font-semibold text-gray-900">Transfers</th>
                    <th className="px-5 py-3 text-right font-semibold text-gray-900">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {casualtyDrill.points.map((pt, idx) => (
                    <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-5 py-3 text-gray-900">{pt.label}</td>
                      <td className="px-5 py-3 text-right text-gray-700">{formatNumber(casualtyDrill.values[idx])}</td>
                      <td className="px-5 py-3 text-right text-violet-700 font-medium">{formatNumber(inpatientDrill.values[idx])}</td>
                      <td className="px-5 py-3 text-right text-gray-600">{formatNumber(dayDrill.values[idx])}</td>
                      <td className="px-5 py-3 text-right text-gray-600">{formatNumber(labDrill.values[idx])}</td>
                      <td className="px-5 py-3 text-right text-rose-600">{formatNumber(transferDrill.values[idx])}</td>
                      <td className="px-5 py-3 text-right text-gray-900 font-medium">
                        {formatNumber(casualtyDrill.values[idx] + inpatientDrill.values[idx] + dayDrill.values[idx] + labDrill.values[idx])}
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-gray-50 font-semibold">
                    <td className="px-5 py-3 text-gray-900">Total</td>
                    <td className="px-5 py-3 text-right text-gray-900">{formatNumber(casualtyTotal)}</td>
                    <td className="px-5 py-3 text-right text-violet-900">{formatNumber(inpatientTotal)}</td>
                    <td className="px-5 py-3 text-right text-gray-700">{formatNumber(dayTotal)}</td>
                    <td className="px-5 py-3 text-right text-gray-700">{formatNumber(labTotal)}</td>
                    <td className="px-5 py-3 text-right text-rose-700">{formatNumber(totalTransfers)}</td>
                    <td className="px-5 py-3 text-right text-gray-900">{formatNumber(totalAdmissions)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ═══════════════════════ INPATIENT TAB ═══════════════════════ */}
      {activeTab === 'inpatient' && (
        <>
          {/* Inpatient-specific KPIs */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard title="Inpatient Admissions" value={formatNumber(inpatientTotal)} trend="neutral" color="violet" />
            <StatCard title="Total Patient Days" value={formatNumber(totalPatientDays)} trend="neutral" color="cyan" />
            <StatCard title="Avg Length of Stay" value={`${avgLOS.toFixed(1)} days`} trend="neutral" color="emerald" />
            <StatCard title="Episodes Finalised" value={formatNumber(totalEpsFinal)} trend="neutral" color="blue" />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Inpatient Admissions + Patient Days */}
            <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
              <div className="border-b border-gray-200 px-5 py-4">
                <h2 className="text-sm font-semibold text-gray-900">{periodLabel} Inpatient Admissions vs Patient Days</h2>
                <p className="mt-1 text-xs text-gray-500">Admission volume and resulting patient days</p>
              </div>
              <div className="px-5 pb-5">
                <ResponsiveContainer width="100%" height={340}>
                  <BarChart data={inpatientTrendChart}>
                    <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
                    <XAxis dataKey="period" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} interval={granularity === 'day' ? 29 : granularity === 'week' ? 3 : 0} />
                    <YAxis yAxisId="left" tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                    <Bar yAxisId="left" dataKey="admissions" fill="#7c3aed" name="Admissions" radius={[4, 4, 0, 0]} />
                    <Line yAxisId="right" type="monotone" dataKey="patientDays" stroke="#0891b2" strokeWidth={2} name="Patient Days" dot={{ r: 3 }} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* ALOS Trend */}
            <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
              <div className="border-b border-gray-200 px-5 py-4">
                <h2 className="text-sm font-semibold text-gray-900">{periodLabel} Average Length of Stay</h2>
                <p className="mt-1 text-xs text-gray-500">Patient days per inpatient admission</p>
              </div>
              <div className="px-5 pb-5">
                <ResponsiveContainer width="100%" height={340}>
                  <AreaChart data={alosChart}>
                    <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
                    <XAxis dataKey="period" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} interval={granularity === 'day' ? 29 : granularity === 'week' ? 3 : 0} />
                    <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} unit=" d" />
                    <Tooltip formatter={(value) => `${(value as number).toFixed(1)} days`} />
                    <Area type="monotone" dataKey="alos" stroke="#059669" fill="#05966920" strokeWidth={2} name="ALOS (days)" dot={granularity === 'day' ? false : { fill: '#059669', r: 4 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Inpatient Transfers + Source */}
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
              <div className="border-b border-gray-200 px-5 py-4">
                <h2 className="text-sm font-semibold text-gray-900">Casualty → Inpatient Transfers</h2>
                <p className="mt-1 text-xs text-gray-500">Patients transferred from casualty to inpatient care</p>
              </div>
              <div className="px-5 pb-5">
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={inpatientTrendChart}>
                    <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
                    <XAxis dataKey="period" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} interval={granularity === 'day' ? 29 : granularity === 'week' ? 3 : 0} />
                    <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                    <Bar dataKey="admissions" fill="#7c3aed" name="Direct Inpatient" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="transfers" fill="#e11d48" name="From Casualty" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Discharged Not Finalised */}
            <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
              <div className="border-b border-gray-200 px-5 py-4">
                <h2 className="text-sm font-semibold text-gray-900">Discharged Not Finalised</h2>
                <p className="mt-1 text-xs text-gray-500">Episodes discharged but billing not completed</p>
              </div>
              <div className="px-5 pb-5">
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={dischNotFinDrill.labels.map((label, i) => ({
                    period: label,
                    count: dischNotFinDrill.values[i],
                    value: dischNotFinValDrill.values[i],
                  }))}>
                    <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
                    <XAxis dataKey="period" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} interval={granularity === 'day' ? 29 : granularity === 'week' ? 3 : 0} />
                    <YAxis yAxisId="left" tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                    <Bar yAxisId="left" dataKey="count" fill="#dc2626" name="Count" radius={[4, 4, 0, 0]} />
                    <Line yAxisId="right" type="monotone" dataKey="value" stroke="#f59e0b" strokeWidth={2} name="Value ($)" dot={{ r: 3 }} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Inpatient Detail Table */}
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-200 px-5 py-4">
              <h2 className="text-sm font-semibold text-gray-900">{periodLabel} Inpatient Detail</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-gray-200 bg-gray-50">
                  <tr>
                    <th className="px-5 py-3 text-left font-semibold text-gray-900">Period</th>
                    <th className="px-5 py-3 text-right font-semibold text-gray-900">Admissions</th>
                    <th className="px-5 py-3 text-right font-semibold text-gray-900">From Casualty</th>
                    <th className="px-5 py-3 text-right font-semibold text-gray-900">Patient Days</th>
                    <th className="px-5 py-3 text-right font-semibold text-gray-900">ALOS</th>
                    <th className="px-5 py-3 text-right font-semibold text-gray-900">Eps Finalised</th>
                    <th className="px-5 py-3 text-right font-semibold text-gray-900">Not Finalised</th>
                  </tr>
                </thead>
                <tbody>
                  {inpatientDrill.points.map((pt, idx) => (
                    <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-5 py-3 text-gray-900">{pt.label}</td>
                      <td className="px-5 py-3 text-right text-violet-700 font-medium">{formatNumber(inpatientDrill.values[idx])}</td>
                      <td className="px-5 py-3 text-right text-rose-600">{formatNumber(transferDrill.values[idx])}</td>
                      <td className="px-5 py-3 text-right text-cyan-700">{formatNumber(patientDaysDrill.values[idx])}</td>
                      <td className="px-5 py-3 text-right text-emerald-700">
                        {inpatientDrill.values[idx] > 0
                          ? (patientDaysDrill.values[idx] / inpatientDrill.values[idx]).toFixed(1)
                          : '—'}
                      </td>
                      <td className="px-5 py-3 text-right text-gray-700">{formatNumber(epsFinalDrill.values[idx])}</td>
                      <td className="px-5 py-3 text-right text-red-600">{formatNumber(dischNotFinDrill.values[idx])}</td>
                    </tr>
                  ))}
                  <tr className="bg-gray-50 font-semibold">
                    <td className="px-5 py-3 text-gray-900">Total</td>
                    <td className="px-5 py-3 text-right text-violet-900">{formatNumber(inpatientTotal)}</td>
                    <td className="px-5 py-3 text-right text-rose-700">{formatNumber(totalTransfers)}</td>
                    <td className="px-5 py-3 text-right text-cyan-900">{formatNumber(totalPatientDays)}</td>
                    <td className="px-5 py-3 text-right text-emerald-700">{avgLOS.toFixed(1)}</td>
                    <td className="px-5 py-3 text-right text-gray-700">{formatNumber(totalEpsFinal)}</td>
                    <td className="px-5 py-3 text-right text-red-600">{formatNumber(totalDischNotFin)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ═══════════════════════ WARDS TAB ═══════════════════════ */}
      {activeTab === 'wards' && (
        <>
          {/* Top Wards Bar Chart */}
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-200 px-5 py-4">
              <h2 className="text-sm font-semibold text-gray-900">Admissions by Ward</h2>
              <p className="mt-1 text-xs text-gray-500">Top {topWards.length} wards by total admissions</p>
            </div>
            <div className="px-5 pb-5">
              <ResponsiveContainer width="100%" height={Math.max(320, topWards.length * 40)}>
                <BarChart data={wardBarData} layout="vertical">
                  <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
                  <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="ward" width={160} tick={{ fill: '#475569', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip content={({ active, payload }) => {
                    if (active && payload?.[0]) {
                      const data = payload[0].payload;
                      return (
                        <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-lg">
                          <p className="text-sm font-medium text-gray-900">{data.fullName}</p>
                          <p className="text-sm text-teal-600">Admissions: {formatNumber(data.admissions)}</p>
                        </div>
                      );
                    }
                    return null;
                  }} />
                  <Bar dataKey="admissions" fill="#0d9488" name="Admissions" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Ward Detail Table */}
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-200 px-5 py-4">
              <h2 className="text-sm font-semibold text-gray-900">{periodLabel} Admissions per Ward</h2>
              <p className="mt-1 text-xs text-gray-500">{wardEntries.length} wards</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-gray-200 bg-gray-50">
                  <tr>
                    <th className="px-5 py-3 text-left font-semibold text-gray-900">Ward</th>
                    {casualtyDrill.labels.map((label) => (
                      <th key={label} className="px-3 py-3 text-right font-semibold text-gray-900 text-xs">{label}</th>
                    ))}
                    <th className="px-5 py-3 text-right font-semibold text-gray-900">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {wardEntries.map(([ward, drill]) => (
                    <tr key={ward} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-5 py-2.5 text-gray-900 text-xs font-medium whitespace-nowrap">{ward}</td>
                      {drill.values.map((val, i) => (
                        <td key={i} className="px-3 py-2.5 text-right text-gray-600 text-xs">{val > 0 ? formatNumber(val) : '—'}</td>
                      ))}
                      <td className="px-5 py-2.5 text-right text-gray-900 font-semibold text-xs">{formatNumber(drill.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ═══════════════════════ DISCHARGES TAB ═══════════════════════ */}
      {activeTab === 'discharges' && (
        <>
          {/* Discharge KPIs */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <StatCard title="Episodes Finalised" value={formatNumber(totalEpsFinal)} trend="neutral" color="teal" />
            <StatCard title="Discharged Not Finalised" value={formatNumber(totalDischNotFin)} trend="neutral" color="rose" />
            <StatCard
              title="Not Finalised Value"
              value={formatCurrency(dischNotFinValDrill.total)}
              trend="neutral"
              color="amber"
            />
          </div>

          {/* Discharges by Type */}
          {dischargeEntries.length > 0 && (
            <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
              <div className="border-b border-gray-200 px-5 py-4">
                <h2 className="text-sm font-semibold text-gray-900">Discharges by Type</h2>
                <p className="mt-1 text-xs text-gray-500">{dischargeEntries.length} discharge categories</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-gray-200 bg-gray-50">
                    <tr>
                      <th className="px-5 py-3 text-left font-semibold text-gray-900">Discharge Type</th>
                      {casualtyDrill.labels.map((label) => (
                        <th key={label} className="px-3 py-3 text-right font-semibold text-gray-900 text-xs">{label}</th>
                      ))}
                      <th className="px-5 py-3 text-right font-semibold text-gray-900">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dischargeEntries.map(([type, drill]) => (
                      <tr key={type} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="px-5 py-2.5 text-gray-900 text-xs font-medium">{type}</td>
                        {drill.values.map((val, i) => (
                          <td key={i} className="px-3 py-2.5 text-right text-gray-600 text-xs">{val > 0 ? formatNumber(val) : '—'}</td>
                        ))}
                        <td className="px-5 py-2.5 text-right text-gray-900 font-semibold text-xs">{formatNumber(drill.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Discharges per Ward */}
          {dischPerWardEntries.length > 0 && (
            <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
              <div className="border-b border-gray-200 px-5 py-4">
                <h2 className="text-sm font-semibold text-gray-900">Discharges per Ward</h2>
                <p className="mt-1 text-xs text-gray-500">{dischPerWardEntries.length} wards</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-gray-200 bg-gray-50">
                    <tr>
                      <th className="px-5 py-3 text-left font-semibold text-gray-900">Ward</th>
                      {casualtyDrill.labels.map((label) => (
                        <th key={label} className="px-3 py-3 text-right font-semibold text-gray-900 text-xs">{label}</th>
                      ))}
                      <th className="px-5 py-3 text-right font-semibold text-gray-900">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dischPerWardEntries.map(([ward, drill]) => (
                      <tr key={ward} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="px-5 py-2.5 text-gray-900 text-xs font-medium whitespace-nowrap">{ward}</td>
                        {drill.values.map((val, i) => (
                          <td key={i} className="px-3 py-2.5 text-right text-gray-600 text-xs">{val > 0 ? formatNumber(val) : '—'}</td>
                        ))}
                        <td className="px-5 py-2.5 text-right text-gray-900 font-semibold text-xs">{formatNumber(drill.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Finalisation Trend */}
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-200 px-5 py-4">
              <h2 className="text-sm font-semibold text-gray-900">{periodLabel} Finalisation Trend</h2>
              <p className="mt-1 text-xs text-gray-500">Episodes finalised vs discharged not finalised</p>
            </div>
            <div className="px-5 pb-5">
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={epsFinalDrill.labels.map((label, i) => ({
                  period: label,
                  finalised: epsFinalDrill.values[i],
                  notFinalised: dischNotFinDrill.values[i],
                }))}>
                  <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
                  <XAxis dataKey="period" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} interval={granularity === 'day' ? 29 : granularity === 'week' ? 3 : 0} />
                  <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Bar dataKey="finalised" fill="#0d9488" name="Finalised" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="notFinalised" fill="#dc2626" name="Not Finalised" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
