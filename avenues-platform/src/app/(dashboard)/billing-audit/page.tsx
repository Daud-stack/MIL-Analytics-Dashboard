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
} from "lucide-react";

import { StatCard } from "@/components/charts/stat-card";
import { ChartCard } from "@/components/dashboard/chart-card";
import { DataTable, ColumnConfig } from "@/components/dashboard/data-table";

// Sample / Mock Tariff Master Data for Initial Rendering
const MOCK_TARIFFS = [
  { code: "USD RATE", tariffCode: "T1001", description: "General Consultation & Assessment", baseBefore: 50.0, baseAfter: 55.0, unitBefore: 1.0, unitAfter: 1.1 },
  { code: "ALLIANCE USD", tariffCode: "T1002", description: "Specialist Physician Consultation", baseBefore: 90.0, baseAfter: 105.0, unitBefore: 1.0, unitAfter: 1.2 },
  { code: "CIMAS BLOOD", tariffCode: "T2005", description: "Full Blood Count (FBC) Lab Test", baseBefore: 35.0, baseAfter: 42.0, unitBefore: 0.8, unitAfter: 1.0 },
  { code: "FMLPRE", tariffCode: "T3010", description: "Major Surgical Operating Theatre Per Hour", baseBefore: 450.0, baseAfter: 520.0, unitBefore: 4.5, unitAfter: 5.2 },
  { code: "RTGS$", tariffCode: "T4022", description: "Pharmacy Antibiotic Dispensing Fee", baseBefore: 15.0, baseAfter: 18.5, unitBefore: 0.5, unitAfter: 0.6 },
  { code: "USD RATE", tariffCode: "T1008", description: "Casualty Emergency Attendance", baseBefore: 75.0, baseAfter: 85.0, unitBefore: 1.5, unitAfter: 1.7 },
  { code: "ALLIANCE USD", tariffCode: "T2015", description: "X-Ray Chest PA View", baseBefore: 60.0, baseAfter: 68.0, unitBefore: 1.0, unitAfter: 1.1 },
];

// Sample / Mock User Billing Transactions for Initial Rendering
const MOCK_BILLING_TRANSACTIONS = [
  { user: "abigail", episode: "A24463:1", item: "04300", description: "Ward Room Daily Charge", type: "Debit", cancelled: "No", location: "Main Ward B", amount: 240.0, cost: 35.0 },
  { user: "abigail", episode: "A24524:1", item: "04495", description: "IV Cannula Insertion", type: "Debit", cancelled: "No", location: "Casualty Emergency", amount: 18.5, cost: 3.2 },
  { user: "blessing", episode: "A24550:1", item: "33333", description: "Surgical Pack Kit", type: "Debit", cancelled: "Yes", location: "Theatre 1", amount: 150.0, cost: 45.0 },
  { user: "blessing", episode: "A24595:1", item: "04315", description: "Nursing Attendance Fee", type: "Debit", cancelled: "No", location: "ICU Unit", amount: 85.0, cost: 12.0 },
  { user: "charles", episode: "A24610:1", item: "10022", description: "Paracetamol IV Infusion", type: "Debit", cancelled: "No", location: "Pharmacy Retail", amount: 12.0, cost: 1.5 },
  { user: "charles", episode: "A24633:1", item: "99001", description: "Unpriced Consumable Line", type: "Debit", cancelled: "No", location: "Pharmacy Store", amount: 0.0, cost: 8.0 },
  { user: "david", episode: "A24701:1", item: "05012", description: "Ultrasound Abdomen Scan", type: "Debit", cancelled: "No", location: "Radiology", amount: 120.0, cost: 22.0 },
];

export default function BillingAuditPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState<"audit" | "tariffs" | "capturers">("audit");

  // Summaries & Calculations
  const stats = useMemo(() => {
    const totalBilled = MOCK_BILLING_TRANSACTIONS.reduce((acc, curr) => acc + curr.amount, 0);
    const totalCost = MOCK_BILLING_TRANSACTIONS.reduce((acc, curr) => acc + curr.cost, 0);
    const margin = totalBilled - totalCost;
    const marginPct = totalBilled > 0 ? (margin / totalBilled) * 100 : 0;
    const zeroBilled = MOCK_BILLING_TRANSACTIONS.filter((t) => t.amount === 0).length;
    const cancelledCount = MOCK_BILLING_TRANSACTIONS.filter((t) => t.cancelled === "Yes").length;
    const uniqueUsers = new Set(MOCK_BILLING_TRANSACTIONS.map((t) => t.user)).size;

    return {
      totalBilled,
      totalCost,
      margin,
      marginPct,
      zeroBilled,
      cancelledCount,
      uniqueUsers,
    };
  }, []);

  // Filtered transactions
  const filteredBilling = useMemo(() => {
    if (!searchTerm) return MOCK_BILLING_TRANSACTIONS;
    const term = searchTerm.toLowerCase();
    return MOCK_BILLING_TRANSACTIONS.filter(
      (t) =>
        t.user.toLowerCase().includes(term) ||
        t.episode.toLowerCase().includes(term) ||
        t.description.toLowerCase().includes(term) ||
        t.location.toLowerCase().includes(term)
    );
  }, [searchTerm]);

  // Capturer summary ranking
  const capturerRank = useMemo(() => {
    const map: Record<string, { user: string; billed: number; cost: number; count: number; cancelled: number }> = {};
    for (const item of MOCK_BILLING_TRANSACTIONS) {
      if (!map[item.user]) {
        map[item.user] = { user: item.user, billed: 0, cost: 0, count: 0, cancelled: 0 };
      }
      map[item.user].billed += item.amount;
      map[item.user].cost += item.cost;
      map[item.user].count += 1;
      if (item.cancelled === "Yes") map[item.user].cancelled += 1;
    }
    return Object.values(map).sort((a, b) => b.billed - a.billed);
  }, []);

  // Table Columns
  const billingColumns: ColumnConfig[] = [
    { key: "user", header: "Capturer User", sortable: true },
    { key: "episode", header: "Episode Number", sortable: true },
    { key: "item", header: "Item Code", sortable: true },
    { key: "description", header: "Description", sortable: true },
    { key: "location", header: "Billed Location", sortable: true },
    {
      key: "amount",
      header: "Billed Amount",
      sortable: true,
      align: "right",
      format: (val) => `$${Number(val).toFixed(2)}`,
    },
    {
      key: "cost",
      header: "Average Cost",
      sortable: true,
      align: "right",
      format: (val) => `$${Number(val).toFixed(2)}`,
    },
    {
      key: "cancelled",
      header: "Cancelled",
      sortable: true,
      align: "center",
    },
  ];

  const tariffColumns: ColumnConfig[] = [
    { key: "code", header: "Billing Group Code", sortable: true },
    { key: "tariffCode", header: "Tariff Code", sortable: true },
    { key: "description", header: "Tariff Description", sortable: true },
    {
      key: "baseBefore",
      header: "Base Rate (Before)",
      sortable: true,
      align: "right",
      format: (val) => `$${Number(val).toFixed(2)}`,
    },
    {
      key: "baseAfter",
      header: "Base Rate (After)",
      sortable: true,
      align: "right",
      format: (val) => `$${Number(val).toFixed(2)}`,
    },
    {
      key: "unitAfter",
      header: "Unit Rate",
      sortable: true,
      align: "right",
      format: (val) => `${Number(val).toFixed(2)}`,
    },
  ];

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Page Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200/80 dark:border-slate-800/80 pb-4">
        <div>
          <h1 className="font-heading text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2.5">
            <Receipt className="h-7 w-7 text-teal-500 shrink-0" />
            Billing & Pricing Audit
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Revenue assurance, tariff rate variance checks, and capturer productivity audit.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Filter audit logs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-48 sm:w-64 rounded-lg border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900/80 pl-9 pr-3 py-1.5 text-xs font-semibold text-slate-900 dark:text-slate-100 focus:border-teal-500 focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Billed Revenue"
          value={`$${stats.totalBilled.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
          subtitle="Billed across all locations"
          icon={DollarSign}
          color="teal"
          change={12.4}
          trend="up"
        />
        <StatCard
          title="Gross Profit Margin"
          value={`${stats.marginPct.toFixed(1)}%`}
          subtitle={`$${stats.margin.toLocaleString(undefined, { minimumFractionDigits: 2 })} net margin`}
          icon={TrendingUp}
          color="emerald"
          change={4.2}
          trend="up"
        />
        <StatCard
          title="Zero-Billed Items"
          value={stats.zeroBilled.toString()}
          subtitle="Unpriced line items audit"
          icon={ShieldAlert}
          color="amber"
          trend="neutral"
        />
        <StatCard
          title="Active Billing Capturers"
          value={stats.uniqueUsers.toString()}
          subtitle="Cashiers & billing staff"
          icon={Users}
          color="blue"
          trend="neutral"
        />
      </div>

      {/* Audit View Subtabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab("audit")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
            activeTab === "audit"
              ? "bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/30"
              : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
        >
          <Receipt className="h-4 w-4" />
          <span>Billing Transactions Audit</span>
        </button>
        <button
          onClick={() => setActiveTab("capturers")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
            activeTab === "capturers"
              ? "bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/30"
              : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
        >
          <Users className="h-4 w-4" />
          <span>Capturer Productivity</span>
        </button>
        <button
          onClick={() => setActiveTab("tariffs")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
            activeTab === "tariffs"
              ? "bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/30"
              : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
        >
          <Tag className="h-4 w-4" />
          <span>Tariff Rates Master</span>
        </button>
      </div>

      {/* TAB CONTENT: BILLING TRANSACTIONS */}
      {activeTab === "audit" && (
        <div className="space-y-6">
          <ChartCard title="User Billing Transactions Audit Log" subtitle="Line item level inspection with cost margin tracking">
            <DataTable columns={billingColumns} data={filteredBilling} searchable={false} exportable={true} pageSize={10} />
          </ChartCard>
        </div>
      )}

      {/* TAB CONTENT: CAPTURERS */}
      {activeTab === "capturers" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ChartCard title="Capturer Revenue Ranking ($)" subtitle="Revenue captured per billing user">
            <div className="space-y-3 pt-2">
              {capturerRank.map((c, i) => (
                <div key={c.user} className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-800">
                  <div className="flex items-center gap-3">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-teal-500/10 text-teal-600 dark:text-teal-400 text-xs font-bold">
                      #{i + 1}
                    </span>
                    <div>
                      <p className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase">{c.user}</p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">{c.count} line items billed</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-slate-900 dark:text-slate-100">${c.billed.toFixed(2)}</p>
                    <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">${(c.billed - c.cost).toFixed(2)} margin</p>
                  </div>
                </div>
              ))}
            </div>
          </ChartCard>

          <ChartCard title="Cancellation Risk by User" subtitle="Capturers with cancelled line items">
            <div className="space-y-3 pt-2">
              {capturerRank.map((c) => (
                <div key={c.user} className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-800">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-amber-500/10 text-amber-500">
                      <AlertTriangle className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase">{c.user}</p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">Total lines: {c.count}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${
                      c.cancelled > 0 ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/30" : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                    }`}>
                      {c.cancelled} Cancelled
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </ChartCard>
        </div>
      )}

      {/* TAB CONTENT: TARIFF RATES MASTER */}
      {activeTab === "tariffs" && (
        <div className="space-y-6">
          <ChartCard title="Tariff Master Catalog & Rate Revisions" subtitle="Base Rate Before vs Base Rate After rate variance tracking">
            <DataTable columns={tariffColumns} data={MOCK_TARIFFS} searchable={false} exportable={true} pageSize={10} />
          </ChartCard>
        </div>
      )}
    </div>
  );
}
