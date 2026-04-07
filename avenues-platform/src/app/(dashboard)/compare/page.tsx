'use client';

import { useState, useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from 'recharts';
import { Scale, AlertCircle } from 'lucide-react';
import { useStore, useDashboard } from '@/store';

type Metric = 'revenue' | 'admissions' | 'occupancy' | 'theatre' | 'pharmacy';

interface MetricData {
  current: number;
  previous: number;
  label: string;
  unit: string;
}

const metricOptions: { value: Metric; label: string }[] = [
  { value: 'revenue', label: 'Revenue' },
  { value: 'admissions', label: 'Admissions' },
  { value: 'occupancy', label: 'Occupancy' },
  { value: 'theatre', label: 'Theatre Cases' },
  { value: 'pharmacy', label: 'Pharmacy' },
];

export default function CompareMetricsPage() {
  const [metric1, setMetric1] = useState<Metric>('revenue');
  const [metric2, setMetric2] = useState<Metric>('admissions');
  const [compareType, setCompareType] = useState<'bar' | 'radar'>('bar');

  const years = useStore((s) => s.years);
  const currentYear = useStore((s) => s.currentYear);
  const currentDashboard = useDashboard();

  // Check if we have data
  const hasData = years.size > 0;

  // Calculate metrics from store data
  const calculateMetrics = useMemo(() => {
    if (!hasData || !currentDashboard) {
      return null;
    }

    const yearArray = Array.from(years.keys()).sort((a, b) => a - b);
    const current = currentDashboard;
    const prevYear = yearArray.length > 1
      ? yearArray[yearArray.indexOf(currentYear) - 1]
      : null;
    const previous = prevYear ? years.get(prevYear)?.dashboard || years.get(prevYear)?.dash : null;

    // Build metrics data from store
    const buildMetricData = (metric: Metric): MetricData => {
      const baseData = {
        label: metricOptions.find((m) => m.value === metric)?.label || metric,
        unit: 'R\'000',
      };

      switch (metric) {
        case 'revenue':
          return {
            ...baseData,
            current: current.totalRevenue || 0,
            previous: previous?.totalRevenue || current.totalRevenue || 0,
          };
        case 'admissions':
          return {
            ...baseData,
            unit: 'cases',
            current: current.admCasualty?.reduce((a, b) => a + b, 0) || 0,
            previous: previous?.admCasualty?.reduce((a, b) => a + b, 0) || 0,
          };
        case 'occupancy':
          return {
            ...baseData,
            unit: '%',
            current: current.occupancyBeds ? (current.occupancyBeds.reduce((a, b) => a + b, 0) / current.occupancyBeds.length) : 0,
            previous: previous?.occupancyBeds ? (previous.occupancyBeds.reduce((a, b) => a + b, 0) / previous.occupancyBeds.length) : 0,
          };
        case 'theatre':
          return {
            ...baseData,
            unit: 'cases',
            current: current.theatreCases?.reduce((a, b) => a + b, 0) || 0,
            previous: previous?.theatreCases?.reduce((a, b) => a + b, 0) || 0,
          };
        case 'pharmacy':
          return {
            ...baseData,
            unit: 'R\'000',
            current: current.pharmacyRev?.reduce((a, b) => a + b, 0) || 0,
            previous: previous?.pharmacyRev?.reduce((a, b) => a + b, 0) || 0,
          };
        default:
          return { ...baseData, current: 0, previous: 0 };
      }
    };

    return {
      metric1: buildMetricData(metric1),
      metric2: buildMetricData(metric2),
    };
  }, [hasData, currentDashboard, years, currentYear, metric1, metric2]);

  // Compute derived metric data before early returns
  const derivedMetricData = useMemo(() => {
    if (!calculateMetrics) {
      return null;
    }

    const data1 = calculateMetrics.metric1;
    const data2 = calculateMetrics.metric2;

    const yoyChange1 = data1.previous !== 0 ? ((data1.current - data1.previous) / data1.previous) * 100 : 0;
    const yoyChange2 = data2.previous !== 0 ? ((data2.current - data2.previous) / data2.previous) * 100 : 0;

    const barChartData = [
      {
        name: metricOptions.find((m) => m.value === metric1)?.label || metric1,
        current: data1.current,
        previous: data1.previous,
      },
      {
        name: metricOptions.find((m) => m.value === metric2)?.label || metric2,
        current: data2.current,
        previous: data2.previous,
      },
    ];

    return { data1, data2, yoyChange1, yoyChange2, barChartData };
  }, [calculateMetrics, metric1, metric2]);

  const comparisonMetrics = useMemo(() => {
    if (!derivedMetricData) return [];

    const { data1, data2, yoyChange1, yoyChange2 } = derivedMetricData;

    return [
      {
        label: metricOptions.find((m) => m.value === metric1)?.label || metric1,
        current: data1.current,
        previous: data1.previous,
        unit: data1.unit,
        change: data1.current - data1.previous,
        changePercent: yoyChange1,
      },
      {
        label: metricOptions.find((m) => m.value === metric2)?.label || metric2,
        current: data2.current,
        previous: data2.previous,
        unit: data2.unit,
        change: data2.current - data2.previous,
        changePercent: yoyChange2,
      },
    ];
  }, [derivedMetricData, metric1, metric2]);

  // Build comparison table from all dashboard metrics
  const comparisonTableData = useMemo(() => {
    if (!currentDashboard) return [];

    return [
      {
        metric: 'Admissions',
        current: currentDashboard.admCasualty?.reduce((a, b) => a + b, 0) || 0,
        previous: 0,
        change: 0,
        changePercent: 0,
      },
      {
        metric: 'Revenue',
        current: currentDashboard.totalRevenue || 0,
        previous: 0,
        change: 0,
        changePercent: 0,
      },
      {
        metric: 'Theatre Cases',
        current: currentDashboard.theatreCases?.reduce((a, b) => a + b, 0) || 0,
        previous: 0,
        change: 0,
        changePercent: 0,
      },
      {
        metric: 'Occupancy %',
        current: currentDashboard.occupancyBeds ? (currentDashboard.occupancyBeds.reduce((a, b) => a + b, 0) / currentDashboard.occupancyBeds.length) : 0,
        previous: 0,
        change: 0,
        changePercent: 0,
      },
      {
        metric: 'Pharmacy Revenue',
        current: currentDashboard.pharmacyRev?.reduce((a, b) => a + b, 0) || 0,
        previous: 0,
        change: 0,
        changePercent: 0,
      },
      {
        metric: 'Patient Days',
        current: currentDashboard.patientDays ? Object.values(currentDashboard.patientDays).flat().reduce((a, b) => a + b, 0) : 0,
        previous: 0,
        change: 0,
        changePercent: 0,
      },
    ];
  }, [currentDashboard]);

  const radarData = useMemo(() => {
    if (!currentDashboard) return [];
    const totalAdm = currentDashboard.admCasualty?.reduce((a, b) => a + b, 0) || 0;
    const totalRev = currentDashboard.totalRevenue || 0;
    const occRate = currentDashboard.occupancyBeds ? (currentDashboard.occupancyBeds.reduce((a, b) => a + b, 0) / currentDashboard.occupancyBeds.length) : 0;
    const totalTheatre = currentDashboard.theatreCases?.reduce((a, b) => a + b, 0) || 0;
    const totalPharm = currentDashboard.pharmacyRev?.reduce((a, b) => a + b, 0) || 0;

    return [
      { metric: 'Revenue', current: Math.min(totalRev / 30, 100), previous: 0 },
      { metric: 'Admissions', current: Math.min(totalAdm / 3, 100), previous: 0 },
      { metric: 'Occupancy', current: occRate, previous: 0 },
      { metric: 'Theatre', current: Math.min(totalTheatre / 1.5, 100), previous: 0 },
      { metric: 'Pharmacy', current: Math.min(totalPharm / 20, 100), previous: 0 },
    ];
  }, [currentDashboard]);

  if (!hasData) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-3 mb-8">
            <Scale className="w-8 h-8 text-blue-600" />
            <h1 className="text-3xl font-bold text-gray-900">Compare Metrics</h1>
          </div>
          <div className="flex flex-col items-center justify-center rounded-xl border border-gray-200 bg-white p-12 text-center shadow-sm">
            <AlertCircle className="h-12 w-12 text-gray-300 mb-4" />
            <h2 className="text-lg font-semibold text-gray-900">No Data Loaded</h2>
            <p className="mt-2 text-sm text-gray-500 max-w-md">Upload CSV data to see comparisons.</p>
            <a href="/upload" className="mt-4 text-sm font-medium text-teal-600 hover:text-teal-700">Go to Upload →</a>
          </div>
        </div>
      </div>
    );
  }

  if (!calculateMetrics) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-3 mb-8">
            <Scale className="w-8 h-8 text-blue-600" />
            <h1 className="text-3xl font-bold text-gray-900">Compare Metrics</h1>
          </div>
          <div className="flex flex-col items-center justify-center rounded-xl border border-gray-200 bg-white p-12 text-center shadow-sm">
            <AlertCircle className="h-12 w-12 text-gray-300 mb-4" />
            <h2 className="text-lg font-semibold text-gray-900">No Data Available</h2>
            <p className="mt-2 text-sm text-gray-500 max-w-md">Please select a year with loaded data.</p>
          </div>
        </div>
      </div>
    );
  }

  const barChartData = derivedMetricData?.barChartData || [];

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <Scale className="w-8 h-8 text-blue-600" />
          <h1 className="text-3xl font-bold text-gray-900">Compare Metrics</h1>
        </div>

        {/* Metric Selectors */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow-sm p-4">
            <label className="block text-sm font-medium text-gray-700 mb-3">
              First Metric
            </label>
            <select
              value={metric1}
              onChange={(e) => setMetric1(e.target.value as Metric)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {metricOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-4">
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Second Metric
            </label>
            <select
              value={metric2}
              onChange={(e) => setMetric2(e.target.value as Metric)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {metricOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-4">
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Chart Type
            </label>
            <select
              value={compareType}
              onChange={(e) => setCompareType(e.target.value as 'bar' | 'radar')}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="bar">Bar Chart</option>
              <option value="radar">Radar Chart</option>
            </select>
          </div>
        </div>

        {/* Metric Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {comparisonMetrics.map((metric, idx) => (
            <div key={idx} className="bg-white rounded-lg shadow-sm p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">{metric.label}</h3>

              <div className="space-y-4">
                {/* Current Value */}
                <div>
                  <p className="text-xs text-gray-600 font-medium">Current Value</p>
                  <p className="text-3xl font-bold text-gray-900 mt-1">
                    {metric.current}
                    <span className="text-sm text-gray-600 ml-2">{metric.unit}</span>
                  </p>
                </div>

                {/* Previous Value */}
                <div>
                  <p className="text-xs text-gray-600 font-medium">Previous Value</p>
                  <p className="text-lg text-gray-700 mt-1">
                    {metric.previous}
                    <span className="text-sm text-gray-600 ml-2">{metric.unit}</span>
                  </p>
                </div>

                {/* YoY Change */}
                <div className="pt-4 border-t border-gray-200">
                  <p className="text-xs text-gray-600 font-medium mb-2">YoY Change</p>
                  <div className="flex items-baseline gap-2">
                    <span
                      className={`text-2xl font-bold ${
                        metric.change > 0 ? 'text-green-600' : 'text-red-600'
                      }`}
                    >
                      {metric.change > 0 ? '+' : ''}{metric.change}
                    </span>
                    <span
                      className={`text-lg font-semibold ${
                        metric.changePercent > 0 ? 'text-green-600' : 'text-red-600'
                      }`}
                    >
                      ({metric.changePercent > 0 ? '+' : ''}{metric.changePercent.toFixed(1)}%)
                    </span>
                  </div>
                </div>

                {/* Status */}
                <div className="pt-4 border-t border-gray-200">
                  <span
                    className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${
                      metric.changePercent > 5
                        ? 'bg-green-100 text-green-800'
                        : metric.changePercent > 0
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {metric.changePercent > 5 ? 'Strong Growth' : metric.changePercent > 0 ? 'Growing' : 'Declining'}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Chart */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            {compareType === 'bar' ? 'Side-by-Side Comparison' : 'Multi-Metric Radar'}
          </h2>

          {compareType === 'bar' ? (
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={barChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="current" fill="#10b981" name="Current" />
                <Bar dataKey="previous" fill="#3b82f6" name="Previous" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <ResponsiveContainer width="100%" height={400}>
              <RadarChart data={radarData}>
                <PolarGrid />
                <PolarAngleAxis dataKey="metric" />
                <PolarRadiusAxis />
                <Radar
                  name="Current"
                  dataKey="current"
                  stroke="#10b981"
                  fill="#10b981"
                  fillOpacity={0.6}
                />
                <Radar
                  name="Previous"
                  dataKey="previous"
                  stroke="#3b82f6"
                  fill="#3b82f6"
                  fillOpacity={0.4}
                />
                <Legend />
              </RadarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Comparison Summary Table */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">All Metrics Comparison</h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left px-4 py-3 font-semibold text-gray-700">Metric</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-700">Current</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-700">Previous</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-700">Change</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-700">% Change</th>
                </tr>
              </thead>
              <tbody>
                {comparisonTableData.map((row, idx) => (
                  <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-900 font-medium">{row.metric}</td>
                    <td className="px-4 py-3 text-right text-gray-900 font-semibold">
                      {row.current}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700">{row.previous}</td>
                    <td
                      className={`px-4 py-3 text-right font-semibold ${
                        row.change > 0 ? 'text-green-600' : 'text-red-600'
                      }`}
                    >
                      {row.change > 0 ? '+' : ''}{row.change}
                    </td>
                    <td
                      className={`px-4 py-3 text-right font-semibold ${
                        row.changePercent > 0 ? 'text-green-600' : 'text-red-600'
                      }`}
                    >
                      {row.changePercent > 0 ? '+' : ''}{row.changePercent.toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
