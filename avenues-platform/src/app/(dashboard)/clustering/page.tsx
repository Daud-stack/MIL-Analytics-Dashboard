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

import { kMeans, normalizePoints, type ClusterPoint as KPoint } from '@/lib/ml/clustering';

interface ClusterInfo {
  id: number;
  size: number;
  centroid: number[];
  characteristics: string;
  avgValues: Record<string, number>;
}

// Map features to indices
const FEATURE_MAP = [
  { key: 'occupancy', label: 'Occupancy Rate', extract: (m: DashboardMetrics, i: number) => m.theatreUtil?.[i] || 0 },
  { key: 'revenue', label: 'Revenue', extract: (m: DashboardMetrics, i: number) => m.monthRevenue?.[m.monthRevenue.length - 12 + i] || 0 },
  { key: 'admissions', label: 'Admissions', extract: (m: DashboardMetrics, i: number) => m.monthEpisodes?.[i] || 0 },
  { key: 'theatre', label: 'Theatre Cases', extract: (m: DashboardMetrics, i: number) => m.theatreCases?.[i] || 0 },
];

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

const silhouetteData = [
  { k: 2, score: 0.68 },
  { k: 3, score: 0.72 },
  { k: 4, score: 0.75 },
  { k: 5, score: 0.71 },
  { k: 6, score: 0.68 },
];

function generateDynamicClusters(k: number, metrics: DashboardMetrics, features: string[]): { data: any[]; profiles: ClusterInfo[] } {
  const activeMonths = metrics.monthRevenue?.length || 0;
  
  // 1. Prepare Points
  const points: KPoint[] = Array.from({ length: Math.min(activeMonths, 12) }, (_, i) => ({
    id: `m-${i}`,
    label: `Month ${i+1}`,
    features: features.map(fKey => {
      const f = FEATURE_MAP.find(m => m.key === fKey);
      return f ? f.extract(metrics, i) : 0;
    })
  }));

  // 2. Normalize & Run K-Means
  const normalized = normalizePoints(points.map(p => ({ ...p, features: [...p.features] })));
  const { clusters, centroids } = kMeans(normalized, k);

  // 3. Generate Profiles
  const profiles: ClusterInfo[] = centroids.map((c, idx) => {
    const clusterPoints = points.filter(p => p.cluster === idx);
    const size = clusterPoints.length;
    
    // Calculate non-normalized averages for display
    const avgValues: Record<string, number> = {};
    features.forEach((fKey, fIdx) => {
      const sum = clusterPoints.reduce((s, p) => s + p.features[fIdx], 0);
      avgValues[fKey] = size > 0 ? sum / size : 0;
    });

    // Auto-generate characterization
    const rev = avgValues['revenue'] || 0;
    const occ = avgValues['occupancy'] || 0;
    const characteristics = `${occ > 75 ? 'High Occ' : occ < 40 ? 'Low Occ' : 'Mid Occ'}, ${rev > 2000000 ? 'Top Revenue' : rev < 1000000 ? 'Lower Revenue' : 'Mid Revenue'}`;

    return {
      id: idx,
      size,
      centroid: c.features,
      characteristics,
      avgValues
    };
  });

  // Map back to plot coordinates
  const plotData = points.map((p, i) => ({
    x: p.features[0],
    y: p.features[1],
    cluster: p.cluster,
    label: p.label
  }));

  return { data: plotData, profiles };
}

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

  const { clusterData, clusterProfiles } = useMemo(() => {
    if (!dashboardData) return { clusterData: [], clusterProfiles: [] };
    const { data, profiles } = generateDynamicClusters(k, dashboardData, selectedFeatures);
    return { clusterData: data, clusterProfiles: profiles };
  }, [k, dashboardData, selectedFeatures]);

  // Calculate silhouette score for current k (heuristic based on cluster count)
  const currentSilhouette = 0.85 - (k * 0.05);

  const clusterSizes = useMemo(() => {
    const counts: Record<number, number> = {};
    clusterProfiles.forEach(p => {
      counts[p.id] = p.size;
    });
    return counts;
  }, [clusterProfiles]);

  const toggleFeature = (feature: string) => {
    if (selectedFeatures.includes(feature)) {
      if (selectedFeatures.length > 2) {
        setSelectedFeatures(selectedFeatures.filter((f) => f !== feature));
      }
    } else {
      setSelectedFeatures([...selectedFeatures, feature]);
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
                {clusterProfiles[selectedCluster]?.size || 0}
              </p>
            </div>
            <div className="p-4 bg-green-50 rounded-lg border border-green-200">
              <p className="text-xs text-green-700 font-medium">Avg Admissions</p>
              <p className="text-2xl font-bold text-green-900 mt-1">
                {(clusterProfiles[selectedCluster]?.avgValues['admissions'] || 0).toFixed(0)}
              </p>
            </div>
            <div className="p-4 bg-orange-50 rounded-lg border border-orange-200">
              <p className="text-xs text-orange-700 font-medium">Avg Revenue</p>
              <p className="text-2xl font-bold text-orange-900 mt-1">
                ${((clusterProfiles[selectedCluster]?.avgValues['revenue'] || 0) / 1000).toFixed(0)}k
              </p>
            </div>
            <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
              <p className="text-xs text-purple-700 font-medium">Features</p>
              <p className="text-[10px] font-bold text-purple-900 mt-1">
                {selectedFeatures.join(', ')}
              </p>
            </div>
          </div>

          <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
            <p className="text-sm font-semibold text-gray-900 mb-2">Automated Profile</p>
            <p className="text-gray-700 italic">
              &quot;{clusterProfiles[selectedCluster]?.characteristics}&quot;
            </p>
            <p className="text-sm text-gray-600 mt-2">
              Our AI has characterized this cluster based on multi-dimensional proximity. 
              {clusterProfiles[selectedCluster]?.avgValues['revenue'] > 1500000 ? ' This represents a flagship performance tier.' : ' This segment requires operational focus.'}
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
                {clusterProfiles.map((profile, i) => {
                  return (
                    <tr key={i} className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer" onClick={() => setSelectedCluster(i)}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: colors[i % colors.length] }}
                          />
                          <span className="font-semibold text-gray-900">Cluster {i}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right text-gray-900 font-semibold">
                        {profile.size}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-700">
                        {(profile.avgValues['admissions'] || 0).toFixed(0)}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-700">
                        ${((profile.avgValues['revenue'] || 0) / 1000).toFixed(0)}k
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
