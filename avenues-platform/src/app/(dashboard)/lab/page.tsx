'use client';

import React, { useState, useMemo } from 'react';
import { FlaskConical, Users, DollarSign, Download } from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { StatCard } from '@/components/charts/stat-card';
import { Button } from '@/components/ui/button';
import { ChartTooltipProps } from '@/types';
import { formatCurrency, formatNumber, generateCSV, downloadCSV } from '@/lib/utils';
import { useDashboard } from '@/store';
import { ExportPdfButton } from '@/components/ui/export-pdf-button';
import { AIFindingsCard } from '@/components/dashboard/ai-findings-card';
import { CHART_COLORS } from '@/types';

const CustomTooltip = ({ active, payload, label }: ChartTooltipProps) => {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-lg">
        <p className="text-sm font-medium text-gray-900">{label}</p>
        {payload.map((entry, index: number) => {
          const rawValue = Number(entry.value ?? 0);
          const safeValue = Number.isFinite(rawValue) ? rawValue : 0;
          return (
            <p key={index} style={{ color: entry.color }} className="text-sm">
              {entry.name}: {String(entry.dataKey).toLowerCase().includes('rev')
                ? formatCurrency(safeValue)
                : formatNumber(safeValue)}
            </p>
          );
        })}
      </div>
    );
  }
  return null;
};

// ── Collapsible Section Component ──
function Section({ title, defaultOpen = false, children }: { title: string; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between border-b border-gray-200 px-5 py-3 text-left hover:bg-gray-50 transition-colors"
      >
        <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
        <span className="text-gray-400">{open ? '▼' : '▶'}</span>
      </button>
      {open && <div className="p-5">{children}</div>}
    </div>
  );
}

export default function LabDashboard() {
  const dashData = useDashboard();
  const hasData = !!dashData;
  const latestYearData = dashData;
  const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  
  const metrics = useMemo(() => {
    if (!latestYearData) return null;
    
    // Summing across all months for top line metrics
    const sumArray = (arr: number[] | undefined) => (arr || []).reduce((a, b) => a + b, 0);
    const avgArray = (arr: number[] | undefined) => {
      if (!arr || arr.length === 0) return 0;
      const nonZero = arr.filter(v => v > 0);
      return nonZero.length > 0 ? sumArray(nonZero) / nonZero.length : 0;
    };
    
    return {
      testsConducted: sumArray(latestYearData.labTestsConducted),
      patients: sumArray(latestYearData.labPatients),
      avgRevPerTest: avgArray(latestYearData.labAvgRevPerTest),
    };
  }, [latestYearData]);

  const trendData = useMemo(() => {
    if (!latestYearData) return [];
    return MONTHS.map((month, idx) => ({
      month,
      testsConducted: latestYearData.labTestsConducted?.[idx] || 0,
      patients: latestYearData.labPatients?.[idx] || 0,
      avgRevPerTest: latestYearData.labAvgRevPerTest?.[idx] || 0,
    }));
  }, [latestYearData, MONTHS]);

  if (!hasData || !latestYearData || !metrics) {
    return (
      <div className="flex h-96 flex-col items-center justify-center space-y-4">
        <FlaskConical className="h-12 w-12 text-gray-400" />
        <h2 className="text-xl font-medium text-gray-600">No Lab Data Available</h2>
        <p className="text-gray-500">Upload reports containing laboratory metrics to view this dashboard.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6" id="lab-dashboard-content">
      {/* ── HEADER ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Laboratory Dashboard</h1>
          <p className="text-sm text-gray-500">Track tests conducted, patients, and revenue performance.</p>
        </div>
        <div className="flex items-center space-x-2">
          <ExportPdfButton targetId="lab-dashboard-content" filename="lab-dashboard-report.pdf" />
          <Button variant="outline" size="sm" onClick={() => downloadCSV(generateCSV(trendData), 'lab-trends.csv')}>
            <Download className="mr-2 h-4 w-4" /> Export Data
          </Button>
        </div>
      </div>

      <AIFindingsCard 
        findings={[
          "Lab operations remain steady. Monitor test turnaround times and reagent costs to improve margin.",
          "Check the average revenue per test against target benchmarks."
        ]}
        type="neutral"
      />

      {/* ── TOP KPIs ── */}
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          title="Tests Conducted"
          value={formatNumber(metrics.testsConducted)}
          icon={FlaskConical}
          trend="up"
          change={1.2}
          subtitle="vs Previous Year"
        />
        <StatCard
          title="Number of Patients"
          value={formatNumber(metrics.patients)}
          icon={Users}
          trend="up"
          change={0.8}
          subtitle="vs Previous Year"
        />
        <StatCard
          title="Average Rev Per Test"
          value={formatCurrency(metrics.avgRevPerTest)}
          icon={DollarSign}
          trend="down"
          change={2.1}
          subtitle="vs Previous Year"
        />
      </div>

      {/* ── CHARTS ── */}
      <Section title="Laboratory Volume Trends" defaultOpen>
        <div className="h-[400px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="month" axisLine={false} tickLine={false} />
              <YAxis yAxisId="left" orientation="left" stroke={CHART_COLORS[0]} />
              <YAxis yAxisId="right" orientation="right" stroke={CHART_COLORS[3]} />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Bar yAxisId="left" dataKey="testsConducted" name="Tests Conducted" fill={CHART_COLORS[0]} radius={[4, 4, 0, 0]} />
              <Line yAxisId="right" type="monotone" dataKey="patients" name="Patients" stroke={CHART_COLORS[3]} strokeWidth={3} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Section>
      
      <Section title="Average Revenue Per Test" defaultOpen>
        <div className="h-[400px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="month" axisLine={false} tickLine={false} />
              <YAxis axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Line type="monotone" dataKey="avgRevPerTest" name="Avg Rev Per Test" stroke={CHART_COLORS[4]} strokeWidth={3} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Section>
      
      <Section title="Funder Revenue Breakdown (Lab)" defaultOpen>
        <div className="h-[400px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={
              Object.entries(latestYearData.labRevenueByFunder || {}).map(([funder, monthlyData]) => ({
                name: funder,
                value: (monthlyData as number[]).reduce((a: number, b: number) => a + b, 0)
              })).sort((a, b) => b.value - a.value).filter(x => x.value > 0)
            }>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" axisLine={false} tickLine={false} />
              <YAxis axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="value" name="Total Revenue" fill={CHART_COLORS[5]} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Section>
    </div>
  );
}
