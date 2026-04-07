'use client';

import React, { useState, useMemo } from 'react';
import { AlertCircle, Download, Search, TrendingUp } from 'lucide-react';
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
  LineChart,
  Line,
} from 'recharts';
import { StatCard } from '@/components/charts/stat-card';
import { Button } from '@/components/ui/button';
import { formatCurrency, formatNumber, generateCSV, downloadCSV } from '@/lib/utils';
import { mean, median, sd } from '@/lib/stats';
import { useLocation } from '@/store';

const COLORS = ['#0d9488', '#475569', '#d97706', '#e11d48', '#7c3aed', '#0284c7', '#059669', '#dc2626'];

export default function DoctorsPage() {
  const location = useLocation();
  const [sortBy, setSortBy] = useState<'revenue' | 'episodes' | 'los'>('revenue');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDoctor, setSelectedDoctor] = useState<{
    name: string;
    specialty: string;
    episodes: number;
    revenue: number;
    avgLOS: number;
    patients: number;
  } | null>(null);

  // Get doctors data from store
  const doctorsData = location?.doctors || [];

  // Map avgLOS to los for internal use
  const doctorsWithLos = useMemo(
    () => doctorsData.map((doc) => ({ ...doc, los: doc.avgLOS })),
    [doctorsData]
  );

  const filteredDoctors = useMemo(() => {
    return doctorsWithLos.filter((doc) =>
      doc.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      doc.specialty.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [searchTerm, doctorsWithLos]);

  const sortedDoctors = useMemo(() => {
    const sorted = [...filteredDoctors];
    if (sortBy === 'revenue') {
      return sorted.sort((a, b) => b.revenue - a.revenue);
    } else if (sortBy === 'episodes') {
      return sorted.sort((a, b) => b.episodes - a.episodes);
    } else {
      return sorted.sort((a, b) => b.los - a.los);
    }
  }, [filteredDoctors, sortBy]);

  const specialtyDistribution = useMemo(() => {
    const specialty: Record<string, number> = {};
    doctorsWithLos.forEach((doc) => {
      specialty[doc.specialty] = (specialty[doc.specialty] || 0) + 1;
    });
    return Object.entries(specialty).map(([name, count]) => ({ name, value: count }));
  }, [doctorsWithLos]);

  const episodesBySpecialty = useMemo(() => {
    const specialty: Record<string, number> = {};
    doctorsWithLos.forEach((doc) => {
      specialty[doc.specialty] = (specialty[doc.specialty] || 0) + doc.episodes;
    });
    return Object.entries(specialty)
      .map(([specialty, episodes]) => ({ specialty, episodes }))
      .sort((a, b) => b.episodes - a.episodes);
  }, [doctorsWithLos]);

  const _revenueData = useMemo(() => {
    return doctorsWithLos
      .slice()
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 12)
      .map((doc) => ({
        month: `Dr ${doc.name.split(' ')[2]}`,
        value: doc.revenue / 100000,
      }));
  }, [doctorsWithLos]);

  const kpis = useMemo(() => {
    if (doctorsWithLos.length === 0) return { totalDoctors: 0, avgEpisodes: 0, avgRevenue: 0, topSpecialty: 'N/A' };
    const totalDoctors = doctorsWithLos.length;
    const avgEpisodes = mean(doctorsWithLos.map((d) => d.episodes));
    const avgRevenue = mean(doctorsWithLos.map((d) => d.revenue));
    const specialties = new Set(doctorsWithLos.map((d) => d.specialty));
    const topSpecialty = [...specialties].reduce((prev, spec) => {
      const count = doctorsWithLos.filter((d) => d.specialty === spec).length;
      return count > (prev.count || 0) ? { name: spec, count } : prev;
    }, {} as { name?: string; count?: number });

    return {
      totalDoctors,
      avgEpisodes: Math.round(avgEpisodes),
      avgRevenue: Math.round(avgRevenue),
      topSpecialty: topSpecialty.name || 'N/A',
    };
  }, [doctorsWithLos]);

  // Show empty state if no data
  if (!location || !location.doctors || location.doctors.length === 0) {
    return (
      <div className="space-y-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Doctor Analytics</h1>
            <p className="mt-1 text-sm text-gray-500">Performance metrics, leaderboards, and specialty analysis</p>
          </div>
        </div>
        <div className="flex flex-col items-center justify-center rounded-xl border border-gray-200 bg-white p-12 text-center shadow-sm">
          <AlertCircle className="h-12 w-12 text-gray-300 mb-4" />
          <h2 className="text-lg font-semibold text-gray-900">No Data Loaded</h2>
          <p className="mt-2 text-sm text-gray-500 max-w-md">Upload Location/Episode CSV data to see doctor analytics.</p>
          <a href="/upload" className="mt-4 text-sm font-medium text-teal-600 hover:text-teal-700">Go to Upload →</a>
        </div>
      </div>
    );
  }

  const topByRevenueData = sortedDoctors
    .slice(0, 10)
    .map((doc) => ({ name: doc.name.split(' ')[2], revenue: doc.revenue }));

  const handleExport = () => {
    const csv = generateCSV(
      sortedDoctors.map((doc) => ({
        name: doc.name,
        specialty: doc.specialty,
        episodes: doc.episodes,
        revenue: formatCurrency(doc.revenue),
        avg_los: doc.los.toFixed(2),
        patients: doc.patients,
      }))
    );
    downloadCSV(csv, `doctors-analytics-${new Date().toISOString().split('T')[0]}.csv`);
  };

  type DoctorType = typeof doctorsWithLos[0];

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Doctor Analytics</h1>
          <p className="mt-1 text-sm text-gray-500">Performance metrics, leaderboards, and specialty analysis</p>
        </div>
        <Button onClick={handleExport} variant="outline" size="sm" className="gap-2">
          <Download className="h-4 w-4" />
          Export
        </Button>
      </div>

      {/* KPI Cards - 4 columns */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Doctors"
          value={formatNumber(kpis.totalDoctors)}
          color="teal"
          trend="neutral"
        />
        <StatCard
          title="Avg Episodes/Doctor"
          value={formatNumber(kpis.avgEpisodes)}
          color="blue"
          trend="neutral"
        />
        <StatCard
          title="Avg Revenue/Doctor"
          value={formatCurrency(kpis.avgRevenue / 1000) + 'K'}
          color="green"
          trend="neutral"
        />
        <StatCard
          title="Top Specialty"
          value={kpis.topSpecialty}
          color="purple"
          trend="neutral"
        />
      </div>

      {/* Charts Row 1 */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Top 10 Doctors by Revenue */}
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 px-5 py-4">
            <h2 className="text-sm font-semibold text-gray-900">Top 10 Doctors by Revenue</h2>
            <p className="mt-1 text-xs text-gray-500">Revenue contribution ranking</p>
          </div>
          <div className="px-5 pb-5">
            <ResponsiveContainer width="100%" height={350}>
              <BarChart
                data={topByRevenueData}
                layout="vertical"
                margin={{ top: 5, right: 30, left: 100 }}
              >
                <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
                <XAxis
                  type="number"
                  tick={{ fill: '#94a3b8', fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  dataKey="month"
                  type="category"
                  tick={{ fill: '#94a3b8', fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                  width={95}
                />
                <Tooltip
                  formatter={(value) => formatCurrency((value as number) * 100000)}
                  contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0' }}
                />
                <Bar dataKey="value" fill="#0284c7" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Specialty Distribution */}
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 px-5 py-4">
            <h2 className="text-sm font-semibold text-gray-900">Specialty Distribution</h2>
            <p className="mt-1 text-xs text-gray-500">Number of doctors per specialty</p>
          </div>
          <div className="px-5 pb-5">
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={specialtyDistribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  labelLine={false}
                  label={({ name, value }) => `${name}: ${value}`}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {specialtyDistribution.map((_, index) => (
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
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 px-5 py-4">
          <h2 className="text-sm font-semibold text-gray-900">Episodes by Specialty</h2>
          <p className="mt-1 text-xs text-gray-500">Total episodes volume per specialty</p>
        </div>
        <div className="px-5 pb-5">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={episodesBySpecialty}>
              <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
              <XAxis
                dataKey="specialty"
                tick={{ fill: '#94a3b8', fontSize: 12 }}
                axisLine={false}
                tickLine={false}
                angle={-45}
                textAnchor="end"
                height={60}
              />
              <YAxis
                tick={{ fill: '#94a3b8', fontSize: 12 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                formatter={(value) => formatNumber(value as number)}
                contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0' }}
              />
              <Bar dataKey="episodes" fill="#059669" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Doctor Leaderboard */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="border-b border-gray-200 px-5 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Doctor Leaderboard</h2>
            <p className="mt-1 text-xs text-gray-500">Top performers ranked by selected metric</p>
          </div>
          <div className="flex gap-2">
            {(['revenue', 'episodes', 'los'] as const).map((metric) => (
              <button
                key={metric}
                onClick={() => setSortBy(metric)}
                className={`px-3 py-1 rounded-lg text-sm font-medium transition-all ${
                  sortBy === metric
                    ? 'bg-teal-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {metric === 'revenue' && 'Revenue'}
                {metric === 'episodes' && 'Episodes'}
                {metric === 'los' && 'LOS'}
              </button>
            ))}
          </div>
        </div>

        {/* Search Input */}
        <div className="border-b border-gray-200 px-5 py-3">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by doctor name or specialty..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-200 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-100"
            />
          </div>
        </div>

        {/* Leaderboard Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-200 bg-gray-50">
              <tr>
                <th className="px-5 py-3 text-left font-semibold text-gray-900">Rank</th>
                <th className="px-5 py-3 text-left font-semibold text-gray-900">Doctor</th>
                <th className="px-5 py-3 text-left font-semibold text-gray-900">Specialty</th>
                <th className="px-5 py-3 text-right font-semibold text-gray-900">Revenue</th>
                <th className="px-5 py-3 text-right font-semibold text-gray-900">Episodes</th>
                <th className="px-5 py-3 text-right font-semibold text-gray-900">Avg LOS</th>
                <th className="px-5 py-3 text-right font-semibold text-gray-900">Patients</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {sortedDoctors.map((doctor, idx) => (
                <tr
                  key={idx}
                  onClick={() =>
                    setSelectedDoctor({
                      name: doctor.name,
                      specialty: doctor.specialty,
                      episodes: doctor.episodes,
                      revenue: doctor.revenue,
                      avgLOS: doctor.avgLOS,
                      patients: doctor.patients,
                    })
                  }
                  className="hover:bg-gray-50 cursor-pointer transition"
                >
                  <td className="px-5 py-3 font-semibold text-gray-900">{idx + 1}</td>
                  <td className="px-5 py-3 font-medium text-gray-900">{doctor.name}</td>
                  <td className="px-5 py-3 text-gray-600">{doctor.specialty}</td>
                  <td className="px-5 py-3 text-right text-gray-900 font-medium">{formatCurrency(doctor.revenue)}</td>
                  <td className="px-5 py-3 text-right text-gray-600">{doctor.episodes}</td>
                  <td className="px-5 py-3 text-right text-gray-600">{doctor.los.toFixed(2)}</td>
                  <td className="px-5 py-3 text-right text-gray-600">{doctor.patients}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Selected Doctor Detail Panel */}
      {selectedDoctor && (
        <div className="rounded-xl border border-teal-200 bg-teal-50 shadow-sm p-5">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">{selectedDoctor.name}</h3>
              <p className="text-sm text-gray-600 mt-1">{selectedDoctor.specialty}</p>
            </div>
            <button
              onClick={() => setSelectedDoctor(null)}
              className="text-gray-400 hover:text-gray-600"
            >
              ×
            </button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div>
              <p className="text-xs font-medium text-gray-600">Total Episodes</p>
              <p className="text-lg font-semibold text-gray-900 mt-1">{selectedDoctor.episodes}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-600">Total Revenue</p>
              <p className="text-lg font-semibold text-gray-900 mt-1">{formatCurrency(selectedDoctor.revenue)}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-600">Avg LOS (days)</p>
              <p className="text-lg font-semibold text-gray-900 mt-1">{selectedDoctor.avgLOS.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-600">Total Patients</p>
              <p className="text-lg font-semibold text-gray-900 mt-1">{selectedDoctor.patients}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-600">Revenue/Episode</p>
              <p className="text-lg font-semibold text-gray-900 mt-1">
                {formatCurrency(selectedDoctor.revenue / selectedDoctor.episodes)}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
