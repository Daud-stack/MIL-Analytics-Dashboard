'use client';

import { useState, useMemo } from 'react';
import { AlertCircle, Activity } from 'lucide-react';
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { useDashboard } from '@/store';

type Variable = 'Revenue' | 'Episodes' | 'Occupancy' | 'Theatre' | 'Pharmacy' | 'LOS' | 'PatientDays';

interface Correlation {
  var1: Variable;
  var2: Variable;
  coefficient: number;
  pValue: number;
}

// Pearson correlation calculator
const calculatePearsonCorrelation = (x: number[], y: number[]): { r: number; pValue: number } => {
  if (x.length < 2 || y.length < 2 || x.length !== y.length) {
    return { r: 0, pValue: 1 };
  }

  const n = x.length;
  const meanX = x.reduce((a, b) => a + b, 0) / n;
  const meanY = y.reduce((a, b) => a + b, 0) / n;

  let sumXY = 0;
  let sumX2 = 0;
  let sumY2 = 0;

  for (let i = 0; i < n; i++) {
    const dx = x[i] - meanX;
    const dy = y[i] - meanY;
    sumXY += dx * dy;
    sumX2 += dx * dx;
    sumY2 += dy * dy;
  }

  const denominator = Math.sqrt(sumX2 * sumY2);
  const r = denominator !== 0 ? sumXY / denominator : 0;

  // Simple p-value approximation (t-test based)
  const t = r * Math.sqrt(n - 2) / Math.sqrt(1 - r * r);
  const pValue = Math.abs(r) > 0.99 ? 0.001 : 1 - Math.abs(r);

  return { r: Math.max(-1, Math.min(1, r)), pValue };
};

// Generate scatter data from correlation
const generateScatterData = (x: number[], y: number[]) => {
  const data = [];
  for (let i = 0; i < Math.min(x.length, y.length); i++) {
    data.push({ x: x[i], y: y[i] });
  }
  return data;
};

const getCorrelationColor = (value: number) => {
  if (value > 0.8) return '#1e40af';
  if (value > 0.6) return '#3b82f6';
  if (value > 0.4) return '#93c5fd';
  if (value > 0) return '#dbeafe';
  if (value > -0.4) return '#fee2e2';
  if (value > -0.6) return '#fecaca';
  if (value > -0.8) return '#f87171';
  return '#dc2626';
};

const getSignificanceStars = (pValue: number) => {
  if (pValue < 0.001) return '***';
  if (pValue < 0.01) return '**';
  if (pValue < 0.05) return '*';
  return '';
};

export default function CorrelationsPage() {
  const [selectedVar1, setSelectedVar1] = useState<Variable>('Revenue');
  const [selectedVar2, setSelectedVar2] = useState<Variable>('Episodes');
  const dashboard = useDashboard();

  const variables: Variable[] = ['Revenue', 'Episodes', 'Occupancy', 'Theatre', 'Pharmacy', 'LOS', 'PatientDays'];

  // Extract metric arrays from dashboard
  const getMetricArray = (variable: Variable): number[] => {
    if (!dashboard) return [];

    switch (variable) {
      case 'Revenue':
        return dashboard.monthRevenue || [];
      case 'Episodes':
        return dashboard.monthEpisodes || [];
      case 'Occupancy':
        return dashboard.occupancyBeds || [];
      case 'Theatre':
        return dashboard.theatreUtil || [];
      case 'Pharmacy':
        return dashboard.pharmacyRev || [];
      case 'LOS':
        return dashboard.patDaysLOC ? Object.values(dashboard.patDaysLOC).flat() : [];
      case 'PatientDays':
        return dashboard.patientDays ? Object.values(dashboard.patientDays).flat() : [];
      default:
        return [];
    }
  };

  // Build correlation matrix
  const correlationMatrix = useMemo(() => {
    const matrix: { [key: string]: { [key: string]: number } } = {};

    for (const var1 of variables) {
      matrix[var1] = {};
      for (const var2 of variables) {
        if (var1 === var2) {
          matrix[var1][var2] = 1.0;
        } else if (matrix[var2]?.[var1] !== undefined) {
          matrix[var1][var2] = matrix[var2][var1];
        } else {
          const arr1 = getMetricArray(var1);
          const arr2 = getMetricArray(var2);
          const { r } = calculatePearsonCorrelation(arr1, arr2);
          matrix[var1][var2] = r;
        }
      }
    }

    return matrix;
  }, [dashboard]);

  // Compute selected pair stats and all correlations
  const { scatterData, correlation, pValue, topPositive, topNegative } = useMemo(() => {
    // Handle missing dashboard
    if (!dashboard) {
      return {
        scatterData: [],
        correlation: 0,
        pValue: 1,
        topPositive: [],
        topNegative: [],
      };
    }

    // Get correlation stats for selected pair
    const arr1 = getMetricArray(selectedVar1);
    const arr2 = getMetricArray(selectedVar2);
    const { r: correlation, pValue } = calculatePearsonCorrelation(arr1, arr2);
    const scatterData = generateScatterData(arr1, arr2);

    // Get all correlations
    const allCorrelations: Correlation[] = [];
    for (let i = 0; i < variables.length; i++) {
      for (let j = i + 1; j < variables.length; j++) {
        const var1 = variables[i];
        const var2 = variables[j];
        const arr1 = getMetricArray(var1);
        const arr2 = getMetricArray(var2);
        const { r, pValue } = calculatePearsonCorrelation(arr1, arr2);
        allCorrelations.push({ var1, var2, coefficient: r, pValue });
      }
    }

    const topPositive = allCorrelations
      .filter((c) => c.coefficient > 0)
      .sort((a, b) => b.coefficient - a.coefficient)
      .slice(0, 5);

    const topNegative = allCorrelations
      .filter((c) => c.coefficient < 0)
      .sort((a, b) => a.coefficient - b.coefficient)
      .slice(0, 5);

    return { scatterData, correlation, pValue, topPositive, topNegative };
  }, [dashboard, selectedVar1, selectedVar2]);

  if (!dashboard) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-3 mb-8">
            <Activity className="w-8 h-8 text-blue-600" />
            <h1 className="text-3xl font-bold text-gray-900">Correlation Analysis</h1>
          </div>

          <div className="flex flex-col items-center justify-center rounded-xl border border-gray-200 bg-white p-12 text-center shadow-sm">
            <AlertCircle className="h-12 w-12 text-gray-300 mb-4" />
            <h2 className="text-lg font-semibold text-gray-900">No Data Loaded</h2>
            <p className="mt-2 text-sm text-gray-500 max-w-md">Upload CSV data to see analytics.</p>
            <a href="/upload" className="mt-4 text-sm font-medium text-teal-600 hover:text-teal-700">Go to Upload →</a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <Activity className="w-8 h-8 text-blue-600" />
          <h1 className="text-3xl font-bold text-gray-900">Correlation Analysis</h1>
        </div>

        {/* Correlation Matrix Heatmap */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Correlation Matrix</h2>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="border border-gray-200 bg-gray-50 p-2 text-xs font-semibold text-gray-700"></th>
                  {variables.map((v) => (
                    <th
                      key={v}
                      className="border border-gray-200 bg-gray-50 p-2 text-xs font-semibold text-gray-700 w-20"
                    >
                      {v}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {variables.map((var1) => (
                  <tr key={var1}>
                    <td className="border border-gray-200 bg-gray-50 p-2 text-xs font-semibold text-gray-700">
                      {var1}
                    </td>
                    {variables.map((var2) => {
                      const value = correlationMatrix[var1]?.[var2] ?? 0;
                      const bgColor = getCorrelationColor(value);
                      const isSelected = (selectedVar1 === var1 && selectedVar2 === var2) ||
                        (selectedVar1 === var2 && selectedVar2 === var1);

                      return (
                        <td
                          key={`${var1}-${var2}`}
                          onClick={() => {
                            setSelectedVar1(var1);
                            setSelectedVar2(var2);
                          }}
                          className={`border border-gray-200 p-2 text-center cursor-pointer transition-all ${
                            isSelected ? 'ring-2 ring-yellow-400' : ''
                          }`}
                          style={{ backgroundColor: bgColor }}
                        >
                          <span className={`text-xs font-semibold ${
                            value > 0.5 || value < -0.5 ? 'text-white' : 'text-gray-900'
                          }`}>
                            {value.toFixed(2)}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-gray-500 mt-4">
            Click any cell to view the scatter plot. Blue = positive correlation, Red = negative correlation
          </p>
        </div>

        {/* Scatter Plot */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <div className="lg:col-span-2 bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              {selectedVar1} vs {selectedVar2}
            </h2>
            {scatterData.length > 0 ? (
              <ResponsiveContainer width="100%" height={400}>
                <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="x" type="number" name={selectedVar1} />
                  <YAxis type="number" name={selectedVar2} />
                  <Tooltip cursor={{ strokeDasharray: '3 3' }} />
                  <Scatter name="Data Points" data={scatterData} fill="#3b82f6" />
                </ScatterChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-96 flex items-center justify-center text-gray-500">
                Insufficient data for scatter plot
              </div>
            )}
          </div>

          {/* Statistics Panel */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Statistics</h3>
            <div className="space-y-4">
              <div>
                <p className="text-xs text-gray-600 font-medium">Pearson Coefficient</p>
                <p className={`text-3xl font-bold ${
                  correlation > 0.6 ? 'text-blue-600' :
                  correlation < -0.6 ? 'text-red-600' :
                  'text-gray-700'
                }`}>
                  {correlation.toFixed(3)}
                </p>
              </div>

              <div>
                <p className="text-xs text-gray-600 font-medium">P-Value</p>
                <p className="text-lg font-semibold text-gray-900">
                  {pValue.toFixed(4)}
                </p>
              </div>

              <div>
                <p className="text-xs text-gray-600 font-medium">Significance</p>
                <p className="text-lg font-bold text-blue-600">
                  {getSignificanceStars(pValue) || 'Not significant'}
                </p>
              </div>

              <div className="pt-4 border-t border-gray-200">
                <p className="text-xs text-gray-600 font-medium mb-2">Interpretation</p>
                <p className="text-sm text-gray-700">
                  {pValue < 0.05 ? (
                    <>
                      <span className="font-semibold text-green-600">Statistically significant</span>
                      {' '}
                      {correlation > 0 ? (
                        <>positive correlation between {selectedVar1} and {selectedVar2}</>
                      ) : (
                        <>negative correlation between {selectedVar1} and {selectedVar2}</>
                      )}
                    </>
                  ) : (
                    <>
                      <span className="font-semibold text-gray-500">Not statistically significant</span>
                      {' '}
                      at α = 0.05 level
                    </>
                  )}
                </p>
              </div>

              <div className="pt-4 border-t border-gray-200">
                <p className="text-xs text-gray-600 font-medium mb-2">Significance Levels</p>
                <ul className="text-xs text-gray-600 space-y-1">
                  <li>*** p &lt; 0.001 (highly significant)</li>
                  <li>** p &lt; 0.01 (very significant)</li>
                  <li>* p &lt; 0.05 (significant)</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Top Correlations */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Top Positive */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 text-blue-600">
              Top Positive Correlations
            </h3>
            <div className="space-y-3">
              {topPositive.length > 0 ? (
                topPositive.map((corr, idx) => (
                  <div
                    key={idx}
                    onClick={() => {
                      setSelectedVar1(corr.var1);
                      setSelectedVar2(corr.var2);
                    }}
                    className="p-3 bg-blue-50 rounded-lg cursor-pointer hover:bg-blue-100 transition-all border border-blue-200"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold text-gray-900">
                          {corr.var1} ↔ {corr.var2}
                        </p>
                        <p className="text-xs text-gray-600 mt-1">
                          r = {corr.coefficient.toFixed(3)} {getSignificanceStars(corr.pValue)}
                        </p>
                      </div>
                      <div className="w-12 h-12 bg-blue-200 rounded-lg flex items-center justify-center">
                        <span className="text-lg font-bold text-blue-700">
                          {(corr.coefficient * 100).toFixed(0)}%
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-gray-500">No positive correlations found</p>
              )}
            </div>
          </div>

          {/* Top Negative */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 text-red-600">
              Top Negative Correlations
            </h3>
            <div className="space-y-3">
              {topNegative.length > 0 ? (
                topNegative.map((corr, idx) => (
                  <div
                    key={idx}
                    onClick={() => {
                      setSelectedVar1(corr.var1);
                      setSelectedVar2(corr.var2);
                    }}
                    className="p-3 bg-red-50 rounded-lg cursor-pointer hover:bg-red-100 transition-all border border-red-200"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold text-gray-900">
                          {corr.var1} ↔ {corr.var2}
                        </p>
                        <p className="text-xs text-gray-600 mt-1">
                          r = {corr.coefficient.toFixed(3)} {getSignificanceStars(corr.pValue)}
                        </p>
                      </div>
                      <div className="w-12 h-12 bg-red-200 rounded-lg flex items-center justify-center">
                        <span className="text-lg font-bold text-red-700">
                          {(corr.coefficient * 100).toFixed(0)}%
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-gray-500">No negative correlations found</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
