'use client';

import React, { useMemo, useState } from 'react';
import { ChevronLeft, Upload } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { Button } from '@/components/ui/button';
import { ChartTooltipProps, MONTHS } from '@/types';
import { formatCurrency, formatNumber } from '@/lib/utils';
import { useCurrentYear, useYears } from '@/store';

type DrillLevel = 'year' | 'specialty' | 'doctor' | 'medAid';
type Metric = 'episodes' | 'revenue' | 'patients';

interface DrillState {
  level: DrillLevel;
  selectedYear?: number;
  selectedSpecialty?: string;
  selectedDoctor?: string;
  selectedMedAid?: string;
}

interface ChartDataPoint {
  id: string;
  name: string;
  episodes: number;
  revenue: number;
  patients: number;
  zScore: number;
  [key: string]: string | number;
}

interface AggregatedPoint {
  id: string;
  name: string;
  episodes: number;
  revenue: number;
  patients: number;
  zScore: number;
  patientKeys: Set<string>;
}

interface NormalizedLocRow {
  specialty: string;
  doctor: string;
  medAid: string;
  patientKey: string;
  monthIndex: number;
  revenue: number;
}

const LEVEL_LABELS: Record<DrillLevel, string> = {
  year: 'Specialty',
  specialty: 'Doctor',
  doctor: 'Medical Aid',
  medAid: 'Month',
};

function calculateZScore(value: number, arr: number[]): number {
  if (arr.length === 0) return 0;
  const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
  const variance = arr.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / arr.length;
  const stdDev = Math.sqrt(variance);
  return stdDev === 0 ? 0 : (value - mean) / stdDev;
}

function normalizeHeader(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function getField(row: Record<string, unknown>, candidates: string[]): string {
  const normalizedCandidates = candidates.map(normalizeHeader);
  for (const [key, value] of Object.entries(row)) {
    const normalizedKey = normalizeHeader(key);
    if (normalizedCandidates.some((candidate) => normalizedKey.includes(candidate))) {
      return value == null ? '' : String(value).trim();
    }
  }
  return '';
}

function parseNumber(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (value == null) return 0;
  const parsed = Number(String(value).replace(/[,$\s]/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

function getRevenue(row: Record<string, unknown>): number {
  for (const [key, value] of Object.entries(row)) {
    if (normalizeHeader(key) === 'total') return parseNumber(value);
  }
  return parseNumber(getField(row, ['revenue', 'amount', 'value']));
}

function parseMonthIndex(value: string): number {
  if (!value) return -1;

  const dmy = value.match(/(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (dmy) {
    const first = Number(dmy[1]);
    const second = Number(dmy[2]);
    if (first > 12) return second - 1;
    if (second > 12) return first - 1;
    return second - 1;
  }

  const iso = value.match(/(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);
  if (iso) return Number(iso[2]) - 1;

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? -1 : parsed.getMonth();
}

function toNormalizedRows(rows: Record<string, unknown>[]): NormalizedLocRow[] {
  return rows.map((row, index) => {
    const episode = getField(row, ['episode']);
    const patient = getField(row, ['patient name', 'patient']);
    const patientKey = patient || episode || `row-${index}`;
    const admDate = getField(row, ['adm date', 'admission date', 'admit date']);

    return {
      specialty: getField(row, ['doctor specialty', 'specialty', 'speciality']) || 'Unknown',
      doctor: getField(row, ['doctor name', 'doctor', 'provider']) || 'Unknown',
      medAid: getField(row, ['medical aid', 'medical aid scheme', 'med aid scheme', 'scheme']) || 'Unknown',
      patientKey,
      monthIndex: parseMonthIndex(admDate),
      revenue: getRevenue(row),
    };
  });
}

function withZScores(rows: ChartDataPoint[], metric: Metric): ChartDataPoint[] {
  const values = rows.map((row) => row[metric] as number);
  return rows.map((row) => ({
    ...row,
    zScore: calculateZScore(row[metric] as number, values),
  }));
}

function aggregateRows(
  rows: NormalizedLocRow[],
  getGroup: (row: NormalizedLocRow) => { id: string; name: string } | null,
  metric: Metric,
): ChartDataPoint[] {
  const grouped = new Map<string, AggregatedPoint>();

  for (const row of rows) {
    const group = getGroup(row);
    if (!group) continue;

    const current = grouped.get(group.id) ?? {
      id: group.id,
      name: group.name,
      episodes: 0,
      revenue: 0,
      patients: 0,
      zScore: 0,
      patientKeys: new Set<string>(),
    };

    current.episodes += 1;
    current.revenue += row.revenue;
    current.patientKeys.add(row.patientKey);
    current.patients = current.patientKeys.size;
    grouped.set(group.id, current);
  }

  return withZScores(
    Array.from(grouped.values())
      .map(({ patientKeys: _patientKeys, ...row }) => row)
      .sort((a, b) => (b[metric] as number) - (a[metric] as number)),
    metric,
  );
}

const CustomTooltip = ({ active, payload }: ChartTooltipProps<ChartDataPoint>) => {
  if (active && payload && payload.length) {
    const row = payload[0].payload;
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-lg">
        <p className="text-sm font-medium text-gray-900">{row?.name}</p>
        <p className="text-sm text-gray-600">Episodes: {formatNumber(row?.episodes ?? 0)}</p>
        <p className="text-sm text-gray-600">Revenue: {formatCurrency(row?.revenue ?? 0)}</p>
        <p className="text-sm text-gray-600">Patients: {formatNumber(row?.patients ?? 0)}</p>
      </div>
    );
  }
  return null;
};

export default function DrilldownPage() {
  const currentYearValue = useCurrentYear();
  const years = useYears();
  const [drillState, setDrillState] = useState<DrillState>({ level: 'year' });
  const [metric, setMetric] = useState<Metric>('episodes');

  const currentYear = drillState.selectedYear ?? currentYearValue;
  const yearData = years.get(currentYear);
  const locData = yearData?.location ?? yearData?.loc ?? null;
  const yearOptions = useMemo(() => {
    const values = Array.from(years.keys()).sort((a, b) => b - a);
    return values.length > 0 ? values : [currentYearValue];
  }, [currentYearValue, years]);

  const normalizedRows = useMemo(
    () => toNormalizedRows(locData?.rawRows ?? []),
    [locData?.rawRows],
  );
  const hasRawRows = normalizedRows.length > 0;

  const chartData = useMemo<ChartDataPoint[]>(() => {
    if (!locData) return [];

    if (drillState.level === 'year') {
      if (hasRawRows) {
        return aggregateRows(
          normalizedRows,
          (row) => ({ id: row.specialty, name: row.specialty }),
          metric,
        );
      }

      const grouped = new Map<string, ChartDataPoint>();
      for (const doc of locData.doctors) {
        const specialty = doc.specialty || 'Unknown';
        const current = grouped.get(specialty) ?? {
          id: specialty,
          name: specialty,
          episodes: 0,
          revenue: 0,
          patients: 0,
          zScore: 0,
        };
        current.episodes += doc.episodes;
        current.revenue += doc.revenue;
        current.patients += doc.patients;
        grouped.set(specialty, current);
      }
      return withZScores(
        Array.from(grouped.values()).sort((a, b) => (b[metric] as number) - (a[metric] as number)),
        metric,
      );
    }

    if (drillState.level === 'specialty') {
      const specialty = drillState.selectedSpecialty;
      if (!specialty) return [];

      if (hasRawRows) {
        return aggregateRows(
          normalizedRows.filter((row) => row.specialty === specialty),
          (row) => ({ id: row.doctor, name: row.doctor }),
          metric,
        );
      }

      return withZScores(
        locData.doctors
          .filter((doc) => (doc.specialty || 'Unknown') === specialty)
          .map((doc) => ({
            id: doc.name,
            name: doc.name,
            episodes: doc.episodes,
            revenue: doc.revenue,
            patients: doc.patients,
            zScore: 0,
          }))
          .sort((a, b) => (b[metric] as number) - (a[metric] as number)),
        metric,
      );
    }

    if (drillState.level === 'doctor') {
      const specialty = drillState.selectedSpecialty;
      const doctor = drillState.selectedDoctor;
      if (!specialty || !doctor || !hasRawRows) return [];

      return aggregateRows(
        normalizedRows.filter((row) => row.specialty === specialty && row.doctor === doctor),
        (row) => ({ id: row.medAid, name: row.medAid }),
        metric,
      );
    }

    const specialty = drillState.selectedSpecialty;
    const doctor = drillState.selectedDoctor;
    const medAid = drillState.selectedMedAid;
    if (!specialty || !doctor || !medAid || !hasRawRows) return [];

    return aggregateRows(
      normalizedRows.filter(
        (row) =>
          row.specialty === specialty &&
          row.doctor === doctor &&
          row.medAid === medAid &&
          row.monthIndex >= 0 &&
          row.monthIndex < 12,
      ),
      (row) => ({ id: String(row.monthIndex), name: MONTHS[row.monthIndex].slice(0, 3) }),
      metric,
    ).sort((a, b) => Number(a.id) - Number(b.id));
  }, [drillState, hasRawRows, locData, metric, normalizedRows]);

  const summaryStats = useMemo(() => {
    if (chartData.length === 0) return { total: 0, avg: 0, max: 0, min: 0 };
    const values = chartData.map((d) => d[metric] as number);
    const total = values.reduce((a, b) => a + b, 0);
    return {
      total,
      avg: total / values.length,
      max: Math.max(...values),
      min: Math.min(...values),
    };
  }, [chartData, metric]);

  if (!locData) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <div className="rounded-xl border border-gray-200 bg-white p-12 shadow-sm max-w-md">
          <Upload className="h-12 w-12 text-slate-300 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-slate-800 mb-2">No Location Data Loaded</h2>
          <p className="text-slate-500 mb-6">Upload your LOC CSV file to use the drill-down explorer.</p>
          <a href="/upload" className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 transition-colors">
            Go to Upload
          </a>
        </div>
      </div>
    );
  }

  const handleDrill = (row: ChartDataPoint) => {
    if (drillState.level === 'year') {
      setDrillState({
        level: 'specialty',
        selectedYear: currentYear,
        selectedSpecialty: row.id,
      });
      return;
    }

    if (drillState.level === 'specialty') {
      setDrillState({
        level: 'doctor',
        selectedYear: currentYear,
        selectedSpecialty: drillState.selectedSpecialty,
        selectedDoctor: row.id,
      });
      return;
    }

    if (drillState.level === 'doctor') {
      setDrillState({
        level: 'medAid',
        selectedYear: currentYear,
        selectedSpecialty: drillState.selectedSpecialty,
        selectedDoctor: drillState.selectedDoctor,
        selectedMedAid: row.id,
      });
    }
  };

  const handleBackClick = () => {
    if (drillState.level === 'specialty') {
      setDrillState({ level: 'year', selectedYear: currentYear });
      return;
    }

    if (drillState.level === 'doctor') {
      setDrillState({
        level: 'specialty',
        selectedYear: currentYear,
        selectedSpecialty: drillState.selectedSpecialty,
      });
      return;
    }

    if (drillState.level === 'medAid') {
      setDrillState({
        level: 'doctor',
        selectedYear: currentYear,
        selectedSpecialty: drillState.selectedSpecialty,
        selectedDoctor: drillState.selectedDoctor,
      });
    }
  };

  const canUseNextLevel = hasRawRows || drillState.level === 'year';
  const canDrillDeeper = drillState.level !== 'medAid' && canUseNextLevel;
  const canGoBack = drillState.level !== 'year';
  const metricLabel = metric.charAt(0).toUpperCase() + metric.slice(1);
  const rawRowsRequired = !hasRawRows && (drillState.level === 'doctor' || drillState.level === 'medAid');

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Hierarchical Drill-Down Explorer</h1>
        <p className="mt-1 text-sm text-gray-500">Navigate through levels: Year -&gt; Specialty -&gt; Doctor -&gt; Medical Aid</p>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-5">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Year</label>
            <select
              value={currentYear}
              onChange={(e) => setDrillState({ level: 'year', selectedYear: Number(e.target.value) })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              {yearOptions.map((year) => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Metric</label>
            <select
              value={metric}
              onChange={(e) => setMetric(e.target.value as Metric)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              <option value="episodes">Episodes</option>
              <option value="revenue">Revenue</option>
              <option value="patients">Patients</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Current Level</label>
            <div className="px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-sm font-medium text-gray-900">
              {LEVEL_LABELS[drillState.level]}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Navigation</label>
            <Button
              onClick={handleBackClick}
              disabled={!canGoBack}
              variant="outline"
              size="sm"
              className="w-full gap-2"
            >
              <ChevronLeft className="h-4 w-4" />
              Back
            </Button>
          </div>
        </div>
      </div>

      {drillState.level !== 'year' && (
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-4">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <button
              onClick={() => setDrillState({ level: 'year', selectedYear: currentYear })}
              className="text-teal-600 hover:text-teal-700 font-medium"
            >
              Year {currentYear}
            </button>
            {drillState.selectedSpecialty && (
              <>
                <span className="text-gray-400">/</span>
                <button
                  onClick={() => setDrillState({ level: 'specialty', selectedYear: currentYear, selectedSpecialty: drillState.selectedSpecialty })}
                  className="text-teal-600 hover:text-teal-700 font-medium"
                >
                  {drillState.selectedSpecialty}
                </button>
              </>
            )}
            {drillState.selectedDoctor && (
              <>
                <span className="text-gray-400">/</span>
                <button
                  onClick={() => setDrillState({
                    level: 'doctor',
                    selectedYear: currentYear,
                    selectedSpecialty: drillState.selectedSpecialty,
                    selectedDoctor: drillState.selectedDoctor,
                  })}
                  className="text-teal-600 hover:text-teal-700 font-medium"
                >
                  {drillState.selectedDoctor}
                </button>
              </>
            )}
            {drillState.selectedMedAid && (
              <>
                <span className="text-gray-400">/</span>
                <span className="text-gray-600">{drillState.selectedMedAid}</span>
              </>
            )}
          </div>
        </div>
      )}

      {rawRowsRequired && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Doctor-to-medical-aid and medical-aid monthly drill-downs require retained LOC row data. Re-uploading a LOC file with row retention enabled will populate this level.
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-4">
        <div className="rounded-lg bg-white border border-gray-200 p-4">
          <p className="text-xs font-medium text-gray-600 uppercase tracking-wider">Total</p>
          <p className="text-2xl font-bold text-gray-900 mt-2">
            {metric === 'revenue' ? formatCurrency(summaryStats.total) : formatNumber(summaryStats.total)}
          </p>
        </div>
        <div className="rounded-lg bg-white border border-gray-200 p-4">
          <p className="text-xs font-medium text-gray-600 uppercase tracking-wider">Average</p>
          <p className="text-2xl font-bold text-gray-900 mt-2">
            {metric === 'revenue' ? formatCurrency(summaryStats.avg) : formatNumber(summaryStats.avg)}
          </p>
        </div>
        <div className="rounded-lg bg-white border border-gray-200 p-4">
          <p className="text-xs font-medium text-gray-600 uppercase tracking-wider">Maximum</p>
          <p className="text-2xl font-bold text-green-600 mt-2">
            {metric === 'revenue' ? formatCurrency(summaryStats.max) : formatNumber(summaryStats.max)}
          </p>
        </div>
        <div className="rounded-lg bg-white border border-gray-200 p-4">
          <p className="text-xs font-medium text-gray-600 uppercase tracking-wider">Minimum</p>
          <p className="text-2xl font-bold text-red-600 mt-2">
            {metric === 'revenue' ? formatCurrency(summaryStats.min) : formatNumber(summaryStats.min)}
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">{metricLabel} by {LEVEL_LABELS[drillState.level]}</h2>
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={chartData}>
              <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
              <XAxis
                dataKey="name"
                tick={{ fill: '#94a3b8', fontSize: 12 }}
                axisLine={false}
                tickLine={false}
                angle={chartData.length > 8 ? -45 : 0}
                textAnchor={chartData.length > 8 ? 'end' : 'middle'}
                height={chartData.length > 8 ? 90 : 30}
                interval={0}
              />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Bar
                dataKey={metric}
                fill="#0d9488"
                radius={[4, 4, 0, 0]}
                onClick={(data) => canDrillDeeper && handleDrill(data as unknown as ChartDataPoint)}
                style={{ cursor: canDrillDeeper ? 'pointer' : 'default' }}
              />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-[300px] items-center justify-center rounded-lg border border-dashed border-gray-200 text-sm text-gray-500">
            No drill-down data available for this selection.
          </div>
        )}
        {canDrillDeeper && chartData.length > 0 && (
          <p className="mt-4 text-xs text-gray-500">Click on a bar to drill deeper into the data.</p>
        )}
      </div>

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">Data Table</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-200 bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left font-semibold text-gray-900">Name</th>
                <th className="px-6 py-3 text-right font-semibold text-gray-900">Episodes</th>
                <th className="px-6 py-3 text-right font-semibold text-gray-900">Revenue</th>
                <th className="px-6 py-3 text-right font-semibold text-gray-900">Patients</th>
                <th className="px-6 py-3 text-right font-semibold text-gray-900">Z-Score</th>
              </tr>
            </thead>
            <tbody>
              {chartData.map((row) => (
                <tr
                  key={row.id}
                  className={`border-b border-gray-100 hover:bg-gray-50 ${Math.abs(row.zScore) > 1.5 ? 'bg-yellow-50' : ''}`}
                  onClick={() => canDrillDeeper && handleDrill(row)}
                  style={{ cursor: canDrillDeeper ? 'pointer' : 'default' }}
                >
                  <td className="px-6 py-3 text-gray-900 font-medium">{row.name}</td>
                  <td className="px-6 py-3 text-right text-gray-700">{formatNumber(row.episodes)}</td>
                  <td className="px-6 py-3 text-right text-gray-700">{formatCurrency(row.revenue)}</td>
                  <td className="px-6 py-3 text-right text-gray-700">{formatNumber(row.patients)}</td>
                  <td className="px-6 py-3 text-right">
                    <span className={`text-sm font-medium ${Math.abs(row.zScore) > 1.5 ? 'text-orange-600' : 'text-gray-600'}`}>
                      {row.zScore.toFixed(2)}
                    </span>
                  </td>
                </tr>
              ))}
              {chartData.length === 0 && (
                <tr>
                  <td className="px-6 py-6 text-center text-gray-500" colSpan={5}>No rows to display.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
