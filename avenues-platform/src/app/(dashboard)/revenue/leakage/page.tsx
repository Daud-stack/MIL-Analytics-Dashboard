'use client';

import React, { useMemo } from 'react';
import { 
  AlertTriangle, 
  Ban, 
  Clock, 
  DollarSign, 
  FileWarning, 
  TrendingDown
} from 'lucide-react';
import { useDashboard } from '@/store';
import { StatCard } from '@/components/charts/stat-card';
import { formatCurrency, formatNumber } from '@/lib/utils';
import {
  BarChart, Bar,
  PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';

export default function RevenueLeakagePage() {
  const dashData = useDashboard();

  // Cancellations Data
  const cancellationsData = useMemo(() => {
    if (!dashData?.cancellationsByReason) return [];
    return Object.entries(dashData.cancellationsByReason).map(([reason, data]) => ({
      name: reason,
      amount: data.value,
      count: data.count
    })).sort((a, b) => b.amount - a.amount).slice(0, 10);
  }, [dashData]);

  const totalCancellationsValue = dashData?.cancellationValueByMonth?.reduce((a, b) => a + b, 0) || 0;
  const totalCancellationsCount = dashData?.cancellationsByMonth?.reduce((a, b) => a + b, 0) || 0;

  // Billing SLA Data
  const slaData = useMemo(() => {
    if (!dashData?.slaDaysToStatement) return [];
    const colors = {
      "0-3 Days": "#10b981", // Green
      "4-7 Days": "#3b82f6", // Blue
      "8-14 Days": "#f59e0b", // Amber
      "15+ Days": "#ef4444", // Red
      "Not Released": "#64748b" // Slate
    };
    return Object.entries(dashData.slaDaysToStatement).map(([days, count]) => ({
      name: days,
      value: count,
      fill: (colors as any)[days] || "#cbd5e1"
    }));
  }, [dashData]);

  const unreleasedReasons = useMemo(() => {
    if (!dashData?.unreleasedByReason) return [];
    return Object.entries(dashData.unreleasedByReason).map(([reason, data]) => ({
      name: reason,
      amount: data.value,
      count: data.count
    })).sort((a, b) => b.amount - a.amount);
  }, [dashData]);

  const totalUnreleasedValue = dashData?.outstandingAmountByMonth?.reduce((a, b) => a + b, 0) || 0;

  if (!dashData) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <p className="text-gray-500">No data available. Please upload the Trimed Reports to view leakage analytics.</p>
      </div>
    );
  }

  const hasCancellations = cancellationsData.length > 0;
  const hasSLA = slaData.length > 0 && slaData.some(d => d.value > 0);

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <AlertTriangle className="h-6 w-6 text-red-600" />
            Revenue Leakage & SLA
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Monitor cancellations and delayed billing releases impacting cash flow
          </p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard 
          title="Total Cancelled Amount" 
          value={hasCancellations ? formatCurrency(totalCancellationsValue) : 'N/A'} 
          trend="neutral" 
          color="red" 
          icon={Ban}
        />
        <StatCard 
          title="Cancellation Volume" 
          value={hasCancellations ? formatNumber(totalCancellationsCount) : 'N/A'} 
          trend="neutral" 
          color="amber" 
          icon={TrendingDown}
        />
        <StatCard 
          title="Outstanding (Unreleased)" 
          value={hasSLA ? formatCurrency(totalUnreleasedValue) : 'N/A'} 
          trend="neutral" 
          color="rose" 
          icon={DollarSign}
        />
        <StatCard 
          title="SLA Risk (15+ Days/Not Rel)" 
          value={hasSLA ? formatNumber((slaData.find(d => d.name === "15+ Days")?.value || 0) + (slaData.find(d => d.name === "Not Released")?.value || 0)) : 'N/A'} 
          trend="neutral" 
          color="orange" 
          icon={Clock}
        />
      </div>

      {hasCancellations && (
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900 mb-6 flex items-center gap-2">
            <Ban className="h-4 w-4 text-red-500" />
            Top Cancellation Reasons by Value
          </h3>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={cancellationsData} layout="vertical" margin={{ left: 120, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f1f5f9" />
              <XAxis type="number" tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} tick={{ fontSize: 10 }} axisLine={false} />
              <YAxis dataKey="name" type="category" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} width={150} />
              <Tooltip formatter={(v) => formatCurrency(Number(v))} cursor={{ fill: '#f8fafc' }} />
              <Bar dataKey="amount" fill="#ef4444" radius={[0, 4, 4, 0]} barSize={24}>
                {cancellationsData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={index < 3 ? '#ef4444' : '#f87171'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {hasSLA && (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Billing SLA */}
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm flex flex-col">
            <h3 className="text-sm font-semibold text-gray-900 mb-6 flex items-center gap-2">
              <Clock className="h-4 w-4 text-blue-500" />
              Billing Release SLA (Days Post Discharge)
            </h3>
            <div className="flex-1 flex items-center justify-center">
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={slaData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {slaData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => formatNumber(Number(v))} />
                  <Legend verticalAlign="bottom" height={36} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Unreleased Reasons */}
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-900 mb-6 flex items-center gap-2">
              <FileWarning className="h-4 w-4 text-amber-500" />
              Not Released Reasons (Outstanding Value)
            </h3>
            <div className="overflow-y-auto max-h-[280px] pr-2">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs font-medium text-gray-500">
                    <th className="pb-2">Reason</th>
                    <th className="pb-2 text-right">Episodes</th>
                    <th className="pb-2 text-right">Value Held</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {unreleasedReasons.map((item) => (
                    <tr key={item.name} className="hover:bg-gray-50">
                      <td className="py-3 text-gray-900 font-medium">{item.name}</td>
                      <td className="py-3 text-right text-gray-600">{formatNumber(item.count)}</td>
                      <td className="py-3 text-right font-semibold text-red-600">{formatCurrency(item.amount)}</td>
                    </tr>
                  ))}
                  {unreleasedReasons.length === 0 && (
                    <tr>
                      <td colSpan={3} className="py-8 text-center text-gray-500">No unreleased episodes recorded.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
