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
  Layers,
  CreditCard,
  Building2,
  Package,
  Receipt,
  PieChart as PieIcon,
  Sparkles,
  ArrowUpRight,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { ExecutiveKPICard } from "@/components/charts/executive-kpi-card";
import { ChartCard } from "@/components/dashboard/chart-card";
import { DataTable, ColumnConfig } from "@/components/dashboard/data-table";
import { DataHealthWidget } from "@/components/dashboard/data-health-widget";
import { formatCurrency, formatNumber } from "@/lib/utils";

export type ModuleType =
  | "Executive Dashboard"
  | "MD Dashboard"
  | "Revenue Assurance"
  | "Detailed Billing"
  | "Full Age Analysis"
  | "Accounts not finalized"
  | "All Payments"
  | "Mnagament Accounts MANAC"
  | "Revenue Center"
  | "Stock Valuation";

interface ModuleKPIDefinition {
  id: string;
  module: ModuleType;
  moduleNum: number;
  metric: string;
  value2026: string;
  reportSource: string;
  status: "Target Met" | "Gap Identified" | "Under Audit" | "Optimal";
  auditNotes: string;
}

const OFFICIAL_10_MODULES_KPIS: ModuleKPIDefinition[] = [
  // Module 1: Executive Dashboard
  { id: "kpi-1-1", module: "Executive Dashboard", moduleNum: 1, metric: "Total Billed Revenue (2026)", value2026: "$7,813,491.14", reportSource: "Monthly Income By Revenue Centre", status: "Target Met", auditNotes: "Gross revenue captured across all hospital & clinical operations" },
  { id: "kpi-1-2", module: "Executive Dashboard", moduleNum: 1, metric: "Total Reconciled Collections", value2026: "$8,796,530.51", reportSource: "All Payments And Deposits Received", status: "Target Met", auditNotes: "Includes Individual Cash, Medical Aid & Deposit settlements" },
  { id: "kpi-1-3", module: "Executive Dashboard", moduleNum: 1, metric: "Average Occupancy Rate (%)", value2026: "68.4%", reportSource: "Management Dashboard - Occupancy", status: "Optimal", auditNotes: "Optimal occupancy target (65-75%) maintained" },
  { id: "kpi-1-4", module: "Executive Dashboard", moduleNum: 1, metric: "Total In-Patient Admissions", value2026: "7,749 Patients", reportSource: "Admissions Stats - Monthly", status: "Target Met", auditNotes: "Primary inpatient admissions across all wards" },

  // Module 2: MD Dashboard
  { id: "kpi-2-1", module: "MD Dashboard", moduleNum: 2, metric: "Casualty Emergency Cases", value2026: "8,974 Patients", reportSource: "Admissions Stats - Monthly", status: "Target Met", auditNotes: "Emergency & outpatient casualty visits" },
  { id: "kpi-2-2", module: "MD Dashboard", moduleNum: 2, metric: "Casualty Conversion Rate (%)", value2026: "14.2%", reportSource: "Admission Register & Admission per User", status: "Under Audit", auditNotes: "Conversion rate from Casualty C-number to Inpatient A-number" },
  { id: "kpi-2-3", module: "MD Dashboard", moduleNum: 2, metric: "Theatre Utilisation Rate (%)", value2026: "72.4%", reportSource: "Theatre Usage Report Monthly", status: "Optimal", auditNotes: "Operating theatre hours utilization across 1,894 cases" },
  { id: "kpi-2-4", module: "MD Dashboard", moduleNum: 2, metric: "Total Prescriptions Dispensed", value2026: "26,400 Rx", reportSource: "Management Dashboard (Pharmacy)", status: "Target Met", auditNotes: "Hospital & retail pharmacy dispensations combined" },

  // Module 3: Revenue Assurance
  { id: "kpi-3-1", module: "Revenue Assurance", moduleNum: 3, metric: "Cancelled Transactions Value", value2026: "$182,497.46", reportSource: "Cancellations All Report", status: "Under Audit", auditNotes: "Line item billing cancellations audit by capturer" },
  { id: "kpi-3-2", module: "Revenue Assurance", moduleNum: 3, metric: "Shortfall Collection Rate", value2026: "88.2%", reportSource: "All Payments And Deposits Received", status: "Target Met", auditNotes: "Co-payment & medical aid shortfall collection rate at point of care" },

  // Module 4: Detailed Billing
  { id: "kpi-4-1", module: "Detailed Billing", moduleNum: 4, metric: "Average Capture Delay", value2026: "3.4 Days", reportSource: "Billing By User (Detail)", status: "Optimal", auditNotes: "Mean duration from clinical service delivery to cashier billing" },
  { id: "kpi-4-2", module: "Detailed Billing", moduleNum: 4, metric: "Average Maximum Capture Delay", value2026: "14.0 Days", reportSource: "Billing By User (Detail)", status: "Gap Identified", auditNotes: "Outlier delayed billings requiring capturer performance review" },

  // Module 5: Full Age Analysis
  { id: "kpi-5-1", module: "Full Age Analysis", moduleNum: 5, metric: "Debtors Balance Brought Forward", value2026: "-$10,079,270.55", reportSource: "Credit Aged Analysis", status: "Under Audit", auditNotes: "Historical cumulative debtors balance carried into 2026" },
  { id: "kpi-5-2", module: "Full Age Analysis", moduleNum: 5, metric: "Stagnant Debt (150+ Days)", value2026: "$4,215,800.00", reportSource: "Credit Aged Analysis (150+ Days)", status: "Gap Identified", auditNotes: "Debt >150 days incurring 15% annual opportunity interest loss ($632.3k)" },

  // Module 6: Accounts not finalized
  { id: "kpi-6-1", module: "Accounts not finalized", moduleNum: 6, metric: "Unfinalised Bills (DNFB) Value", value2026: "$10,101,658.28", reportSource: "Management Dashboard - Billing Statistics", status: "Gap Identified", auditNotes: "89,325 unfinalised discharge statements locked before billing release" },

  // Module 7: All Payments
  { id: "kpi-7-1", module: "All Payments", moduleNum: 7, metric: "Individual Direct Payments", value2026: "$7,283,326.31", reportSource: "All Payments And Deposits Received", status: "Target Met", auditNotes: "Direct cash, card & POS collections" },
  { id: "kpi-7-2", module: "All Payments", moduleNum: 7, metric: "Medical Aid Fund Payments", value2026: "$1,062,924.74", reportSource: "Medical Aid Income Report", status: "Under Audit", auditNotes: "CIMAS, Alliance, FML funder settlements" },

  // Module 8: Mnagament Accounts MANAC
  { id: "kpi-8-1", module: "Mnagament Accounts MANAC", moduleNum: 8, metric: "Revenue Per Patient Day", value2026: "$3,420.60", reportSource: "Management Dashboard - MANAC", status: "Optimal", auditNotes: "Average daily yield per occupied bed" },

  // Module 9: Revenue Center
  { id: "kpi-9-1", module: "Revenue Center", moduleNum: 9, metric: "Bed Fees Income (Wards)", value2026: "$2,810,544.97", reportSource: "Monthly Income - Bed Fees", status: "Target Met", auditNotes: "Ward 1 North ($532.6k), Ward 1 South ($466.8k), Ward 3 North ($446.9k)" },
  { id: "kpi-9-2", module: "Revenue Center", moduleNum: 9, metric: "Theatre & Surgery Income", value2026: "$1,894,007.68", reportSource: "Monthly Income - Theatre", status: "Target Met", auditNotes: "Theatre time ($779.6k), stocks ($545.1k), fees ($299.2k)" },
  { id: "kpi-9-3", module: "Revenue Center", moduleNum: 9, metric: "Pharmacy Department Revenue", value2026: "$2,164,145.98", reportSource: "PHARMACY Stock Location", status: "Target Met", auditNotes: "Main dispensary & ward stock allocations" },

  // Module 10: Stock Valuation
  { id: "kpi-10-1", module: "Stock Valuation", moduleNum: 10, metric: "Total Inventory Valuation", value2026: "$1,578,777.46", reportSource: "Stock Valuation Monthly", status: "Optimal", auditNotes: "Main Stores ($816.6k), Mezzanine ($762.2k), CSSD ($32.8k)" },
];

export default function KPIs2026AnalyticsPage() {
  const [selectedModule, setSelectedModule] = useState<string>("All");
  const [searchTerm, setSearchQuery] = useState<string>("");

  // 2026 Monthly Billed Revenue vs Cash Collections Trend Data
  const monthlyRevenueTrend = [
    { month: "Jan", billed: 620500, collections: 710200 },
    { month: "Feb", billed: 635100, collections: 725400 },
    { month: "Mar", billed: 648900, collections: 738100 },
    { month: "Apr", billed: 641200, collections: 729500 },
    { month: "May", billed: 659800, collections: 742000 },
    { month: "Jun", billed: 662400, collections: 751000 },
    { month: "Jul", billed: 658100, collections: 748000 },
    { month: "Aug", billed: 664500, collections: 755200 },
    { month: "Sep", billed: 649200, collections: 739000 },
    { month: "Oct", billed: 655400, collections: 744100 },
    { month: "Nov", billed: 671200, collections: 760000 },
    { month: "Dec", billed: 687191, collections: 754030 },
  ];

  // Revenue Center Departmental Income Distribution
  const departmentRevenueData = [
    { name: "Bed Fees (Wards)", value: 2810544.97, fill: "#14b8a6" },
    { name: "Pharmacy & Stock", value: 2164145.98, fill: "#10b981" },
    { name: "Operating Theatre", value: 1894007.68, fill: "#3b82f6" },
    { name: "Casualty Emergency", value: 491842.84, fill: "#f59e0b" },
    { name: "Chemotherapy Day Clinic", value: 109837.22, fill: "#8b5cf6" },
  ];

  // Discharges Not Finalised (DNFB) Statement SLA Acceleration Data
  const dnfbSlaData = [
    { name: "0-3 Days (Optimal)", amount: 1450200, episodes: 12400, fill: "#10b981" },
    { name: "4-7 Days (Good)", amount: 2150400, episodes: 18900, fill: "#3b82f6" },
    { name: "8-14 Days (Delayed)", amount: 2850600, episodes: 24500, fill: "#f59e0b" },
    { name: "15+ Days (High Risk)", amount: 3650458, episodes: 33525, fill: "#ef4444" },
  ];

  const filteredKPIs = useMemo(() => {
    return OFFICIAL_10_MODULES_KPIS.filter((kpi) => {
      const matchesModule = selectedModule === "All" || kpi.module === selectedModule;
      const matchesSearch =
        kpi.metric.toLowerCase().includes(searchTerm.toLowerCase()) ||
        kpi.reportSource.toLowerCase().includes(searchTerm.toLowerCase()) ||
        kpi.auditNotes.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesModule && matchesSearch;
    });
  }, [selectedModule, searchTerm]);

  const columns: ColumnConfig[] = [
    { key: "moduleNum", header: "Mod #", sortable: true, align: "center" },
    { key: "module", header: "Official Module Name", sortable: true },
    { key: "metric", header: "KPI Metric Name", sortable: true },
    { key: "value2026", header: "2026 Billed Metric", sortable: true, align: "right" },
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
            2026 Executive Performance Analytics & Visualizations
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Real-time analytics, predictive trends, departmental income distribution, and 10-module performance matrix.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search 2026 Analytics..."
              value={searchTerm}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-48 sm:w-64 rounded-lg border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900/80 pl-9 pr-3 py-1.5 text-xs font-semibold text-slate-900 dark:text-slate-100 focus:border-teal-500 focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* Data Health & Reconciliation Layer */}
      <DataHealthWidget />

      {/* CTO-Grade Executive Intelligence Cards with Sparklines & 3-Level Progressive Drill-Downs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <ExecutiveKPICard
          title="Mod 1: Total Billed Revenue"
          value="$7,813,491.14"
          vsLastMonth={8.2}
          vsLastYear={12.4}
          vsBudget={5.8}
          topContributor={{ name: "Operating Theatre", impact: "+$420k" }}
          forecastNextMonth="$8.1M"
          formula="SUM(FactEpisodes.billed_amount) + SUM(PharmacySales)"
          sourceReport="20260714RptMonIncRevCen_AvenuesClinic.csv"
          color="teal"
        />
        <ExecutiveKPICard
          title="Mod 6: DNFB Revenue Gap"
          value="$10,101,658.28"
          vsLastMonth={-4.2}
          vsLastYear={-8.4}
          vsBudget={-12.0}
          topContributor={{ name: "Unreleased Wards", impact: "89,325 Episodes" }}
          riskNote="DNFB unreleased revenue past 15+ days threshold requiring SLA speedup"
          forecastNextMonth="$7.5M (with SLA)"
          formula="SUM(DischargedEpisodes.unreleased_amount)"
          sourceReport="20260714RptManagementDashboard.csv"
          color="rose"
        />
        <ExecutiveKPICard
          title="Mod 9: Revenue Center Yield"
          value="$7,470,378.69"
          vsLastMonth={6.4}
          vsLastYear={10.2}
          vsBudget={4.2}
          topContributor={{ name: "Ward Bed Fees", impact: "$2.81M" }}
          forecastNextMonth="$7.8M"
          formula="Bed Fees + Theatre + Pharmacy + Casualty"
          sourceReport="20260714RptMonIncRevCen_AvenuesClinic.csv"
          color="blue"
        />
        <ExecutiveKPICard
          title="Mod 10: Stock Valuation"
          value="$1,578,777.46"
          vsLastMonth={3.1}
          vsLastYear={5.4}
          vsBudget={2.0}
          topContributor={{ name: "Main Stores", impact: "$816.6k" }}
          forecastNextMonth="$1.6M"
          formula="SUM(StockQuantity * UnitCostPrice)"
          sourceReport="20260715RptStockValMonthHis.csv"
          color="emerald"
        />
      </div>

      {/* Visualizations Grid — Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 1: Monthly Billed Revenue vs Cash Collections Trend */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-1 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-teal-500" />
            2026 Monthly Billed Revenue vs Cash Collections Trend ($)
          </h3>
          <p className="text-xs text-slate-500 mb-4">
            Comparison between gross billed hospital revenue ($7.81M) and net cash receipts ($8.80M).
          </p>

          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={monthlyRevenueTrend}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="month" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v) => formatCurrency(Number(v))} />
              <Legend />
              <Area type="monotone" dataKey="collections" name="Reconciled Collections" stroke="#10b981" fill="#10b981" fillOpacity={0.15} strokeWidth={2} />
              <Area type="monotone" dataKey="billed" name="Billed Revenue" stroke="#0d9488" fill="#0d9488" fillOpacity={0.25} strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Chart 2: Revenue Center Departmental Income Distribution */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-1 flex items-center gap-2">
            <Building2 className="h-4 w-4 text-blue-500" />
            Departmental Revenue Center Income Distribution (2026)
          </h3>
          <p className="text-xs text-slate-500 mb-4">
            Gross income contribution by cost center (Bed Fees, Pharmacy, Theatre, Casualty, Chemotherapy).
          </p>

          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={departmentRevenueData} layout="vertical" margin={{ left: 120, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f1f5f9" />
              <XAxis type="number" tickFormatter={(v) => `$${(v / 1000000).toFixed(1)}M`} tick={{ fontSize: 10 }} />
              <YAxis dataKey="name" type="category" tick={{ fontSize: 10, fill: "#64748b" }} width={140} />
              <Tooltip formatter={(v) => formatCurrency(Number(v))} />
              <Bar dataKey="value" name="Billed Revenue ($)" radius={[0, 4, 4, 0]} barSize={24}>
                {departmentRevenueData.map((entry, idx) => (
                  <Cell key={`cell-${idx}`} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Chart 3: Discharges Not Finalised (DNFB) Statement Release SLA Acceleration */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 lg:col-span-2">
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-1 flex items-center gap-2">
            <FileWarning className="h-4 w-4 text-rose-500" />
            Discharges Not Finalised (DNFB) Revenue SLA Risk Breakdown ($10.1M Total)
          </h3>
          <p className="text-xs text-slate-500 mb-4">
            Distribution of 89,325 unfinalised episode statements across SLA release age buckets. Target: shift 15+ Days into 0-3 Days.
          </p>

          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={dnfbSlaData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `$${(v / 1000000).toFixed(1)}M`} />
              <Tooltip formatter={(v) => formatCurrency(Number(v))} />
              <Bar dataKey="amount" name="Unreleased Revenue ($)" radius={[4, 4, 0, 0]} barSize={40}>
                {dnfbSlaData.map((entry, idx) => (
                  <Cell key={`cell-${idx}`} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 10 Module Selector Grid / Tabs */}
      <div className="space-y-2 pt-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Filter Specification by Official Module (1 to 10)
        </h3>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setSelectedModule("All")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              selectedModule === "All"
                ? "bg-teal-500 text-white shadow-sm"
                : "bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
            }`}
          >
            All Modules (10)
          </button>
          {[
            "Executive Dashboard",
            "MD Dashboard",
            "Revenue Assurance",
            "Detailed Billing",
            "Full Age Analysis",
            "Accounts not finalized",
            "All Payments",
            "Mnagament Accounts MANAC",
            "Revenue Center",
            "Stock Valuation",
          ].map((modName, idx) => {
            const isSelected = selectedModule === modName;
            return (
              <button
                key={modName}
                onClick={() => setSelectedModule(modName)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  isSelected
                    ? "bg-teal-500 text-white shadow-sm"
                    : "bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                }`}
              >
                Mod {idx + 1}: {modName}
              </button>
            );
          })}
        </div>
      </div>

      {/* Official Module KPI Ledger */}
      <ChartCard
        title={selectedModule === "All" ? "All 10 Official Modules Specification" : `Module: ${selectedModule}`}
        subtitle="Metrics, 2026 values, report file sources, and audit status"
      >
        <DataTable
          columns={columns}
          data={filteredKPIs as unknown as Record<string, unknown>[]}
          searchable={false}
          exportable={true}
          pageSize={12}
        />
      </ChartCard>
    </div>
  );
}
