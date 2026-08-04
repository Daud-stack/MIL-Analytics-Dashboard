"use client";

import React, { useState } from "react";
import { BookOpen, Search, ShieldCheck, HelpCircle, Layers, FileText } from "lucide-react";
import { CENTRAL_KPI_CATALOG, KPIMetadata } from "@/lib/kpi-catalog";
import { StatCard } from "@/components/charts/stat-card";
import { DataHealthWidget } from "@/components/dashboard/data-health-widget";

export default function KPICatalogPage() {
  const [searchTerm, setSearchQuery] = useState("");
  const [selectedModule, setSelectedModule] = useState("All");

  const filteredKPIs = CENTRAL_KPI_CATALOG.filter((kpi) => {
    const matchesModule = selectedModule === "All" || kpi.module.includes(selectedModule);
    const matchesSearch =
      kpi.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      kpi.businessDefinition.toLowerCase().includes(searchTerm.toLowerCase()) ||
      kpi.formula.toLowerCase().includes(searchTerm.toLowerCase()) ||
      kpi.sourceReport.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesModule && matchesSearch;
  });

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200/80 dark:border-slate-800/80 pb-4">
        <div>
          <h1 className="font-heading text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2.5">
            <BookOpen className="h-7 w-7 text-teal-500 shrink-0" />
            Centralized KPI Catalog & Governance Metadata
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Formal business definitions, formulas, targets, warning thresholds, and end-to-end data lineage for platform auditability.
          </p>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search catalog formulas..."
            value={searchTerm}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-56 sm:w-72 rounded-lg border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900/80 pl-9 pr-3 py-1.5 text-xs font-semibold text-slate-900 dark:text-slate-100 focus:border-teal-500 focus:outline-none"
          />
        </div>
      </div>

      {/* Embedded Data Quality & Reconciliation Health Widget */}
      <DataHealthWidget />

      {/* KPI Catalog Table */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-4">
          Authoritative Metric Governance & Formula Catalog
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 dark:border-slate-800 text-slate-500 font-bold uppercase tracking-wider">
              <tr>
                <th className="pb-3">KPI Name</th>
                <th className="pb-3">Module & Owner</th>
                <th className="pb-3">Mathematical Formula</th>
                <th className="pb-3">Source Report File</th>
                <th className="pb-3">Target & Thresholds</th>
                <th className="pb-3">Data Lineage Trace</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
              {filteredKPIs.map((kpi) => (
                <tr key={kpi.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                  <td className="py-3 font-bold text-slate-900 dark:text-slate-100">
                    <div>{kpi.name}</div>
                    <div className="text-[10px] font-normal text-slate-500 dark:text-slate-400 mt-0.5">
                      {kpi.businessDefinition}
                    </div>
                  </td>
                  <td className="py-3 text-slate-700 dark:text-slate-300">
                    <div className="font-semibold text-teal-600 dark:text-teal-400">{kpi.module}</div>
                    <div className="text-[10px] text-slate-400">{kpi.owner} ({kpi.refreshFrequency})</div>
                  </td>
                  <td className="py-3 font-mono text-[11px] text-emerald-600 dark:text-emerald-400 bg-slate-50 dark:bg-slate-950 p-2 rounded">
                    {kpi.formula}
                  </td>
                  <td className="py-3 text-slate-600 dark:text-slate-400 font-mono text-[11px]">
                    {kpi.sourceReport}
                  </td>
                  <td className="py-3 text-[11px]">
                    <div className="font-bold text-teal-600 dark:text-teal-400">Target: {kpi.targetValue}</div>
                    <div className="text-[10px] text-amber-500">Warn: {kpi.warningThreshold}</div>
                    <div className="text-[10px] text-rose-500">Crit: {kpi.criticalThreshold}</div>
                  </td>
                  <td className="py-3 text-[10px] font-mono text-slate-500">
                    {kpi.dataLineage.join(" ➔ ")}
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
