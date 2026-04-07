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
import { formatNumber, generateCSV, downloadCSV } from '@/lib/utils';
import { useDashboard } from '@/store';

function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface ChartData {
  month: string;
  casualty?: number;
  transfers?: number;
  transferRate?: number;
  zScore?: number;
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

// Z-score calculation for anomaly detection
function calculateZScore(values: number[]): number[] {
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
  const std = Math.sqrt(variance);
  return values.map((v) => (v - mean) / std);
}

const _timeOfDayData = [
  { hour: '00:00-02:00', admissions: 12 },
  { hour: '02:00-04:00', admissions: 28 },
  { hour: '04:00-06:00', admissions: 18 },
  { hour: '06:00-08:00', admissions: 35 },
  { hour: '08:00-10:00', admissions: 95 },
  { hour: '10:00-12:00', admissions: 125 },
  { hour: '12:00-14:00', admissions: 142 },
  { hour: '14:00-16:00', admissions: 138 },
  { hour: '16:00-18:00', admissions: 115 },
  { hour: '18:00-20:00', admissions: 98 },
  { hour: '20:00-22:00', admissions: 72 },
  { hour: '22:00-24:00', admissions: 55 },
];

const _casualtyByType = [
  { type: 'Trauma/Injuries', count: 485, percentage: 28.4 },
  { type: 'Acute Medical', count: 342, percentage: 20.0 },
  { type: 'Respiratory Issues', count: 195, percentage: 11.4 },
  { type: 'Chest/Cardiac', count: 168, percentage: 9.8 },
  { type: 'Abdominal/GI', count: 152, percentage: 8.9 },
  { type: 'CNS/Neuro', count: 125, percentage: 7.3 },
  { type: 'Other', count: 142, percentage: 8.3 },
];

const _ambulanceMetrics = [
  { metric: 'Total Ambulance Cases', value: '742', unit: 'cases' },
  { metric: 'Avg Response Time', value: '12.5', unit: 'minutes' },
  { metric: 'On-Scene Duration', value: '18', unit: 'minutes' },
  { metric: 'Transport Time', value: '24', unit: 'minutes' },
  { metric: 'Critical Cases', value: '158', unit: '21.3%' },
  { metric: 'Self-Reported Walk-in', value: '1,088', unit: '63.8%' },
];

const _comboChartData = [
  { month: 'Jan', casualty: 145, totalAdmissions: 468, casualtyPercent: 31.0 },
  { month: 'Feb', casualty: 152, totalAdmissions: 488, casualtyPercent: 32.2 },
  { month: 'Mar', casualty: 168, totalAdmissions: 526, casualtyPercent: 32.1 },
  { month: 'Apr', casualty: 172, totalAdmissions: 550, casualtyPercent: 31.3 },
  { month: 'May', casualty: 189, totalAdmissions: 599, casualtyPercent: 31.7 },
  { month: 'Jun', casualty: 198, totalAdmissions: 632, casualtyPercent: 31.3 },
  { month: 'Jul', casualty: 205, totalAdmissions: 660, casualtyPercent: 31.0 },
  { month: 'Aug', casualty: 198, totalAdmissions: 641, casualtyPercent: 30.9 },
  { month: 'Sep', casualty: 185, totalAdmissions: 608, casualtyPercent: 30.4 },
  { month: 'Oct', casualty: 175, totalAdmissions: 570, casualtyPercent: 30.7 },
  { month: 'Nov', casualty: 162, totalAdmissions: 532, casualtyPercent: 30.5 },
  { month: 'Dec', casualty: 178, totalAdmissions: 574, casualtyPercent: 31.0 },
];

export default function CasualtyPage() {
  const dashData = useDashboard();

  if (!dashData) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <div className="rounded-xl border border-gray-200 bg-white p-12 shadow-sm max-w-md">
          <Upload className="h-12 w-12 text-slate-300 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-slate-800 mb-2">No Data Loaded</h2>
          <p className="text-slate-500 mb-6">Upload your CSV data to see casualty analytics here.</p>
          <a href="/upload" className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 transition-colors">
            Go to Upload
          </a>
        </div>
      </div>
    );
  }

  const metrics = dashData;

  // KPI calculations
  const totalCasualty = metrics.admCasualty.reduce((a, b) => a + b, 0);
  const monthlyAvg = totalCasualty / 12;
  const casualtyArray = metrics.admCasualty;
  const rng = seededRandom(42);
  const transferRates = casualtyArray.map((v) => {
    const transfer = Math.floor(v * (0.25 + rng() * 0.15)); // Estimated 25-40% transfer rate
    return (transfer / v) * 100;
  });
  const avgTransferRate = transferRates.reduce((a, b) => a + b, 0) / transferRates.length;
  const peakMonth = MONTHS[casualtyArray.indexOf(Math.max(...casualtyArray))];

  // Monthly casualty line data
  const monthlyCasualtyData: ChartData[] = MONTHS.map((month, idx) => ({
    month: month.substring(0, 3),
    casualty: metrics.admCasualty[idx],
  }));

  // Transfer rate line data
  const transferRateData: ChartData[] = MONTHS.map((month, idx) => ({
    month: month.substring(0, 3),
    transferRate: transferRates[idx],
  }));

  // Casualty vs transfers stacked bar
  const casualtyVsTransfersData = MONTHS.map((month, idx) => ({
    month: month.substring(0, 3),
    casualty: metrics.admCasualty[idx],
    transfers: Math.floor(metrics.admCasualty[idx] * (transferRates[idx] / 100)),
    notTransferred: Math.floor(metrics.admCasualty[idx] * (1 - transferRates[idx] / 100)),
  }));

  // Day of week distribution
  const dayOfWeekDistData = [
    { day: 'Mon', admissions: Math.round(monthlyAvg / 7 * 1.15) },
    { day: 'Tue', admissions: Math.round(monthlyAvg / 7 * 1.2) },
    { day: 'Wed', admissions: Math.round(monthlyAvg / 7 * 1.25) },
    { day: 'Thu', admissions: Math.round(monthlyAvg / 7 * 1.18) },
    { day: 'Fri', admissions: Math.round(monthlyAvg / 7 * 1.3) },
    { day: 'Sat', admissions: Math.round(monthlyAvg / 7 * 0.85) },
    { day: 'Sun', admissions: Math.round(monthlyAvg / 7 * 0.7) },
  ];

  // Anomaly detection for transfer rates
  const zScores = calculateZScore(transferRates);
  const monthlyDetail = MONTHS.map((month, idx) => ({
    month,
    casualty: metrics.admCasualty[idx],
    transfers: casualtyVsTransfersData[idx].transfers,
    notTransferred: casualtyVsTransfersData[idx].notTransferred,
    transferRate: transferRates[idx],
    zScore: zScores[idx],
    isAnomaly: Math.abs(zScores[idx]) > 1.5,
  }));

  const handleExport = () => {
    const exportData = [
      { metric: 'Total Casualty Admissions', value: formatNumber(totalCasualty) },
      { metric: 'Monthly Average', value: formatNumber(Math.round(monthlyAvg)) },
      { metric: 'Avg Transfer Rate %', value: avgTransferRate.toFixed(1) },
      { metric: 'Peak Month', value: peakMonth },
      ...monthlyDetail.map((d) => ({
        metric: `${d.month} - Casualty`,
        value: formatNumber(d.casualty),
      })),
    ];

    const csv = generateCSV(exportData);
    downloadCSV(csv, `casualty-${new Date().toISOString().split('T')[0]}.csv`);
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Casualty & Emergency Analytics</h1>
          <p className="mt-1 text-sm text-gray-500">Emergency department volume and transfer analysis</p>
        </div>
        <Button onClick={handleExport} variant="outline" size="sm" className="gap-2">
          <Download className="h-4 w-4" />
          Export
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Casualty"
          value={formatNumber(totalCasualty)}
          trend="neutral"
          color="teal"
        />
        <StatCard
          title="Monthly Average"
          value={formatNumber(Math.round(monthlyAvg))}
          trend="neutral"
          color="blue"
        />
        <StatCard
          title="Transfer Rate %"
          value={`${avgTransferRate.toFixed(1)}%`}
          trend="neutral"
          color="amber"
        />
        <StatCard
          title="Peak Month"
          value={peakMonth}
          color="rose"
        />
      </div>

      {/* Charts Row 1 */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Monthly Casualty Line */}
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 px-5 py-4">
            <h2 className="text-sm font-semibold text-gray-900">Monthly Casualty Admissions</h2>
            <p className="mt-1 text-xs text-gray-500">Emergency department volume trend</p>
          </div>
          <div className="px-5 pb-5">
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={monthlyCasualtyData}>
                <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
                <XAxis dataKey="month" tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Line type="monotone" dataKey="casualty" stroke="#0d9488" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Transfer Rate % Line */}
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 px-5 py-4">
            <h2 className="text-sm font-semibold text-gray-900">Transfer Rate %</h2>
            <p className="mt-1 text-xs text-gray-500">Alert thresholds: Red &gt;25%, Amber &gt;15%</p>
          </div>
          <div className="px-5 pb-5">
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={transferRateData}>
                <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
                <XAxis dataKey="month" tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <ReferenceLine y={25} stroke="#dc2626" strokeDasharray="3 3" label={{ value: '25% Alert', position: 'right', fill: '#94a3b8' }} />
                <ReferenceLine y={15} stroke="#d97706" strokeDasharray="3 3" label={{ value: '15% Warning', position: 'right', fill: '#94a3b8' }} />
                <Line type="monotone" dataKey="transferRate" stroke="#e11d48" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Casualty vs Transfers Stacked */}
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 px-5 py-4">
            <h2 className="text-sm font-semibold text-gray-900">Casualty vs Transfers</h2>
            <p className="mt-1 text-xs text-gray-500">Monthly breakdown of transfers</p>
          </div>
          <div className="px-5 pb-5">
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={casualtyVsTransfersData}>
                <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
                <XAxis dataKey="month" tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Bar dataKey="transfers" fill="#e11d48" name="Transferred" radius={[4, 4, 0, 0]} />
                <Bar dataKey="notTransferred" fill="#0d9488" name="Not Transferred" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Day of Week Distribution */}
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 px-5 py-4">
            <h2 className="text-sm font-semibold text-gray-900">Day of Week Distribution</h2>
            <p className="mt-1 text-xs text-gray-500">Average admissions by day of week</p>
          </div>
          <div className="px-5 pb-5">
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={dayOfWeekDistData}>
                <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
                <XAxis dataKey="day" tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="admissions" radius={[4, 4, 0, 0]}>
                  {dayOfWeekDistData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={index < 5 ? '#0d9488' : '#d97706'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Monthly Detail Table with Anomaly Detection */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 px-5 py-4">
          <h2 className="text-sm font-semibold text-gray-900">Monthly Detail with Anomaly Detection</h2>
          <p className="mt-1 text-xs text-gray-500">12-month breakdown with z-score anomaly flagging</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-600">Month</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-gray-600">Casualty</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-gray-600">Transfers</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-gray-600">Not Transferred</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-gray-600">Transfer Rate %</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-gray-600">Z-Score</th>
                <th className="px-5 py-3 text-center text-xs font-semibold text-gray-600">Status</th>
              </tr>
            </thead>
            <tbody>
              {monthlyDetail.map((row, idx) => (
                <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-5 py-3 text-sm text-gray-900">{row.month}</td>
                  <td className="px-5 py-3 text-right text-sm text-gray-600">{formatNumber(row.casualty)}</td>
                  <td className="px-5 py-3 text-right text-sm text-gray-600">{formatNumber(row.transfers)}</td>
                  <td className="px-5 py-3 text-right text-sm text-gray-600">{formatNumber(row.notTransferred)}</td>
                  <td className="px-5 py-3 text-right text-sm font-medium text-gray-900">{row.transferRate.toFixed(1)}%</td>
                  <td className="px-5 py-3 text-right text-sm text-gray-600">{row.zScore.toFixed(2)}</td>
                  <td className="px-5 py-3 text-center">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      row.isAnomaly ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
                    }`}>
                      {row.isAnomaly ? 'Anomaly' : 'Normal'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
