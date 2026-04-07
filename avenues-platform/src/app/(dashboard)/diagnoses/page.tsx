'use client';

import React, { useState } from 'react';
import { Download, Search, Upload } from 'lucide-react';
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  ComposedChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Line,
} from 'recharts';
import { StatCard } from '@/components/charts/stat-card';
import { Button } from '@/components/ui/button';
import { formatNumber, generateCSV, downloadCSV } from '@/lib/utils';
import { useLocation } from '@/store';
import { ChartTooltipProps } from '@/types';

const COLORS = ['#0d9488', '#475569', '#d97706', '#e11d48', '#7c3aed', '#0284c7', '#059669', '#dc2626'];

interface ChartData {
  name?: string;
  value?: number;
  count?: number;
  code?: string;
  cumulative?: number;
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

const topICDCodes = [
  { code: 'I10', description: 'Essential hypertension', count: 285, revenue: 85500 },
  { code: 'E11', description: 'Type 2 diabetes mellitus', count: 312, revenue: 93600 },
  { code: 'I50', description: 'Heart failure', count: 198, revenue: 59400 },
  { code: 'J44', description: 'COPD', count: 156, revenue: 46800 },
  { code: 'N18', description: 'Chronic kidney disease', count: 142, revenue: 42600 },
  { code: 'M79', description: 'Other and unspecified soft tissue', count: 128, revenue: 38400 },
  { code: 'E78', description: 'Abdominal and pelvic pain', count: 115, revenue: 34500 },
];

const topCPTCodes = [
  { code: '99213', description: 'Office visit, established patient', count: 1250, revenue: 375000 },
  { code: '99214', description: 'Office visit, established patient (mid)', count: 895, revenue: 358000 },
  { code: '43235', description: 'Upper endoscopy with biopsy', count: 312, revenue: 89280 },
  { code: '45378', description: 'Colonoscopy with biopsy', count: 285, revenue: 85500 },
  { code: '27447', description: 'Total knee arthroplasty', count: 145, revenue: 95000 },
  { code: '27130', description: 'Hip arthroplasty', count: 98, revenue: 98000 },
];

const icdPrevalenceTrends = [
  { month: 'Jan', hypertension: 92, diabetes: 78, heartFailure: 65, copd: 58 },
  { month: 'Feb', hypertension: 98, diabetes: 82, heartFailure: 68, copd: 61 },
  { month: 'Mar', hypertension: 105, diabetes: 89, heartFailure: 72, copd: 65 },
  { month: 'Apr', hypertension: 102, diabetes: 85, heartFailure: 70, copd: 63 },
  { month: 'May', hypertension: 112, diabetes: 95, heartFailure: 78, copd: 70 },
  { month: 'Jun', hypertension: 115, diabetes: 98, heartFailure: 82, copd: 72 },
  { month: 'Jul', hypertension: 125, diabetes: 105, heartFailure: 88, copd: 78 },
  { month: 'Aug', hypertension: 120, diabetes: 102, heartFailure: 85, copd: 75 },
  { month: 'Sep', hypertension: 110, diabetes: 95, heartFailure: 80, copd: 70 },
  { month: 'Oct', hypertension: 105, diabetes: 88, heartFailure: 75, copd: 65 },
  { month: 'Nov', hypertension: 98, diabetes: 82, heartFailure: 68, copd: 60 },
  { month: 'Dec', hypertension: 108, diabetes: 90, heartFailure: 78, copd: 68 },
];

const diagnosisCategoriesData = [
  { name: 'Circulatory Diseases', value: 2485, color: '#e11d48' },
  { name: 'Endocrine/Metabolic', value: 1752, color: '#f59e0b' },
  { name: 'Respiratory Diseases', value: 1398, color: '#06b6d4' },
  { name: 'Psychiatric', value: 1125, color: '#8b5cf6' },
  { name: 'Musculoskeletal', value: 945, color: '#10b981' },
  { name: 'GI Disorders', value: 852, color: '#ec4899' },
  { name: 'Genitourinary', value: 745, color: '#3b82f6' },
  { name: 'Neoplasms', value: 625, color: '#6366f1' },
  { name: 'Other', value: 1203, color: '#64748b' },
];

const specialtyByDiagnosis = [
  { specialty: 'Cardiology', hypertension: 245, heartFailure: 198, atherosclerosis: 165 },
  { specialty: 'Endocrinology', diabetes: 312, lipoidStorage: 95, thyroid: 78 },
  { specialty: 'Pulmonology', copd: 156, asthma: 125, pneumonia: 95 },
  { specialty: 'Psychiatry', depression: 198, anxiety: 125, bipolar: 85 },
  { specialty: 'Orthopedics', osteoarthritis: 185, backPain: 142, fractures: 98 },
];

const comorbidityData = [
  { primary: 'Hypertension (I10)', comorbidity: 'Diabetes (E11)', count: 325 },
  { primary: 'Hypertension (I10)', comorbidity: 'Heart Failure (I50)', count: 287 },
  { primary: 'Diabetes (E11)', comorbidity: 'Hypertension (I10)', count: 325 },
  { primary: 'COPD (J44)', comorbidity: 'Heart Failure (I50)', count: 145 },
  { primary: 'Heart Failure (I50)', comorbidity: 'Hypertension (I10)', count: 287 },
  { primary: 'Heart Failure (I50)', comorbidity: 'CKD (N18)', count: 125 },
  { primary: 'Depression (F32)', comorbidity: 'Anxiety (F41)', count: 98 },
  { primary: 'Hypertension (I10)', comorbidity: 'CKD (N18)', count: 165 },
];

export default function DiagnosesPage() {
  const locationData = useLocation();
  const [searchICD, setSearchICD] = useState('');
  const [searchCPT, setSearchCPT] = useState('');

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

  // Prepare ICD and CPT data
  const icdArray = Object.entries(locationData.icdCodes)
    .map(([code, data]) => ({
      code,
      desc: data.desc,
      count: data.count,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 15);

  const cptArray = Object.entries(locationData.cptCodes)
    .map(([code, data]) => ({
      code,
      desc: data.desc,
      count: data.count,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 15);

  const uniqueICDCodes = Object.keys(locationData.icdCodes).length;
  const uniqueCPTCodes = Object.keys(locationData.cptCodes).length;

  // Top specialty
  const topSpecialty = Object.entries(locationData.specialties).sort((a, b) => b[1] - a[1])[0]?.[0] || 'General';

  // Specialty case mix pie
  const specialtyData = Object.entries(locationData.specialties)
    .map(([name, count]) => ({
      name,
      value: count,
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);

  // Pareto chart data (Top ICD with cumulative %)
  const totalICDCount = icdArray.reduce((sum, d) => sum + d.count, 0);
  const paretoData = icdArray.reduce<Array<{ code: string; count: number; cumulative: number; percentage: number }>>(
    (acc, d) => {
      const cumulative = (acc.at(-1)?.cumulative ?? 0) + d.count;
      acc.push({
        code: `${d.code}`,
        count: d.count,
        cumulative,
        percentage: (cumulative / totalICDCount) * 100,
      });
      return acc;
    },
    []
  );

  // Filter tables
  const filteredICD = icdArray.filter(
    (d) => d.code.toLowerCase().includes(searchICD.toLowerCase()) ||
      d.desc.toLowerCase().includes(searchICD.toLowerCase())
  );

  const filteredCPT = cptArray.filter(
    (d) => d.code.toLowerCase().includes(searchCPT.toLowerCase()) ||
      d.desc.toLowerCase().includes(searchCPT.toLowerCase())
  );

  const handleExport = () => {
    const exportData = [
      { metric: 'Unique ICD Codes', value: formatNumber(uniqueICDCodes) },
      { metric: 'Unique CPT Codes', value: formatNumber(uniqueCPTCodes) },
      { metric: 'Top Specialty', value: topSpecialty },
      ...icdArray.map((d) => ({
        metric: `${d.code} - ${d.desc}`,
        value: formatNumber(d.count),
      })),
    ];

    const csv = generateCSV(exportData);
    downloadCSV(csv, `diagnoses-${new Date().toISOString().split('T')[0]}.csv`);
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">ICD/CPT Code Analytics</h1>
          <p className="mt-1 text-sm text-gray-500">Diagnosis and procedure code distribution</p>
        </div>
        <Button onClick={handleExport} variant="outline" size="sm" className="gap-2">
          <Download className="h-4 w-4" />
          Export
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          title="Unique ICD Codes"
          value={formatNumber(uniqueICDCodes)}
          trend="neutral"
          color="teal"
        />
        <StatCard
          title="Unique CPT Codes"
          value={formatNumber(uniqueCPTCodes)}
          trend="neutral"
          color="blue"
        />
        <StatCard
          title="Top Specialty"
          value={topSpecialty}
          color="amber"
        />
      </div>

      {/* Charts Row 1 */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Top 15 Diagnoses */}
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 px-5 py-4">
            <h2 className="text-sm font-semibold text-gray-900">Top 15 ICD Diagnoses</h2>
            <p className="mt-1 text-xs text-gray-500">Most frequent diagnosis codes</p>
          </div>
          <div className="px-5 pb-5">
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={icdArray} layout="vertical" margin={{ top: 5, right: 30, left: 80 }}>
                <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
                <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis dataKey="code" type="category" tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} width={75} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="count" fill="#0d9488" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top 15 Procedures */}
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 px-5 py-4">
            <h2 className="text-sm font-semibold text-gray-900">Top 15 CPT Procedures</h2>
            <p className="mt-1 text-xs text-gray-500">Most frequent procedure codes</p>
          </div>
          <div className="px-5 pb-5">
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={cptArray} layout="vertical" margin={{ top: 5, right: 30, left: 80 }}>
                <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
                <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis dataKey="code" type="category" tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} width={75} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="count" fill="#0284c7" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Specialty Mix Pie */}
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 px-5 py-4">
            <h2 className="text-sm font-semibold text-gray-900">Specialty Case Mix</h2>
            <p className="mt-1 text-xs text-gray-500">Cases by specialty department</p>
          </div>
          <div className="px-5 pb-5">
            <ResponsiveContainer width="100%" height={320}>
              <PieChart>
                <Pie
                  data={specialtyData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  labelLine={false}
                  label={({ name, value }) => `${name}: ${formatNumber(value)}`}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {specialtyData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => formatNumber(value as number)} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Pareto Chart */}
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 px-5 py-4">
            <h2 className="text-sm font-semibold text-gray-900">ICD Codes Pareto Analysis</h2>
            <p className="mt-1 text-xs text-gray-500">Frequency bars with cumulative percentage line</p>
          </div>
          <div className="px-5 pb-5">
            <ResponsiveContainer width="100%" height={320}>
              <ComposedChart data={paretoData}>
                <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
                <XAxis dataKey="code" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} angle={-45} textAnchor="end" height={80} />
                <YAxis yAxisId="left" tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="right" orientation="right" tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Bar yAxisId="left" dataKey="count" fill="#0d9488" radius={[4, 4, 0, 0]} />
                <Line yAxisId="right" type="monotone" dataKey="percentage" stroke="#e11d48" strokeWidth={2} dot={{ r: 2 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* ICD Code Search Table */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 px-5 py-4">
          <h2 className="text-sm font-semibold text-gray-900">Searchable ICD Codes</h2>
          <p className="mt-1 text-xs text-gray-500">Filter by code or description</p>
          <div className="mt-4 flex items-center gap-2">
            <Search className="h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search ICD code or description..."
              value={searchICD}
              onChange={(e) => setSearchICD(e.target.value)}
              className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-teal-500 focus:outline-none"
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-600">Code</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-600">Description</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-gray-600">Frequency</th>
              </tr>
            </thead>
            <tbody>
              {filteredICD.map((row, idx) => (
                <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-5 py-3 text-sm font-medium text-gray-900">{row.code}</td>
                  <td className="px-5 py-3 text-sm text-gray-600">{row.desc}</td>
                  <td className="px-5 py-3 text-right text-sm text-gray-600">{formatNumber(row.count)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* CPT Code Search Table */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 px-5 py-4">
          <h2 className="text-sm font-semibold text-gray-900">Searchable CPT Codes</h2>
          <p className="mt-1 text-xs text-gray-500">Filter by code or description</p>
          <div className="mt-4 flex items-center gap-2">
            <Search className="h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search CPT code or description..."
              value={searchCPT}
              onChange={(e) => setSearchCPT(e.target.value)}
              className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-teal-500 focus:outline-none"
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-600">Code</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-600">Description</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-gray-600">Frequency</th>
              </tr>
            </thead>
            <tbody>
              {filteredCPT.map((row, idx) => (
                <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-5 py-3 text-sm font-medium text-gray-900">{row.code}</td>
                  <td className="px-5 py-3 text-sm text-gray-600">{row.desc}</td>
                  <td className="px-5 py-3 text-right text-sm text-gray-600">{formatNumber(row.count)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
