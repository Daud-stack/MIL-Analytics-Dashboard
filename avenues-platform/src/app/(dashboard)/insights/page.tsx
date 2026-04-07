'use client';

import React, { useState, useMemo } from 'react';
import {
  TrendingUp, TrendingDown, AlertCircle, CheckCircle, Info,
  BarChart3, PieChart, Activity, DollarSign, Users, Zap, Heart, Pill
} from 'lucide-react';
import { useDashboard } from '@/store';

interface Insight {
  id: number;
  type: 'good' | 'warning' | 'bad' | 'info';
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  metric: string;
  timestamp: string;
}

export default function InsightsPage() {
  const [selectedFilter, setSelectedFilter] = useState('All');
  const dashboard = useDashboard();

  const filters = ['All', 'Good', 'Warning', 'Bad', 'Info'];

  // Generate insights from real data
  const insights: Insight[] = useMemo(() => {
    if (!dashboard) return [];

    const generateInsights: Insight[] = [];
    let id = 1;

    // 1. Revenue trend analysis
    if (dashboard.monthRevenue && dashboard.monthRevenue.length > 0) {
      const current = dashboard.monthRevenue[dashboard.monthRevenue.length - 1];
      const previous = dashboard.monthRevenue[dashboard.monthRevenue.length - 2] || current;
      const change = ((current - previous) / previous * 100).toFixed(1);
      const changeNum = parseFloat(change);

      if (changeNum > 5) {
        generateInsights.push({
          id: id++,
          type: 'good',
          icon: TrendingUp,
          title: 'Revenue Growth Strong',
          description: `Monthly revenue is up ${change}% compared to previous month`,
          metric: `+${change}%`,
          timestamp: '2 hours ago'
        });
      } else if (changeNum < -5) {
        generateInsights.push({
          id: id++,
          type: 'bad',
          icon: TrendingDown,
          title: 'Revenue Declining',
          description: `Monthly revenue is down ${Math.abs(changeNum)}% compared to previous month`,
          metric: `${change}%`,
          timestamp: '2 hours ago'
        });
      }
    }

    // 2. Occupancy analysis
    if (dashboard.occupancyBeds && dashboard.occupancyBeds.length > 0) {
      const currentOcc = dashboard.occupancyBeds[dashboard.occupancyBeds.length - 1];
      const target = 75;
      const diff = (currentOcc - target).toFixed(1);

      if (currentOcc < target) {
        generateInsights.push({
          id: id++,
          type: 'warning',
          icon: AlertCircle,
          title: 'Occupancy Below Target',
          description: `Bed occupancy at ${currentOcc.toFixed(1)}%, target is ${target}%`,
          metric: `${diff}%`,
          timestamp: '5 minutes ago'
        });
      } else {
        generateInsights.push({
          id: id++,
          type: 'good',
          icon: CheckCircle,
          title: 'Occupancy on Target',
          description: `Bed occupancy at ${currentOcc.toFixed(1)}%, exceeding ${target}% target`,
          metric: `+${diff}%`,
          timestamp: '5 minutes ago'
        });
      }
    }

    // 3. Theatre utilization
    if (dashboard.theatreUtil && dashboard.theatreUtil.length > 0) {
      const theatreUtil = dashboard.theatreUtil[dashboard.theatreUtil.length - 1];
      if (theatreUtil > 80) {
        generateInsights.push({
          id: id++,
          type: 'info',
          icon: BarChart3,
          title: 'Theatre Utilization Peak',
          description: `Operating theatres at ${theatreUtil.toFixed(1)}% utilization`,
          metric: `${theatreUtil.toFixed(0)}%`,
          timestamp: '45 minutes ago'
        });
      }
    }

    // 4. Admissions trend
    if (dashboard.monthEpisodes && dashboard.monthEpisodes.length > 0) {
      const currentAdm = dashboard.monthEpisodes[dashboard.monthEpisodes.length - 1];
      const previousAdm = dashboard.monthEpisodes[dashboard.monthEpisodes.length - 2] || currentAdm;
      const admChange = ((currentAdm - previousAdm) / previousAdm * 100).toFixed(1);

      if (parseFloat(admChange) > 5) {
        generateInsights.push({
          id: id++,
          type: 'good',
          icon: Activity,
          title: 'Admissions at Peak',
          description: `Total admissions up ${admChange}% this month`,
          metric: `+${admChange}%`,
          timestamp: '3 hours ago'
        });
      }
    }

    // 5. Pharmacy revenue contribution
    if (dashboard.pharmacyRev && dashboard.monthRevenue) {
      const pharmacyTotal = dashboard.pharmacyRev.reduce((a, b) => a + b, 0);
      const revenueTotal = dashboard.monthRevenue.reduce((a, b) => a + b, 0);
      const pharmacyPct = (pharmacyTotal / revenueTotal * 100).toFixed(1);

      if (parseFloat(pharmacyPct) > 15) {
        generateInsights.push({
          id: id++,
          type: 'good',
          icon: Pill,
          title: 'Pharmacy Revenue Strong',
          description: `Pharmacy revenue contributes ${pharmacyPct}% of total revenue`,
          metric: `${pharmacyPct}%`,
          timestamp: '4 hours ago'
        });
      }
    }

    // 6. Episodes finalized
    if (dashboard.epsFinalised && dashboard.epsFinalised.length > 0) {
      const finalised = dashboard.epsFinalised[dashboard.epsFinalised.length - 1];
      if (finalised > 0) {
        generateInsights.push({
          id: id++,
          type: 'info',
          icon: Users,
          title: 'Episodes Finalized',
          description: `${finalised} episodes finalized this period`,
          metric: `${finalised}`,
          timestamp: '20 minutes ago'
        });
      }
    }

    // If no insights generated, add info message
    if (generateInsights.length === 0) {
      generateInsights.push({
        id: id,
        type: 'info',
        icon: Info,
        title: 'Limited Data',
        description: 'More data points needed to generate insights',
        metric: '—',
        timestamp: 'just now'
      });
    }

    return generateInsights;
  }, [dashboard]);

  const filteredInsights = selectedFilter === 'All'
    ? insights
    : insights.filter(insight => insight.type === selectedFilter.toLowerCase());

  const getTypeStyles = (type: string) => {
    switch (type) {
      case 'good':
        return {
          bg: 'bg-green-50 border-green-200',
          badge: 'bg-green-100 text-green-800',
          icon: 'text-green-600'
        };
      case 'warning':
        return {
          bg: 'bg-amber-50 border-amber-200',
          badge: 'bg-amber-100 text-amber-800',
          icon: 'text-amber-600'
        };
      case 'bad':
        return {
          bg: 'bg-red-50 border-red-200',
          badge: 'bg-red-100 text-red-800',
          icon: 'text-red-600'
        };
      case 'info':
        return {
          bg: 'bg-teal-50 border-teal-200',
          badge: 'bg-teal-100 text-teal-800',
          icon: 'text-teal-600'
        };
      default:
        return {
          bg: 'bg-gray-50 border-gray-200',
          badge: 'bg-gray-100 text-gray-800',
          icon: 'text-gray-600'
        };
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'good':
        return 'Good';
      case 'warning':
        return 'Warning';
      case 'bad':
        return 'Bad';
      case 'info':
        return 'Info';
      default:
        return '';
    }
  };

  // Show empty state if no data
  if (!dashboard) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">AI Insights</h1>
          <p className="mt-2 text-slate-600">
            Automated intelligence and recommendations based on your healthcare data
          </p>
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
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">AI Insights</h1>
        <p className="mt-2 text-slate-600">
          Automated intelligence and recommendations based on your healthcare data
        </p>
      </div>

      {/* Filter Buttons */}
      <div className="flex gap-2 flex-wrap">
        {filters.map((filter) => (
          <button
            key={filter}
            onClick={() => setSelectedFilter(filter)}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              selectedFilter === filter
                ? 'bg-blue-600 text-white'
                : 'bg-white border text-slate-900 hover:bg-slate-50'
            }`}
          >
            {filter}
            {filter !== 'All' && (
              <span className="ml-2 text-sm">
                ({insights.filter(i => i.type === filter.toLowerCase()).length})
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Insights Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredInsights.map((insight) => {
          const styles = getTypeStyles(insight.type);
          const IconComponent = insight.icon;

          return (
            <div
              key={insight.id}
              className={`rounded-lg border p-6 shadow-sm transition hover:shadow-md cursor-pointer ${styles.bg}`}
            >
              <div className="flex items-start justify-between mb-4">
                <IconComponent className={`h-6 w-6 ${styles.icon}`} />
                <span className={`text-xs font-semibold px-2 py-1 rounded-full ${styles.badge}`}>
                  {getTypeLabel(insight.type)}
                </span>
              </div>

              <h3 className="font-semibold text-slate-900 mb-2">{insight.title}</h3>
              <p className="text-sm text-slate-600 mb-4">{insight.description}</p>

              <div className="flex items-end justify-between">
                <span className="text-2xl font-bold text-slate-900">{insight.metric}</span>
                <span className="text-xs text-slate-500">{insight.timestamp}</span>
              </div>
            </div>
          );
        })}
      </div>

      {filteredInsights.length === 0 && (
        <div className="rounded-lg border bg-white p-12 text-center shadow-sm">
          <Info className="h-12 w-12 text-slate-400 mx-auto mb-4" />
          <p className="text-slate-600">No insights found for the selected filter.</p>
        </div>
      )}

      {/* Summary Stats */}
      <div className="rounded-lg border bg-white p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-slate-900 mb-6">Insights Summary</h3>
        <div className="grid gap-6 md:grid-cols-4">
          <div className="space-y-2">
            <p className="text-sm font-medium text-slate-600">Total Insights</p>
            <p className="text-3xl font-bold text-slate-900">{insights.length}</p>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium text-green-600">Good</p>
            <p className="text-3xl font-bold text-green-600">{insights.filter(i => i.type === 'good').length}</p>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium text-amber-600">Warnings</p>
            <p className="text-3xl font-bold text-amber-600">{insights.filter(i => i.type === 'warning').length}</p>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium text-red-600">Critical</p>
            <p className="text-3xl font-bold text-red-600">{insights.filter(i => i.type === 'bad').length}</p>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="rounded-lg border bg-white p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-slate-900 mb-6">Recent Activity Timeline</h3>
        <div className="space-y-4">
          {insights.slice(0, 6).map((insight) => {
            const styles = getTypeStyles(insight.type);
            const IconComponent = insight.icon;

            return (
              <div key={insight.id} className="flex items-start gap-4 pb-4 border-b last:border-b-0">
                <div className={`flex-shrink-0 p-2 rounded-lg ${styles.badge}`}>
                  <IconComponent className={`h-5 w-5 ${styles.icon}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-slate-900">{insight.title}</p>
                  <p className="text-sm text-slate-600">{insight.description}</p>
                </div>
                <div className="flex-shrink-0 text-right">
                  <p className="text-sm font-semibold text-slate-900">{insight.metric}</p>
                  <p className="text-xs text-slate-500 mt-1">{insight.timestamp}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
