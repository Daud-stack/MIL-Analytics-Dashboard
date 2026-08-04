"use client";

import React, { useState, useMemo } from "react";
import {
  BarChart3,
  TrendingUp,
  AlertTriangle,
  DollarSign,
  Users,
  Activity,
  BedDouble,
  Pill,
  Scissors,
  FileWarning,
  ShieldCheck,
  Search,
  Download,
  Filter,
  FlaskConical,
  Store,
  Clock,
} from "lucide-react";
import { StatCard } from "@/components/charts/stat-card";
import { ChartCard } from "@/components/dashboard/chart-card";
import { DataTable, ColumnConfig } from "@/components/dashboard/data-table";

interface KPIDefinition {
  metric: string;
  category: "Hospital Ops" | "Revenue Breakdown" | "Revenue Assurance" | "Retail & Lab";
  value2026: string;
  reportSource: string;
  status: "Target Met" | "Gap Identified" | "Under Audit" | "Optimal";
  auditNotes: string;
}

const DASHBOARD_KPIS_2026_MASTER: KPIDefinition[] = [
  // 1. Hospital Operations
  { metric: "Occupancy Rate (%)", category: "Hospital Ops", value2026: "68.4%", reportSource: "Management Dashboard - Occupancy", status: "Optimal", auditNotes: "Target 65%-75% maintained across In-Patient wards" },
  { metric: "In-Patient Admissions", category: "Hospital Ops", value2026: "7,749 Patients", reportSource: "Admissions Stats Monthly", status: "Target Met", auditNotes: "Main Ward 1 & 3 driving primary admissions" },
  { metric: "Casualty Emergency Cases", category: "Hospital Ops", value2026: "8,974 Patients", reportSource: "Admissions Stats Monthly", status: "Target Met", auditNotes: "Casualty attendance 53.6% of total hospital intake" },
  { metric: "Casualty Conversion Rate (%)", category: "Hospital Ops", value2026: "14.2%", reportSource: "Admission Register & Per User", status: "Under Audit", auditNotes: "Conversion from C-number to A-number inpatient admission" },
  { metric: "Billed Bed Days", category: "Hospital Ops", value2026: "16,488 Days", reportSource: "Billed Patient Days Per Ward", status: "Optimal", auditNotes: "Two-Bedded & General Ward 3-5 Beds primary drivers" },
  { metric: "Theatre Operating Cases", category: "Hospital Ops", value2026: "1,894 Cases", reportSource: "Theatre Usage Report Monthly", status: "Target Met", auditNotes: "Major & minor surgical procedures combined" },
  { metric: "Theatre Utilisation Rate (%)", category: "Hospital Ops", value2026: "72.4%", reportSource: "Theatre Usage Report Monthly", status: "Optimal", auditNotes: "Operating theatre hours utilization" },
  { metric: "Pharmacy Prescriptions Dispensed", category: "Hospital Ops", value2026: "26,400 Rx", reportSource: "Management Dashboard - Pharmacy", status: "Target Met", auditNotes: "Hospital & Retail pharmacy combined dispensations" },

  // 2. Revenue Breakdown
  { metric: "Total Billed Revenue", category: "Revenue Breakdown", value2026: "$7,813,491.14", reportSource: "Monthly Income By Revenue Centre", status: "Target Met", auditNotes: "Gross revenue captured across all departments" },
  { metric: "Bed Fees Income", category: "Revenue Breakdown", value2026: "$2,810,544.97", reportSource: "Monthly Income - Bed Fees", status: "Target Met", auditNotes: "Ward 1 North & Ward 3 North top contributors" },
  { metric: "Theatre & Recovery Fees", category: "Revenue Breakdown", value2026: "$1,894,007.68", reportSource: "Monthly Income - Theatre", status: "Target Met", auditNotes: "Theatre time ($779.5k), stocks ($545.1k), fees ($299.2k)" },
  { metric: "Pharmacy Revenue", category: "Revenue Breakdown", value2026: "$2,164,145.98", reportSource: "PHARMACY Stock Location", status: "Target Met", auditNotes: "Ethical & surgical drug dispensing revenue" },
  { metric: "Casualty Other Fees", category: "Revenue Breakdown", value2026: "$491,842.84", reportSource: "CASUALTY OTHER FEES", status: "Optimal", auditNotes: "Emergency attendance & procedure fees" },
  { metric: "Labour Ward Revenue", category: "Revenue Breakdown", value2026: "$93,604.34", reportSource: "LABOUR WARD OTHER FEES & STOCKS", status: "Optimal", auditNotes: "Maternity & labour ward delivery fees" },
  { metric: "St Clements Chemotherapy", category: "Revenue Breakdown", value2026: "$109,837.22", reportSource: "Pick all ST CLEMENTS", status: "Optimal", auditNotes: "Oncology & chemotherapy day cases" },
  { metric: "Individual Cash Payments", category: "Revenue Breakdown", value2026: "$7,283,326.31", reportSource: "All Payments And Deposits Received", status: "Target Met", auditNotes: "Direct cash, card & POS collections" },
  { metric: "Medical Aid Fund Payments", category: "Revenue Breakdown", value2026: "$1,062,924.74", reportSource: "Medical Aid Income Report", status: "Under Audit", auditNotes: "CIMAS, Alliance, FML funder settlements" },

  // 3. Revenue Assurance & Leakage
  { metric: "Unfinalised Bills (DNFB) Value", category: "Revenue Assurance", value2026: "$10,101,658.28", reportSource: "Management Dashboard - Billing Stats", status: "Gap Identified", auditNotes: "89,325 unfinalised discharge statements requiring SLA speedup" },
  { metric: "Cancelled Transactions Value", category: "Revenue Assurance", value2026: "$182,497.46", reportSource: "Cancellations All Report", status: "Under Audit", auditNotes: "Line item billing cancellations audit" },
  { metric: "Average Capture Delay", category: "Revenue Assurance", value2026: "3.4 Days", reportSource: "Billing By User (Detail)", status: "Optimal", auditNotes: "Time elapsed from service to cashier billing capture" },
  { metric: "Max Capture Delay SLA", category: "Revenue Assurance", value2026: "14.0 Days", reportSource: "Billing By User (Detail)", status: "Gap Identified", auditNotes: "Outlier delayed billings past 14-day threshold" },
  { metric: "Cash Discharged Outstanding Debt", category: "Revenue Assurance", value2026: "$239,915.38", reportSource: "Release and Discharged Report", status: "Gap Identified", auditNotes: "Cash patients released before settling balance" },
  { metric: "Patient Refunds Issued", category: "Revenue Assurance", value2026: "$182,497.46", reportSource: "Credit Aged Analysis - Refunds", status: "Under Audit", auditNotes: "Overpayment refund audit" },
  { metric: "Inventory Stock Valuation", category: "Revenue Assurance", value2026: "$1,578,777.46", reportSource: "Stock Valuation Monthly", status: "Optimal", auditNotes: "Main stores, Mezzanine & CSSD valuation" },
  { metric: "Shortfall Collection Rate", category: "Revenue Assurance", value2026: "88.2%", reportSource: "All Payments & Deposits Received", status: "Target Met", auditNotes: "Co-payment & shortfall recovery at discharge" },
];

export default function KPIs2026MasterPage() {
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [searchTerm, setSearchQuery] = useState<string>("");

  const filteredKPIs = useMemo(() => {
    return DASHBOARD_KPIS_2026_MASTER.filter((kpi) => {
      const matchesCat = selectedCategory === "All" || kpi.category === selectedCategory;
      const matchesSearch =
        kpi.metric.toLowerCase().includes(searchTerm.toLowerCase()) ||
        kpi.reportSource.toLowerCase().includes(searchTerm.toLowerCase()) ||
        kpi.auditNotes.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesCat && matchesSearch;
    });
  }, [selectedCategory, searchTerm]);

  const columns: ColumnConfig[] = [
    { key: "metric", header: "KPI Metric Name", sortable: true },
    { key: "category", header: "Category", sortable: true },
    { key: "value2026", header: "2026 Billed Value / Metric", sortable: true, align: "right" },
    { key: "reportSource", header: "Report Source File", sortable: true },
    {
      key: "status",
      header: "Audit Status",
      sortable: true,
      align: "center",
      format: (val) => String(val),
    },
    { key: "auditNotes", header: "Audit & Operational Notes", sortable: true },
  ];

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200/80 dark:border-slate-800/80 pb-4">
        <div>
          <h1 className="font-heading text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2.5">
            <BarChart3 className="h-7 w-7 text-teal-500 shrink-0" />
            Dashboard KPIs 2026 Master Specification
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Authoritative executive metric requirements extracted from 'Dashboard KPIs 2026.xlsx'.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search 2026 KPIs..."
              value={searchTerm}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-48 sm:w-64 rounded-lg border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900/80 pl-9 pr-3 py-1.5 text-xs font-semibold text-slate-900 dark:text-slate-100 focus:border-teal-500 focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Billed Revenue 2026"
          value="$7,813,491.14"
          subtitle="Monthly Income Grand Total"
          icon={DollarSign}
          color="teal"
          change={14.8}
          trend="up"
        />
        <StatCard
          title="DNFB Revenue Gap (2026)"
          value="$10,101,658.28"
          subtitle="89,325 unfinalised episodes"
          icon={FileWarning}
          color="rose"
          change={-8.4}
          trend="down"
        />
        <StatCard
          title="Theatre & Surgery Revenue"
          value="$1,894,007.68"
          subtitle="1,894 surgical procedures"
          icon={Scissors}
          color="blue"
          trend="neutral"
        />
        <StatCard
          title="Pharmacy Revenue 2026"
          value="$2,164,145.98"
          subtitle="Hospital & Retail dispensary"
          icon={Pill}
          color="emerald"
          change={6.2}
          trend="up"
        />
      </div>

      {/* Category Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2 overflow-x-auto">
        {["All", "Hospital Ops", "Revenue Breakdown", "Revenue Assurance"].map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              selectedCategory === cat
                ? "bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/30"
                : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* KPI Ledger Table */}
      <ChartCard title="2026 Executive KPI Specification Ledger" subtitle="Full audit ledger of metrics mapped from source reports">
        <DataTable
          columns={columns}
          data={filteredKPIs as unknown as Record<string, unknown>[]}
          searchable={false}
          exportable={true}
          pageSize={10}
        />
      </ChartCard>
    </div>
  );
}
