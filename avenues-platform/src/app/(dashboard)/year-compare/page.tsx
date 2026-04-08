'use client';

import { useState, useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
} from 'recharts';
import { Calendar, Download, AlertCircle } from 'lucide-react';
import { useStore } from '@/store';
import type { DashboardMetrics, YearData } from '@/types';

interface MonthlyData {
  month: string;
  [key: string]: number | string;
}

interface YearlyMetric {
  year: number;
  total: number;
  average: number;
  peak: number;
  peakMonth: string;
}

const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const generateMonthlyComparison = (selectedYears: number[], yearDataMap: Map<number, YearData>): MonthlyData[] => {
  return months.map((month, idx) => {
    const data: MonthlyData = { month };
    selectedYears.forEach((year) => {
      const yearData = yearDataMap.get(year);
      const dashboard = yearData?.dashboard || yearData?.dash;
      const monthRev = dashboard?.monthRevenue?.[idx] || 0;
      data[year.toString()] = monthRev;
    });
    return data;
  });
};

const calculateYearlyMetrics = (year: number, dashboard: DashboardMetrics | null): YearlyMetric => {
  const monthlyData = dashboard?.monthRevenue || [];
  const total = monthlyData.reduce((a: number, b: number) => a + b, 0);
  const average = monthlyData.length > 0 ? total / monthlyData.length : 0;
  const peak = monthlyData.length > 0 ? Math.max(...monthlyData) : 0;
  const peakMonth = monthlyData.length > 0 ? months[monthlyData.indexOf(peak)] : 'N/A';

  return { year, total, average, peak, peakMonth };
};

const calculateCAGR = (startValue: number, endValue: number, periods: number) => {
  if (startValue <= 0) return 0;
  return ((Math.pow(endValue / startValue, 1 / periods) - 1) * 100).toFixed(2);
};

export default function YearComparisonPage() {
  const years = useStore((s) => s.years);
  const availableYears = Array.from(years.keys()).sort((a, b) => a - b);
  const [selectedYears, setSelectedYears] = useState<number[]>(
    availableYears.slice(-3).length > 0 ? availableYears.slice(-3) : availableYears
  );

  const toggleYear = (year: number) => {
    if (selectedYears.includes(year)) {
      if (selectedYears.length > 1) {
        setSelectedYears(selectedYears.filter((y) => y !== year));
      }
    } else {
      if (selectedYears.length < 4) {
        setSelectedYears([...selectedYears, year].sort((a, b) => a - b));
      }
    }
  };

  // Check if we have data
  const hasData = years.size > 0;

  const monthlyComparison = generateMonthlyComparison(selectedYears, years);
  const yearlyMetrics = selectedYears.map((year) => {
    const yearData = years.get(year);
    const dashboard = (yearData?.dashboard || yearData?.dash) ?? null;
    return calculateYearlyMetrics(year, dashboard);
  });

  // Growth rates
  const growthRates = useMemo(() => {
    return selectedYears.map((year, idx) => {
      if (idx === 0) return null;
      const prevYear = selectedYears[idx - 1];
      const prevYearData = years.get(prevYear);
      const currYearData = years.get(year);
      const prevDash = prevYearData?.dashboard || prevYearData?.dash;
      const currDash = currYearData?.dashboard || currYearData?.dash;

      const prevTotal = prevDash?.monthRevenue?.reduce((a: number, b: number) => a + b, 0) || 0;
      const currTotal = currDash?.monthRevenue?.reduce((a: number, b: number) => a + b, 0) || 0;
      const growth = prevTotal > 0 ? ((currTotal - prevTotal) / prevTotal) * 100 : 0;

      return {
        period: `${year} vs ${prevYear}`,
        growth: parseFloat(growth.toFixed(1)),
      };
    }).filter(Boolean);
  }, [selectedYears, years]);

  // CAGR calculation
  const cagr = useMemo(() => {
    if (selectedYears.length < 2) return '0.00';
    const firstYear = selectedYears[0];
    const lastYear = selectedYears[selectedYears.length - 1];
    const firstData = years.get(firstYear);
    const lastData = years.get(lastYear);
    const firstDash = firstData?.dashboard || firstData?.dash;
    const lastDash = lastData?.dashboard || lastData?.dash;

    const startValue = firstDash?.monthRevenue?.[0] || 1;
    const endValue = lastDash?.monthRevenue?.[11] || startValue;
    return calculateCAGR(startValue, endValue, selectedYears.length - 1);
  }, [selectedYears, years]);

  // Best and worst months
  const bestMonth = useMemo(() => {
    let maxValue = 0;
    let bestMonthName = '';
    let bestYear: number | null = null;

    selectedYears.forEach((year) => {
      const yearData = years.get(year);
      const dashboard = yearData?.dashboard || yearData?.dash;
      const monthlyData = dashboard?.monthRevenue || [];
      monthlyData.forEach((value: number, idx: number) => {
        if (value > maxValue) {
          maxValue = value;
          bestMonthName = months[idx];
          bestYear = year;
        }
      });
    });

    return { month: bestMonthName, year: bestYear, value: maxValue };
  }, [selectedYears, years]);

  const worstMonth = useMemo(() => {
    let minValue = Infinity;
    let worstMonthName = '';
    let worstYear: number | null = null;

    selectedYears.forEach((year) => {
      const yearData = years.get(year);
      const dashboard = yearData?.dashboard || yearData?.dash;
      const monthlyData = dashboard?.monthRevenue || [];
      monthlyData.forEach((value: number, idx: number) => {
        if (value < minValue) {
          minValue = value;
          worstMonthName = months[idx];
          worstYear = year;
        }
      });
    });

    return { month: worstMonthName, year: worstYear, value: minValue };
  }, [selectedYears, years]);

  // Comprehensive comparison table
  const comparisonTable = useMemo(() => {
    return months.map((month, idx) => {
      const row: Record<string, string | number> = { month };
      selectedYears.forEach((year) => {
        const yearData = years.get(year);
        const dashboard = yearData?.dashboard || yearData?.dash;
        const monthRev = dashboard?.monthRevenue?.[idx] || 0;
        row[year.toString()] = monthRev;
      });
      return row;
    });
  }, [selectedYears, years]);

  if (!hasData) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-3 mb-8">
            <Calendar className="w-8 h-8 text-blue-600" />
            <h1 className="text-3xl font-bold text-gray-900">Year-on-Year Comparison</h1>
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

  const handleExport = () => {
    const csv = [
      ['Month', ...selectedYears.map((y) => y.toString())],
      ...comparisonTable.map((row) =>
        months.indexOf(row.month as string) >= 0
          ? [row.month, ...selectedYears.map((y) => row[y.toString()])]
          : []
      ),
      [],
      ['Yearly Totals'],
      ...yearlyMetrics.map((m) => [m.year, m.total]),
      [],
      ['CAGR', cagr],
    ]
      .map((row) => row.join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'year-comparison.csv';
    a.click();
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Calendar className="w-8 h-8 text-blue-600" />
            <h1 className="text-3xl font-bold text-gray-900">Year-on-Year Comparison</h1>
          </div>
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        </div>

        {/* Year Selection */}
        <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Select Years (up to 4)
          </label>
          <div className="flex flex-wrap gap-3">
            {availableYears.map((year) => (
              <button
                key={year}
                onClick={() => toggleYear(year)}
                disabled={!selectedYears.includes(year) && selectedYears.length >= 4}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${
                  selectedYears.includes(year)
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed'
                }`}
              >
                {year}
              </button>
            ))}
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow-sm p-4">
            <p className="text-xs text-gray-600 font-medium">CAGR</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{cagr}%</p>
            <p className="text-xs text-gray-500 mt-1">
              {selectedYears.length > 1
                ? `${selectedYears[0]} to ${selectedYears[selectedYears.length - 1]}`
                : 'Select multiple years'}
            </p>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-4">
            <p className="text-xs text-gray-600 font-medium">Best Month</p>
            <p className="text-lg font-bold text-gray-900 mt-1">
              {bestMonth.month} {bestMonth.year}
            </p>
            <p className="text-xs text-green-600 mt-1">{bestMonth.value}</p>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-4">
            <p className="text-xs text-gray-600 font-medium">Worst Month</p>
            <p className="text-lg font-bold text-gray-900 mt-1">
              {worstMonth.month} {worstMonth.year}
            </p>
            <p className="text-xs text-red-600 mt-1">{worstMonth.value}</p>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-4">
            <p className="text-xs text-gray-600 font-medium">Total Range</p>
            <p className="text-lg font-bold text-gray-900 mt-1">
              {(bestMonth.value - worstMonth.value).toFixed(0)}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              {(((bestMonth.value - worstMonth.value) / worstMonth.value) * 100).toFixed(1)}%
            </p>
          </div>
        </div>

        {/* Monthly Overlay Chart */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Monthly Trend - All Years
          </h2>
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={monthlyComparison}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Legend />
              {selectedYears.map((year, idx) => (
                <Line
                  key={year}
                  type="monotone"
                  dataKey={year.toString()}
                  stroke={['#3b82f6', '#10b981', '#f59e0b', '#ef4444'][idx]}
                  strokeWidth={2}
                  name={year.toString()}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Yearly Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {yearlyMetrics.map((metric) => (
            <div key={metric.year} className="bg-white rounded-lg shadow-sm p-4">
              <p className="text-sm font-semibold text-gray-900">{metric.year}</p>
              <p className="text-2xl font-bold text-blue-600 mt-2">{metric.total.toFixed(0)}</p>
              <div className="mt-3 space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-600">Average:</span>
                  <span className="font-semibold text-gray-900">{metric.average.toFixed(0)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Peak:</span>
                  <span className="font-semibold text-gray-900">{metric.peak}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Peak Month:</span>
                  <span className="font-semibold text-gray-900">{metric.peakMonth}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Growth Rate Table */}
        {growthRates.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Year-over-Year Growth Rate</h2>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left px-4 py-3 font-semibold text-gray-700">Period</th>
                    <th className="text-right px-4 py-3 font-semibold text-gray-700">Growth %</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-700">Trend</th>
                  </tr>
                </thead>
                <tbody>
                  {growthRates.map((row, idx) => (
                    <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-900 font-medium">{row?.period}</td>
                      <td
                        className={`px-4 py-3 text-right font-bold ${
                          row && row.growth > 0 ? 'text-green-600' : 'text-red-600'
                        }`}
                      >
                        {row && (row.growth > 0 ? '+' : '')}{row?.growth}%
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {row && row.growth > 5
                          ? '📈 Strong Growth'
                          : row && row.growth > 0
                            ? '📊 Moderate Growth'
                            : '📉 Decline'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Comprehensive Comparison Table */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Comprehensive Monthly Comparison
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left px-4 py-3 font-semibold text-gray-700">Month</th>
                  {selectedYears.map((year) => (
                    <th
                      key={year}
                      className="text-right px-4 py-3 font-semibold text-gray-700"
                    >
                      {year}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {comparisonTable.map((row, idx) => (
                  <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-900 font-medium">{row.month}</td>
                    {selectedYears.map((year) => (
                      <td
                        key={year}
                        className="px-4 py-3 text-right text-gray-900 font-semibold"
                      >
                        {row[year.toString()]}
                      </td>
                    ))}
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
