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
  ComposedChart,
} from 'recharts';
import { StatCard } from '@/components/charts/stat-card';
import { Button } from '@/components/ui/button';
import { ChartRecord, ChartTooltipProps, MONTHS } from '@/types';
import { formatNumber, generateCSV, downloadCSV } from '@/lib/utils';
import { useDashboard } from '@/store';

interface ChartData {
  month?: string;
  ward?: string;
  occupied?: number;
  capacity?: number;
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

const WARDS = ['ICU', 'General Ward', 'Maternity', 'Pediatric', 'Surgical', 'Medical'];

const monthlyBedFeeData = [
  { month: 'Jan', beds: 223, patientDays: 4523, revenue: 642775 },
  { month: 'Feb', beds: 223, patientDays: 4312, revenue: 615216 },
  { month: 'Mar', beds: 223, patientDays: 4756, revenue: 679104 },
  { month: 'Apr', beds: 223, patientDays: 4894, revenue: 698454 },
  { month: 'May', beds: 223, patientDays: 5126, revenue: 731882 },
  { month: 'Jun', beds: 223, patientDays: 5342, revenue: 762684 },
  { month: 'Jul', beds: 223, patientDays: 5501, revenue: 785928 },
  { month: 'Aug', beds: 223, patientDays: 5378, revenue: 767568 },
  { month: 'Sep', beds: 223, patientDays: 5123, revenue: 731524 },
  { month: 'Oct', beds: 223, patientDays: 4876, revenue: 696368 },
  { month: 'Nov', beds: 223, patientDays: 4654, revenue: 664452 },
  { month: 'Dec', beds: 223, patientDays: 4832, revenue: 689856 },
];

const wardComparisonData = [
  { ward: 'ICU', beds: 32, patientDays: 8526, revenue: 1274900, avgFee: 1285, occupancy: 88 },
  { ward: 'Cardiology', beds: 48, patientDays: 10234, revenue: 1535100, avgFee: 1500, occupancy: 74 },
  { ward: 'General Ward', beds: 64, patientDays: 12345, revenue: 1400000, avgFee: 1134, occupancy: 64 },
  { ward: 'Orthopedics', beds: 40, patientDays: 7236, revenue: 1021200, avgFee: 1412, occupancy: 67 },
  { ward: 'Obstetrics', beds: 28, patientDays: 6142, revenue: 737040, avgFee: 1200, occupancy: 76 },
  { ward: 'Pediatrics', beds: 28, patientDays: 428, revenue: 145320, avgFee: 340, occupancy: 52 },
  { ward: 'Gynecology', beds: 22, patientDays: 390, revenue: 132450, avgFee: 340, occupancy: 61 },
  { ward: 'ENT', beds: 18, patientDays: 278, revenue: 94280, avgFee: 340, occupancy: 43 },
];

const revenuePerPatientDayTrend = [
  { month: 'Jan', revenue: 135.6, benchmark: 140 },
  { month: 'Feb', revenue: 135.0, benchmark: 140 },
  { month: 'Mar', revenue: 135.1, benchmark: 140 },
  { month: 'Apr', revenue: 134.8, benchmark: 140 },
  { month: 'May', revenue: 135.2, benchmark: 140 },
  { month: 'Jun', revenue: 135.4, benchmark: 140 },
  { month: 'Jul', revenue: 135.1, benchmark: 140 },
  { month: 'Aug', revenue: 135.2, benchmark: 140 },
  { month: 'Sep', revenue: 135.2, benchmark: 140 },
  { month: 'Oct', revenue: 135.0, benchmark: 140 },
  { month: 'Nov', revenue: 135.1, benchmark: 140 },
  { month: 'Dec', revenue: 135.2, benchmark: 140 },
];

const wardHeatmapData = [
  { ward: 'ICU', jan: 92, feb: 95, mar: 98, apr: 96, may: 100, jun: 97, jul: 102, aug: 98, sep: 94, oct: 90, nov: 88, dec: 91 },
  { ward: 'Cardiology', jan: 78, feb: 80, mar: 82, apr: 80, may: 85, jun: 83, jul: 88, aug: 84, sep: 80, oct: 76, nov: 74, dec: 78 },
  { ward: 'General Ward', jan: 73, feb: 75, mar: 78, apr: 76, may: 80, jun: 78, jul: 82, aug: 80, sep: 76, oct: 72, nov: 70, dec: 74 },
  { ward: 'Orthopedics', jan: 67, feb: 69, mar: 72, apr: 70, may: 75, jun: 73, jul: 78, aug: 76, sep: 72, oct: 68, nov: 65, dec: 69 },
  { ward: 'Obstetrics', jan: 64, feb: 66, mar: 69, apr: 67, may: 72, jun: 70, jul: 75, aug: 73, sep: 70, oct: 66, nov: 63, dec: 67 },
  { ward: 'Pediatrics', jan: 52, feb: 54, mar: 57, apr: 55, may: 60, jun: 58, jul: 63, aug: 61, sep: 58, oct: 54, nov: 51, dec: 55 },
  { ward: 'Gynecology', jan: 61, feb: 63, mar: 66, apr: 64, may: 69, jun: 67, jul: 72, aug: 70, sep: 67, oct: 63, nov: 60, dec: 64 },
  { ward: 'ENT', jan: 43, feb: 45, mar: 48, apr: 46, may: 51, jun: 49, jul: 54, aug: 52, sep: 49, oct: 45, nov: 42, dec: 46 },
];

const getHeatmapColor = (value: number) => {
  if (value >= 95) return 'bg-red-200';
  if (value >= 85) return 'bg-orange-200';
  if (value >= 75) return 'bg-yellow-200';
  if (value >= 65) return 'bg-green-200';
  return 'bg-blue-200';
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

  // KPI calculations
  const totalWards = WARDS.length;
  const totalPatientDays = metrics.patDaysWard ? Object.values(metrics.patDaysWard).reduce((sum, arr) => sum + arr.reduce((a, b) => a + b, 0), 0) : 0;
  const avgOccupancy = metrics.pctOccWard ? Object.values(metrics.pctOccWard).reduce((sum, arr) => sum + arr.reduce((a, b) => a + b, 0), 0) / (Object.keys(metrics.pctOccWard).length * 12) : 0;

  // Ward capacity vs occupied
  const wardCapacityData = WARDS.map((ward, idx) => {
    const capacity = 20 + idx * 5;
    const occupied = Math.round(capacity * (avgOccupancy / 100));
    return {
      ward,
      capacity,
      occupied,
      utilization: (occupied / capacity) * 100,
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
    WARDS.forEach((ward) => {
      const wardData = metrics.pctOccWard[ward] || metrics.theatrePctOcc;
      monthData[ward] = wardData[i];
    });
    mergedTrendData.push(monthData);
  }

  // Ward utilization matrix (heatmap style)
  const wardUtilizationMatrix = WARDS.map((ward, idx) => {
    const wardData = metrics.pctOccWard[ward] || metrics.theatrePctOcc;
    return {
      ward,
      utilization: wardData.reduce((a, b) => a + b, 0) / wardData.length,
      minOcc: Math.min(...wardData),
      maxOcc: Math.max(...wardData),
      capacity: 20 + idx * 5,
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
          value={`${avgOccupancy.toFixed(1)}%`}
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
            <h2 className="text-sm font-semibold text-gray-900">Ward Capacity vs Occupied</h2>
            <p className="mt-1 text-xs text-gray-500">Current bed capacity and occupancy by ward</p>
          </div>
          <div className="px-5 pb-5">
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={wardCapacityData}>
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
                <Bar dataKey="capacity" fill="#cbd5e1" name="Capacity" radius={[4, 4, 0, 0]} />
                <Bar dataKey="occupied" fill="#0d9488" name="Occupied" radius={[4, 4, 0, 0]} />
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
              {WARDS.map((ward, idx) => {
                const colors = ['#0d9488', '#475569', '#d97706', '#e11d48', '#7c3aed', '#0284c7'];
                return <Line key={idx} type="monotone" dataKey={ward} stroke={colors[idx % colors.length]} strokeWidth={2} dot={false} />;
              })}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Ward Performance Summary Table */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 px-5 py-4">
          <h2 className="text-sm font-semibold text-gray-900">Ward Performance Summary</h2>
          <p className="mt-1 text-xs text-gray-500">Capacity, occupancy, and patient days by ward</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-600">Ward</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-gray-600">Bed Capacity</th>
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
                  <td className="px-5 py-3 text-right text-sm text-gray-600">{formatNumber(ward.capacity)}</td>
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
