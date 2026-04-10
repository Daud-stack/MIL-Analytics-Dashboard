'use client';

import React, { useState } from 'react';
import { Download, DollarSign, Beaker, AlertCircle, Activity, TrendingUp, ChevronDown, ChevronRight } from 'lucide-react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { StatCard } from '@/components/charts/stat-card';
import { Button } from '@/components/ui/button';
import { ChartTooltipProps, MONTHS } from '@/types';
import { formatCurrency, formatNumber, generateCSV, downloadCSV } from '@/lib/utils';
import { useDashboard } from '@/store';
import Link from 'next/link';

const MONTH_ABBR = MONTHS.map(m => m.substring(0, 3));

const CustomTooltip = ({ active, payload, label }: ChartTooltipProps) => {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-lg">
        <p className="text-sm font-medium text-gray-900">{label}</p>
        {payload.map((entry, index: number) => (
          <p key={index} style={{ color: entry.color }} className="text-sm">
            {entry.name}: {typeof entry.value === 'number' && String(entry.dataKey).toLowerCase().includes('rev')
              ? formatCurrency(Number(entry.value ?? 0))
              : formatNumber(Number(entry.value ?? 0))}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

// ── Collapsible Section Component ──
function Section({ title, defaultOpen = false, children }: { title: string; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between border-b border-gray-200 px-5 py-3 text-left hover:bg-gray-50 transition-colors"
      >
        <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
        {open ? <ChevronDown className="h-4 w-4 text-gray-500" /> : <ChevronRight className="h-4 w-4 text-gray-500" />}
      </button>
      {open && <div className="overflow-x-auto">{children}</div>}
    </div>
  );
}

// ── Monthly Data Table ──
function MonthlyTable({
  data,
  isCurrency = false,
  isPercentage = false,
}: {
  data: Record<string, number[]>;
  isCurrency?: boolean;
  isPercentage?: boolean;
}) {
  const entries = Object.entries(data).filter(([, vals]) => vals.some(v => v !== 0));
  if (entries.length === 0) return <p className="px-5 py-4 text-sm text-gray-400">No data available</p>;

  const fmt = (v: number) => {
    if (isCurrency) return formatCurrency(v);
    if (isPercentage) return v === 0 ? '-' : `${v.toFixed(1)}%`;
    return v === 0 ? '-' : formatNumber(v);
  };

  return (
    <table className="w-full text-xs">
      <thead className="border-b border-gray-200 bg-gray-50 sticky top-0">
        <tr>
          <th className="px-3 py-2 text-left font-semibold text-gray-900 min-w-[180px]">Item</th>
          {MONTH_ABBR.map(m => (
            <th key={m} className="px-2 py-2 text-right font-semibold text-gray-900 min-w-[70px]">{m}</th>
          ))}
          <th className="px-2 py-2 text-right font-semibold text-gray-900 bg-gray-100 min-w-[80px]">Total</th>
        </tr>
      </thead>
      <tbody>
        {entries.map(([name, vals]) => {
          const total = isPercentage
            ? vals.filter(v => v > 0).reduce((a, b) => a + b, 0) / Math.max(vals.filter(v => v > 0).length, 1)
            : vals.reduce((a, b) => a + b, 0);
          return (
            <tr key={name} className="border-b border-gray-100 hover:bg-gray-50">
              <td className="px-3 py-1.5 text-gray-900 font-medium whitespace-nowrap">{name}</td>
              {vals.map((v, i) => (
                <td key={i} className="px-2 py-1.5 text-right text-gray-700 tabular-nums">{fmt(v)}</td>
              ))}
              <td className="px-2 py-1.5 text-right font-semibold text-gray-900 bg-gray-50 tabular-nums">
                {isPercentage ? `${total.toFixed(1)}%` : isCurrency ? formatCurrency(total) : formatNumber(total)}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

// ── Single-Row Monthly Table (for single metrics like Theatre Cases) ──
function SingleRowTable({ label, values, isCurrency = false }: { label: string; values: number[]; isCurrency?: boolean }) {
  if (values.every(v => v === 0)) return null;
  return (
    <MonthlyTable
      data={{ [label]: values }}
      isCurrency={isCurrency}
    />
  );
}

export default function DashboardPage() {
  const dashData = useDashboard();

  // Empty state
  if (!dashData) {
    return (
      <div className="space-y-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Executive Dashboard</h1>
            <p className="mt-1 text-sm text-gray-500">Key performance indicators and metrics</p>
          </div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-12">
          <div className="flex flex-col items-center justify-center gap-4">
            <AlertCircle className="h-12 w-12 text-gray-400" />
            <div className="text-center">
              <h2 className="text-lg font-semibold text-gray-900">No data loaded yet</h2>
              <p className="mt-2 text-sm text-gray-500">Upload your Management Dashboard CSV to get started.</p>
              <Link href="/upload"><Button className="mt-4">Upload CSV</Button></Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Prepare chart data ──
  const revenueData = MONTHS.map((month, idx) => ({
    month: month.substring(0, 3),
    Revenue: dashData.monthRevenue[idx],
  }));

  const admissionsData = MONTHS.map((month, idx) => ({
    month: month.substring(0, 3),
    Casualty: dashData.admCasualty[idx],
    'Day Patient': dashData.admDay[idx],
    'In-Patient': dashData.admInpatient[idx],
    Laboratory: dashData.admLab[idx],
  }));

  const paymentsData = MONTHS.map((month, idx) => ({
    month: month.substring(0, 3),
    Deposits: dashData.payments.deposits[idx],
    Individual: dashData.payments.individual[idx],
    'Med Aid': dashData.payments.medAid[idx],
    Batched: dashData.payments.batched[idx],
  }));

  // ── KPI totals ──
  const totalRevenue = dashData.monthRevenue.reduce((a, b) => a + b, 0);
  const totalAdmissions = dashData.admCasualty.reduce((a, b) => a + b, 0) +
    dashData.admDay.reduce((a, b) => a + b, 0) +
    dashData.admInpatient.reduce((a, b) => a + b, 0) +
    dashData.admLab.reduce((a, b) => a + b, 0);
  const totalEpisodesFinalised = dashData.epsFinalised.reduce((a, b) => a + b, 0);
  const totalTheatreCases = dashData.theatreCases.reduce((a, b) => a + b, 0);
  const totalPrescriptions = dashData.pharmacyRx.reduce((a, b) => a + b, 0);
  const totalPayments =
    dashData.payments.deposits.reduce((a, b) => a + b, 0) +
    dashData.payments.individual.reduce((a, b) => a + b, 0) +
    dashData.payments.medAid.reduce((a, b) => a + b, 0) +
    dashData.payments.batched.reduce((a, b) => a + b, 0);

  const handleExport = () => {
    // Export raw columns as CSV
    const rows: Record<string, string>[] = [];
    const colNames = Object.keys(dashData.rawColumns || {});
    MONTHS.forEach((month, idx) => {
      const row: Record<string, string> = { Month: month };
      colNames.forEach(col => {
        row[col] = String(dashData.rawColumns?.[col]?.[idx] ?? 0);
      });
      rows.push(row);
    });
    if (rows.length > 0) {
      const csv = generateCSV(rows);
      downloadCSV(csv, `dashboard-export-${new Date().toISOString().split('T')[0]}.csv`);
    }
  };

  return (
    <div className="space-y-4 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Management Dashboard</h1>
          <p className="mt-1 text-sm text-gray-500">Complete reporting — all data displayed as-is from CSV</p>
        </div>
        <Button onClick={handleExport} variant="outline" size="sm" className="gap-2">
          <Download className="h-4 w-4" /> Export
        </Button>
      </div>

      {/* KPI Grid */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard title="Total Revenue" value={formatCurrency(totalRevenue)} trend="neutral" icon={DollarSign} color="green" />
        <StatCard title="Total Admissions" value={formatNumber(totalAdmissions)} trend="neutral" icon={Activity} color="blue" />
        <StatCard title="Episodes Finalised" value={formatNumber(totalEpisodesFinalised)} trend="neutral" icon={Beaker} color="purple" />
        <StatCard title="Theatre Cases" value={formatNumber(totalTheatreCases)} trend="neutral" icon={AlertCircle} color="amber" />
        <StatCard title="Prescriptions" value={formatNumber(totalPrescriptions)} trend="neutral" icon={TrendingUp} color="rose" />
        <StatCard title="Total Payments" value={formatCurrency(totalPayments)} trend="neutral" color="teal" />
      </div>

      {/* Charts Row */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Monthly Revenue Trend */}
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 px-5 py-3">
            <h2 className="text-sm font-semibold text-gray-900">Monthly Revenue Trend</h2>
          </div>
          <div className="px-5 pb-5">
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={revenueData}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0d9488" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#0d9488" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#f1f5f9" strokeDasharray="3 3" />
                <XAxis dataKey="month" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="Revenue" stroke="#0d9488" strokeWidth={2} fill="url(#colorRevenue)" dot={{ fill: '#0d9488', r: 3 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Monthly Admissions by Type */}
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 px-5 py-3">
            <h2 className="text-sm font-semibold text-gray-900">Monthly Admissions by Type</h2>
          </div>
          <div className="px-5 pb-5">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={admissionsData}>
                <CartesianGrid stroke="#f1f5f9" strokeDasharray="3 3" />
                <XAxis dataKey="month" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Bar dataKey="Casualty" fill="#0d9488" stackId="a" />
                <Bar dataKey="Day Patient" fill="#475569" stackId="a" />
                <Bar dataKey="In-Patient" fill="#d97706" stackId="a" />
                <Bar dataKey="Laboratory" fill="#7c3aed" stackId="a" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* ── DATA SECTIONS — displayed as-is from CSV ───────────── */}
      {/* ═══════════════════════════════════════════════════════════ */}

      {/* 1. Admissions */}
      <Section title="Admissions" defaultOpen={true}>
        <MonthlyTable data={{
          'CASUALTY PATIENT': dashData.admCasualty,
          'DAY PATIENT': dashData.admDay,
          'IN-PATIENT': dashData.admInpatient,
          'LABORATORY': dashData.admLab,
        }} />
      </Section>

      {/* 2. Admissions Per Ward */}
      {Object.keys(dashData.admPerWard).length > 0 && (
        <Section title="Admissions Per Ward">
          <MonthlyTable data={dashData.admPerWard} />
        </Section>
      )}

      {/* 3. Discharges */}
      {Object.keys(dashData.discharges).length > 0 && (
        <Section title="Discharges">
          <MonthlyTable data={dashData.discharges} />
        </Section>
      )}

      {/* 4. Discharges Per Ward */}
      {Object.keys(dashData.dischargesPerWard).length > 0 && (
        <Section title="Discharges Per Ward">
          <MonthlyTable data={dashData.dischargesPerWard} />
        </Section>
      )}

      {/* 5. Patients Transferred From Casualty To In Patient */}
      <Section title="Patients Transferred From Casualty To In-Patient">
        <SingleRowTable label="Transfers" values={dashData.casToInpatient} />
      </Section>

      {/* 6. Patients At Midday Per Ward */}
      {Object.keys(dashData.patientsAtMidday).length > 0 && (
        <Section title="Patients At Midday Per Ward">
          <MonthlyTable data={dashData.patientsAtMidday} />
        </Section>
      )}

      {/* 7. Patients At Midnight Per Ward */}
      {Object.keys(dashData.patientDays).length > 0 && (
        <Section title="Patients At Midnight Per Ward">
          <MonthlyTable data={dashData.patientDays} />
        </Section>
      )}

      {/* 8. Billed Patient Days Per Ward */}
      {Object.keys(dashData.billedPatDays).length > 0 && (
        <Section title="Billed Patient Days Per Ward">
          <MonthlyTable data={dashData.billedPatDays} />
        </Section>
      )}

      {/* 9. Patients Days Per Level Of Care */}
      {Object.keys(dashData.patDaysLOC).length > 0 && (
        <Section title="Patient Days Per Level Of Care">
          <MonthlyTable data={dashData.patDaysLOC} />
        </Section>
      )}

      {/* 10. Patients Days Per Ward */}
      {Object.keys(dashData.patDaysWard).length > 0 && (
        <Section title="Patient Days Per Ward">
          <MonthlyTable data={dashData.patDaysWard} />
        </Section>
      )}

      {/* 11. Percentage Occupancy Per Ward */}
      {Object.keys(dashData.pctOccWard).length > 0 && (
        <Section title="Percentage Occupancy Per Ward">
          <MonthlyTable data={dashData.pctOccWard} isPercentage />
        </Section>
      )}

      {/* 12. Theatre Statistics */}
      <Section title="Theatre Statistics">
        <MonthlyTable data={{
          'Theatre Cases': dashData.theatreCases,
          'Theatre Utilization (mins)': dashData.theatreMinutes,
          'Theatre % Occupancy': dashData.theatrePctOcc,
        }} />
      </Section>

      {/* 13. Pharmacy / Prescriptions */}
      <Section title="Pharmacy — Prescriptions Dispensed">
        <MonthlyTable data={{
          'Prescriptions - Hospital': dashData.prescriptionsHospital,
          'Prescriptions - Retail': dashData.prescriptionsRetail,
          'Revenue - Hospital': dashData.prescriptionsRevHospital,
          'Revenue - Retail': dashData.prescriptionsRevRetail,
        }} />
      </Section>

      {/* 14. Billing Statistics */}
      <Section title="Billing Statistics" defaultOpen={true}>
        <MonthlyTable data={{
          'Total Revenue': dashData.monthRevenue,
          'Revenue Per Patient Day': dashData.revPerPatDay,
        }} isCurrency />
      </Section>

      {/* 15. Revenue Per Stock Location */}
      {Object.keys(dashData.revLocation).length > 0 && (
        <Section title="Revenue Per Stock Location">
          <MonthlyTable data={dashData.revLocation} isCurrency />
        </Section>
      )}

      {/* 16. COS Per Stock Location */}
      {Object.keys(dashData.cosLocation).length > 0 && (
        <Section title="COS (Cost of Sales) Per Stock Location">
          <MonthlyTable data={dashData.cosLocation} isCurrency />
        </Section>
      )}

      {/* 17. GP % Ethical Stock */}
      {Object.keys(dashData.gpEthicalPerLoc).length > 0 && (
        <Section title="GP Percentage — Ethical Stock Items">
          <MonthlyTable data={dashData.gpEthicalPerLoc} isPercentage />
        </Section>
      )}

      {/* 18. GP % Surgical Stock */}
      {Object.keys(dashData.gpSurgicalPerLoc).length > 0 && (
        <Section title="GP Percentage — Surgical Stock Items">
          <MonthlyTable data={dashData.gpSurgicalPerLoc} isPercentage />
        </Section>
      )}

      {/* 19. Episodes & Discharges Not Finalised */}
      <Section title="Episodes Finalised / Discharges Not Finalised">
        <MonthlyTable data={{
          'Episodes Finalised': dashData.epsFinalised,
          'Discharges Not Finalised': dashData.dischNotFinalised,
          'Discharges Not Finalised Value': dashData.dischNotFinalisedValue,
        }} />
      </Section>

      {/* 20. Revenue Per Revenue Centre */}
      {Object.keys(dashData.revPerRevCentre).length > 0 && (
        <Section title="Revenue Per Revenue Centre">
          <MonthlyTable data={dashData.revPerRevCentre} isCurrency />
        </Section>
      )}

      {/* 21. Payments Per Day */}
      <Section title="Payments Per Day">
        <div className="grid gap-4 lg:grid-cols-2 p-4">
          <div>
            <MonthlyTable data={{
              'Deposits': dashData.payments.deposits,
              'Individual Payments': dashData.payments.individual,
              'Medical Aid Payments': dashData.payments.medAid,
              'Batched Payments': dashData.payments.batched,
            }} isCurrency />
          </div>
          <div className="flex items-center justify-center">
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={paymentsData}>
                <CartesianGrid stroke="#f1f5f9" strokeDasharray="3 3" />
                <XAxis dataKey="month" tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                <Bar dataKey="Deposits" fill="#0d9488" stackId="a" />
                <Bar dataKey="Individual" fill="#475569" stackId="a" />
                <Bar dataKey="Med Aid" fill="#d97706" stackId="a" />
                <Bar dataKey="Batched" fill="#e11d48" stackId="a" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </Section>

      {/* 22. Account Sundries */}
      <Section title="Account Sundries">
        <SingleRowTable label="Account Sundries" values={dashData.accountSundries} isCurrency />
      </Section>

      {/* 23. Debtors Reconciliation Per Day */}
      <Section title="Debtors Reconciliation Per Day">
        <MonthlyTable data={{
          'Balance Brought Forward': dashData.debtRecon.brought,
          'Revenue': dashData.debtRecon.revenue,
          'Payments': dashData.debtRecon.payments,
          'Sundries / SunList': dashData.debtRecon.sundries,
          'Closing Balance': dashData.debtRecon.total,
        }} isCurrency />
      </Section>

      {/* 24. Chargeable Items Transferred Per Location */}
      {Object.keys(dashData.chargeableItems).length > 0 && (
        <Section title="Chargeable Items Transferred Per Location">
          <MonthlyTable data={dashData.chargeableItems} isCurrency />
        </Section>
      )}

      {/* 25. Non Chargeable Items Transferred Per Location */}
      {Object.keys(dashData.nonChargeableItems).length > 0 && (
        <Section title="Non-Chargeable Items Transferred Per Location">
          <MonthlyTable data={dashData.nonChargeableItems} isCurrency />
        </Section>
      )}

      {/* 26. Stock Receipts */}
      {Object.keys(dashData.stockReceipts).length > 0 && (
        <Section title="Stock Receipts Per Location">
          <MonthlyTable data={dashData.stockReceipts} />
        </Section>
      )}

      {/* 27. Stock Receipts Value */}
      {Object.keys(dashData.stockReceiptsValue).length > 0 && (
        <Section title="Stock Receipts Value Per Location">
          <MonthlyTable data={dashData.stockReceiptsValue} isCurrency />
        </Section>
      )}

      {/* 28. Stock Receipts Discount */}
      {Object.keys(dashData.stockReceiptsDiscount).length > 0 && (
        <Section title="Stock Receipts Discount Per Location">
          <MonthlyTable data={dashData.stockReceiptsDiscount} isCurrency />
        </Section>
      )}
    </div>
  );
}
