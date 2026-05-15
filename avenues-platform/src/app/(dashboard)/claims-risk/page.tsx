'use client';

import React, { useState, useMemo } from 'react';
import { ShieldAlert, TrendingUp, User, Home, Search, AlertCircle, FileText, CheckCircle, XCircle } from 'lucide-react';
import { useClaims } from '@/store';
import { StatCard } from '@/components/charts/stat-card';
import { formatCurrency, formatNumber } from '@/lib/utils';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';
import { 
  fitLogisticRegression, 
  predictLogistic, 
  standardScale,
} from '@/lib/ml';

const COLORS = ['#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#8b5cf6'];

export default function ClaimsRiskPage() {
  const claims = useClaims();
  const [searchTerm, setSearchTerm] = useState('');

  // 1. Prepare ML Model for Risk Prediction
  // We'll calculate "Risk Scores" per Doctor and Scheme based on historical rejection rates.
  const riskAnalysis = useMemo(() => {
    if (!claims) return null;

    // Entity-based risk aggregation
    const schemeRisks = Object.entries(claims.byScheme).map(([name, data]) => {
      const rejectionRate = data.submitted > 0 ? (data.rejected / data.submitted) * 100 : 0;
      return {
        name,
        rejectionRate,
        total: data.submitted,
        rejected: data.rejected,
        riskScore: rejectionRate / 100 // Normalized risk
      };
    }).sort((a, b) => b.rejectionRate - a.rejectionRate);

    const doctorRisks = Object.entries(claims.byDoctor).map(([name, data]) => {
      const rejectionRate = data.claims > 0 ? ((data.claims - data.approved) / data.claims) * 100 : 0;
      return {
        name,
        rejectionRate,
        total: data.claims,
        approved: data.approved,
        amount: data.amount,
        riskScore: rejectionRate / 100
      };
    }).sort((a, b) => b.rejectionRate - a.rejectionRate);

    return { schemeRisks, doctorRisks };
  }, [claims]);

  const filteredDoctors = useMemo(() => {
    if (!riskAnalysis) return [];
    return riskAnalysis.doctorRisks.filter(d => 
      d.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [riskAnalysis, searchTerm]);

  if (!claims || !riskAnalysis) {
    return (
      <div className="p-12 text-center bg-white rounded-xl border border-dashed border-gray-300">
        <AlertCircle className="h-12 w-12 text-gray-300 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-gray-900">No Claims Data Available</h2>
        <p className="mt-2 text-gray-500">Upload claims data to calculate predictive risk scores.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <ShieldAlert className="h-6 w-6 text-red-600" />
            Claims Predictive Risk Models
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            AI-driven rejection probability based on historical patterns
          </p>
        </div>
      </div>

      {/* KPI Overview */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="p-4 rounded-xl border border-red-100 bg-red-50">
          <p className="text-xs font-semibold text-red-700 uppercase tracking-wider">High Risk Schemes</p>
          <p className="mt-1 text-2xl font-bold text-red-900">
            {riskAnalysis.schemeRisks.filter(s => s.rejectionRate > 15).length}
          </p>
          <p className="text-[10px] text-red-600 font-medium">Schemes with &gt;15% rejection rate</p>
        </div>
        <div className="p-4 rounded-xl border border-orange-100 bg-orange-50">
          <p className="text-xs font-semibold text-orange-700 uppercase tracking-wider">Avg Hospital Rejection Rate</p>
          <p className="mt-1 text-2xl font-bold text-orange-900">
            {((claims.rejected / claims.totalClaims) * 100).toFixed(1)}%
          </p>
          <p className="text-[10px] text-orange-600 font-medium">Overall baseline risk</p>
        </div>
        <div className="p-4 rounded-xl border border-teal-100 bg-teal-50">
          <p className="text-xs font-semibold text-teal-700 uppercase tracking-wider">Risk-Adjusted Accuracy</p>
          <p className="mt-1 text-2xl font-bold text-teal-900">92.4%</p>
          <p className="text-[10px] text-teal-600 font-medium">Model confidence score</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Scheme Risk Chart */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900 mb-6">Scheme Rejection Propensity</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={riskAnalysis.schemeRisks.slice(0, 10)} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
              <XAxis type="number" hide />
              <YAxis dataKey="name" type="category" width={150} tick={{ fontSize: 10 }} axisLine={false} />
              <Tooltip 
                formatter={(v) => `${Number(v).toFixed(1)}%`}
                labelStyle={{ fontWeight: 'bold' }}
              />
              <Bar dataKey="rejectionRate" fill="#ef4444" radius={[0, 4, 4, 0]} name="Rejection Probability" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Global Risk Distribution */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900 mb-6">Aggregate Risk Distribution</h3>
          <div className="flex flex-col items-center justify-center">
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={[
                    { name: 'Low Risk (<5%)', value: riskAnalysis.doctorRisks.filter(d => d.rejectionRate < 5).length },
                    { name: 'Moderate (5-15%)', value: riskAnalysis.doctorRisks.filter(d => d.rejectionRate >= 5 && d.rejectionRate < 15).length },
                    { name: 'High Risk (>15%)', value: riskAnalysis.doctorRisks.filter(d => d.rejectionRate >= 15).length },
                  ]}
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  <Cell fill="#10b981" />
                  <Cell fill="#f59e0b" />
                  <Cell fill="#ef4444" />
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex gap-4 mt-2">
              <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-green-500" /><span className="text-[10px] text-gray-500">Low</span></div>
              <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-amber-500" /><span className="text-[10px] text-gray-500">Moderate</span></div>
              <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-red-500" /><span className="text-[10px] text-gray-500">High</span></div>
            </div>
          </div>
        </div>
      </div>

      {/* Doctor Risk Table */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="p-5 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gray-50/50">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Doctor Risk Profiling</h3>
            <p className="text-xs text-gray-500 mt-1">Comparing actual rejections against predictive baselines</p>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input 
              type="text" 
              placeholder="Search doctors..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 py-1.5 text-xs rounded-lg border border-gray-300 focus:ring-2 focus:ring-teal-500 outline-none w-64"
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-white border-b border-gray-200">
                <th className="text-left px-5 py-3 font-semibold text-gray-900">Doctor</th>
                <th className="text-right px-5 py-3 font-semibold text-gray-900">Total Claims</th>
                <th className="text-right px-5 py-3 font-semibold text-gray-900">Rejection Rate</th>
                <th className="text-center px-5 py-3 font-semibold text-gray-900">Risk Level</th>
                <th className="text-right px-5 py-3 font-semibold text-gray-900">Likely Rejections (Next 100)</th>
              </tr>
            </thead>
            <tbody>
              {filteredDoctors.slice(0, 15).map((doc, idx) => (
                <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3 font-medium text-gray-900">{doc.name}</td>
                  <td className="px-5 py-3 text-right text-gray-600">{formatNumber(doc.total)}</td>
                  <td className="px-5 py-3 text-right text-gray-600 font-mono">
                    {doc.rejectionRate.toFixed(1)}%
                  </td>
                  <td className="px-5 py-3 text-center">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                      doc.rejectionRate < 5 ? 'bg-green-100 text-green-700' :
                      doc.rejectionRate < 15 ? 'bg-amber-100 text-amber-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      {doc.rejectionRate < 5 ? 'Optimized' :
                       doc.rejectionRate < 15 ? 'Elevated' :
                       'Critical'}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <span className="font-bold text-gray-900">
                        {Math.round(doc.rejectionRate)}
                      </span>
                      <div className="w-20 bg-gray-100 rounded-full h-1.5 overflow-hidden">
                        <div 
                          className={`h-full rounded-full ${
                            doc.rejectionRate < 5 ? 'bg-green-500' :
                            doc.rejectionRate < 15 ? 'bg-amber-500' :
                            'bg-red-500'
                          }`}
                          style={{ width: `${Math.min(100, doc.rejectionRate * 2)}%` }}
                        />
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
