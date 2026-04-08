'use client';

import React, { useState, useMemo } from 'react';
import { ChevronLeft, Upload } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { Button } from '@/components/ui/button';
import { ChartTooltipProps, MONTHS } from '@/types';
import { formatCurrency, formatNumber } from '@/lib/utils';
import { useLocation, useDashboard, useCurrentYear } from '@/store';

type DrillLevel = 'year' | 'specialty' | 'doctor' | 'medAid' | 'patient';
type Metric = 'episodes' | 'revenue' | 'admissions';

interface DrillState {
  level: DrillLevel;
  selectedYear?: number;
  selectedSpecialty?: string;
  selectedDoctor?: string;
  selectedMedAid?: string;
}

function calculateZScore(value: number, arr: number[]): number {
  if (arr.length === 0) return 0;
  const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
  const variance = arr.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / arr.length;
  const stdDev = Math.sqrt(variance);
  return stdDev === 0 ? 0 : (value - mean) / stdDev;
}

interface ChartDataPoint {
  name: string;
  episodes: number;
  revenue: number;
  admissions: number;
  zScore: number;
  [key: string]: string | number;
}

const CustomTooltip = ({ active, payload }: ChartTooltipProps<ChartDataPoint>) => {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-lg">
        <p className="text-sm font-medium text-gray-900">{payload[0].payload?.name}</p>
        <p className="text-sm text-blue-600">{formatNumber(Number(payload[0].value ?? 0))}</p>
      </div>
    );
  }
  return null;
};

export default function DrilldownPage() {
  const [drillState, setDrillState] = useState<DrillState>({ level: 'year', selectedYear: 2024 });
  const [metric, setMetric] = useState<Metric>('episodes');

  const currentYearValue = useCurrentYear();
  const locData = useLocation();
  const dashData = useDashboard();
  const currentYear = drillState.selectedYear || currentYearValue;

  // Generate hierarchical data
  const generateChartData = (): ChartDataPoint[] => {
    if (!locData) return [];

    switch (drillState.level) {
      case 'year': {
        // Yearly data by specialty
        const grouped = locData.doctors
          .reduce((acc: Record<string, ChartDataPoint>, doc) => {
            const spec = doc.specialty ?? 'Unknown';
            if (!acc[spec]) {
              acc[spec] = {
                name: spec,
                episodes: 0,
                revenue: 0,
                admissions: 0,
                zScore: 0,
              };
            }
            acc[spec].episodes += doc.episodes;
            acc[spec].revenue += doc.revenue;
            acc[spec].admissions += Math.floor(doc.episodes * (0.3 + 0.2));
            return acc;
          }, {} as Record<string, ChartDataPoint>);
        return Object.values(grouped).map((d) => ({ ...d, zScore: 0 }));
      }

      case 'specialty': {
        // Doctors in selected specialty
        const selectedSpecialty = drillState.selectedSpecialty ?? '';
        const filteredDocs = locData.doctors.filter(d => d.specialty === selectedSpecialty);
        const values = filteredDocs.map(d => d[metric === 'episodes' ? 'episodes' : 'revenue']);
        return filteredDocs.map(doc => ({
          name: doc.name.split(' ')[1] ?? 'Unknown',
          episodes: doc.episodes,
          revenue: doc.revenue,
          admissions: Math.floor(doc.episodes * 0.35),
          zScore: calculateZScore(doc[metric === 'episodes' ? 'episodes' : 'revenue'], values),
        }));
      }

      case 'doctor': {
        // Medical aids for selected doctor
        const firstDoc = locData.doctors[0];
        const docEpisodes = firstDoc?.episodes ?? 0;
        const docRevenue = firstDoc?.revenue ?? 0;
        return Object.entries(locData.medAids).map(([aid, count]) => {
          const total = Object.values(locData.medAids).reduce((a, b) => a + b, 0) || 1;
          return {
            name: aid.substring(0, 15),
            episodes: Math.floor(docEpisodes * (count / total)),
            revenue: Math.floor(docRevenue * (count / total)),
            admissions: Math.floor(docEpisodes * 0.35 * (count / total)),
            zScore: 0,
          };
        });
      }

      case 'medAid': {
        // Monthly breakdown for selected medical aid
        return MONTHS.map((month, idx) => ({
          name: month.substring(0, 3),
          episodes: locData.monthEpisodes?.[idx] ?? 0,
          revenue: locData.monthRevenue?.[idx] ?? 0,
          admissions: Math.floor((locData.monthEpisodes?.[idx] ?? 0) * 0.35),
          zScore: 0,
        }));
      }

      case 'patient':
      default:
        return [];
    }
  };

  const chartData = generateChartData();
  const metricKey = metric === 'admissions' ? 'admissions' : metric;

  // Calculate summary stats
  const summaryStats = useMemo(() => {
    if (chartData.length === 0) return { total: 0, avg: 0, max: 0, min: 0 };
    const values = chartData.map((d: ChartDataPoint) => d[metricKey as keyof ChartDataPoint] as number);
    const total = values.reduce((a: number, b: number) => a + b, 0);
    return {
      total,
      avg: total / values.length,
      max: Math.max(...values),
      min: Math.min(...values),
    };
  }, [chartData, metricKey]);

  if (!locData || !dashData) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <div className="rounded-xl border border-gray-200 bg-white p-12 shadow-sm max-w-md">
          <Upload className="h-12 w-12 text-slate-300 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-slate-800 mb-2">No Data Loaded</h2>
          <p className="text-slate-500 mb-6">Upload your CSV files to see analytics here.</p>
          <a href="/upload" className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 transition-colors">
            Go to Upload
          </a>
        </div>
      </div>
    );
  }

  const handleDrill = (name: string) => {
    switch (drillState.level) {
      case 'year':
        setDrillState({
          ...drillState,
          level: 'specialty',
          selectedSpecialty: name,
        });
        break;
      case 'specialty':
        setDrillState({
          ...drillState,
          level: 'doctor',
          selectedDoctor: name,
        });
        break;
      case 'doctor':
        setDrillState({
          ...drillState,
          level: 'medAid',
          selectedMedAid: name,
        });
        break;
      case 'medAid':
        setDrillState({
          ...drillState,
          level: 'patient',
        });
        break;
    }
  };

  const handleBackClick = () => {
    switch (drillState.level) {
      case 'specialty':
        setDrillState({ level: 'year', selectedYear: currentYear });
        break;
      case 'doctor':
        setDrillState({ level: 'specialty', selectedYear: currentYear, selectedSpecialty: drillState.selectedSpecialty });
        break;
      case 'medAid':
        setDrillState({ level: 'doctor', selectedYear: currentYear, selectedSpecialty: drillState.selectedSpecialty, selectedDoctor: drillState.selectedDoctor });
        break;
      case 'patient':
        setDrillState({ ...drillState, level: 'medAid' });
        break;
    }
  };

  const canDrillDeeper = drillState.level !== 'patient';
  const canGoBack = drillState.level !== 'year';

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Hierarchical Drill-Down Explorer</h1>
        <p className="mt-1 text-sm text-gray-500">Navigate through levels: Year → Specialty → Doctor → Medical Aid</p>
      </div>

      {/* Controls */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-5">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Year Selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Year</label>
            <select
              value={currentYear}
              onChange={(e) => setDrillState({ level: 'year', selectedYear: parseInt(e.target.value) })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              <option value="2022">2022</option>
              <option value="2023">2023</option>
              <option value="2024">2024</option>
              <option value="2025">2025</option>
            </select>
          </div>

          {/* Metric Selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Metric</label>
            <select
              value={metric}
              onChange={(e) => setMetric(e.target.value as Metric)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              <option value="episodes">Episodes</option>
              <option value="revenue">Revenue</option>
              <option value="admissions">Admissions</option>
            </select>
          </div>

          {/* Level Display */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Current Level</label>
            <div className="px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-sm font-medium text-gray-900">
              {drillState.level.charAt(0).toUpperCase() + drillState.level.slice(1)}
            </div>
          </div>

          {/* Navigation */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Navigation</label>
            <Button
              onClick={handleBackClick}
              disabled={!canGoBack}
              variant="outline"
              size="sm"
              className="w-full gap-2"
            >
              <ChevronLeft className="h-4 w-4" />
              Back
            </Button>
          </div>
        </div>
      </div>

      {/* Breadcrumb */}
      {drillState.level !== 'year' && (
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-4">
          <div className="flex items-center gap-2 text-sm">
            <button
              onClick={() => setDrillState({ level: 'year', selectedYear: currentYear })}
              className="text-teal-600 hover:text-teal-700 font-medium"
            >
              Year
            </button>
            {drillState.selectedSpecialty && (
              <>
                <span className="text-gray-400">/</span>
                <button
                  onClick={() => setDrillState({ level: 'specialty', selectedYear: currentYear, selectedSpecialty: drillState.selectedSpecialty })}
                  className="text-teal-600 hover:text-teal-700 font-medium"
                >
                  {drillState.selectedSpecialty}
                </button>
              </>
            )}
            {drillState.selectedDoctor && (
              <>
                <span className="text-gray-400">/</span>
                <span className="text-gray-600">{drillState.selectedDoctor}</span>
              </>
            )}
            {drillState.selectedMedAid && (
              <>
                <span className="text-gray-400">/</span>
                <span className="text-gray-600">{drillState.selectedMedAid}</span>
              </>
            )}
          </div>
        </div>
      )}

      {/* Summary Stats */}
      <div className="grid gap-4 sm:grid-cols-4">
        <div className="rounded-lg bg-white border border-gray-200 p-4">
          <p className="text-xs font-medium text-gray-600 uppercase tracking-wider">Total</p>
          <p className="text-2xl font-bold text-gray-900 mt-2">
            {metric === 'revenue' ? formatCurrency(summaryStats.total) : formatNumber(summaryStats.total)}
          </p>
        </div>
        <div className="rounded-lg bg-white border border-gray-200 p-4">
          <p className="text-xs font-medium text-gray-600 uppercase tracking-wider">Average</p>
          <p className="text-2xl font-bold text-gray-900 mt-2">
            {metric === 'revenue' ? formatCurrency(summaryStats.avg) : formatNumber(summaryStats.avg)}
          </p>
        </div>
        <div className="rounded-lg bg-white border border-gray-200 p-4">
          <p className="text-xs font-medium text-gray-600 uppercase tracking-wider">Maximum</p>
          <p className="text-2xl font-bold text-green-600 mt-2">
            {metric === 'revenue' ? formatCurrency(summaryStats.max) : formatNumber(summaryStats.max)}
          </p>
        </div>
        <div className="rounded-lg bg-white border border-gray-200 p-4">
          <p className="text-xs font-medium text-gray-600 uppercase tracking-wider">Minimum</p>
          <p className="text-2xl font-bold text-red-600 mt-2">
            {metric === 'revenue' ? formatCurrency(summaryStats.min) : formatNumber(summaryStats.min)}
          </p>
        </div>
      </div>

      {/* Chart */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">{metric.charAt(0).toUpperCase() + metric.slice(1)} by {drillState.level.charAt(0).toUpperCase() + drillState.level.slice(1)}</h2>
        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={chartData}>
            <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
            <XAxis
              dataKey="name"
              tick={{ fill: '#94a3b8', fontSize: 12 }}
              axisLine={false}
              tickLine={false}
              angle={chartData.length > 8 ? -45 : 0}
              textAnchor={chartData.length > 8 ? 'end' : 'middle'}
              height={chartData.length > 8 ? 80 : 30}
            />
            <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
            <Tooltip content={<CustomTooltip />} />
            <Bar
              dataKey={metricKey}
              fill="#0d9488"
              radius={[4, 4, 0, 0]}
              onClick={(data) => canDrillDeeper && data.name && handleDrill(data.name)}
              style={{ cursor: canDrillDeeper ? 'pointer' : 'default' }}
            />
          </BarChart>
        </ResponsiveContainer>
        {canDrillDeeper && (
          <p className="mt-4 text-xs text-gray-500">Click on a bar to drill deeper into the data</p>
        )}
      </div>

      {/* Data Table */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">Data Table</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-200 bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left font-semibold text-gray-900">Name</th>
                <th className="px-6 py-3 text-right font-semibold text-gray-900">Episodes</th>
                <th className="px-6 py-3 text-right font-semibold text-gray-900">Revenue</th>
                <th className="px-6 py-3 text-right font-semibold text-gray-900">Z-Score</th>
              </tr>
            </thead>
            <tbody>
              {chartData.map((row: ChartDataPoint, idx: number) => (
                <tr
                  key={idx}
                  className={`border-b border-gray-100 hover:bg-gray-50 ${Math.abs(row.zScore) > 1.5 ? 'bg-yellow-50' : ''}`}
                  onClick={() => canDrillDeeper && handleDrill(row.name)}
                  style={{ cursor: canDrillDeeper ? 'pointer' : 'default' }}
                >
                  <td className="px-6 py-3 text-gray-900 font-medium">{row.name}</td>
                  <td className="px-6 py-3 text-right text-gray-700">{formatNumber(row.episodes)}</td>
                  <td className="px-6 py-3 text-right text-gray-700">{formatCurrency(row.revenue)}</td>
                  <td className="px-6 py-3 text-right">
                    <span className={`text-sm font-medium ${Math.abs(row.zScore) > 1.5 ? 'text-orange-600' : 'text-gray-600'}`}>
                      {row.zScore.toFixed(2)}
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
