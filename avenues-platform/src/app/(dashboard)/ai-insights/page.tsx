"use client";

import React, { useState } from "react";
import {
  Brain,
  Zap,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Sparkles,
  Download,
  ShieldAlert,
  Search,
  ArrowRight,
  Filter,
  DollarSign,
  Activity,
  Layers,
} from "lucide-react";
import { StatCard } from "@/components/charts/stat-card";
import { ChartCard } from "@/components/dashboard/chart-card";
import { DataTable, ColumnConfig } from "@/components/dashboard/data-table";

interface AnomalyItem {
  id: string;
  category: "Billing" | "Pharmacy" | "Debtors" | "Casualty" | "Claims";
  title: string;
  description: string;
  financialImpact: number;
  confidenceScore: number;
  riskLevel: "Critical" | "High" | "Medium" | "Low";
  recommendedAction: string;
}

const MOCK_ANOMALIES: AnomalyItem[] = [
  {
    id: "ANOM-01",
    category: "Billing",
    title: "Unpriced Consumable Line Items Spike",
    description: "Detected 42 lines billed at $0.00 rate in Casualty Emergency Ward over the last 14 days.",
    financialImpact: 14500.0,
    confidenceScore: 94,
    riskLevel: "Critical",
    recommendedAction: "Audit Emergency Ward tariff master and enforce mandatory price validations at point of care.",
  },
  {
    id: "ANOM-02",
    category: "Debtors",
    title: "Medical Aid Stagnant Debt Accumulation (150+ Days)",
    description: "CIMAS & Alliance Medical Aid accounts aged past 150 days show 15% annual interest loss.",
    financialImpact: 38200.0,
    confidenceScore: 89,
    riskLevel: "High",
    recommendedAction: "Initiate senior funder reconciliation and submit formal demand letters for accounts >90 days.",
  },
  {
    id: "ANOM-03",
    category: "Pharmacy",
    title: "Antibiotic Dispensing vs Inventory Stock Valuation Delta",
    description: "Retail Pharmacy inventory stock valuation decreased faster than recorded patient billing claims.",
    financialImpact: 8750.0,
    confidenceScore: 91,
    riskLevel: "High",
    recommendedAction: "Perform physical stock count in Retail Pharmacy Store and cross-check shift cashier logs.",
  },
  {
    id: "ANOM-04",
    category: "Claims",
    title: "Pre-Authorization Key Missing on Casualty Admissions",
    description: "18% of Casualty private insured admissions lack valid pre-authorization codes prior to discharge.",
    financialImpact: 19800.0,
    confidenceScore: 96,
    riskLevel: "Critical",
    recommendedAction: "Mandate pre-auth code entry in Admission Desk workflow before releasing patient statements.",
  },
  {
    id: "ANOM-05",
    category: "Billing",
    title: "Weekend Billing Capturer Variance",
    description: "Night shift billing capturers recorded 28% higher cancellation ratios than weekday morning shifts.",
    financialImpact: 6400.0,
    confidenceScore: 85,
    riskLevel: "Medium",
    recommendedAction: "Review weekend night shift supervisory sign-offs and cancellation approval workflows.",
  },
];

export default function AIInsightsPage() {
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const filteredAnomalies = MOCK_ANOMALIES.filter((item) => {
    const matchesCategory = selectedCategory === "All" || item.category === selectedCategory;
    const matchesSearch =
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const totalImpact = MOCK_ANOMALIES.reduce((acc, curr) => acc + curr.financialImpact, 0);

  const anomalyColumns: ColumnConfig[] = [
    { key: "id", header: "Anomaly ID", sortable: true },
    { key: "category", header: "Pillar Category", sortable: true },
    { key: "title", header: "Anomaly Title", sortable: true },
    {
      key: "financialImpact",
      header: "Est. Impact ($)",
      sortable: true,
      align: "right",
      format: (val) => `$${Number(val).toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
    },
    {
      key: "riskLevel",
      header: "Risk Severity",
      sortable: true,
      align: "center",
      format: (val) => String(val),
    },
    {
      key: "confidenceScore",
      header: "AI Confidence",
      sortable: true,
      align: "right",
      format: (val) => `${val}%`,
    },
  ];

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200/80 dark:border-slate-800/80 pb-4">
        <div>
          <h1 className="font-heading text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2.5">
            <Brain className="h-7 w-7 text-purple-500 shrink-0" />
            AI Executive Insights & Anomaly Detection
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Automated intelligence engine scanning revenue leakage, debtor defaults, and tariff variances.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search AI findings..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-48 sm:w-64 rounded-lg border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900/80 pl-9 pr-3 py-1.5 text-xs font-semibold text-slate-900 dark:text-slate-100 focus:border-purple-500 focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Recoverable Leakage"
          value={`$${totalImpact.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
          subtitle="Identified across 5 anomalies"
          icon={DollarSign}
          color="violet"
          change={18.2}
          trend="up"
        />
        <StatCard
          title="Critical Risk Findings"
          value="2 Anomalies"
          subtitle="Immediate action required"
          icon={AlertTriangle}
          color="rose"
          trend="neutral"
        />
        <StatCard
          title="Average AI Confidence"
          value="91.2%"
          subtitle="Pattern recognition score"
          icon={Sparkles}
          color="blue"
          trend="neutral"
        />
        <StatCard
          title="Pillars Monitored"
          value="5 Domains"
          subtitle="Billing, Debtors, Pharmacy..."
          icon={Layers}
          color="emerald"
          trend="neutral"
        />
      </div>

      {/* Executive Summary Briefing Banner */}
      <div className="rounded-xl border border-purple-500/30 bg-purple-50/50 dark:bg-purple-950/20 p-5 backdrop-blur-md">
        <div className="flex items-start gap-4">
          <div className="p-2.5 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 shrink-0">
            <Sparkles className="h-6 w-6" />
          </div>
          <div className="space-y-2 flex-1">
            <h3 className="font-heading font-bold text-base text-purple-950 dark:text-purple-200">
              Executive AI Intelligence Briefing — Hospital Management
            </h3>
            <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
              Our automated engine has analyzed <strong>21,890 clinical episodes</strong> and identified <strong>$87,650.00</strong> in actionable financial leakage risks. Primary root causes include unpriced emergency consumables, missing pre-authorizations on private insured patients, and stagnant medical aid accounts past 150 days.
            </p>
          </div>
        </div>
      </div>

      {/* Anomaly Feed Grid */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-rose-500" />
            Detected Anomalies & Financial Recovery Plan
          </h2>
          <div className="flex items-center gap-2">
            {["All", "Billing", "Debtors", "Pharmacy", "Claims"].map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                  selectedCategory === cat
                    ? "bg-purple-600 text-white shadow-xs"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredAnomalies.map((item) => (
            <div
              key={item.id}
              className="rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md p-5 shadow-xs hover:shadow-md transition-all duration-200 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                    {item.category} • {item.id}
                  </span>
                  <span
                    className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                      item.riskLevel === "Critical"
                        ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/30"
                        : item.riskLevel === "High"
                        ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30"
                        : "bg-sky-500/10 text-sky-600 dark:text-sky-400"
                    }`}
                  >
                    {item.riskLevel} Risk
                  </span>
                </div>

                <h3 className="font-heading font-bold text-base text-slate-900 dark:text-slate-100 mb-1">
                  {item.title}
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed mb-3">
                  {item.description}
                </p>
              </div>

              <div className="border-t border-slate-100 dark:border-slate-800/60 pt-3 mt-2 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500 dark:text-slate-400">Est. Financial Impact:</span>
                  <span className="font-heading font-bold text-rose-600 dark:text-rose-400 text-sm">
                    ${item.financialImpact.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="bg-slate-50 dark:bg-slate-800/50 p-2.5 rounded-lg border border-slate-200/60 dark:border-slate-800 flex items-start gap-2 text-xs">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                  <span className="text-slate-700 dark:text-slate-200 font-medium">
                    {item.recommendedAction}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Detailed Anomaly Matrix Table */}
      <ChartCard title="AI Anomaly Ledger & Confidence Scores" subtitle="Full audit log of detected operational anomalies">
        <DataTable columns={anomalyColumns} data={MOCK_ANOMALIES as unknown as Record<string, unknown>[]} searchable={false} exportable={true} pageSize={5} />
      </ChartCard>

    </div>
  );
}
