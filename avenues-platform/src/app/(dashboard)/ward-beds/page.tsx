'use client';

import React, { useMemo } from 'react';
import { Download, Info, Upload } from 'lucide-react';
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
import { ChartRecord, ChartTooltipProps } from '@/types';
import { formatNumber, generateCSV, downloadCSV } from '@/lib/utils';
import { useDashboard } from '@/store';
import { useDrillDownRecord } from '@/hooks/useDrillDown';
import { useFilterStore } from '@/store/filter';

interface WardSummary {
  ward: string;
  occupancyPct: number;
  minOcc: number;
  maxOcc: number;
  patientDays: number;
  activePeriods: number;
}

const WARD_COLORS = ['#0d9488', '#475569', '#d97706', '#e11d48', '#7c3aed', '#0284c7', '#059669', '#dc2626'];
const TREND_WARD_LIMIT = 8;

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

function averageNonZero(values: number[]): number {
  const active = values.filter((value) => value > 0);
  return active.length > 0 ? active.reduce((sum, value) => sum + value, 0) / active.length : 0;
}

function getUtilizationColor(value: number) {
  if (value <= 0) return '#f1f5f9';
  if (value < 60) return '#d1fae5';
  if (value < 85) return '#fef3c7';
  return '#fee2e2';
}

export default function WardBedsPage() {
  const dashData = useDashboard();
  const { granularity } = useFilterStore();
  const pctOccWardDrill = useDrillDownRecord(dashData?.pctOccWard);
  const patDaysWardDrill = useDrillDownRecord(dashData?.patDaysWard);

  const wardNames = useMemo(
    () => Array.from(new Set([
      ...Array.from(pctOccWardDrill.keys()),
      ...Array.from(patDaysWardDrill.keys()),
    ])).sort(),
    [patDaysWardDrill, pctOccWardDrill],
  );

  const wardSummaries = useMemo<WardSummary[]>(() => wardNames.map((ward) => {
    const occupancy = pctOccWardDrill.get(ward);
    const patientDays = patDaysWardDrill.get(ward);
    const activeOccupancy = occupancy?.values.filter((value) => value > 0) ?? [];

    return {
      ward,
      occupancyPct: averageNonZero(occupancy?.values ?? []),
      minOcc: activeOccupancy.length > 0 ? Math.min(...activeOccupancy) : 0,
      maxOcc: activeOccupancy.length > 0 ? Math.max(...activeOccupancy) : 0,
      patientDays: patientDays?.total ?? 0,
      activePeriods: activeOccupancy.length,
    };
  }), [patDaysWardDrill, pctOccWardDrill, wardNames]);

  if (!dashData) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
        <div className="max-w-md rounded-xl border border-gray-200 bg-white p-8 shadow-sm sm:p-12">
          <Upload className="mx-auto mb-4 h-12 w-12 text-slate-300" />
          <h2 className="mb-2 text-xl font-semibold text-slate-800">No Data Loaded</h2>
          <p className="mb-6 text-slate-500">Upload your CSV data to see ward bed analytics here.</p>
          <a href="/upload" className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-teal-700">
            Go to Upload
          </a>
        </div>
      </div>
    );
  }

  const hasWardData = wardNames.length > 0;
  const totalWards = wardNames.length;
  const totalPatientDays = wardSummaries.reduce((sum, ward) => sum + ward.patientDays, 0);
  const activeOccupancyWards = wardSummaries.filter((ward) => ward.activePeriods > 0);
  const avgOccupancy = activeOccupancyWards.length > 0
    ? activeOccupancyWards.reduce((sum, ward) => sum + ward.occupancyPct, 0) / activeOccupancyWards.length
    : 0;

  const sortedByOccupancy = [...wardSummaries].sort((a, b) => b.occupancyPct - a.occupancyPct);
  const patientDaysData = [...wardSummaries]
    .filter((ward) => ward.patientDays > 0)
    .sort((a, b) => b.patientDays - a.patientDays);
  const trendWards = [...wardSummaries]
    .sort((a, b) => b.patientDays - a.patientDays || b.occupancyPct - a.occupancyPct)
    .slice(0, TREND_WARD_LIMIT)
    .map((ward) => ward.ward);

  const periodLabels = pctOccWardDrill.size > 0
    ? Array.from(pctOccWardDrill.values())[0].labels
    : patDaysWardDrill.size > 0
      ? Array.from(patDaysWardDrill.values())[0].labels
      : [];

  const mergedTrendData: ChartRecord[] = periodLabels.map((label, index) => {
    const row: ChartRecord = { period: label };
    trendWards.forEach((ward) => {
      row[ward] = pctOccWardDrill.get(ward)?.values[index] ?? 0;
    });
    return row;
  });

  const periodLabel = granularity === 'year' ? 'Annual'
    : granularity === 'quarter' ? 'Quarterly'
    : granularity === 'week' ? 'Weekly'
    : granularity === 'day' ? 'Daily'
    : periodLabels.length < 12 ? 'Filtered Period'
    : 'Monthly';

  const isEstimated = Array.from(pctOccWardDrill.values()).some((result) => result.isEstimated)
    || Array.from(patDaysWardDrill.values()).some((result) => result.isEstimated);

  const handleExport = () => {
    const exportData = [
      { metric: 'Period View', value: periodLabel },
      { metric: 'Total Wards', value: formatNumber(totalWards) },
      { metric: 'Avg Occupancy %', value: avgOccupancy.toFixed(1) },
      { metric: 'Total Patient Days', value: formatNumber(totalPatientDays) },
      ...wardSummaries.map((w) => ({
        metric: `${w.ward} Avg Occupancy %`,
        value: w.occupancyPct.toFixed(1),
      })),
      ...wardSummaries.map((w) => ({
        metric: `${w.ward} Patient Days`,
        value: formatNumber(w.patientDays),
      })),
    ];

    const csv = generateCSV(exportData);
    downloadCSV(csv, `ward-beds-${new Date().toISOString().split('T')[0]}.csv`);
  };

  if (!hasWardData) {
    return (
      <div className="space-y-6 p-4 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900 sm:text-2xl">Ward Bed Management</h1>
            <p className="mt-1 text-sm text-gray-500">Capacity planning and bed utilization analytics</p>
          </div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-8 text-center shadow-sm">
          <Upload className="mx-auto mb-4 h-10 w-10 text-slate-300" />
          <h2 className="mb-2 text-lg font-semibold text-slate-800">No Ward Bed Data Found</h2>
          <p className="text-sm text-slate-500">Upload dashboard data with ward occupancy or patient-days fields to populate this feature.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 sm:text-2xl">Ward Bed Management</h1>
          <p className="mt-1 text-sm text-gray-500">
            {periodLabel} capacity planning and bed utilization analytics
          </p>
        </div>
        <Button onClick={handleExport} variant="outline" size="sm" className="w-full gap-2 sm:w-auto">
          <Download className="h-4 w-4" />
          Export
        </Button>
      </div>

      {isEstimated && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <Info className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <span>Daily and weekly ward values are distributed from monthly source totals.</span>
        </div>
      )}

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

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 px-5 py-4">
            <h2 className="text-sm font-semibold text-gray-900">Average Occupancy by Ward</h2>
            <p className="mt-1 text-xs text-gray-500">{periodLabel} average occupancy from ward-level percentages</p>
          </div>
          <div className="overflow-x-auto px-5 pb-5">
            <div style={{ minWidth: sortedByOccupancy.length > 8 ? Math.max(680, sortedByOccupancy.length * 72) : undefined }}>
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={sortedByOccupancy}>
                  <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
                  <XAxis
                    dataKey="ward"
                    tick={{ fill: '#94a3b8', fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                    angle={sortedByOccupancy.length > 6 ? -45 : 0}
                    textAnchor={sortedByOccupancy.length > 6 ? 'end' : 'middle'}
                    height={sortedByOccupancy.length > 6 ? 90 : 35}
                    interval={0}
                  />
                  <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Bar dataKey="occupancyPct" fill="#0d9488" name="Avg Occupancy %" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 px-5 py-4">
            <h2 className="text-sm font-semibold text-gray-900">Patient Days per Ward</h2>
            <p className="mt-1 text-xs text-gray-500">{periodLabel} patient days by ward</p>
          </div>
          <div className="overflow-x-auto px-5 pb-5">
            <div className="min-w-[620px]">
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={patientDaysData} layout="vertical" margin={{ top: 5, right: 30, left: 120 }}>
                  <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
                  <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis dataKey="ward" type="category" tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} width={120} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="patientDays" fill="#0284c7" name="Patient Days" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 px-5 py-4">
          <h2 className="text-sm font-semibold text-gray-900">Occupancy Trend per Ward</h2>
          <p className="mt-1 text-xs text-gray-500">Top {trendWards.length} wards by patient days for readability</p>
        </div>
        <div className="overflow-x-auto px-5 pb-5">
          <div className="min-w-[720px]">
            <ResponsiveContainer width="100%" height={350}>
              <LineChart data={mergedTrendData}>
                <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
                <XAxis dataKey="period" tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                {trendWards.map((ward, idx) => (
                  <Line
                    key={ward}
                    type="monotone"
                    dataKey={ward}
                    stroke={WARD_COLORS[idx % WARD_COLORS.length]}
                    strokeWidth={2}
                    dot={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 px-5 py-4">
          <h2 className="text-sm font-semibold text-gray-900">Ward Performance Summary</h2>
          <p className="mt-1 text-xs text-gray-500">Occupancy and patient days by ward for the selected period</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px]">
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
              {sortedByOccupancy.map((ward) => (
                <tr key={ward.ward} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-5 py-3 text-sm font-medium text-gray-900">{ward.ward}</td>
                  <td className="px-5 py-3 text-right text-sm text-gray-600">
                    <span
                      className="inline-block rounded px-2 py-1 text-xs font-medium text-gray-900"
                      style={{ backgroundColor: getUtilizationColor(ward.occupancyPct) }}
                    >
                      {ward.occupancyPct > 0 ? `${ward.occupancyPct.toFixed(1)}%` : 'N/A'}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right text-sm text-gray-600">{ward.minOcc > 0 ? `${ward.minOcc.toFixed(1)}%` : 'N/A'}</td>
                  <td className="px-5 py-3 text-right text-sm text-gray-600">{ward.maxOcc > 0 ? `${ward.maxOcc.toFixed(1)}%` : 'N/A'}</td>
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
