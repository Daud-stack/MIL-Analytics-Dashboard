'use client';

import React from 'react';
import { Download, Upload } from 'lucide-react';
import {
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
import { formatNumber, formatCurrency, generateCSV, downloadCSV } from '@/lib/utils';
import { useLocation } from '@/store';

const COLORS = ['#0d9488', '#475569', '#d97706', '#e11d48', '#7c3aed', '#0284c7', '#059669', '#dc2626'];

interface ChartData {
  name?: string;
  group?: string;
  value?: number;
  count?: number;
  percentage?: number;
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

const losbySpecialty = [
  { specialty: 'Cardiology', avg: 6.2, min: 1, max: 28 },
  { specialty: 'General Surgery', avg: 5.1, min: 1, max: 21 },
  { specialty: 'Orthopedics', avg: 4.8, min: 1, max: 18 },
  { specialty: 'Neurology', avg: 7.3, min: 2, max: 35 },
  { specialty: 'Gastroenterology', avg: 3.2, min: 1, max: 12 },
  { specialty: 'ICU', avg: 8.5, min: 2, max: 45 },
  { specialty: 'Gynecology', avg: 2.8, min: 1, max: 8 },
];

const readmissionByDept = [
  { department: 'Cardiology', rate: 12.5, admissions: 245 },
  { department: 'Orthopedics', rate: 8.2, admissions: 198 },
  { department: 'General Surgery', rate: 6.8, admissions: 312 },
  { department: 'Urology', rate: 5.4, admissions: 142 },
  { department: 'ENT', rate: 4.1, admissions: 95 },
  { department: 'Pediatrics', rate: 3.2, admissions: 165 },
];

const patientVolumeTrends = [
  { month: 'Jan', newPatients: 285, returning: 542, total: 827 },
  { month: 'Feb', newPatients: 298, returning: 568, total: 866 },
  { month: 'Mar', newPatients: 325, returning: 615, total: 940 },
  { month: 'Apr', newPatients: 315, returning: 605, total: 920 },
  { month: 'May', newPatients: 352, returning: 648, total: 1000 },
  { month: 'Jun', newPatients: 368, returning: 672, total: 1040 },
  { month: 'Jul', newPatients: 385, returning: 715, total: 1100 },
  { month: 'Aug', newPatients: 372, returning: 698, total: 1070 },
  { month: 'Sep', newPatients: 355, returning: 665, total: 1020 },
  { month: 'Oct', newPatients: 328, returning: 625, total: 953 },
  { month: 'Nov', newPatients: 312, returning: 598, total: 910 },
  { month: 'Dec', newPatients: 335, returning: 642, total: 977 },
];

const newVsReturning = [
  { month: 'Jan', new: 285, returning: 542 },
  { month: 'Feb', new: 298, returning: 568 },
  { month: 'Mar', new: 325, returning: 615 },
  { month: 'Apr', new: 315, returning: 605 },
  { month: 'May', new: 352, returning: 648 },
  { month: 'Jun', new: 368, returning: 672 },
  { month: 'Jul', new: 385, returning: 715 },
  { month: 'Aug', new: 372, returning: 698 },
  { month: 'Sep', new: 355, returning: 665 },
  { month: 'Oct', new: 328, returning: 625 },
  { month: 'Nov', new: 312, returning: 598 },
  { month: 'Dec', new: 335, returning: 642 },
];

export default function PatientsPage() {
  const locationData = useLocation();

  if (!locationData) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <div className="rounded-xl border border-gray-200 bg-white p-12 shadow-sm max-w-md">
          <Upload className="h-12 w-12 text-slate-300 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-slate-800 mb-2">No Data Loaded</h2>
          <p className="text-slate-500 mb-6">Upload your CPT Statistics CSV to see analytics here.</p>
          <a href="/upload" className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 transition-colors">
            Go to Upload
          </a>
        </div>
      </div>
    );
  }

  // KPI calculations
  const totalEpisodes = locationData.episodes;
  const uniquePatients = Math.round(totalEpisodes * 0.75); // Estimate ~75% unique
  const avgRevenue = locationData.totalRevenue / totalEpisodes;

  // Calculate average LOS from distribution
  const losValues = Object.entries(locationData.los)
    .flatMap(([days, count]) => Array(count).fill(parseInt(days)))
    .slice(0, 1000);
  const avgLOS = losValues.length > 0
    ? losValues.reduce((a, b) => a + b, 0) / losValues.length
    : 5;

  // Age group data
  const ageGroupData = Object.entries(locationData.ageGroups).map(([group, count]) => ({
    group,
    count,
    percentage: (count / totalEpisodes) * 100,
  }));

  // Gender split
  const genderData = Object.entries(locationData.genders).map(([name, value]) => ({
    name,
    value,
    percentage: (value / totalEpisodes) * 100,
  }));

  // LOS distribution
  const losDistribution = Object.entries(locationData.los)
    .map(([days, count]) => ({
      range: `${days} days`,
      count,
      percentage: (count / totalEpisodes) * 100,
    }))
    .slice(0, 10)
    .sort((a, b) => {
      const aMin = parseInt(a.range);
      const bMin = parseInt(b.range);
      return aMin - bMin;
    });

  // Specialty distribution
  const specialtyData = Object.entries(locationData.specialties)
    .map(([name, count]) => ({
      name,
      count,
    }))
    .sort((a, b) => b.count - a.count);

  // Medical aid distribution
  const medAidData = Object.entries(locationData.medAids).map(([name, count]) => ({
    name,
    value: count,
  }));

  // LOS percentiles
  const sortedLOS = losValues.sort((a, b) => a - b);
  const los25th = sortedLOS[Math.floor(sortedLOS.length * 0.25)];
  const los50th = sortedLOS[Math.floor(sortedLOS.length * 0.5)];
  const los75th = sortedLOS[Math.floor(sortedLOS.length * 0.75)];
  const los90th = sortedLOS[Math.floor(sortedLOS.length * 0.9)];

  const handleExport = () => {
    const exportData = [
      { metric: 'Total Episodes', value: formatNumber(totalEpisodes) },
      { metric: 'Unique Patients (Est.)', value: formatNumber(uniquePatients) },
      { metric: 'Avg LOS (days)', value: avgLOS.toFixed(2) },
      { metric: 'Avg Revenue/Episode', value: formatCurrency(avgRevenue) },
      { metric: 'LOS 25th Percentile', value: los25th || 'N/A' },
      { metric: 'LOS 50th Percentile (Median)', value: los50th || 'N/A' },
      { metric: 'LOS 75th Percentile', value: los75th || 'N/A' },
      { metric: 'LOS 90th Percentile', value: los90th || 'N/A' },
      ...ageGroupData.map((a) => ({
        metric: `Age Group ${a.group}`,
        value: formatNumber(a.count),
      })),
    ];

    const csv = generateCSV(exportData);
    downloadCSV(csv, `patients-${new Date().toISOString().split('T')[0]}.csv`);
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Patient Demographics</h1>
          <p className="mt-1 text-sm text-gray-500">Patient population and utilization analytics</p>
        </div>
        <Button onClick={handleExport} variant="outline" size="sm" className="gap-2">
          <Download className="h-4 w-4" />
          Export
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Episodes"
          value={formatNumber(totalEpisodes)}
          trend="neutral"
          color="teal"
        />
        <StatCard
          title="Unique Patients (Est.)"
          value={formatNumber(uniquePatients)}
          trend="neutral"
          color="blue"
        />
        <StatCard
          title="Avg LOS"
          value={`${avgLOS.toFixed(1)} days`}
          trend="neutral"
          color="amber"
        />
        <StatCard
          title="Avg Revenue/Episode"
          value={formatCurrency(avgRevenue)}
          trend="neutral"
          color="rose"
        />
      </div>

      {/* Charts Row 1 */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Age Group Distribution */}
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 px-5 py-4">
            <h2 className="text-sm font-semibold text-gray-900">Age Group Distribution</h2>
            <p className="mt-1 text-xs text-gray-500">Patient episodes by age group</p>
          </div>
          <div className="px-5 pb-5">
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={ageGroupData}>
                <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
                <XAxis
                  dataKey="group"
                  tick={{ fill: '#94a3b8', fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                  angle={-45}
                  textAnchor="end"
                  height={80}
                />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="count" fill="#0d9488" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Gender Split */}
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 px-5 py-4">
            <h2 className="text-sm font-semibold text-gray-900">Gender Distribution</h2>
            <p className="mt-1 text-xs text-gray-500">Patient episodes by gender</p>
          </div>
          <div className="px-5 pb-5">
            <ResponsiveContainer width="100%" height={320}>
              <PieChart>
                <Pie
                  data={genderData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  labelLine={false}
                  label={({ name, value }) => `${name}: ${formatNumber(value)}`}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {genderData.map((_, index) => (
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
        {/* LOS Distribution */}
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 px-5 py-4">
            <h2 className="text-sm font-semibold text-gray-900">Length of Stay Distribution</h2>
            <p className="mt-1 text-xs text-gray-500">Episodes by LOS category</p>
          </div>
          <div className="px-5 pb-5">
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={losDistribution}>
                <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
                <XAxis
                  dataKey="range"
                  tick={{ fill: '#94a3b8', fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                  angle={-45}
                  textAnchor="end"
                  height={80}
                />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="count" fill="#7c3aed" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Medical Aid Distribution */}
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 px-5 py-4">
            <h2 className="text-sm font-semibold text-gray-900">Medical Aid Distribution</h2>
            <p className="mt-1 text-xs text-gray-500">Patient episodes by medical aid scheme</p>
          </div>
          <div className="px-5 pb-5">
            <ResponsiveContainer width="100%" height={320}>
              <PieChart>
                <Pie
                  data={medAidData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  labelLine={false}
                  label={({ name, value }) => `${(name || '').substring(0, 12)}: ${formatNumber(value)}`}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {medAidData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => formatNumber(value as number)} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Charts Row 3 */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 px-5 py-4">
          <h2 className="text-sm font-semibold text-gray-900">Specialty Distribution</h2>
          <p className="mt-1 text-xs text-gray-500">Episodes by specialty department</p>
        </div>
        <div className="px-5 pb-5">
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={specialtyData} layout="vertical" margin={{ top: 5, right: 30, left: 120 }}>
              <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
              <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis dataKey="name" type="category" tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} width={115} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="count" fill="#0284c7" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* LOS Percentile Summary */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 px-5 py-4">
          <h2 className="text-sm font-semibold text-gray-900">Length of Stay Percentile Summary</h2>
          <p className="mt-1 text-xs text-gray-500">Statistical distribution of patient LOS</p>
        </div>
        <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border border-gray-200 p-4">
            <p className="text-xs font-medium text-gray-600">25th Percentile</p>
            <p className="mt-2 text-2xl font-semibold text-gray-900">{los25th || 'N/A'}</p>
            <p className="mt-1 text-xs text-gray-500">days</p>
          </div>
          <div className="rounded-lg border border-gray-200 p-4">
            <p className="text-xs font-medium text-gray-600">50th Percentile (Median)</p>
            <p className="mt-2 text-2xl font-semibold text-gray-900">{los50th || 'N/A'}</p>
            <p className="mt-1 text-xs text-gray-500">days</p>
          </div>
          <div className="rounded-lg border border-gray-200 p-4">
            <p className="text-xs font-medium text-gray-600">75th Percentile</p>
            <p className="mt-2 text-2xl font-semibold text-gray-900">{los75th || 'N/A'}</p>
            <p className="mt-1 text-xs text-gray-500">days</p>
          </div>
          <div className="rounded-lg border border-gray-200 p-4">
            <p className="text-xs font-medium text-gray-600">90th Percentile</p>
            <p className="mt-2 text-2xl font-semibold text-gray-900">{los90th || 'N/A'}</p>
            <p className="mt-1 text-xs text-gray-500">days</p>
          </div>
        </div>
      </div>
    </div>
  );
}
