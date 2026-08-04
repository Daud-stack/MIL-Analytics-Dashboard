"use client";

import React, { useState, useMemo } from "react";
import {
  DollarSign,
  Receipt,
  Tag,
  AlertTriangle,
  Users,
  Search,
  TrendingUp,
  ShieldAlert,
  Download,
  Filter,
  FileWarning,
  CheckCircle2,
} from "lucide-react";

import { StatCard } from "@/components/charts/stat-card";
import { ChartCard } from "@/components/dashboard/chart-card";
import { DataTable, ColumnConfig } from "@/components/dashboard/data-table";
import { DataHealthWidget } from "@/components/dashboard/data-health-widget";
import { formatCurrency, formatNumber } from "@/lib/utils";

// Official 12-Column Pricing/Billing Audit Record Structure (including Originator date)
export interface PricingAuditRecord {
  episode: string;
  patient: string;
  code: string;
  description: string;
  medicalAid: string;
  txDate: string;
  originatorDate: string;
  charged: number;
  tariff: number;
  deltaPerUnit: number;
  impact: number;
  type: "Overcharged" | "Undercharged" | "Unpriced" | "Compliant";
}

const PRICING_AUDIT_TRANSACTIONS: PricingAuditRecord[] = [
  {
    episode: "A24239:1",
    patient: "MAST HARVEY BRUK-JACKSON",
    code: "02003",
    description: "4.00 Nights @ USD 390.00 BED 1",
    medicalAid: "CIMAS USD",
    txDate: "2026-05-15",
    originatorDate: "2026-05-14 14:30",
    charged: 390.0,
    tariff: 300.0,
    deltaPerUnit: 90.0,
    impact: 360.0,
    type: "Overcharged",
  },
  {
    episode: "A24463:1",
    patient: "TINASHE MUTASA",
    code: "04300",
    description: "3.00 Nights @ USD 240.00 WARD 1 NORTH",
    medicalAid: "FIRST MUTUAL USD",
    txDate: "2026-06-02",
    originatorDate: "2026-06-01 09:15",
    charged: 240.0,
    tariff: 210.0,
    deltaPerUnit: 30.0,
    impact: 90.0,
    type: "Overcharged",
  },
  {
    episode: "A24524:1",
    patient: "BLESSING MAKOPE",
    code: "04495",
    description: "1.00 Item IV CANNULA INSERTION",
    medicalAid: "ALLIANCE HEALTH",
    txDate: "2026-06-10",
    originatorDate: "2026-06-09 22:45",
    charged: 18.5,
    tariff: 25.0,
    deltaPerUnit: -6.5,
    impact: -6.5,
    type: "Undercharged",
  },
  {
    episode: "A24550:1",
    patient: "CHIPO CHIKWANHA",
    code: "33333",
    description: "2.00 Packs SURGICAL PACK KIT",
    medicalAid: "CIMAS USD",
    txDate: "2026-06-14",
    originatorDate: "2026-06-13 11:20",
    charged: 150.0,
    tariff: 120.0,
    deltaPerUnit: 30.0,
    impact: 60.0,
    type: "Overcharged",
  },
  {
    episode: "A24595:1",
    patient: "FARAI MOYO",
    code: "04315",
    description: "5.00 Hours ICU NURSING ATTENDANCE",
    medicalAid: "FBC HEALTH",
    txDate: "2026-06-18",
    originatorDate: "2026-06-17 16:00",
    charged: 85.0,
    tariff: 85.0,
    deltaPerUnit: 0.0,
    impact: 0.0,
    type: "Compliant",
  },
  {
    episode: "A24633:1",
    patient: "TENDAI NYATHI",
    code: "99001",
    description: "1.00 Unit UNPRICED EMERGENCY CONSUMABLE",
    medicalAid: "FLIMAS USD",
    txDate: "2026-06-22",
    originatorDate: "2026-06-21 08:30",
    charged: 0.0,
    tariff: 45.0,
    deltaPerUnit: -45.0,
    impact: -45.0,
    type: "Unpriced",
  },
  {
    episode: "A24701:1",
    patient: "KUDZAI CHIPATO",
    code: "05012",
    description: "1.00 Procedure ULTRASOUND ABDOMEN",
    medicalAid: "BONVIE MEDICAL",
    txDate: "2026-06-25",
    originatorDate: "2026-06-24 13:10",
    charged: 120.0,
    tariff: 100.0,
    deltaPerUnit: 20.0,
    impact: 20.0,
    type: "Overcharged",
  },
  {
    episode: "A24788:1",
    patient: "RUVARASHE ZVOBGO",
    code: "02005",
    description: "2.00 Nights @ USD 420.00 ICU BED",
    medicalAid: "CIMAS USD",
    txDate: "2026-07-01",
    originatorDate: "2026-06-30 19:40",
    charged: 420.0,
    tariff: 380.0,
    deltaPerUnit: 40.0,
    impact: 80.0,
    type: "Overcharged",
  },
];

export default function BillingAuditPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedType, setSelectedType] = useState<string>("All");

  const filteredRecords = useMemo(() => {
    return PRICING_AUDIT_TRANSACTIONS.filter((row) => {
      const matchesType = selectedType === "All" || row.type === selectedType;
      const matchesSearch =
        row.episode.toLowerCase().includes(searchTerm.toLowerCase()) ||
        row.patient.toLowerCase().includes(searchTerm.toLowerCase()) ||
        row.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        row.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        row.medicalAid.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesType && matchesSearch;
    });
  }, [selectedType, searchTerm]);

  // Aggregate Audit Statistics
  const stats = useMemo(() => {
    const totalCharged = PRICING_AUDIT_TRANSACTIONS.reduce((acc, curr) => acc + curr.charged, 0);
    const totalTariff = PRICING_AUDIT_TRANSACTIONS.reduce((acc, curr) => acc + curr.tariff, 0);
    const netImpact = PRICING_AUDIT_TRANSACTIONS.reduce((acc, curr) => acc + curr.impact, 0);
    const overchargedCount = PRICING_AUDIT_TRANSACTIONS.filter((t) => t.type === "Overcharged").length;
    const underchargedCount = PRICING_AUDIT_TRANSACTIONS.filter((t) => t.type === "Undercharged").length;
    const unpricedCount = PRICING_AUDIT_TRANSACTIONS.filter((t) => t.type === "Unpriced").length;

    return {
      totalCharged,
      totalTariff,
      netImpact,
      overchargedCount,
      underchargedCount,
      unpricedCount,
    };
  }, []);

  // Explicit 12-Column DataTable Configuration (including Originator date)
  const columns: ColumnConfig[] = [
    { key: "episode", header: "Episode", sortable: true },
    { key: "patient", header: "Patient", sortable: true },
    { key: "code", header: "Code", sortable: true },
    { key: "description", header: "Description", sortable: true },
    { key: "medicalAid", header: "Medical Aid", sortable: true },
    { key: "txDate", header: "Tx date", sortable: true },
    { key: "originatorDate", header: "Originator date", sortable: true },
    {
      key: "charged",
      header: "Charged",
      sortable: true,
      align: "right",
      format: (val) => formatCurrency(Number(val)),
    },
    {
      key: "tariff",
      header: "Tariff",
      sortable: true,
      align: "right",
      format: (val) => formatCurrency(Number(val)),
    },
    {
      key: "deltaPerUnit",
      header: "Δ / unit",
      sortable: true,
      align: "right",
      format: (val) => {
        const num = Number(val);
        const prefix = num > 0 ? "+" : "";
        return `${prefix}${formatCurrency(num)}`;
      },
    },
    {
      key: "impact",
      header: "Impact",
      sortable: true,
      align: "right",
      format: (val) => {
        const num = Number(val);
        const prefix = num > 0 ? "+" : "";
        return `${prefix}${formatCurrency(num)}`;
      },
    },
    {
      key: "type",
      header: "Type",
      sortable: true,
      align: "center",
      format: (val) => {
        const typeStr = String(val);
        let colorClasses = "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300";
        if (typeStr === "Overcharged") colorClasses = "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300 font-bold";
        if (typeStr === "Undercharged") colorClasses = "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300 font-bold";
        if (typeStr === "Unpriced") colorClasses = "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300 font-bold";
        if (typeStr === "Compliant") colorClasses = "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300";
        return `<span class="px-2.5 py-0.5 rounded-full text-[10px] ${colorClasses}">${typeStr}</span>`;
      },
    },
  ];

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200/80 dark:border-slate-800/80 pb-4">
        <div>
          <h1 className="font-heading text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2.5">
            <Receipt className="h-7 w-7 text-teal-500 shrink-0" />
            Pricing & Billing Audit Specification
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Official 12-column line item pricing audit (Episode, Patient, Code, Description, Medical Aid, Tx date, Originator date, Charged, Tariff, Δ / unit, Impact, Type).
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search episode or patient..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-48 sm:w-64 rounded-lg border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900/80 pl-9 pr-3 py-1.5 text-xs font-semibold text-slate-900 dark:text-slate-100 focus:border-teal-500 focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* Data Health & Validation Layer */}
      <DataHealthWidget />

      {/* Audit KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Billed Charged Amount"
          value={formatCurrency(stats.totalCharged)}
          subtitle="Sum of line item billings"
          icon={DollarSign}
          color="teal"
          trend="up"
        />
        <StatCard
          title="Tariff Master Benchmark Value"
          value={formatCurrency(stats.totalTariff)}
          subtitle="Expected master tariff cost"
          icon={Tag}
          color="blue"
          trend="neutral"
        />
        <StatCard
          title="Net Variance Revenue Impact"
          value={`+${formatCurrency(stats.netImpact)}`}
          subtitle="Net pricing overcharge delta"
          icon={TrendingUp}
          color="rose"
          change={12.4}
          trend="up"
        />
        <StatCard
          title="Unpriced & Variance Line Items"
          value={formatNumber(stats.overchargedCount + stats.unpricedCount)}
          subtitle="Lines requiring tariff correction"
          icon={ShieldAlert}
          color="amber"
          trend="down"
        />
      </div>

      {/* Type Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
        {["All", "Overcharged", "Undercharged", "Unpriced", "Compliant"].map((type) => (
          <button
            key={type}
            onClick={() => setSelectedType(type)}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
              selectedType === type
                ? "bg-teal-500 text-white shadow-sm"
                : "bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
            }`}
          >
            {type}
          </button>
        ))}
      </div>

      {/* Official 12-Column Pricing & Billing Audit Ledger Table */}
      <ChartCard
        title="Official 12-Column Pricing & Tariff Audit Ledger"
        subtitle="Itemized audit comparison with Originator date: Charged vs Master Tariff Rate"
      >
        <DataTable
          columns={columns}
          data={filteredRecords as unknown as Record<string, unknown>[]}
          searchable={false}
          exportable={true}
          pageSize={10}
        />
      </ChartCard>
    </div>
  );
}
