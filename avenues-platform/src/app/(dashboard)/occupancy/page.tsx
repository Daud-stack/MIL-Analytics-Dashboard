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
  AreaChart,
  Area,
} from 'recharts';
import { StatCard } from '@/components/charts/stat-card';
import { Button } from '@/components/ui/button';
import { ChartTooltipProps, MONTHS } from '@/types';
import { formatNumber, generateCSV, downloadCSV } from '@/lib/utils';
import { useDashboard } from '@/store';

interface ChartData {
  month: string;
  occupancy?: number;
  patientDays?: number;
  midnight?: number;
  ma?: number;
}

const CustomTooltip = ({ active, payload, label }: ChartTooltipProps) => {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-lg">
        <p className="text-sm font-medium text-gray-900">{label}</p>
        {payload.map((entry, index: number) => (
          <p key={index} style={{ color: entry.color }} className="text-sm">
            {entry.name}: {typeof entry.value === 'number' ? entry.value.toFixed(1) : entry.value}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

// Calculate z-score for anomaly detection
function calculateZScore(values: number[]): number[] {
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
  const std = Math.sqrt(variance);
  return values.map((v) => (v - mean) / std);
}

const monthlyOccupancyData = [
  { month: 'Jan', occupancy: 68, patientDays: 4523, benchmark: 75 },
  { month: 'Feb', occupancy: 72, patientDays: 4312, benchmark: 75 },
  { month: 'Mar', occupancy: 78, patientDays: 4756, benchmark: 75 },
  { month: 'Apr', occupancy: 76, patientDays: 4894, benchmark: 75 },
  { month: 'May', occupancy: 82, patientDays: 5126, benchmark: 75 },
  { month: 'Jun', occupancy: 85, patientDays: 5342, benchmark: 75 },
  { month: 'Jul', occupancy: 88, patientDays: 5501, benchmark: 75 },
  { month: 'Aug', occupancy: 86, patientDays: 5378, benchmark: 75 },
  { month: 'Sep', occupancy: 81, patientDays: 5123, benchmark: 75 },
  { month: 'Oct', occupancy: 75, patientDays: 4876, benchmark: 75 },
  { month: 'Nov', occupancy: 70, patientDays: 4654, benchmark: 75 },
  { month: 'Dec', occupancy: 76, patientDays: 4832, benchmark: 75 },
];

const wardOccupancyData = [
  { ward: 'ICU', beds: 32, occupied: 28, occupancy: 88 },
  { ward: 'Cardiology', beds: 48, occupied: 36, occupancy: 75 },
  { ward: 'General Ward', beds: 64, occupied: 41, occupancy: 64 },
  { ward: 'Orthopedics', beds: 40, occupied: 27, occupancy: 67 },
  { ward: 'Obstetrics', beds: 28, occupied: 21, occupancy: 76 },
  { ward: 'Pediatrics', beds: 28, occupied: 15, occupancy: 52 },
  { ward: 'Gynecology', beds: 22, occupied: 13, occupancy: 61 },
  { ward: 'Surgery Recovery', beds: 20, occupied: 13, occupancy: 65 },
];

const yoyOccupancyData = [
  { month: 'Jan', year2024: 68, year2025: 70, year2026: 72 },
  { month: 'Feb', year2024: 72, year2025: 74, year2026: 75 },
  { month: 'Mar', year2024: 78, year2025: 80, year2026: 81 },
  { month: 'Apr', year2024: 76, year2025: 78, year2026: 79 },
  { month: 'May', year2024: 82, year2025: 83, year2026: 84 },
  { month: 'Jun', year2024: 85, year2025: 86, year2026: 87 },
  { month: 'Jul', year2024: 88, year2025: 89, year2026: 90 },
  { month: 'Aug', year2024: 86, year2025: 87, year2026: 88 },
  { month: 'Sep', year2024: 81, year2025: 82, year2026: 83 },
  { month: 'Oct', year2024: 75, year2025: 76, year2026: 77 },
  { month: 'Nov', year2024: 70, year2025: 71, year2026: 72 },
  { month: 'Dec', year2024: 76, year2025: 77, year2026: 78 },
];

export default function OccupancyPage() {
  const dashData = useDashboard();

  if (!dashData) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <div className="rounded-xl border border-gray-200 bg-white p-12 shadow-sm max-w-md">
          <Upload className="h-12 w-12 text-slate-300 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-slate-800 mb-2">No Data Loaded</h2>
          <p className="text-slate-500 mb-6">Upload your CSV data to see occupancy analytics here.</p>
          <a href="/upload" className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 transition-colors">
            Go to Upload
          </a>
        </div>
      </div>
    );
  }

  const metrics = dashData;

  // Calculate KPIs
  const avgOccupancy = metrics.pctOccWard ? Object.values(metrics.pctOccWard).reduce((sum, arr) => sum + arr.reduce((a, b) => a + b, 0), 0) / (Object.keys(metrics.pctOccWard).length * 12) : 0;
  const totalPatientDays = Object.values(metrics.patDaysWard).reduce((sum, arr) => sum + arr.reduce((a, b) => a + b, 0), 0);
  const midnightCensus = metrics.occMidnight.reduce((a, b) => a + b, 0) / metrics.occMidnight.length;

  // Monthly occupancy data
  const occupancyData: ChartData[] = MONTHS.map((month, idx) => ({
    month: month.substring(0, 3),
    occupancy: metrics.theatrePctOcc[idx],
    patientDays: metrics.patDaysWard['General Ward']?.[idx] || 0,
  }));

  // Moving average overlay for midnight census
  const midnightData: ChartData[] = MONTHS.map((month, idx) => ({
    month: month.substring(0, 3),
    midnight: metrics.occMidnight[idx],
  }));

  // Add 3-month moving average
  const withMA = midnightData.map((d, i) => ({
    ...d,
    ma: i < 2
      ? metrics.occMidnight[i]
      : (metrics.occMidnight[i] + metrics.occMidnight[i - 1] + metrics.occMidnight[i - 2]) / 3,
  }));

  // Patient days by LOC
  const locData = Object.entries(metrics.patDaysLOC)
    .map(([loc, values]) => ({
      name: loc,
      patientDays: values.reduce((a, b) => a + b, 0),
    }))
    .sort((a, b) => b.patientDays - a.patientDays);

  // Ward occupancy detail table with z-score anomaly detection
  const wardOccupancies = Object.entries(metrics.pctOccWard).map(([ward, values]) => ({
    ward,
    occupancy: values.reduce((a, b) => a + b, 0) / values.length,
    min: Math.min(...values),
    max: Math.max(...values),
  }));

  const zScores = calculateZScore(wardOccupancies.map((w) => w.occupancy));
  const wardWithAnomaly = wardOccupancies.map((w, i) => ({
    ...w,
    zScore: zScores[i],
    isAnomaly: Math.abs(zScores[i]) > 1.5,
  }));

  // Heatmap data (12 months x wards)
  const heatmapData = Object.entries(metrics.pctOccWard).map(([ward, values]) => ({
    ward,
    values: values.map((v) => v),
  }));

  const getHeatmapColor = (value: number) => {
    if (value < 60) return '#d1fae5'; // light green
    if (value < 85) return '#fef3c7'; // light amber
    return '#fee2e2'; // light red
  };

  const handleExport = () => {
    const exportData = [
      { metric: 'Average Occupancy %', value: avgOccupancy.toFixed(1) },
      { metric: 'Total Patient Days', value: formatNumber(totalPatientDays) },
      { metric: 'Midnight Census (Avg)', value: midnightCensus.toFixed(0) },
      ...wardWithAnomaly.map((w) => ({
        metric: `${w.ward} Occupancy %`,
        value: w.occupancy.toFixed(1),
      })),
    ];

    const csv = generateCSV(exportData);
    downloadCSV(csv, `occupancy-${new Date().toISOString().split('T')[0]}.csv`);
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Bed Occupancy Analytics</h1>
          <p className="mt-1 text-sm text-gray-500">Ward utilization and census monitoring</p>
        </div>
        <Button onClick={handleExport} variant="outline" size="sm" className="gap-2">
          <Download className="h-4 w-4" />
          Export
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          title="Avg Occupancy %"
          value={`${avgOccupancy.toFixed(1)}%`}
          trend="neutral"
          color="teal"
        />
        <StatCard
          title="Patient Days"
          value={formatNumber(totalPatientDays)}
          trend="neutral"
          color="blue"
        />
        <StatCard
          title="Midnight Census"
          value={formatNumber(Math.round(midnightCensus))}
          trend="neutral"
          color="amber"
        />
      </div>

      {/* Heatmap Grid */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 px-5 py-4">
          <h2 className="text-sm font-semibold text-gray-900">Occupancy Heatmap</h2>
          <p className="mt-1 text-xs text-gray-500">Monthly occupancy % by ward (Green: &lt;60%, Amber: 60-85%, Red: &gt;85%)</p>
        </div>
        <div className="overflow-x-auto px-5 pb-5">
          <table className="mt-4 w-full min-w-max border-collapse">
            <thead>
              <tr>
                <th className="border border-gray-200 bg-gray-50 px-4 py-2 text-left text-xs font-semibold text-gray-600">Ward</th>
                {MONTHS.map((month, idx) => (
                  <th key={idx} className="border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-600">
                    {month.substring(0, 3)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {heatmapData.map((row, rowIdx) => (
                <tr key={rowIdx}>
                  <td className="border border-gray-200 bg-gray-50 px-4 py-2 text-xs font-medium text-gray-900">{row.ward}</td>
                  {row.values.map((val, colIdx) => (
                    <td
                      key={colIdx}
                      className="border border-gray-200 px-3 py-2 text-center text-xs font-medium"
                      style={{ backgroundColor: getHeatmapColor(val) }}
                    >
                      {val.toFixed(0)}%
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Charts Row 1 */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Occupancy Trend Line */}
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 px-5 py-4">
            <h2 className="text-sm font-semibold text-gray-900">Monthly Occupancy Trend</h2>
            <p className="mt-1 text-xs text-gray-500">Percentage occupancy with 75% benchmark</p>
          </div>
          <div className="px-5 pb-5">
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={occupancyData}>
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
                <Line type="monotone" dataKey="occupancy" stroke="#0d9488" strokeWidth={2} dot={{ r: 3 }} name="Occupancy %" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Patient Days by LOC */}
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 px-5 py-4">
            <h2 className="text-sm font-semibold text-gray-900">Patient Days by Location</h2>
            <p className="mt-1 text-xs text-gray-500">Annual distribution across locations</p>
          </div>
          <div className="px-5 pb-5">
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={locData} layout="vertical" margin={{ top: 5, right: 30, left: 120 }}>
                <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
                <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis dataKey="name" type="category" tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} width={115} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="patientDays" fill="#0284c7" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 px-5 py-4">
          <h2 className="text-sm font-semibold text-gray-900">Midnight Census with 3-Month MA</h2>
          <p className="mt-1 text-xs text-gray-500">Daily census trend with moving average overlay</p>
        </div>
        <div className="px-5 pb-5">
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={withMA}>
              <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
              <XAxis dataKey="month" tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Line type="monotone" dataKey="midnight" stroke="#d97706" strokeWidth={2} dot={{ r: 3 }} name="Actual" />
              <Line type="monotone" dataKey="ma" stroke="#0d9488" strokeWidth={2} strokeDasharray="5 5" dot={false} name="3-Month MA" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Ward Detail Table with Anomaly Detection */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 px-5 py-4">
          <h2 className="text-sm font-semibold text-gray-900">Ward Occupancy Summary</h2>
          <p className="mt-1 text-xs text-gray-500">Average occupancy with min/max range and z-score anomaly detection</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-600">Ward</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-gray-600">Avg Occupancy %</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-gray-600">Min %</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-gray-600">Max %</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-gray-600">Z-Score</th>
                <th className="px-5 py-3 text-center text-xs font-semibold text-gray-600">Status</th>
              </tr>
            </thead>
            <tbody>
              {wardWithAnomaly.map((ward, idx) => (
                <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-5 py-3 text-sm font-medium text-gray-900">{ward.ward}</td>
                  <td className="px-5 py-3 text-right text-sm text-gray-600">{ward.occupancy.toFixed(1)}%</td>
                  <td className="px-5 py-3 text-right text-sm text-gray-600">{ward.min.toFixed(1)}%</td>
                  <td className="px-5 py-3 text-right text-sm text-gray-600">{ward.max.toFixed(1)}%</td>
                  <td className="px-5 py-3 text-right text-sm text-gray-600">{ward.zScore.toFixed(2)}</td>
                  <td className="px-5 py-3 text-center">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      ward.isAnomaly ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
                    }`}>
                      {ward.isAnomaly ? 'Anomaly' : 'Normal'}
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
