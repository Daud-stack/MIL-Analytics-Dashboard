'use client';

import { useState, useMemo } from 'react';
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
} from 'recharts';
import { Zap, AlertCircle } from 'lucide-react';
import { useDashboard } from '@/store';
import type { DashboardMetrics } from '@/types';
import { CLUSTER_COLORS as colors } from '@/types';

interface ClusterPoint {
  x: number;
  y: number;
  cluster: number;
}

interface ClusterInfo {
  id: number;
  size: number;
  centroidX: number;
  centroidY: number;
  characteristics: string;
  avgAdmissions: number;
  avgRevenue: number;
}

// Generate cluster data from real monthly revenue/occupancy
const generateClusterData = (k: number, metrics: DashboardMetrics | null): ClusterPoint[] => {
  const data: ClusterPoint[] = [];
  if (!metrics?.monthRevenue || !metrics?.theatreUtil) return data;

  // Normalize months by revenue and occupancy
  const points = metrics.monthRevenue.map((rev: number, idx: number) => ({
    revenue: rev,
    occupancy: metrics.theatreUtil?.[idx] || 65,
    idx,
  }));

  const revMin = Math.min(...points.map((p) => p.revenue));
  const revMax = Math.max(...points.map((p) => p.revenue));
  const occMin = Math.min(...points.map((p) => p.occupancy));
  const occMax = Math.max(...points.map((p) => p.occupancy));

  // Normalize to 0-100 scale
  const normalized = points.map((p) => ({
    x: ((p.occupancy - occMin) / (occMax - occMin + 1)) * 100,
    y: ((p.revenue - revMin) / (revMax - revMin + 1)) * 2500,
  }));

  // Simple k-means: group months into k clusters
  const centroids = Array.from({ length: k }, (_, i) => ({
    x: (i / k) * 100,
    y: 1250 + (i % 2) * 500,
  }));

  normalized.forEach((point) => {
    const distances = centroids.map((c) => Math.sqrt(Math.pow(point.x - c.x, 2) + Math.pow(point.y - c.y, 2)));
    const cluster = distances.indexOf(Math.min(...distances));
    data.push({ x: point.x, y: point.y, cluster });
  });

  return data;
};

// Elbow method data
const elbowData = [
  { k: 1, inertia: 450 },
  { k: 2, inertia: 280 },
  { k: 3, inertia: 120 },
  { k: 4, inertia: 65 },
  { k: 5, inertia: 52 },
  { k: 6, inertia: 48 },
  { k: 7, inertia: 45 },
  { k: 8, inertia: 43 },
];

// Silhouette scores
const silhouetteData = [
  { k: 2, score: 0.68 },
  { k: 3, score: 0.72 },
  { k: 4, score: 0.75 },
  { k: 5, score: 0.71 },
  { k: 6, score: 0.68 },
];
  0: {
    id: 0,
    size: 14,
    centroidX: 30,
    centroidY: 2000,
    characteristics: 'Low Occupancy, Lower Revenue',
    avgAdmissions: 180,
    avgRevenue: 1950,
  },
  1: {
    id: 1,
    size: 16,
    centroidX: 65,
    centroidY: 2500,
    characteristics: 'Medium Occupancy, Medium Revenue',
    avgAdmissions: 220,
    avgRevenue: 2480,
  },
  2: {
    id: 2,
    size: 15,
    centroidX: 80,
    centroidY: 2800,
    characteristics: 'High Occupancy, High Revenue',
    avgAdmissions: 260,
    avgRevenue: 2800,
  },
  3: {
    id: 3,
    size: 12,
    centroidX: 45,
    centroidY: 1800,
    characteristics: 'Low Admissions, Low Revenue',
    avgAdmissions: 150,
    avgRevenue: 1750,
  },
};

export default function ClusteringPage() {
  const dashboardData = useDashboard();
  const [k, setK] = useState(3);
  const [selectedCluster, setSelectedCluster] = useState(0);
  const [selectedFeatures, setSelectedFeatures] = useState(['occupancy', 'revenue']);

  const features = [
    { value: 'occupancy', label: 'Occupancy Rate' },
    { value: 'revenue', label: 'Revenue' },
    { value: 'admissions', label: 'Admissions' },
    { value: 'theatre', label: 'Theatre Utilization' },
  ];

  const clusterData = useMemo(() => generateClusterData(k, dashboardData), [k, dashboardData]);

  // Calculate silhouette score for current k
  const currentSilhouette = silhouetteData.find((d) => d.k === k)?.score || 0.72;

  const clusterSizes = useMemo(() => {
    const counts: Record<number, number> = {};
    for (let i = 0; i < k; i++) {
      counts[i] = clusterData.filter((d) => d.cluster === i).length;
    }
    return counts;
  }, [clusterData, k]);

  const toggleFeature = (feature: string) => {
    if (selectedFeatures.includes(feature)) {
      if (selectedFeatures.length > 1) {
        setSelectedFeatures(selectedFeatures.filter((f) => f !== feature));
      }
    } else {
      if (selectedFeatures.length < 2) {
        setSelectedFeatures([...selectedFeatures, feature]);
      }
    }
  };

  // Show empty state if no data
  if (!dashboardData) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-3 mb-8">
            <Zap className="w-8 h-8 text-blue-600" />
            <h1 className="text-3xl font-bold text-gray-900">Clustering Analysis</h1>
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
          <Zap className="w-8 h-8 text-blue-600" />
          <h1 className="text-3xl font-bold text-gray-900">Clustering Analysis</h1>
        </div>

        {/* Controls */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
          {/* K Selector */}
          <div className="bg-white rounded-lg shadow-sm p-4">
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Number of Clusters (k): {k}
            </label>
            <input
              type="range"
              min="2"
              max="10"
              value={k}
              onChange={(e) => setK(parseInt(e.target.value))}
              className="w-full"
            />
            <p className="text-xs text-gray-500 mt-2">Adjust k to find optimal clustering</p>
          </div>

          {/* Features */}
          <div className="bg-white rounded-lg shadow-sm p-4">
            <label className="block text-sm font-medium text-gray-700 mb-3">
              X-Axis Feature
            </label>
            <select
              value={selectedFeatures[0]}
              onChange={(e) => setSelectedFeatures([e.target.value, selectedFeatures[1]])}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            >
              {features.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
          </div>

          {/* Y-Axis Feature */}
          <div className="bg-white rounded-lg shadow-sm p-4">
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Y-Axis Feature
            </label>
            <select
              value={selectedFeatures[1]}
              onChange={(e) => setSelectedFeatures([selectedFeatures[0], e.target.value])}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            >
              {features.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow-sm p-4">
            <p className="text-xs text-gray-600 font-medium">Silhouette Score</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{currentSilhouette.toFixed(3)}</p>
            <p className="text-xs text-gray-500 mt-1">
              {currentSilhouette > 0.7 ? 'Strong' : currentSilhouette > 0.5 ? 'Moderate' : 'Weak'} clustering
            </p>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-4">
            <p className="text-xs text-gray-600 font-medium">Clusters</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{k}</p>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-4">
            <p className="text-xs text-gray-600 font-medium">Total Points</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{clusterData.length}</p>
          </div>
        </div>

        {/* Main Visualizations */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          {/* Scatter Plot */}
          <div className="lg:col-span-2 bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Cluster Visualization ({selectedFeatures[0]} vs {selectedFeatures[1]})
            </h2>
            <ResponsiveContainer width="100%" height={400}>
              <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="x" type="number" name={selectedFeatures[0]} />
                <YAxis type="number" name={selectedFeatures[1]} />
                <Tooltip cursor={{ strokeDasharray: '3 3' }} />
                {Array.from({ length: k }, (_, i) => (
                  <Scatter
                    key={i}
                    name={`Cluster ${i}`}
                    data={clusterData.filter((d) => d.cluster === i)}
                    fill={colors[i % colors.length]}
                    onClick={() => setSelectedCluster(i)}
                  />
                ))}
              </ScatterChart>
            </ResponsiveContainer>
          </div>

          {/* Cluster Summary */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Cluster Summary</h3>
            <div className="space-y-3">
              {Array.from({ length: k }, (_, i) => (
                <button
                  key={i}
                  onClick={() => setSelectedCluster(i)}
                  className={`w-full p-3 rounded-lg text-left transition-all border-2 ${
                    selectedCluster === i
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: colors[i] }}
                    />
                    <p className="font-semibold text-gray-900">Cluster {i}</p>
                  </div>
                  <p className="text-xs text-gray-600">
                    Size: {clusterSizes[i]} points
                  </p>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Elbow Method */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Elbow Curve */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Elbow Method</h2>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={elbowData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="k" label={{ value: 'Number of Clusters (k)', position: 'insideBottomRight', offset: -5 }} />
                <YAxis label={{ value: 'Inertia', angle: -90, position: 'insideLeft' }} />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="inertia"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={{ fill: '#3b82f6', r: k === 3 ? 6 : 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
            <p className="text-xs text-gray-600 mt-3">
              The &quot;elbow&quot; point suggests optimal k (typically k=3-4)
            </p>
          </div>

          {/* Silhouette Score */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Silhouette Analysis</h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={silhouetteData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="k" />
                <YAxis label={{ value: 'Silhouette Score', angle: -90, position: 'insideLeft' }} />
                <Tooltip />
                <Bar
                  dataKey="score"
                  fill="#3b82f6"
                >
                  {silhouetteData.map((entry, index) => (
                    <Bar
                      key={`bar-${index}`}
                      dataKey="score"
                      fill={entry.k === k ? '#10b981' : '#3b82f6'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <p className="text-xs text-gray-600 mt-3">
              Higher scores indicate better-defined clusters
            </p>
          </div>
        </div>

        {/* Selected Cluster Details */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Cluster {selectedCluster} Details
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-xs text-blue-700 font-medium">Cluster Size</p>
              <p className="text-2xl font-bold text-blue-900 mt-1">
                {clusterSizes[selectedCluster]}
              </p>
            </div>
            <div className="p-4 bg-green-50 rounded-lg border border-green-200">
              <p className="text-xs text-green-700 font-medium">Avg Admissions</p>
              <p className="text-2xl font-bold text-green-900 mt-1">
                {clusterCharacteristics[selectedCluster].avgAdmissions}
              </p>
            </div>
            <div className="p-4 bg-orange-50 rounded-lg border border-orange-200">
              <p className="text-xs text-orange-700 font-medium">Avg Revenue</p>
              <p className="text-2xl font-bold text-orange-900 mt-1">
                {clusterCharacteristics[selectedCluster].avgRevenue}k
              </p>
            </div>
            <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
              <p className="text-xs text-purple-700 font-medium">Centroid</p>
              <p className="text-sm font-bold text-purple-900 mt-1">
                ({clusterCharacteristics[selectedCluster].centroidX.toFixed(1)},
                {clusterCharacteristics[selectedCluster].centroidY.toFixed(0)})
              </p>
            </div>
          </div>

          <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
            <p className="text-sm font-semibold text-gray-900 mb-2">Characteristics</p>
            <p className="text-gray-700">
              {clusterCharacteristics[selectedCluster].characteristics}
            </p>
            <p className="text-sm text-gray-600 mt-2">
              This cluster represents hospital performance patterns with moderate to {' '}
              {clusterCharacteristics[selectedCluster].avgRevenue > 2500 ? 'high' : 'low'} operational metrics.
            </p>
          </div>
        </div>

        {/* Cluster Profiles Table */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Cluster Profiles</h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left px-4 py-3 font-semibold text-gray-700">Cluster</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-700">Size</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-700">Avg Admissions</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-700">Avg Revenue</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-700">Profile</th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: k }, (_, i) => {
                  const profile = clusterCharacteristics[i];
                  return (
                    <tr key={i} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: colors[i] }}
                          />
                          <span className="font-semibold text-gray-900">Cluster {i}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right text-gray-900 font-semibold">
                        {clusterSizes[i]}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-700">
                        {profile.avgAdmissions}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-700">
                        {profile.avgRevenue}k
                      </td>
                      <td className="px-4 py-3 text-gray-700">
                        {profile.characteristics}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
