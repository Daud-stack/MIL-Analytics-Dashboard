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
  LineChart,
  Line,
  ScatterChart,
  Scatter,
} from 'recharts';
import { Beaker, AlertCircle } from 'lucide-react';
import { useDashboard } from '@/store';
import { normalCDF, normalInvCDF } from '@/lib/stats';
import type { DashboardMetrics } from '@/types';

type TestType = 't-test' | 'chi-square' | 'anova' | 'shapiro-wilk' | 'z-test';

interface TestResult {
  testStatistic: number;
  pValue: number;
  degreesOfFreedom?: number;
  effectSize?: number;
  significant: boolean;
  interpretation: string;
}

// Generate sample data from dashboard metrics
const generateSampleData = (metrics: DashboardMetrics | null) => {
  if (!metrics?.monthRevenue) {
    return {
      group1: [220, 225, 230, 235, 240, 245, 250, 255, 260, 265],
      group2: [200, 205, 210, 215, 220, 225, 230, 235, 240, 245],
      normal: [10.2, 10.5, 10.8, 11.0, 11.2, 11.5, 11.8, 12.0, 12.2, 12.5, 10.3, 10.6, 10.9, 11.1, 11.3, 11.6, 11.9, 12.1, 12.3, 12.6],
      bimodal: [2.1, 2.3, 2.5, 2.7, 2.9, 8.1, 8.3, 8.5, 8.7, 8.9, 2.2, 2.4, 2.6, 2.8, 3.0, 8.2, 8.4, 8.6, 8.8, 9.0],
    };
  }

  const revenue = metrics.monthRevenue;
  const min = Math.min(...revenue);
  const max = Math.max(...revenue);
  const range = max - min;

  // Normalize to 200-270 scale
  const normalized = revenue.map((r: number) => 200 + ((r - min) / (range + 1)) * 70);

  return {
    group1: normalized.slice(0, 10),
    group2: normalized.slice(6, 12).map((v: number) => v - 20),
    normal: metrics.monthRevenue.slice(0, 12).map((v: number) => (v / 200) * 11.5),
    bimodal: [...metrics.monthRevenue.slice(0, 6).map((v: number) => (v / 1000) * 2.5), ...metrics.monthRevenue.slice(6, 12).map((v: number) => (v / 300) * 8.5)],
  };
};

// Q-Q plot data generator
const generateQQPlotData = (data: number[]) => {
  const sorted = [...data].sort((a, b) => a - b);
  const mean = sorted.reduce((a, b) => a + b, 0) / sorted.length;
  const variance =
    sorted.reduce((a, b) => a + (b - mean) ** 2, 0) / sorted.length;
  const stdev = Math.sqrt(variance);

  return sorted.map((value, idx) => {
    // Normal quantile for each position using proper inverse normal CDF
    const q = (idx + 1) / (sorted.length + 1);
    const theoretical = mean + stdev * normalInvCDF(q);
    return { theoretical, actual: value };
  });
};

// Test implementations
const performTTest = (group1: number[], group2: number[]): TestResult => {
  const mean1 = group1.reduce((a, b) => a + b, 0) / group1.length;
  const mean2 = group2.reduce((a, b) => a + b, 0) / group2.length;

  const var1 = group1.reduce((a, b) => a + (b - mean1) ** 2, 0) / (group1.length - 1);
  const var2 = group2.reduce((a, b) => a + (b - mean2) ** 2, 0) / (group2.length - 1);

  const pooledVar = ((group1.length - 1) * var1 + (group2.length - 1) * var2) /
    (group1.length + group2.length - 2);
  const se = Math.sqrt(pooledVar * (1 / group1.length + 1 / group2.length));

  const tStat = (mean1 - mean2) / se;
  const df = group1.length + group2.length - 2;

  // Approximate p-value using normal CDF (valid for large df; reasonable for df > 5)
  const pValue = 2 * (1 - normalCDF(Math.abs(tStat)));
  const effectSize = (mean1 - mean2) / Math.sqrt(pooledVar);

  return {
    testStatistic: parseFloat(tStat.toFixed(4)),
    pValue: parseFloat(pValue.toFixed(4)),
    degreesOfFreedom: df,
    effectSize: parseFloat(effectSize.toFixed(4)),
    significant: pValue < 0.05,
    interpretation:
      pValue < 0.05
        ? `The difference between groups is statistically significant (p = ${pValue.toFixed(4)})`
        : `No significant difference between groups (p = ${pValue.toFixed(4)})`,
  };
};

const performShapiroWilk = (data: number[]): TestResult => {
  // Simplified Shapiro-Wilk test
  const sorted = [...data].sort((a, b) => a - b);
  const mean = sorted.reduce((a, b) => a + b, 0) / sorted.length;
  const variance = sorted.reduce((a, b) => a + (b - mean) ** 2, 0) / sorted.length;

  // Calculate W statistic (simplified)
  let numerator = 0;
  for (let i = 0; i < Math.floor(sorted.length / 2); i++) {
    const coeff = (i + 1) / (sorted.length + 1);
    numerator += coeff * (sorted[sorted.length - 1 - i] - sorted[i]);
  }

  const denominator = Math.sqrt(
    sorted.reduce((a, b) => a + (b - mean) ** 2, 0)
  );

  const W = (numerator / denominator) ** 2;

  // Approximate p-value using Royston's log-transform for Shapiro-Wilk
  // For W near 1 (normal), p should be high; for W near 0, p should be low
  const n = sorted.length;
  const mu = 0.0038915 * Math.log(n) ** 3 - 0.083751 * Math.log(n) ** 2 - 0.31082 * Math.log(n) - 1.5861;
  const sigma = Math.exp(0.0030302 * Math.log(n) ** 2 - 0.082676 * Math.log(n) - 0.4803);
  const zW = (Math.log(1 - W) - mu) / sigma;
  const pValue = 1 - normalCDF(zW);

  return {
    testStatistic: parseFloat(W.toFixed(4)),
    pValue: parseFloat(pValue.toFixed(4)),
    significant: pValue < 0.05,
    interpretation:
      pValue > 0.05
        ? 'The data appears to be normally distributed (p > 0.05)'
        : 'The data deviates from normal distribution (p < 0.05)',
  };
};

const performANOVA = (group1: number[], group2: number[]): TestResult => {
  // Simplified one-way ANOVA using sample groups
  const groups = [group1, group2, group1];
  const groupMeans = groups.map((g) => g.reduce((a, b) => a + b, 0) / g.length);
  const overallMean = groupMeans.reduce((a, b) => a + b, 0) / groupMeans.length;

  const betweenGroupVar =
    groups.reduce(
      (a, g, i) => a + g.length * (groupMeans[i] - overallMean) ** 2,
      0
    ) /
    (groups.length - 1);

  const withinGroupVar =
    groups.reduce((a, g, i) => {
      const variance = g.reduce((s, v) => s + (v - groupMeans[i]) ** 2, 0) /
        (g.length - 1);
      return a + (g.length - 1) * variance;
    }, 0) /
    (groups.reduce((a, g) => a + g.length, 0) - groups.length);

  const F = betweenGroupVar / (withinGroupVar || 1e-10);
  // Approximate F-distribution p-value using normal approximation
  // For moderate df values, use Wilson-Hilferty approximation
  const df1 = groups.length - 1;
  const df2 = groups.reduce((a, g) => a + g.length, 0) - groups.length;
  const z = Math.pow(F * df1 / df2, 1/3) * (1 - 2 / (9 * df2)) - (1 - 2 / (9 * df1));
  const denom = Math.sqrt(2 / (9 * df1) + Math.pow(F * df1 / df2, 2/3) * (2 / (9 * df2)));
  const pValue = 1 - normalCDF(z / (denom || 1));

  return {
    testStatistic: parseFloat(F.toFixed(4)),
    pValue: parseFloat(pValue.toFixed(4)),
    degreesOfFreedom: groups.length - 1,
    significant: pValue < 0.05,
    interpretation:
      pValue < 0.05
        ? 'Significant differences exist between groups (p < 0.05)'
        : 'No significant differences between groups (p >= 0.05)',
  };
};

const performZTest = (sample: number[]): TestResult => {
  // Z-test for sample mean
  const mean = sample.reduce((a, b) => a + b, 0) / sample.length;
  const variance = sample.reduce((a, b) => a + (b - mean) ** 2, 0) / sample.length;
  const stdev = Math.sqrt(variance);
  const se = stdev / Math.sqrt(sample.length);

  const populationMean = 240;
  const Z = (mean - populationMean) / se;
  // Two-tailed p-value from standard normal
  const pValue = 2 * (1 - normalCDF(Math.abs(Z)));

  return {
    testStatistic: parseFloat(Z.toFixed(4)),
    pValue: parseFloat(pValue.toFixed(4)),
    significant: pValue < 0.05,
    interpretation:
      pValue < 0.05
        ? `Sample mean significantly differs from ${populationMean} (p = ${pValue.toFixed(4)})`
        : `Sample mean does not significantly differ from ${populationMean}`,
  };
};

export default function StatisticalTestsPage() {
  const dashboardData = useDashboard();
  const sampleData = useMemo(() => generateSampleData(dashboardData), [dashboardData]);
  const [selectedTest, setSelectedTest] = useState<TestType>('t-test');
  const [group1Sample, setGroup1Sample] = useState(sampleData.group1);
  const [group2Sample, setGroup2Sample] = useState(sampleData.group2);
  const [normalitySample, setNormalitySample] = useState(sampleData.normal);

  const testOptions: { value: TestType; label: string }[] = [
    { value: 't-test', label: 'T-Test (Two Groups)' },
    { value: 'chi-square', label: 'Chi-Square Test' },
    { value: 'anova', label: 'ANOVA (Multiple Groups)' },
    { value: 'shapiro-wilk', label: 'Shapiro-Wilk (Normality)' },
    { value: 'z-test', label: 'Z-Test' },
  ];

  // Calculate results
  const results = useMemo(() => {
    switch (selectedTest) {
      case 't-test':
        return performTTest(group1Sample, group2Sample);
      case 'shapiro-wilk':
        return performShapiroWilk(normalitySample);
      case 'anova':
        return performANOVA(group1Sample, group2Sample);
      case 'z-test':
        return performZTest(group1Sample);
      case 'chi-square': {
        // Compute chi-square from contingency table
        const table = [
          { observed: 45, expected: 40 },
          { observed: 38, expected: 40 },
          { observed: 52, expected: 50 },
          { observed: 35, expected: 40 },
        ];
        const chiSq = table.reduce((sum, r) => sum + Math.pow(r.observed - r.expected, 2) / r.expected, 0);
        const chiDf = table.length - 1;
        // Wilson-Hilferty approximation for chi-square p-value
        const chiZ = Math.pow(chiSq / chiDf, 1/3) - (1 - 2 / (9 * chiDf));
        const chiDenom = Math.sqrt(2 / (9 * chiDf));
        const chiP = 1 - normalCDF(chiZ / chiDenom);
        return {
          testStatistic: parseFloat(chiSq.toFixed(4)),
          pValue: parseFloat(chiP.toFixed(4)),
          degreesOfFreedom: chiDf,
          significant: chiP < 0.05,
          interpretation: chiP < 0.05
            ? `Significant association found between variables (p = ${chiP.toFixed(4)})`
            : `No significant association between variables (p = ${chiP.toFixed(4)})`,
        };
      }
      default:
        return {
          testStatistic: 0,
          pValue: 0,
          significant: false,
          interpretation: '',
        };
    }
  }, [selectedTest, group1Sample, group2Sample, normalitySample]);

  // Distribution visualization
  const distributionData = (selectedTest === 'shapiro-wilk' ? normalitySample : group1Sample).map(
    (value: number, idx: number) => ({ idx, value })
  );

  // Q-Q plot data for normality test
  const qqPlotData = generateQQPlotData(normalitySample);

  // Contingency table for chi-square
  const contingencyTable = [
    { category: 'Category A', observed: 45, expected: 40 },
    { category: 'Category B', observed: 38, expected: 40 },
    { category: 'Category C', observed: 52, expected: 50 },
    { category: 'Category D', observed: 35, expected: 40 },
  ];

  // Show empty state if no data
  if (!dashboardData) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-3 mb-8">
            <Beaker className="w-8 h-8 text-blue-600" />
            <h1 className="text-3xl font-bold text-gray-900">Statistical Tests</h1>
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
          <Beaker className="w-8 h-8 text-blue-600" />
          <h1 className="text-3xl font-bold text-gray-900">Statistical Tests</h1>
        </div>

        {/* Test Selector */}
        <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Select Test
          </label>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
            {testOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => setSelectedTest(option.value)}
                className={`px-3 py-2 rounded text-sm font-medium transition-all ${
                  selectedTest === option.value
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {/* Main Results Panel */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          {/* Statistics */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Test Results</h2>

              <div className="space-y-4">
                {/* Test Statistic */}
                <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <p className="text-xs text-blue-700 font-medium">Test Statistic</p>
                  <p className="text-3xl font-bold text-blue-900 mt-1">
                    {results.testStatistic.toFixed(4)}
                  </p>
                </div>

                {/* P-Value */}
                <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                  <p className="text-xs text-purple-700 font-medium">P-Value</p>
                  <p className="text-3xl font-bold text-purple-900 mt-1">
                    {results.pValue.toFixed(4)}
                  </p>
                </div>

                {/* Degrees of Freedom */}
                {results.degreesOfFreedom !== undefined && (
                  <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <p className="text-xs text-gray-700 font-medium">Degrees of Freedom</p>
                    <p className="text-2xl font-bold text-gray-900 mt-1">
                      {results.degreesOfFreedom}
                    </p>
                  </div>
                )}

                {/* Effect Size */}
                {results.effectSize !== undefined && (
                  <div className="p-4 bg-orange-50 rounded-lg border border-orange-200">
                    <p className="text-xs text-orange-700 font-medium">Effect Size (Cohen&apos;s d)</p>
                    <p className="text-2xl font-bold text-orange-900 mt-1">
                      {results.effectSize.toFixed(4)}
                    </p>
                  </div>
                )}

                {/* Significance */}
                <div
                  className={`p-4 rounded-lg border ${
                    results.significant
                      ? 'bg-green-50 border-green-200'
                      : 'bg-red-50 border-red-200'
                  }`}
                >
                  <p
                    className={`text-xs font-medium ${
                      results.significant ? 'text-green-700' : 'text-red-700'
                    }`}
                  >
                    Significance (α = 0.05)
                  </p>
                  <p
                    className={`text-lg font-bold mt-1 ${
                      results.significant ? 'text-green-900' : 'text-red-900'
                    }`}
                  >
                    {results.significant ? 'SIGNIFICANT' : 'NOT SIGNIFICANT'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Interpretation Panel */}
          <div>
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Interpretation</h3>
              <p className="text-sm text-gray-700 leading-relaxed mb-4">
                {results.interpretation}
              </p>

              <div className="pt-4 border-t border-gray-200 space-y-3">
                <div>
                  <p className="text-xs text-gray-600 font-medium mb-1">α Level</p>
                  <p className="text-sm font-semibold text-gray-900">0.05</p>
                </div>

                <div>
                  <p className="text-xs text-gray-600 font-medium mb-1">Conclusion</p>
                  <p className="text-sm text-gray-700">
                    {results.pValue < 0.05
                      ? 'Reject the null hypothesis. Sufficient evidence of effect.'
                      : 'Fail to reject the null hypothesis. Insufficient evidence.'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Visualization */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {selectedTest === 'shapiro-wilk' && (
            <>
              {/* Q-Q Plot */}
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Q-Q Plot (Normality)</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="theoretical" type="number" name="Theoretical" />
                    <YAxis type="number" name="Actual" />
                    <Tooltip />
                    <Scatter data={qqPlotData} fill="#3b82f6" />
                  </ScatterChart>
                </ResponsiveContainer>
                <p className="text-xs text-gray-600 mt-2">
                  Points close to diagonal = normal distribution
                </p>
              </div>

              {/* Distribution */}
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Distribution</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={distributionData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="idx" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="value" fill="#3b82f6" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </>
          )}

          {selectedTest === 't-test' && (
            <>
              {/* Group Comparison */}
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Group Distributions</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={[
                    { group: 'Group 1', mean: group1Sample.reduce((a: number, b: number) => a + b, 0) / group1Sample.length },
                    { group: 'Group 2', mean: group2Sample.reduce((a: number, b: number) => a + b, 0) / group2Sample.length },
                  ]}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="group" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="mean" fill="#3b82f6" />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Sample Data */}
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Sample Data</h3>
                <div className="space-y-3">
                  <div>
                    <p className="text-xs text-gray-600 font-medium">Group 1</p>
                    <p className="text-sm text-gray-700">
                      {group1Sample.join(', ')}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600 font-medium">Group 2</p>
                    <p className="text-sm text-gray-700">
                      {group2Sample.join(', ')}
                    </p>
                  </div>
                </div>
              </div>
            </>
          )}

          {selectedTest === 'chi-square' && (
            <>
              {/* Contingency Table */}
              <div className="bg-white rounded-lg shadow-sm p-6 lg:col-span-2">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Contingency Table</h3>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left px-4 py-2 font-semibold text-gray-700">
                          Category
                        </th>
                        <th className="text-right px-4 py-2 font-semibold text-gray-700">
                          Observed
                        </th>
                        <th className="text-right px-4 py-2 font-semibold text-gray-700">
                          Expected
                        </th>
                        <th className="text-right px-4 py-2 font-semibold text-gray-700">
                          χ² Contribution
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {contingencyTable.map((row, idx) => {
                        const contribution = ((row.observed - row.expected) ** 2) / row.expected;
                        return (
                          <tr key={idx} className="border-b border-gray-100">
                            <td className="px-4 py-2 text-gray-900 font-medium">
                              {row.category}
                            </td>
                            <td className="px-4 py-2 text-right text-gray-900 font-semibold">
                              {row.observed}
                            </td>
                            <td className="px-4 py-2 text-right text-gray-700">
                              {row.expected}
                            </td>
                            <td className="px-4 py-2 text-right text-gray-900 font-semibold">
                              {contribution.toFixed(3)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Interpretation Guide */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">How to Interpret</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-sm font-semibold text-blue-900 mb-2">P-Value &lt; 0.05</p>
              <p className="text-xs text-blue-800">
                Result is statistically significant. Reject null hypothesis.
              </p>
            </div>
            <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
              <p className="text-sm font-semibold text-amber-900 mb-2">P-Value = 0.05</p>
              <p className="text-xs text-amber-800">
                Borderline result. Use domain knowledge for decision.
              </p>
            </div>
            <div className="p-4 bg-red-50 rounded-lg border border-red-200">
              <p className="text-sm font-semibold text-red-900 mb-2">P-Value &gt; 0.05</p>
              <p className="text-xs text-red-800">
                Result is not statistically significant. Fail to reject null hypothesis.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
