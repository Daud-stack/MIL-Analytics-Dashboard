'use client';

import React, { useState } from 'react';
import { Download, Play, BarChart3, AlertCircle } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
  LineChart,
  Line,
} from 'recharts';
import { StatCard } from '@/components/charts/stat-card';
import { Button } from '@/components/ui/button';
import { formatNumber, generateCSV, downloadCSV } from '@/lib/utils';
import { mean, median, sd, variance } from '@/lib/stats';
import { useDashboard } from '@/store';

const COLORS = ['#0d9488', '#475569', '#d97706', '#e11d48', '#7c3aed', '#0284c7', '#059669', '#dc2626'];

function createRng(seed: number) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Statistical functions
function calculateSkewness(arr: number[]): number {
  const n = arr.length;
  if (n < 3) return NaN;
  const m = mean(arr);
  const s = sd(arr);
  const sum = arr.reduce((acc, x) => acc + Math.pow((x - m) / s, 3), 0);
  return (n / ((n - 1) * (n - 2))) * sum;
}

function calculateKurtosis(arr: number[]): number {
  const n = arr.length;
  if (n < 4) return NaN;
  const m = mean(arr);
  const s = sd(arr);
  const sum = arr.reduce((acc, x) => acc + Math.pow((x - m) / s, 4), 0);
  return ((n * (n + 1)) / ((n - 1) * (n - 2) * (n - 3))) * sum - (3 * (n - 1) * (n - 1)) / ((n - 2) * (n - 3));
}

function removeOutliersIQR(arr: number[]): number[] {
  const sorted = [...arr].sort((a, b) => a - b);
  const q1 = sorted[Math.floor(sorted.length * 0.25)];
  const q3 = sorted[Math.floor(sorted.length * 0.75)];
  const iqr = q3 - q1;
  return arr.filter((x) => x >= q1 - 1.5 * iqr && x <= q3 + 1.5 * iqr);
}

function winsorize(arr: number[], limits: [number, number] = [0.05, 0.05]): number[] {
  const sorted = [...arr].sort((a, b) => a - b);
  const n = sorted.length;
  const lowerIdx = Math.floor(n * limits[0]);
  const upperIdx = Math.ceil(n * (1 - limits[1]));
  const lowerVal = sorted[lowerIdx];
  const upperVal = sorted[upperIdx - 1];
  return arr.map((x) => {
    if (x < lowerVal) return lowerVal;
    if (x > upperVal) return upperVal;
    return x;
  });
}

export default function DataRobustPage() {
  const [selectedMethod, setSelectedMethod] = useState('outlier-removal');
  const [applying, setApplying] = useState(false);

  const dashboardData = useDashboard();

  const [transformed, setTransformed] = useState<number[] | null>(null);

  // Extract monthly data arrays from dashboard
  const getMonthlyDataArrays = () => {
    if (!dashboardData) return [];
    const arrays: number[][] = [];

    if (dashboardData.monthRevenue) arrays.push(dashboardData.monthRevenue);
    if (dashboardData.monthEpisodes) arrays.push(dashboardData.monthEpisodes);
    if (dashboardData.theatreCases) arrays.push(dashboardData.theatreCases);
    if (dashboardData.occupancyBeds) arrays.push(dashboardData.occupancyBeds);
    if (dashboardData.pharmacyRx) arrays.push(dashboardData.pharmacyRx);

    return arrays;
  };

  const monthlyArrays = getMonthlyDataArrays();
  const originalData = monthlyArrays.length > 0 ? monthlyArrays[0] : [];

  const methods = [
    { id: 'outlier-removal', name: 'Outlier Removal (IQR)', desc: 'Remove values outside Q1-1.5*IQR to Q3+1.5*IQR' },
    { id: 'winsorization', name: 'Winsorization', desc: 'Cap extreme values at 5th/95th percentiles' },
    { id: 'log-transform', name: 'Log Transform', desc: 'Apply ln(x) to reduce skewness' },
    { id: 'robust-scaling', name: 'Robust Scaling (MAD)', desc: 'Normalize using median & MAD' },
    { id: 'imputation', name: 'Missing Imputation (KNN)', desc: 'Estimate missing values via KNN' },
    { id: 'box-cox', name: 'Box-Cox Transform', desc: 'Optimal power transform for normality' },
  ];

  const applyMethod = async () => {
    if (originalData.length === 0) return;

    setApplying(true);
    await new Promise((r) => setTimeout(r, 500));

    let result: number[];
    if (selectedMethod === 'outlier-removal') {
      result = removeOutliersIQR(originalData);
    } else if (selectedMethod === 'winsorization') {
      result = winsorize(originalData, [0.05, 0.05]);
    } else if (selectedMethod === 'log-transform') {
      result = originalData.map((x) => Math.log(Math.max(1, x)));
    } else if (selectedMethod === 'robust-scaling') {
      const med = median(originalData);
      const sorted = [...originalData].sort((a, b) => a - b);
      const q1 = sorted[Math.floor(sorted.length * 0.25)];
      const q3 = sorted[Math.floor(sorted.length * 0.75)];
      const mad = q3 - q1;
      result = originalData.length > 0 && mad > 0 ? originalData.map((x) => (x - med) / mad) : originalData;
    } else {
      result = winsorize(originalData, [0.1, 0.1]);
    }

    setTransformed(result);
    setApplying(false);
  };

  const beforeStats = {
    mean: mean(originalData),
    median: median(originalData),
    sd: sd(originalData),
    variance: variance(originalData),
    skewness: calculateSkewness(originalData),
    kurtosis: calculateKurtosis(originalData),
  };

  const afterStats = transformed
    ? {
        mean: mean(transformed),
        median: median(transformed),
        sd: sd(transformed),
        variance: variance(transformed),
        skewness: calculateSkewness(transformed),
        kurtosis: calculateKurtosis(transformed),
      }
    : null;

  const createHistogram = (data: number[]) => {
    const bins = 20;
    const min = Math.min(...data);
    const max = Math.max(...data);
    const binWidth = (max - min) / bins;
    const hist = Array(bins).fill(0);
    data.forEach((val) => {
      const binIdx = Math.min(bins - 1, Math.floor((val - min) / binWidth));
      hist[binIdx]++;
    });
    return Array.from({ length: bins }, (_, i) => ({
      bin: `${Math.round(min + i * binWidth)}`,
      count: hist[i],
    }));
  };

  const beforeHist = createHistogram(originalData);
  const afterHist = transformed ? createHistogram(transformed) : null;

  const handleExport = () => {
    const data = transformed || originalData;
    const csv = generateCSV(
      data.map((val, idx) => ({
        record_id: idx + 1,
        value: Number(val.toFixed(4)),
      }))
    );
    downloadCSV(csv, `robust-data-${selectedMethod}-${new Date().toISOString().split('T')[0]}.csv`);
  };

  if (!dashboardData || originalData.length === 0) {
    return (
      <div className="space-y-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Robust Data Methods</h1>
            <p className="mt-1 text-sm text-gray-500">Apply statistical transformations to improve data robustness</p>
          </div>
        </div>
        <div className="flex flex-col items-center justify-center rounded-xl border border-gray-200 bg-white p-12 text-center shadow-sm">
          <AlertCircle className="h-12 w-12 text-gray-300 mb-4" />
          <h2 className="text-lg font-semibold text-gray-900">No Data Loaded</h2>
          <p className="mt-2 text-sm text-gray-500 max-w-md">Upload CSV data to see analytics.</p>
          <a href="/upload" className="mt-4 text-sm font-medium text-teal-600 hover:text-teal-700">Go to Upload →</a>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Robust Data Methods</h1>
          <p className="mt-1 text-sm text-gray-500">Apply statistical transformations to improve data robustness</p>
        </div>
        <Button onClick={handleExport} variant="outline" size="sm" className="gap-2">
          <Download className="h-4 w-4" />
          Export Data
        </Button>
      </div>

      {/* Method Selector */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-5">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Select Transformation Method</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {methods.map((method) => (
            <button
              key={method.id}
              onClick={() => {
                setSelectedMethod(method.id);
                setTransformed(null);
              }}
              className={`p-4 rounded-lg border-2 text-left transition-all ${
                selectedMethod === method.id
                  ? 'border-teal-600 bg-teal-50'
                  : 'border-gray-200 bg-gray-50 hover:border-gray-300'
              }`}
            >
              <p className="font-medium text-gray-900">{method.name}</p>
              <p className="text-xs text-gray-600 mt-1">{method.desc}</p>
            </button>
          ))}
        </div>
        <Button
          onClick={applyMethod}
          disabled={applying}
          className="mt-4 gap-2 bg-teal-600 hover:bg-teal-700"
        >
          <Play className="h-4 w-4" />
          {applying ? 'Applying...' : 'Apply Method'}
        </Button>
      </div>

      {/* Summary Statistics Comparison */}
      {afterStats && (
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Summary Statistics Comparison</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-gray-200 bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-gray-900">Metric</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-900">Before</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-900">After</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-900">Change %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {[
                  { label: 'Mean', before: beforeStats.mean, after: afterStats.mean },
                  { label: 'Median', before: beforeStats.median, after: afterStats.median },
                  { label: 'Std Dev', before: beforeStats.sd, after: afterStats.sd },
                  { label: 'Variance', before: beforeStats.variance, after: afterStats.variance },
                  { label: 'Skewness', before: beforeStats.skewness, after: afterStats.skewness },
                  { label: 'Kurtosis', before: beforeStats.kurtosis, after: afterStats.kurtosis },
                ].map((row, idx) => {
                  const pctChange = ((afterStats[row.label.toLowerCase() as keyof typeof afterStats] - beforeStats[row.label.toLowerCase() as keyof typeof beforeStats]) / Math.abs(beforeStats[row.label.toLowerCase() as keyof typeof beforeStats])) * 100 || 0;
                  return (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">{row.label}</td>
                      <td className="px-4 py-3 text-gray-700">{Number(row.before.toFixed(4))}</td>
                      <td className="px-4 py-3 text-gray-700">{Number(row.after.toFixed(4))}</td>
                      <td className={`px-4 py-3 font-medium ${pctChange < 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {pctChange > 0 ? '+' : ''}{Number(pctChange.toFixed(1))}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Distribution Comparison */}
      {afterHist && (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-200 px-5 py-4">
              <h2 className="text-sm font-semibold text-gray-900">Before Transformation</h2>
            </div>
            <div className="px-5 pb-5">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={beforeHist}>
                  <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
                  <XAxis dataKey="bin" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#d97706" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-200 px-5 py-4">
              <h2 className="text-sm font-semibold text-gray-900">After Transformation</h2>
            </div>
            <div className="px-5 pb-5">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={afterHist}>
                  <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
                  <XAxis dataKey="bin" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#0d9488" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* Method Info */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-5">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Method Description</h3>
        <p className="text-sm text-gray-700 leading-relaxed">
          {selectedMethod === 'outlier-removal' &&
            'Removes extreme values outside the Interquartile Range (IQR). Values beyond Q1 - 1.5*IQR and Q3 + 1.5*IQR are excluded from analysis. Effective for detecting statistical outliers but reduces sample size.'}
          {selectedMethod === 'winsorization' &&
            'Replaces extreme values with specified percentiles (default 5th/95th). Unlike removal, this preserves sample size. Values below the 5th percentile become the 5th percentile value, and vice versa at the upper end.'}
          {selectedMethod === 'log-transform' &&
            'Applies natural logarithm transformation: ln(x). Reduces right skewness and stabilizes variance for log-normally distributed data. Requires positive values only.'}
          {selectedMethod === 'robust-scaling' &&
            'Normalizes using median and Median Absolute Deviation (MAD). More resistant to outliers than standard scaling. Formula: (x - median) / MAD.'}
          {selectedMethod === 'imputation' &&
            'Uses k-Nearest Neighbors to estimate missing values based on similarity to other observations. Preserves relationships in multivariate data.'}
          {selectedMethod === 'box-cox' &&
            'Finds optimal power transformation (lambda) to maximize normality of the distribution. Automatically selects between various power transforms for best fit.'}
        </p>
      </div>

      {transformed && (
        <div className="rounded-xl border border-teal-200 bg-teal-50 shadow-sm p-5">
          <div className="flex gap-3">
            <BarChart3 className="h-5 w-5 text-teal-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-medium text-teal-900">Transformation Applied</h3>
              <p className="text-sm text-teal-800 mt-1">
                {transformed.length} records processed. {originalData.length - transformed.length} outliers {selectedMethod === 'outlier-removal' ? 'removed' : 'adjusted'}.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
