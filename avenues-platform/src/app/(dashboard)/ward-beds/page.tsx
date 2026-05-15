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
} from 'recharts';
import { StatCard } from '@/components/charts/stat-card';
import { Button } from '@/components/ui/button';
import { ChartRecord, ChartTooltipProps, MONTHS } from '@/types';
import { formatNumber, generateCSV, downloadCSV } from '@/lib/utils';
import { useDashboard } from '@/store';

interface ChartData {
  month?: string;
  ward?: string;
  patientDays?: number;
  occupancyPct?: number;
}

const CustomTooltip = ({ active, payload, label }: ChartTooltipProps) => {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-lg">
        <p className="text-sm font-medium text-gray-900">{label}</p>
        {payload.map((entry, index: number) => (
          <p key={index} style={{ color: entry.color }} className="text-sm">
            {entry.name}: {typeof entry.value === 'number' ? formatNumber(entry.value) : entry.value}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export default function WardBedsPage() {
  const dashData = useDashboard();

  if (!dashData) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <div className="rounded-xl border border-gray-200 bg-white p-12 shadow-sm max-w-md">
          <Upload className="h-12 w-12 text-slate-300 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-slate-800 mb-2">No Data Loaded</h2>
          <p className="text-slate-500 mb-6">Upload your CSV data to see ward bed analytics here.</p>
          <a href="/upload" className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 transition-colors">
            Go to Upload
          </a>
        </div>
      </div>
    );
  }

  const metrics = dashData;
  const wardNames = Array.from(new Set([
    ...Object.keys(metrics.pctOccWard || {}),
    ...Object.keys(metrics.patDaysWard || {}),
  ])).sort();

  // KPI calculations
  const totalWards = wardNames.length;
  const totalPatientDays = metrics.patDaysWard ? Object.values(metrics.patDaysWard).reduce((sum, arr) => sum + arr.reduce((a, b) => a + b, 0), 0) : 0;
  const pctOccWardCount = metrics.pctOccWard ? Object.keys(metrics.pctOccWard).length : 0;
  const avgOccupancy = pctOccWardCount > 0
    ? (() => {
        let totalOcc = 0;
        let totalActive = 0;
        Object.values(metrics.pctOccWard).forEach(arr => {
          arr.forEach(v => {
            if (v > 0) { totalOcc += v; totalActive++; }
          });
        });
        return totalActive > 0 ? totalOcc / totalActive : 0;
      })()
    : 0;

  const wardOccupancyData = wardNames.map((ward) => {
    const values = (metrics.pctOccWard[ward] || []).filter((value) => value > 0);
    return {
      ward,
      occupancyPct: values.length > 0
        ? values.reduce((sum, value) => sum + value, 0) / values.length
        : 0,
    };
  });

  // Patient days per ward
  const patientDaysData = Object.entries(metrics.patDaysWard)
    .map(([ward, values]) => ({
      ward,
      patientDays: values.reduce((a, b) => a + b, 0),
    }))
    .sort((a, b) => b.patientDays - a.patientDays);

  // Merge monthly data for multi-line chart
  const mergedTrendData: ChartRecord[] = [];
  for (let i = 0; i < 12; i++) {
    const monthData: ChartRecord = { month: MONTHS[i].substring(0, 3) };
    wardNames.forEach((ward) => {
      const wardData = metrics.pctOccWard[ward] || new Array(12).fill(0);
      monthData[ward] = wardData[i] || 0;
    });
    mergedTrendData.push(monthData);
  }

  // Ward utilization matrix (heatmap style)
  const wardUtilizationMatrix = wardNames.map((ward) => {
    const wardData = metrics.pctOccWard[ward] || new Array(12).fill(0);
    const activeValues = wardData.filter((value) => value > 0);
    return {
      ward,
      utilization: activeValues.length > 0 ? activeValues.reduce((a, b) => a + b, 0) / activeValues.length : 0,
      minOcc: activeValues.length > 0 ? Math.min(...activeValues) : 0,
      maxOcc: activeValues.length > 0 ? Math.max(...activeValues) : 0,
      patientDays: metrics.patDaysWard[ward]?.reduce((a, b) => a + b, 0) || 0,
    };
  });

  const getUtilizationColor = (value: number) => {
    if (value < 60) return '#d1fae5';
    if (value < 85) return '#fef3c7';
    return '#fee2e2';
  };

  const handleExport = () => {
    const exportData = [
      { metric: 'Total Wards', value: formatNumber(totalWards) },
      { metric: 'Avg Occupancy %', value: avgOccupancy.toFixed(1) },
      { metric: 'Total Patient Days', value: formatNumber(totalPatientDays) },
      ...wardUtilizationMatrix.map((w) => ({
        metric: `${w.ward} Avg Occupancy %`,
        value: w.utilization.toFixed(1),
      })),
    ];

    const csv = generateCSV(exportData);
    downloadCSV(csv, `ward-beds-${new Date().toISOString().split('T')[0]}.csv`);
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Ward Bed Management</h1>
          <p className="mt-1 text-sm text-gray-500">Capacity planning and bed utilization analytics</p>
        </div>
        <Button onClick={handleExport} variant="outline" size="sm" className="gap-2">
          <Download className="h-4 w-4" />
          Export
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          title="Total Wards"
          value={formatNumber(totalWards)}
          color="teal"
        />
        <StatCard
          title="Avg Occupancy"
          value={avgOccupancy > 0 ? `${avgOccupancy.toFixed(1)}%` : 'N/A'}
          trend="neutral"
          color="blue"
        />
        <StatCard
          title="Total Patient Days"
          value={formatNumber(totalPatientDays)}
          trend="neutral"
          color="amber"
        />
      </div>

      {/* Charts Row 1 */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Ward Capacity vs Occupied */}
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 px-5 py-4">
            <h2 className="text-sm font-semibold text-gray-900">Average Occupancy by Ward</h2>
            <p className="mt-1 text-xs text-gray-500">Calculated from uploaded ward occupancy data</p>
          </div>
          <div className="px-5 pb-5">
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={wardOccupancyData}>
                <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
                <XAxis
                  dataKey="ward"
                  tick={{ fill: '#94a3b8', fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                  angle={-45}
                  textAnchor="end"
                  height={80}
                />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Bar dataKey="occupancyPct" fill="#0d9488" name="Avg Occupancy %" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Patient Days per Ward */}
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 px-5 py-4">
            <h2 className="text-sm font-semibold text-gray-900">Patient Days per Ward</h2>
            <p className="mt-1 text-xs text-gray-500">Annual patient days by ward</p>
          </div>
          <div className="px-5 pb-5">
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={patientDaysData} layout="vertical" margin={{ top: 5, right: 30, left: 100 }}>
                <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
                <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis dataKey="ward" type="category" tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} width={95} />
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
          <h2 className="text-sm font-semibold text-gray-900">Occupancy Trend per Ward</h2>
          <p className="mt-1 text-xs text-gray-500">Monthly occupancy % for each ward</p>
        </div>
        <div className="px-5 pb-5">
          <ResponsiveContainer width="100%" height={350}>
            <LineChart data={mergedTrendData}>
              <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
              <XAxis dataKey="month" tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              {wardNames.map((ward, idx) => {
                const wardColors = ['#0d9488', '#475569', '#d97706', '#e11d48', '#7c3aed', '#0284c7'];
                return <Line key={idx} type="monotone" dataKey={ward} stroke={wardColors[idx % wardColors.length]} strokeWidth={2} dot={false} />;
              })}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Ward Performance Summary Table */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 px-5 py-4">
          <h2 className="text-sm font-semibold text-gray-900">Ward Performance Summary</h2>
          <p className="mt-1 text-xs text-gray-500">Occupancy and patient days by ward</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-600">Ward</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-gray-600">Avg Occupancy %</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-gray-600">Min Occupancy %</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-gray-600">Max Occupancy %</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-gray-600">Patient Days</th>
              </tr>
            </thead>
            <tbody>
              {wardUtilizationMatrix.map((ward, idx) => (
                <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-5 py-3 text-sm font-medium text-gray-900">{ward.ward}</td>
                  <td className="px-5 py-3 text-right text-sm text-gray-600">
                    <span
                      className="inline-block rounded px-2 py-1 text-xs font-medium text-gray-900"
                      style={{ backgroundColor: getUtilizationColor(ward.utilization) }}
                    >
                      {ward.utilization.toFixed(1)}%
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right text-sm text-gray-600">{ward.minOcc.toFixed(1)}%</td>
                  <td className="px-5 py-3 text-right text-sm text-gray-600">{ward.maxOcc.toFixed(1)}%</td>
                  <td className="px-5 py-3 text-right text-sm font-medium text-gray-900">{formatNumber(ward.patientDays)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
