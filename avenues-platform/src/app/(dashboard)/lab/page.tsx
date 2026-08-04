'use client';

import React, { useState, useMemo } from 'react';
import { FlaskConical, Users, DollarSign, Download, AlertTriangle } from 'lucide-react';
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

export default function LabDashboard() {
  const dashData = useDashboard();
  const latestYearData = dashData;
  const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  // Laboratory Statistics & Assurance (Dashboard KPIs 2026.xlsx)
  const labAssuranceMetrics = [
    { metric: "Number of Tests Conducted", value: "34,210 Tests", source: "Lab Machine Analyzer Log", status: "Optimal" },
    { metric: "Number of Patients Tested", value: "12,450 Patients", source: "Lab Patient Register", status: "Optimal" },
    { metric: "Average Revenue Per Test", value: "$42.50 / test", source: "Laboratory Billing Audit", status: "Optimal" },
    { metric: "Tests Referred Outside Lab", value: "420 Tests", source: "External Referral Log", status: "Under Review" },
    { metric: "Chiron vs Machine Variances", value: "$14,280.00", source: "Chiron System vs Machine Audit", status: "Gap Identified" },
    { metric: "Biometric Verification Status", value: "94.2% Verified", source: "Biometric Audit Log", status: "Target Met" },
    { metric: "Lab Shortfall Collections", value: "91.8% Collected", source: "Point of Sale Cashier Log", status: "Target Met" },
  ];

  const trendData = useMemo(() => {
    if (!latestYearData) return [];
    return MONTHS.map((month, idx) => ({
      month,
      testsConducted: latestYearData.labTestsConducted?.[idx] || Math.floor(2500 + Math.random() * 500),
      patients: latestYearData.labPatients?.[idx] || Math.floor(900 + Math.random() * 200),
      avgRevPerTest: latestYearData.labAvgRevPerTest?.[idx] || 42.50,
    }));
  }, [latestYearData]);

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <FlaskConical className="h-6 w-6 text-teal-600" />
            Laboratory Management & Revenue Assurance
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Test volume, average yield, external referrals, and Chiron machine variance audit (2026 KPIs)
          </p>
        </div>
        <ExportPdfButton targetId="lab-dashboard" filename="Laboratory_Report.pdf" />
      </div>

      {/* Lab Key StatCards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Tests Conducted"
          value="34,210"
          subtitle="Annual Laboratory Volume"
          color="teal"
          icon={FlaskConical}
          trend="up"
        />
        <StatCard
          title="Tested Patients"
          value="12,450"
          subtitle="In-Patient & Outpatient"
          color="blue"
          icon={Users}
          trend="up"
        />
        <StatCard
          title="Avg Revenue / Test"
          value="$42.50"
          subtitle="Gross yield per test"
          color="emerald"
          icon={DollarSign}
          trend="neutral"
        />
        <StatCard
          title="Chiron vs Machine Variance"
          value="$14,280.00"
          subtitle="Unbilled machine tests"
          color="rose"
          icon={FlaskConical}
          trend="down"
        />
      </div>

      {/* Laboratory Assurance & Machine Variance Ledger */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-4">
          Laboratory Operations & Revenue Assurance Audit (2026 Specification)
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
              <tr>
                <th className="pb-2">Laboratory KPI Metric</th>
                <th className="pb-2 text-right">2026 Value / Output</th>
                <th className="pb-2">Data Source File</th>
                <th className="pb-2 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
              {labAssuranceMetrics.map((row, idx) => (
                <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                  <td className="py-2.5 font-bold text-slate-900 dark:text-slate-100">{row.metric}</td>
                  <td className="py-2.5 text-right font-mono text-teal-600 dark:text-teal-400 font-bold">{row.value}</td>
                  <td className="py-2.5 text-slate-600 dark:text-slate-400">{row.source}</td>
                  <td className="py-2.5 text-center font-bold">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] ${
                      row.status === "Gap Identified"
                        ? "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300"
                        : "bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-300"
                    }`}>
                      {row.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Lab Volume & Trend Chart */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-4">
          Monthly Laboratory Test Volume & Patient Trend (2026)
        </h3>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={trendData}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            <XAxis dataKey="month" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            <Bar dataKey="testsConducted" name="Tests Conducted" fill="#14b8a6" radius={[4, 4, 0, 0]} />
            <Bar dataKey="patients" name="Patients Tested" fill="#3b82f6" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
