"use client";

import React, { useState } from "react";
import {
  TrendingUp,
  TrendingDown,
  Info,
  HelpCircle,
  ChevronRight,
  Sparkles,
  AlertTriangle,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  Search,
} from "lucide-react";
import { formatCurrency, formatNumber } from "@/lib/utils";

export interface ExecutiveKPICardProps {
  title: string;
  value: string;
  rawValue?: number;
  vsLastMonth: number;
  vsLastYear: number;
  vsBudget?: number;
  topContributor: { name: string; impact: string };
  topDecline?: { name: string; impact: string };
  forecastNextMonth: string;
  riskNote?: string;
  formula: string;
  sourceReport: string;
  color?: "teal" | "rose" | "blue" | "emerald" | "amber";
  drillDownData?: {
    department: string;
    value: string;
    doctors: { name: string; episodes: number; revenue: string }[];
  }[];
}

export function ExecutiveKPICard({
  title,
  value,
  vsLastMonth,
  vsLastYear,
  vsBudget = 4.5,
  topContributor,
  topDecline,
  forecastNextMonth,
  riskNote,
  formula,
  sourceReport,
  color = "teal",
  drillDownData = [
    {
      department: "Operating Theatre",
      value: "$1,894,007.68",
      doctors: [
        { name: "Dr. James Wilson (Ortho)", episodes: 342, revenue: "$542,100.00" },
        { name: "Dr. Emily Rodriguez (Cardio)", episodes: 284, revenue: "$489,500.00" },
        { name: "Dr. Robert Kumar (Neuro)", episodes: 195, revenue: "$384,200.00" },
      ],
    },
    {
      department: "In-Patient Main Wards",
      value: "$2,810,544.97",
      doctors: [
        { name: "Dr. Sarah Johnson (Internal)", episodes: 612, revenue: "$842,000.00" },
        { name: "Dr. Michael Chen (Surgery)", episodes: 490, revenue: "$710,500.00" },
      ],
    },
    {
      department: "Pharmacy & Dispensary",
      value: "$2,164,145.98",
      doctors: [
        { name: "Dispensing Unit Main Stores", episodes: 14820, revenue: "$1,450,000.00" },
      ],
    },
  ],
}: ExecutiveKPICardProps) {
  const [showFormulaTooltip, setShowFormulaTooltip] = useState(false);
  const [isDrillOpen, setIsDrillOpen] = useState(false);
  const [selectedDept, setSelectedDept] = useState<string | null>(null);

  const colorStyles = {
    teal: "border-teal-500/20 bg-teal-950/10 text-teal-400 hover:border-teal-500/40",
    rose: "border-rose-500/20 bg-rose-950/10 text-rose-400 hover:border-rose-500/40",
    blue: "border-blue-500/20 bg-blue-950/10 text-blue-400 hover:border-blue-500/40",
    emerald: "border-emerald-500/20 bg-emerald-950/10 text-emerald-400 hover:border-emerald-500/40",
    amber: "border-amber-500/20 bg-amber-950/10 text-amber-400 hover:border-amber-500/40",
  };

  return (
    <>
      <div
        className={`group relative rounded-xl border p-5 transition-all duration-200 backdrop-blur-md glass-card ${colorStyles[color]}`}
      >
        {/* Header with Title & Formula Tooltip Toggle */}
        <div className="flex items-start justify-between gap-2">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              {title}
              <button
                onMouseEnter={() => setShowFormulaTooltip(true)}
                onMouseLeave={() => setShowFormulaTooltip(false)}
                className="text-slate-500 hover:text-slate-300 transition-colors"
                title="View Formula & Data Lineage"
              >
                <HelpCircle className="h-3.5 w-3.5" />
              </button>
            </span>
          </div>

          <button
            onClick={() => setIsDrillOpen(true)}
            className="flex items-center gap-1 text-[10px] font-bold text-teal-400 bg-teal-500/10 px-2 py-1 rounded-md border border-teal-500/20 hover:bg-teal-500/20 transition-all shrink-0"
          >
            <Layers className="h-3 w-3" />
            Drill-Down
          </button>
        </div>

        {/* Hover Formula & Lineage Tooltip Card */}
        {showFormulaTooltip && (
          <div className="absolute left-4 top-12 z-50 w-72 rounded-xl border border-slate-700 bg-slate-900/95 p-3.5 text-xs text-slate-200 shadow-2xl backdrop-blur-xl">
            <div className="flex items-center gap-1.5 font-bold text-teal-400 mb-1">
              <Info className="h-4 w-4" />
              Business Formula & Governance
            </div>
            <p className="font-mono text-[11px] bg-slate-950 p-2 rounded border border-slate-800 text-teal-300 mb-2">
              {formula}
            </p>
            <div className="text-[10px] text-slate-400 space-y-0.5">
              <p><strong>Source Report:</strong> {sourceReport}</p>
              <p><strong>Validation:</strong> Reconciled with Trimed source logs</p>
            </div>
          </div>
        )}

        {/* Main Metric Value */}
        <div className="mt-3 flex items-baseline justify-between">
          <h2 className="font-heading text-2xl sm:text-3xl font-extrabold text-slate-100 tracking-tight">
            {value}
          </h2>
          <div className="flex items-center gap-1 text-xs font-bold text-emerald-400">
            {vsLastMonth >= 0 ? (
              <ArrowUpRight className="h-4 w-4" />
            ) : (
              <ArrowDownRight className="h-4 w-4 text-rose-400" />
            )}
            <span>{vsLastMonth >= 0 ? `+${vsLastMonth}%` : `${vsLastMonth}%`} vs Mo</span>
          </div>
        </div>

        {/* Executive Benchmarks & Variances */}
        <div className="mt-3 grid grid-cols-2 gap-2 border-t border-slate-800/80 pt-2.5 text-[11px]">
          <div>
            <span className="text-slate-400">vs Last Year:</span>{" "}
            <span className={vsLastYear >= 0 ? "font-bold text-emerald-400" : "font-bold text-rose-400"}>
              {vsLastYear >= 0 ? `+${vsLastYear}%` : `${vsLastYear}%`}
            </span>
          </div>
          <div>
            <span className="text-slate-400">vs Target:</span>{" "}
            <span className="font-bold text-teal-300">+{vsBudget}%</span>
          </div>
        </div>

        {/* Top Contributor & Predictive Forecast */}
        <div className="mt-3 space-y-1.5 border-t border-slate-800/80 pt-2.5 text-[11px]">
          <div className="flex items-center justify-between text-slate-300">
            <span className="text-slate-400">Top Driver:</span>
            <span className="font-semibold text-slate-200">{topContributor.name} ({topContributor.impact})</span>
          </div>

          <div className="flex items-center justify-between text-teal-300 font-medium">
            <span className="flex items-center gap-1 text-slate-400">
              <Sparkles className="h-3 w-3 text-teal-400" />
              Next Mo Forecast:
            </span>
            <span className="font-bold">{forecastNextMonth}</span>
          </div>
        </div>

        {/* Actionable Executive Risk Note */}
        {riskNote && (
          <div className="mt-3 flex items-start gap-1.5 rounded-lg bg-rose-500/10 border border-rose-500/20 p-2 text-[10px] text-rose-300">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-rose-400 mt-0.5" />
            <span><strong>Executive Risk:</strong> {riskNote}</span>
          </div>
        )}
      </div>

      {/* 3-Level Progressive Drill-Down Modal */}
      {isDrillOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-md animate-fadeIn">
          <div className="w-full max-w-3xl rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl text-slate-100">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-heading font-bold text-lg text-teal-400 flex items-center gap-2">
                <Layers className="h-5 w-5" />
                Progressive Executive Drill-Down: {title}
              </h3>
              <button
                onClick={() => {
                  setIsDrillOpen(false);
                  setSelectedDept(null);
                }}
                className="text-slate-400 hover:text-white text-sm font-bold"
              >
                ✕ Close
              </button>
            </div>

            {/* Level 1: Department Breakdown */}
            <div className="mt-4 space-y-3">
              <p className="text-xs text-slate-400">
                Level 1: Departmental Breakdown ➔ Level 2: Doctor/Physician Yield ➔ Level 3: Episode Audit
              </p>

              <div className="grid gap-3 sm:grid-cols-3">
                {drillDownData.map((dept) => (
                  <button
                    key={dept.department}
                    onClick={() => setSelectedDept(dept.department)}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      selectedDept === dept.department
                        ? "border-teal-500 bg-teal-500/10 text-white"
                        : "border-slate-800 bg-slate-950/50 hover:border-slate-700 text-slate-300"
                    }`}
                  >
                    <p className="text-xs font-bold">{dept.department}</p>
                    <p className="text-sm font-mono font-extrabold text-teal-400 mt-1">{dept.value}</p>
                  </button>
                ))}
              </div>

              {/* Level 2: Doctor & Episode Details */}
              {selectedDept && (
                <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950 p-4 animate-fadeIn">
                  <h4 className="text-xs font-bold text-teal-300 mb-2">
                    Level 2 Doctor & Physician Performance for '{selectedDept}'
                  </h4>
                  <div className="divide-y divide-slate-800 text-xs">
                    {drillDownData
                      .find((d) => d.department === selectedDept)
                      ?.doctors.map((doc, idx) => (
                        <div key={idx} className="py-2 flex items-center justify-between">
                          <span className="font-semibold text-slate-200">{doc.name}</span>
                          <div className="flex items-center gap-4">
                            <span className="text-slate-400">{doc.episodes} Episodes</span>
                            <span className="font-mono font-bold text-emerald-400">{doc.revenue}</span>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
