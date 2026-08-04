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
  PieChart,
} from "lucide-react";
import { StatCard } from "@/components/charts/stat-card";
import { ChartCard } from "@/components/dashboard/chart-card";
import { DataTable, ColumnConfig } from "@/components/dashboard/data-table";

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
  { id: "kpi-1-1", module: "Executive Dashboard", moduleNum: 1, metric: "Total Billed Revenue (2026)", value2026: "$7,813,491.14", reportSource: "Monthly Income By Revenue Centre (Grand Total)", status: "Target Met", auditNotes: "Gross revenue captured across all hospital & clinical operations" },
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
  { id: "kpi-3-3", module: "Revenue Assurance", moduleNum: 3, metric: "Undercharges & Overcharges Audit", value2026: "$42,150.00", reportSource: "Revenue Assurance Audit Log", status: "Under Audit", auditNotes: "Tariff master variance audit between Chiron & machine logs" },

  // Module 4: Detailed Billing
  { id: "kpi-4-1", module: "Detailed Billing", moduleNum: 4, metric: "Average Capture Days", value2026: "3.4 Days", reportSource: "Billing By User (Detail)", status: "Optimal", auditNotes: "Mean duration from clinical service delivery to cashier billing" },
  { id: "kpi-4-2", module: "Detailed Billing", moduleNum: 4, metric: "Average Maximum Capture Delay", value2026: "14.0 Days", reportSource: "Billing By User (Detail)", status: "Gap Identified", auditNotes: "Outlier delayed billings requiring capturer performance review" },
  { id: "kpi-4-3", module: "Detailed Billing", moduleNum: 4, metric: "Capturer Billed Line Items", value2026: "45,820 Items", reportSource: "User Billing Detail Report", status: "Target Met", auditNotes: "Total itemized billing entries processed by staff" },

  // Module 5: Full Age Analysis
  { id: "kpi-5-1", module: "Full Age Analysis", moduleNum: 5, metric: "Debtors Balance Brought Forward", value2026: "-$10,079,270.55", reportSource: "Credit Aged Analysis", status: "Under Audit", auditNotes: "Historical cumulative debtors balance carried into 2026" },
  { id: "kpi-5-2", module: "Full Age Analysis", moduleNum: 5, metric: "Stagnant Debt (150+ Days)", value2026: "$4,215,800.00", reportSource: "Credit Aged Analysis (150+ Days)", status: "Gap Identified", auditNotes: "Debt >150 days incurring 15% annual opportunity interest loss ($632.3k)" },

  // Module 6: Accounts not finalized
  { id: "kpi-6-1", module: "Accounts not finalized", moduleNum: 6, metric: "Unfinalised Bills (DNFB) Value", value2026: "$10,101,658.28", reportSource: "Management Dashboard - Billing Statistics", status: "Gap Identified", auditNotes: "89,325 unfinalised discharge statements locked before billing release" },
  { id: "kpi-6-2", module: "Accounts not finalized", moduleNum: 6, metric: "Discharges Not Finalised Volume", value2026: "89,325 Episodes", reportSource: "Management Dashboard - Billing Statistics", status: "Gap Identified", auditNotes: "Target SLA reduction from 15+ days down to 0-3 days to release $10.1M" },

  // Module 7: All Payments
  { id: "kpi-7-1", module: "All Payments", moduleNum: 7, metric: "Individual Direct Payments", value2026: "$7,283,326.31", reportSource: "All Payments And Deposits Received", status: "Target Met", auditNotes: "Direct cash, card & POS collections" },
  { id: "kpi-7-2", module: "All Payments", moduleNum: 7, metric: "Medical Aid Fund Payments", value2026: "$1,062,924.74", reportSource: "Medical Aid Income Report", status: "Under Audit", auditNotes: "CIMAS, Alliance, FML funder settlements" },
  { id: "kpi-7-3", module: "All Payments", moduleNum: 7, metric: "Patient Advance Deposits Received", value2026: "$450,279.46", reportSource: "All Payments And Deposits Received", status: "Optimal", auditNotes: "Pre-admission & procedure deposits" },
  { id: "kpi-7-4", module: "All Payments", moduleNum: 7, metric: "Account Sundries & Adjustments", value2026: "$183,722.14", reportSource: "Debtors Reconciliation", status: "Optimal", auditNotes: "Account adjustments and sundries reconciled" },

  // Module 8: Mnagament Accounts MANAC
  { id: "kpi-8-1", module: "Mnagament Accounts MANAC", moduleNum: 8, metric: "Revenue Per Patient Day", value2026: "$3,420.60", reportSource: "Management Dashboard - Revenue Per Patient Day", status: "Optimal", auditNotes: "Average daily yield per occupied bed" },
  { id: "kpi-8-2", module: "Mnagament Accounts MANAC", moduleNum: 8, metric: "GP % Ethical Stock Items", value2026: "42.5%", reportSource: "Management Dashboard - GP Percentage", status: "Optimal", auditNotes: "Gross profit margin on ethical pharmaceuticals" },
  { id: "kpi-8-3", module: "Mnagament Accounts MANAC", moduleNum: 8, metric: "GP % Surgical Stock Items", value2026: "38.2%", reportSource: "Management Dashboard - GP Percentage", status: "Optimal", auditNotes: "Gross profit margin on surgical consumables" },

  // Module 9: Revenue Center
  { id: "kpi-9-1", module: "Revenue Center", moduleNum: 9, metric: "Bed Fees Income (Wards)", value2026: "$2,810,544.97", reportSource: "Monthly Income - Bed Fees", status: "Target Met", auditNotes: "Ward 1 North ($532.6k), Ward 1 South ($466.8k), Ward 3 North ($446.9k)" },
  { id: "kpi-9-2", module: "Revenue Center", moduleNum: 9, metric: "Theatre & Surgery Income", value2026: "$1,894,007.68", reportSource: "Monthly Income - Theatre", status: "Target Met", auditNotes: "Theatre time ($779.6k), stocks ($545.1k), fees ($299.2k)" },
  { id: "kpi-9-3", module: "Revenue Center", moduleNum: 9, metric: "Pharmacy Department Revenue", value2026: "$2,164,145.98", reportSource: "PHARMACY Stock Location", status: "Target Met", auditNotes: "Main dispensary & ward stock allocations" },
  { id: "kpi-9-4", module: "Revenue Center", moduleNum: 9, metric: "Casualty Revenue", value2026: "$491,842.84", reportSource: "CASUALTY OTHER FEES", status: "Optimal", auditNotes: "Emergency attendance & doctor fee allocations" },
  { id: "kpi-9-5", module: "Revenue Center", moduleNum: 9, metric: "St Clements Chemotherapy", value2026: "$109,837.22", reportSource: "Pick all ST CLEMENTS", status: "Optimal", auditNotes: "Oncology & day clinic chemotherapy revenue" },

  // Module 10: Stock Valuation
  { id: "kpi-10-1", module: "Stock Valuation", moduleNum: 10, metric: "Main Stores Inventory Value", value2026: "$816,624.58", reportSource: "Stock Valuation Monthly", status: "Optimal", auditNotes: "Central medical store inventory valuation" },
  { id: "kpi-10-2", module: "Stock Valuation", moduleNum: 10, metric: "Mezzanine Floor Stock Value", value2026: "$762,152.88", reportSource: "Stock Valuation Monthly", status: "Optimal", auditNotes: "Sub-store & ward distribution stock" },
  { id: "kpi-10-3", module: "Stock Valuation", moduleNum: 10, metric: "CSSD Sterilization Stock", value2026: "$32,772.93", reportSource: "Stock Valuation Monthly", status: "Optimal", auditNotes: "Central Sterile Services Department inventory" },
  { id: "kpi-10-4", module: "Stock Valuation", moduleNum: 10, metric: "Total Inventory Valuation", value2026: "$1,578,777.46", reportSource: "Stock Valuation Monthly", status: "Optimal", auditNotes: "Combined inventory assets across all hospital locations" },
];

const MODULE_ICONS: Record<ModuleType, React.ComponentType<{ className?: string }>> = {
  "Executive Dashboard": LayoutDashboard,
  "MD Dashboard": Activity,
  "Revenue Assurance": ShieldCheck,
  "Detailed Billing": Receipt,
  "Full Age Analysis": CreditCard,
  "Accounts not finalized": FileWarning,
  "All Payments": WalletIcon,
  "Mnagament Accounts MANAC": PieChart,
  "Revenue Center": Building2,
  "Stock Valuation": Package,
};

function WalletIcon(props: { className?: string }) {
  return <DollarSign {...props} />;
}

function LayoutDashboard(props: { className?: string }) {
  return <BarChart3 {...props} />;
}

export default function KPIs2026OfficialModulesPage() {
  const [selectedModule, setSelectedModule] = useState<string>("All");
  const [searchTerm, setSearchQuery] = useState<string>("");

  const modulesList: ModuleType[] = [
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
            <Layers className="h-7 w-7 text-teal-500 shrink-0" />
            2026 Official 10-Module KPI Matrix
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Authoritative executive specification organized by the 10 core modules in 'Dashboard KPIs 2026.xlsx'.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search across 10 modules..."
              value={searchTerm}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-48 sm:w-64 rounded-lg border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900/80 pl-9 pr-3 py-1.5 text-xs font-semibold text-slate-900 dark:text-slate-100 focus:border-teal-500 focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* Top 4 Core Stat Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Mod 1: Executive Revenue"
          value="$7,813,491.14"
          subtitle="Monthly Income Grand Total"
          icon={DollarSign}
          color="teal"
          change={14.8}
          trend="up"
        />
        <StatCard
          title="Mod 6: Accounts Not Finalized (DNFB)"
          value="$10,101,658.28"
          subtitle="89,325 unfinalised episodes"
          icon={FileWarning}
          color="rose"
          change={-8.4}
          trend="down"
        />
        <StatCard
          title="Mod 9: Revenue Center Income"
          value="$7,470,378.69"
          subtitle="Beds, Theatre, Pharmacy & Casualty"
          icon={Building2}
          color="blue"
          trend="neutral"
        />
        <StatCard
          title="Mod 10: Total Inventory Valuation"
          value="$1,578,777.46"
          subtitle="Main Stores, Mezzanine & CSSD"
          icon={Package}
          color="emerald"
          change={5.2}
          trend="up"
        />
      </div>

      {/* 10 Module Selector Grid / Tabs */}
      <div className="space-y-2">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Filter by Official Module (1 to 10)
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
          {modulesList.map((modName, idx) => {
            const IconComp = MODULE_ICONS[modName] || Layers;
            const isSelected = selectedModule === modName;
            return (
              <button
                key={modName}
                onClick={() => setSelectedModule(modName)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  isSelected
                    ? "bg-teal-500 text-white shadow-sm"
                    : "bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                }`}
              >
                <IconComp className="h-3.5 w-3.5" />
                <span>Mod {idx + 1}: {modName}</span>
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
