'use client';

import React, { useMemo } from 'react';
import { 
  DollarSign, 
  TrendingUp, 
  Wallet, 
  ShieldCheck, 
  AlertCircle, 
  Clock, 
  ArrowUpRight, 
  ArrowDownRight,
  Calculator,
  PieChart as PieChartIcon
} from 'lucide-react';
import { useDashboard, useClaims } from '@/store';
import { calculateFinancialHealth, FinancialHealth } from '@/lib/finance';
import { StatCard } from '@/components/charts/stat-card';
import { formatCurrency, formatNumber } from '@/lib/utils';
import {
  AreaChart, Area,
  BarChart, Bar,
  LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  Cell, PieChart, Pie
} from 'recharts';

export default function TreasuryPage() {
  const dashData = useDashboard();
  const claimsData = useClaims();
  
  const health = useMemo(() => calculateFinancialHealth(dashData), [dashData]);

  // Data for Cash vs Accrual Chart
  const cashAccrualData = useMemo(() => {
    if (!dashData?.debtRecon) return [];
    return dashData.debtRecon.revenue.map((accrual, i) => ({
      period: `M${i+1}`,
      Accrual: accrual,
      Cash: dashData.debtRecon.payments[i] || 0,
      Gap: accrual - (dashData.debtRecon.payments[i] || 0)
    }));
  }, [dashData]);

  // Debt Aging Breakdown (Simulated based on closing debt vs revenue)
  const debtAging = useMemo(() => {
    if (!health || !dashData) return [];
    const total = dashData.debtRecon?.total.slice(-1)[0] || 0;
    return [
      { name: 'Current (<30d)', value: total * 0.4, fill: '#10b981' },
      { name: '31-60 Days', value: total * 0.3, fill: '#3b82f6' },
      { name: '61-90 Days', value: total * 0.2, fill: '#f59e0b' },
      { name: '90+ Days (Risk)', value: total * 0.1, fill: '#ef4444' },
    ];
  }, [health, dashData]);

  if (!dashData) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Wallet className="h-6 w-6 text-emerald-600" />
            Treasury & Financial Intelligence
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Liquidity monitoring, collection efficiency, and bad debt provisioning
          </p>
        </div>
      </div>

      {/* Financial Health Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard 
          title="Collection Rate" 
          value={`${health?.collectionRate.toFixed(1)}%`} 
          trend={health?.trend === 'improving' ? 'up' : health?.trend === 'deteriorating' ? 'down' : 'neutral'} 
          color="emerald" 
          icon={TrendingUp}
        />
        <StatCard 
          title="DSO (Days Outstanding)" 
          value={`${health?.dso.toFixed(0)} Days`} 
          trend={health?.dso && health.dso > 45 ? 'down' : 'up'} 
          color="blue" 
          icon={Clock}
        />
        <StatCard 
          title="Bad Debt Provision" 
          value={formatCurrency(health?.badDebtProvision || 0)} 
          trend="neutral" 
          color="amber" 
          icon={Calculator}
        />
        <div className={`p-4 rounded-xl border ${
          health?.riskLevel === 'high' ? 'border-red-100 bg-red-50' : 
          health?.riskLevel === 'medium' ? 'border-amber-100 bg-amber-50' : 
          'border-emerald-100 bg-emerald-50'
        }`}>
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Financial Risk</p>
            <ShieldCheck className={`h-4 w-4 ${
              health?.riskLevel === 'high' ? 'text-red-600' : 
              health?.riskLevel === 'medium' ? 'text-amber-600' : 
              'text-emerald-600'
            }`} />
          </div>
          <p className={`mt-1 text-2xl font-bold uppercase ${
            health?.riskLevel === 'high' ? 'text-red-900' : 
            health?.riskLevel === 'medium' ? 'text-amber-900' : 
            'text-emerald-900'
          }`}>
            {health?.riskLevel || 'Low'}
          </p>
          <p className="text-[10px] text-gray-500">System assessment of liquidity</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Accrual vs Cash Chart */}
        <div className="lg:col-span-2 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Cash-to-Accrual Velocity</h3>
              <p className="text-xs text-gray-500 mt-1">Comparison of Billed Revenue (Accrual) vs Actual Collections (Cash)</p>
            </div>
            <div className="flex gap-4">
              <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-blue-500" /><span className="text-[10px] text-gray-400">Accrual</span></div>
              <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-emerald-500" /><span className="text-[10px] text-gray-400">Cash</span></div>
            </div>
          </div>
          
          <ResponsiveContainer width="100%" height={320}>
            <AreaChart data={cashAccrualData}>
              <defs>
                <linearGradient id="colorAccrual" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorCash" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.1} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="period" tick={{ fontSize: 10 }} axisLine={false} />
              <YAxis tick={{ fontSize: 10 }} axisLine={false} tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} />
              <Tooltip formatter={(v) => formatCurrency(Number(v))} />
              <Area type="monotone" dataKey="Accrual" stroke="#3b82f6" fillOpacity={1} fill="url(#colorAccrual)" strokeWidth={2} />
              <Area type="monotone" dataKey="Cash" stroke="#10b981" fillOpacity={1} fill="url(#colorCash)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Debt Aging Chart */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm flex flex-col">
          <h3 className="text-sm font-semibold text-gray-900 mb-6 flex items-center gap-2">
            <PieChartIcon className="h-4 w-4 text-blue-500" />
            Estimated Debt Aging
          </h3>
          <div className="flex-1 flex flex-col items-center justify-center">
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie
                  data={debtAging}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {debtAging.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => formatCurrency(Number(v))} />
              </PieChart>
            </ResponsiveContainer>
            
            <div className="w-full mt-4 space-y-2">
              {debtAging.map((item) => (
                <div key={item.name} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.fill }} />
                    <span className="text-gray-600">{item.name}</span>
                  </div>
                  <span className="font-semibold text-gray-900">{formatCurrency(item.value)}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-6 pt-4 border-t border-gray-100">
            <div className="flex items-center justify-between text-[11px] text-gray-500">
              <span>Total Outstanding</span>
              <span className="font-bold text-gray-900">
                {formatCurrency(dashData.debtRecon?.total.slice(-1)[0] || 0)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Treasury Findings & Action Items */}
      <div className="grid gap-6 md:grid-cols-2">
        <div className="p-5 rounded-xl border border-gray-200 bg-white shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2 mb-4">
            <DollarSign className="h-4 w-4 text-emerald-600" />
            Collection Performance
          </h3>
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-3 rounded-lg bg-gray-50">
              <div className="p-1.5 rounded-md bg-white border border-gray-200 shadow-sm text-emerald-600">
                <ArrowUpRight className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-gray-900">Collection Velocity</p>
                <p className="text-[11px] text-gray-500 mt-0.5">Collections are currently at {health?.collectionRate.toFixed(1)}% of billed revenue, indicating healthy cash flow.</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 rounded-lg bg-gray-50">
              <div className="p-1.5 rounded-md bg-white border border-gray-200 shadow-sm text-blue-600">
                <Clock className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-gray-900">Debtor Cycle (DSO)</p>
                <p className="text-[11px] text-gray-500 mt-0.5">Average payment cycle is {health?.dso.toFixed(0)} days. Recommended target is &lt;45 days.</p>
              </div>
            </div>
          </div>
        </div>

        <div className="p-5 rounded-xl border border-gray-200 bg-white shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2 mb-4">
            <AlertCircle className="h-4 w-4 text-amber-500" />
            Treasury Risks & Provisions
          </h3>
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-50">
              <div className="p-1.5 rounded-md bg-white border border-amber-200 shadow-sm text-amber-600">
                <Calculator className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-amber-900">Unprovisioned Exposure</p>
                <p className="text-[11px] text-amber-700 mt-0.5">Estimated risk on 90+ day debt is {formatCurrency((health?.badDebtProvision || 0) * 0.4)}. Recommend increasing provision.</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 rounded-lg bg-red-50">
              <div className="p-1.5 rounded-md bg-white border border-red-200 shadow-sm text-red-600">
                <ShieldCheck className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-red-900">Revenue Leakage Alert</p>
                <p className="text-[11px] text-red-700 mt-0.5">Rejection patterns suggest a potential {((claimsData?.rejected || 0) / (claimsData?.totalClaims || 1) * 100).toFixed(1)}% revenue leak from clinical documentation errors.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
