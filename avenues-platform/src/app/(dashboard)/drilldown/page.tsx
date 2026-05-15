'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, Layers, Upload } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Button } from '@/components/ui/button';
import { ChartTooltipProps, DashboardMetrics, GenericDataset, MONTHS, YearData } from '@/types';
import { formatCurrency, formatNumber } from '@/lib/utils';
import { useCurrentYear, useYears } from '@/store';

type MetricFormat = 'number' | 'currency' | 'percent';
type MetricAggregator = 'count' | 'sum' | 'unique';

interface DrillMetric {
  id: string;
  label: string;
  format: MetricFormat;
  aggregator: MetricAggregator;
  field?: string;
}

interface DrillSource {
  id: string;
  label: string;
  description: string;
  rows: DrillRow[];
  dimensions: string[];
  defaultPath: string[];
  metrics: DrillMetric[];
}

interface DrillRow {
  dimensions: Record<string, string>;
  values: Record<string, number>;
  unique: Record<string, string>;
}

interface ChartDataPoint {
  id: string;
  name: string;
  value: number;
  records: number;
  zScore: number;
  [key: string]: string | number;
}

interface AggregatedPoint {
  id: string;
  name: string;
  value: number;
  records: number;
  zScore: number;
  uniqueKeys: Set<string>;
}

const DEFAULT_DIMENSION_LIMIT = 4;
const CATEGORICAL_UNIQUE_LIMIT = 80;
const OMITTED_FIELDS = new Set(['rawRows', 'conversionRecords', 'dashboardSnapshots', 'uploads', 'datasets']);

function normalizeHeader(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function titleCase(value: string): string {
  return value
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function parseNumber(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (value == null) return 0;
  const parsed = Number(String(value).replace(/[,$%\s]/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

function stringifyValue(value: unknown, fallback = 'Unknown'): string {
  if (value == null || value === '') return fallback;
  return String(value).trim() || fallback;
}

function getField(row: Record<string, unknown>, candidates: string[]): string {
  const normalizedCandidates = candidates.map(normalizeHeader);
  for (const [key, value] of Object.entries(row)) {
    const normalizedKey = normalizeHeader(key);
    if (normalizedCandidates.some((candidate) => normalizedKey.includes(candidate))) {
      return stringifyValue(value, '');
    }
  }
  return '';
}

function getExactField(row: Record<string, unknown>, field: string): unknown {
  for (const [key, value] of Object.entries(row)) {
    if (normalizeHeader(key) === normalizeHeader(field)) return value;
  }
  return undefined;
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

function getRevenue(row: Record<string, unknown>): number {
  for (const [key, value] of Object.entries(row)) {
    if (normalizeHeader(key) === 'total') return parseNumber(value);
  }
  return parseNumber(getField(row, ['claim amount', 'claimed amount', 'revenue', 'amount', 'value']));
}

function formatMetricValue(value: number, format: MetricFormat): string {
  if (format === 'currency') return formatCurrency(value);
  if (format === 'percent') return `${value.toFixed(1)}%`;
  return formatNumber(value);
}

function calculateZScore(value: number, arr: number[]): number {
  if (arr.length === 0) return 0;
  const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
  const variance = arr.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / arr.length;
  const stdDev = Math.sqrt(variance);
  return stdDev === 0 ? 0 : (value - mean) / stdDev;
}

function isNumericValue(value: unknown): boolean {
  if (typeof value === 'number') return Number.isFinite(value);
  if (value == null || value === '') return false;
  return Number.isFinite(parseNumber(value));
}

function findCategoricalColumns(rows: Record<string, unknown>[]): string[] {
  if (rows.length === 0) return [];
  const sample = rows.slice(0, 300);
  const columns = Array.from(new Set(sample.flatMap((row) => Object.keys(row))));

  return columns
    .filter((column) => {
      const values = sample.map((row) => row[column]).filter((value) => value != null && value !== '');
      if (values.length === 0) return false;
      if (values.every(isNumericValue)) return false;
      const unique = new Set(values.map((value) => stringifyValue(value))).size;
      return unique > 1 && unique <= CATEGORICAL_UNIQUE_LIMIT;
    })
    .slice(0, 12);
}

function findNumericColumns(rows: Record<string, unknown>[]): string[] {
  if (rows.length === 0) return [];
  const sample = rows.slice(0, 300);
  const columns = Array.from(new Set(sample.flatMap((row) => Object.keys(row))));

  return columns
    .filter((column) => {
      const values = sample.map((row) => row[column]).filter((value) => value != null && value !== '');
      return values.length > 0 && values.some(isNumericValue);
    })
    .slice(0, 16);
}

function getModuleName(path: string): string {
  const first = path.split('.')[0] || path;
  const known: Record<string, string> = {
    admCasualty: 'Admissions',
    admDay: 'Admissions',
    admInpatient: 'Admissions',
    admLab: 'Admissions',
    theatreCases: 'Theatre',
    theatreMinutes: 'Theatre',
    theatreUtil: 'Theatre',
    theatrePctOcc: 'Theatre',
    pharmacyRx: 'Pharmacy',
    pharmacyRev: 'Pharmacy',
    occupancyBeds: 'Occupancy',
    occMidnight: 'Occupancy',
    monthRevenue: 'Revenue',
    monthEpisodes: 'Episodes',
    revPerPatDay: 'Revenue',
    payments: 'Payments',
    debtRecon: 'Debtors',
    revLocation: 'Revenue',
    patientDays: 'Occupancy',
    pctOccWard: 'Occupancy',
    patDaysWard: 'Occupancy',
    patDaysLOC: 'Occupancy',
  };
  return known[first] ?? titleCase(first);
}

function collectMonthlySeries(value: unknown, path: string[] = []): Array<{ path: string; values: number[] }> {
  if (Array.isArray(value) && value.length === 12 && value.every((item) => typeof item === 'number')) {
    return [{ path: path.join('.'), values: value }];
  }

  if (!value || typeof value !== 'object' || Array.isArray(value)) return [];

  return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) => {
    if (OMITTED_FIELDS.has(key)) return [];
    return collectMonthlySeries(child, [...path, key]);
  });
}

function buildDashboardSource(dashboard: DashboardMetrics | null | undefined): DrillSource | null {
  if (!dashboard) return null;

  const series = collectMonthlySeries(dashboard).filter((item) => item.path);
  if (series.length === 0) return null;

  const rows: DrillRow[] = series.flatMap(({ path, values }) =>
    values.map((value, monthIndex) => ({
      dimensions: {
        Module: getModuleName(path),
        Metric: titleCase(path.split('.').slice(-1)[0] || path),
        Series: titleCase(path),
        Month: MONTHS[monthIndex],
      },
      values: { value },
      unique: {},
    })),
  );

  return {
    id: 'dashboard',
    label: 'Dashboard Metrics',
    description: `${series.length} monthly metric series`,
    rows,
    dimensions: ['Module', 'Metric', 'Series', 'Month'],
    defaultPath: ['Module', 'Metric', 'Month'],
    metrics: [{ id: 'value', label: 'Value', format: 'number', aggregator: 'sum', field: 'value' }],
  };
}

function buildLocationSource(yearData: YearData | undefined): DrillSource | null {
  const location = yearData?.location ?? yearData?.loc;
  if (!location) return null;

  if (location.rawRows?.length) {
    const rawRows = location.rawRows;
    const discoveredDimensions = findCategoricalColumns(rawRows);
    const dimensions = Array.from(new Set(['Specialty', 'Doctor', 'Medical Aid', 'Month', ...discoveredDimensions]));

    const rows: DrillRow[] = rawRows.map((row, index) => {
      const admDate = getField(row, ['adm date', 'admission date', 'admit date']);
      const monthIndex = parseMonthIndex(admDate);
      const episode = getField(row, ['episode']);
      const patient = getField(row, ['patient name', 'patient']);
      const dimensionsRecord: Record<string, string> = {
        Specialty: getField(row, ['doctor specialty', 'specialty', 'speciality']) || 'Unknown',
        Doctor: getField(row, ['doctor name', 'doctor', 'provider']) || 'Unknown',
        'Medical Aid': getField(row, ['medical aid', 'medical aid scheme', 'med aid scheme', 'scheme']) || 'Unknown',
        Month: monthIndex >= 0 && monthIndex < 12 ? MONTHS[monthIndex] : 'Unknown',
      };

      for (const dimension of discoveredDimensions) {
        dimensionsRecord[dimension] = stringifyValue(getExactField(row, dimension));
      }

      return {
        dimensions: dimensionsRecord,
        values: { revenue: getRevenue(row), episodes: 1, patients: 1 },
        unique: { patients: patient || episode || `loc-${index}` },
      };
    });

    return {
      id: 'location',
      label: 'Location / Patient Episodes',
      description: `${formatNumber(rows.length)} retained LOC row(s)`,
      rows,
      dimensions,
      defaultPath: ['Specialty', 'Doctor', 'Medical Aid', 'Month'],
      metrics: [
        { id: 'episodes', label: 'Episodes', format: 'number', aggregator: 'count' },
        { id: 'revenue', label: 'Revenue', format: 'currency', aggregator: 'sum', field: 'revenue' },
        { id: 'patients', label: 'Patients', format: 'number', aggregator: 'unique' },
      ],
    };
  }

  const rows: DrillRow[] = location.doctors.map((doctor) => ({
    dimensions: {
      Specialty: doctor.specialty || 'Unknown',
      Doctor: doctor.name || 'Unknown',
    },
    values: {
      episodes: doctor.episodes,
      revenue: doctor.revenue,
      patients: doctor.patients,
      avgLOS: doctor.avgLOS,
    },
    unique: {},
  }));

  return {
    id: 'location',
    label: 'Location / Patient Episodes',
    description: 'Doctor-level LOC aggregates',
    rows,
    dimensions: ['Specialty', 'Doctor'],
    defaultPath: ['Specialty', 'Doctor'],
    metrics: [
      { id: 'episodes', label: 'Episodes', format: 'number', aggregator: 'sum', field: 'episodes' },
      { id: 'revenue', label: 'Revenue', format: 'currency', aggregator: 'sum', field: 'revenue' },
      { id: 'patients', label: 'Patients', format: 'number', aggregator: 'sum', field: 'patients' },
      { id: 'avgLOS', label: 'Average LOS', format: 'number', aggregator: 'sum', field: 'avgLOS' },
    ],
  };
}

function buildClaimsSource(yearData: YearData | undefined): DrillSource | null {
  const claims = yearData?.claims ?? yearData?.apac;
  if (!claims) return null;

  if (claims.rawRows?.length) {
    const rawRows = claims.rawRows as unknown as Record<string, unknown>[];
    const discoveredDimensions = findCategoricalColumns(rawRows);
    const numericColumns = findNumericColumns(rawRows);
    const dimensions = Array.from(new Set(['Scheme', 'Status', 'Doctor', 'Month', ...discoveredDimensions]));

    const rows: DrillRow[] = rawRows.map((row, index) => {
      const date = getField(row, ['submitted date', 'submission date', 'date', 'claim date']);
      const monthIndex = parseMonthIndex(date);
      const claimId = getField(row, ['claim number', 'claim id', 'invoice', 'episode']);
      const dimensionsRecord: Record<string, string> = {
        Scheme: getField(row, ['medical aid', 'scheme', 'funder', 'payer', 'insurer']) || 'Unknown',
        Status: getField(row, ['status', 'claim status']) || 'Unknown',
        Doctor: getField(row, ['doctor name', 'doctor', 'provider']) || 'Unknown',
        Month: monthIndex >= 0 && monthIndex < 12 ? MONTHS[monthIndex] : 'Unknown',
      };

      for (const dimension of discoveredDimensions) {
        dimensionsRecord[dimension] = stringifyValue(getExactField(row, dimension));
      }

      const values = Object.fromEntries(numericColumns.map((column) => [column, parseNumber(getExactField(row, column))]));
      values.amount = getRevenue(row);

      return {
        dimensions: dimensionsRecord,
        values,
        unique: { claims: claimId || `claim-${index}` },
      };
    });

    return {
      id: 'claims',
      label: 'Claims',
      description: `${formatNumber(rows.length)} retained claim row(s)`,
      rows,
      dimensions,
      defaultPath: ['Scheme', 'Status', 'Month'],
      metrics: [
        { id: 'claims', label: 'Claims', format: 'number', aggregator: 'count' },
        { id: 'amount', label: 'Claim Amount', format: 'currency', aggregator: 'sum', field: 'amount' },
        ...numericColumns.map((column) => ({
          id: column,
          label: titleCase(column),
          format: normalizeHeader(column).includes('amount') ? 'currency' as const : 'number' as const,
          aggregator: 'sum' as const,
          field: column,
        })),
      ],
    };
  }

  const rows: DrillRow[] = [
    ...Object.entries(claims.byScheme ?? {}).map(([scheme, data]) => ({
      dimensions: { Scheme: scheme, Status: 'All' },
      values: {
        claims: data.totalClaimed,
        submitted: data.submitted,
        approved: data.approved,
        rejected: data.rejected,
        pending: data.pending,
        amount: data.totalClaimed,
      },
      unique: {},
    })),
    ...Object.entries(claims.byStatus ?? {}).map(([status, count]) => ({
      dimensions: { Scheme: 'All', Status: status },
      values: { claims: count, amount: 0 },
      unique: {},
    })),
  ];

  return {
    id: 'claims',
    label: 'Claims',
    description: 'Claims aggregates',
    rows,
    dimensions: ['Scheme', 'Status'],
    defaultPath: ['Scheme', 'Status'],
    metrics: [
      { id: 'claims', label: 'Claims', format: 'number', aggregator: 'sum', field: 'claims' },
      { id: 'amount', label: 'Claim Amount', format: 'currency', aggregator: 'sum', field: 'amount' },
      { id: 'approved', label: 'Approved', format: 'number', aggregator: 'sum', field: 'approved' },
      { id: 'rejected', label: 'Rejected', format: 'number', aggregator: 'sum', field: 'rejected' },
      { id: 'pending', label: 'Pending', format: 'number', aggregator: 'sum', field: 'pending' },
    ],
  };
}

function buildDatasetSource(dataset: GenericDataset): DrillSource | null {
  if (!dataset.rows?.length) return null;

  const dimensions = findCategoricalColumns(dataset.rows);
  const numericColumns = findNumericColumns(dataset.rows);
  if (dimensions.length === 0 && numericColumns.length === 0) return null;

  const rows: DrillRow[] = dataset.rows.map((row, index) => ({
    dimensions: Object.fromEntries(dimensions.map((dimension) => [dimension, stringifyValue(row[dimension])])),
    values: Object.fromEntries(numericColumns.map((column) => [column, parseNumber(row[column])])) as Record<string, number>,
    unique: { records: `${dataset.id}-${index}` },
  }));

  return {
    id: `dataset:${dataset.id}`,
    label: dataset.name || dataset.fileName,
    description: `${formatNumber(dataset.rowCount)} row dataset`,
    rows,
    dimensions,
    defaultPath: dimensions.slice(0, DEFAULT_DIMENSION_LIMIT),
    metrics: [
      { id: 'records', label: 'Records', format: 'number', aggregator: 'count' },
      ...numericColumns.map((column) => ({
        id: column,
        label: titleCase(column),
        format: normalizeHeader(column).includes('amount') || normalizeHeader(column).includes('revenue') ? 'currency' as const : 'number' as const,
        aggregator: 'sum' as const,
        field: column,
      })),
    ],
  };
}

function buildSources(yearData: YearData | undefined): DrillSource[] {
  const sources = [
    buildDashboardSource(yearData?.dashboard ?? yearData?.dash),
    buildLocationSource(yearData),
    buildClaimsSource(yearData),
    ...Object.values(yearData?.datasets ?? {}).map(buildDatasetSource),
  ];

  return sources.filter((source): source is DrillSource => Boolean(source && source.rows.length > 0 && source.metrics.length > 0));
}

function aggregateForDimension(
  rows: DrillRow[],
  dimension: string,
  metric: DrillMetric,
): ChartDataPoint[] {
  const grouped = new Map<string, AggregatedPoint>();

  for (const row of rows) {
    const id = stringifyValue(row.dimensions[dimension]);
    const current = grouped.get(id) ?? {
      id,
      name: id,
      value: 0,
      records: 0,
      zScore: 0,
      uniqueKeys: new Set<string>(),
    };

    current.records += 1;
    if (metric.aggregator === 'count') {
      current.value += 1;
    } else if (metric.aggregator === 'unique') {
      current.uniqueKeys.add(row.unique[metric.id] ?? row.unique.records ?? `${id}-${current.records}`);
      current.value = current.uniqueKeys.size;
    } else {
      current.value += row.values[metric.field ?? metric.id] ?? 0;
    }

    grouped.set(id, current);
  }

  const values = Array.from(grouped.values())
    .map(({ uniqueKeys: _uniqueKeys, ...row }) => row)
    .sort((a, b) => b.value - a.value);

  const zScoreValues = values.map((row) => row.value);
  return values.map((row) => ({ ...row, zScore: calculateZScore(row.value, zScoreValues) }));
}

function DrillTooltip({
  active,
  payload,
  metricFormat,
}: ChartTooltipProps<ChartDataPoint> & { metricFormat: MetricFormat }) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-lg">
      <p className="text-sm font-medium text-gray-900">{row?.name}</p>
      <p className="text-sm text-gray-600">Value: {formatMetricValue(row?.value ?? 0, metricFormat)}</p>
      <p className="text-sm text-gray-600">Records: {formatNumber(row?.records ?? 0)}</p>
    </div>
  );
}

export default function DrilldownPage() {
  const currentYearValue = useCurrentYear();
  const years = useYears();
  const [selectedYear, setSelectedYear] = useState(currentYearValue);
  const [sourceId, setSourceId] = useState('');
  const [metricId, setMetricId] = useState('');
  const [path, setPath] = useState<string[]>([]);
  const [selections, setSelections] = useState<string[]>([]);

  const yearData = years.get(selectedYear);
  const yearOptions = useMemo(() => {
    const values = Array.from(years.keys()).sort((a, b) => b - a);
    return values.length > 0 ? values : [currentYearValue];
  }, [currentYearValue, years]);

  const sources = useMemo(() => buildSources(yearData), [yearData]);
  const selectedSource = sources.find((source) => source.id === sourceId) ?? sources[0] ?? null;
  const selectedMetric = selectedSource?.metrics.find((metric) => metric.id === metricId) ?? selectedSource?.metrics[0] ?? null;

  useEffect(() => {
    if (!sources.length) {
      setSourceId('');
      setMetricId('');
      setPath([]);
      setSelections([]);
      return;
    }

    const nextSource = sources.find((source) => source.id === sourceId) ?? sources[0];
    if (nextSource.id !== sourceId) setSourceId(nextSource.id);

    const nextMetric = nextSource.metrics.find((metric) => metric.id === metricId) ?? nextSource.metrics[0];
    if (nextMetric.id !== metricId) setMetricId(nextMetric.id);

    if (!path.length || path.some((dimension) => !nextSource.dimensions.includes(dimension))) {
      setPath(nextSource.defaultPath.length ? nextSource.defaultPath : nextSource.dimensions.slice(0, DEFAULT_DIMENSION_LIMIT));
      setSelections([]);
    }
  }, [metricId, path, sourceId, sources]);

  const activePath = useMemo(() => {
    if (!selectedSource) return [];
    const valid = path.filter((dimension) => selectedSource.dimensions.includes(dimension));
    return valid.length > 0 ? valid : selectedSource.defaultPath;
  }, [path, selectedSource]);

  const levelIndex = Math.min(selections.length, Math.max(activePath.length - 1, 0));
  const currentDimension = activePath[levelIndex];

  const filteredRows = useMemo(() => {
    if (!selectedSource) return [];
    return selectedSource.rows.filter((row) =>
      selections.every((selection, index) => row.dimensions[activePath[index]] === selection),
    );
  }, [activePath, selectedSource, selections]);

  const chartData = useMemo(() => {
    if (!currentDimension || !selectedMetric) return [];
    return aggregateForDimension(filteredRows, currentDimension, selectedMetric);
  }, [currentDimension, filteredRows, selectedMetric]);

  const summaryStats = useMemo(() => {
    if (!chartData.length) return { total: 0, avg: 0, max: 0, min: 0 };
    const values = chartData.map((row) => row.value);
    const total = values.reduce((sum, value) => sum + value, 0);
    return {
      total,
      avg: total / values.length,
      max: Math.max(...values),
      min: Math.min(...values),
    };
  }, [chartData]);

  const canGoBack = selections.length > 0;
  const canDrillDeeper = selections.length < activePath.length - 1;
  const chartMinWidth = chartData.length > 10 ? Math.max(720, chartData.length * 72) : 0;

  const handleDrill = (row: ChartDataPoint) => {
    if (!canDrillDeeper) return;
    setSelections((current) => [...current, row.id]);
  };

  const handleBackClick = () => {
    setSelections((current) => current.slice(0, -1));
  };

  const updatePathDimension = (index: number, dimension: string) => {
    const nextPath = [...activePath];
    nextPath[index] = dimension;
    const deduped = nextPath.filter((item, itemIndex) => nextPath.indexOf(item) === itemIndex);
    setPath(deduped);
    setSelections([]);
  };

  if (!selectedSource || !selectedMetric) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
        <div className="max-w-md rounded-xl border border-gray-200 bg-white p-8 shadow-sm sm:p-12">
          <Upload className="mx-auto mb-4 h-12 w-12 text-slate-300" />
          <h2 className="mb-2 text-xl font-semibold text-slate-800">No Drill-Down Data Loaded</h2>
          <p className="mb-6 text-slate-500">Upload dashboard, LOC, claims, or generic CSV data to explore it here.</p>
          <a href="/upload" className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-teal-700">
            Go to Upload
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 p-4 sm:space-y-6 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 sm:text-2xl">Dynamic Drill-Down Explorer</h1>
          <p className="mt-1 text-sm text-gray-500">Explore any loaded feature by selecting a source, metric, and hierarchy.</p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-lg border border-teal-200 bg-teal-50 px-3 py-2 text-xs font-medium text-teal-800">
          <Layers className="h-4 w-4" />
          {selectedSource.description}
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">Year</label>
            <select
              value={selectedYear}
              onChange={(event) => {
                setSelectedYear(Number(event.target.value));
                setSelections([]);
              }}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              {yearOptions.map((year) => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">Feature Source</label>
            <select
              value={selectedSource.id}
              onChange={(event) => {
                const source = sources.find((item) => item.id === event.target.value);
                setSourceId(event.target.value);
                setMetricId(source?.metrics[0]?.id ?? '');
                setPath(source?.defaultPath ?? []);
                setSelections([]);
              }}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              {sources.map((source) => (
                <option key={source.id} value={source.id}>{source.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">Metric</label>
            <select
              value={selectedMetric.id}
              onChange={(event) => {
                setMetricId(event.target.value);
                setSelections([]);
              }}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              {selectedSource.metrics.map((metric) => (
                <option key={metric.id} value={metric.id}>{metric.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">Current Level</label>
            <div className="rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm font-medium text-gray-900">
              {currentDimension ?? 'None'}
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">Navigation</label>
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

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: Math.min(DEFAULT_DIMENSION_LIMIT, selectedSource.dimensions.length) }).map((_, index) => (
            <div key={index}>
              <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-gray-500">
                Level {index + 1}
              </label>
              <select
                value={activePath[index] ?? ''}
                onChange={(event) => updatePathDimension(index, event.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                {selectedSource.dimensions.map((dimension) => (
                  <option
                    key={dimension}
                    value={dimension}
                    disabled={activePath.includes(dimension) && activePath[index] !== dimension}
                  >
                    {dimension}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm sm:p-4">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <button
            onClick={() => setSelections([])}
            className="font-medium text-teal-600 hover:text-teal-700"
          >
            {selectedSource.label}
          </button>
          {selections.map((selection, index) => (
            <React.Fragment key={`${activePath[index]}-${selection}`}>
              <span className="text-gray-400">/</span>
              <button
                onClick={() => setSelections((current) => current.slice(0, index + 1))}
                className="max-w-full truncate font-medium text-teal-600 hover:text-teal-700"
              >
                {activePath[index]}: {selection}
              </button>
            </React.Fragment>
          ))}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ['Total', summaryStats.total, 'text-gray-900'],
          ['Average', summaryStats.avg, 'text-gray-900'],
          ['Maximum', summaryStats.max, 'text-green-600'],
          ['Minimum', summaryStats.min, 'text-red-600'],
        ].map(([label, value, color]) => (
          <div key={label} className="rounded-lg border border-gray-200 bg-white p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-gray-600">{label}</p>
            <p className={`mt-2 text-xl font-bold sm:text-2xl ${color}`}>
              {formatMetricValue(Number(value), selectedMetric.format)}
            </p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-base font-semibold text-gray-900 sm:text-lg">
            {selectedMetric.label} by {currentDimension}
          </h2>
          <p className="text-xs text-gray-500">{formatNumber(filteredRows.length)} row(s) in scope</p>
        </div>

        {chartData.length > 0 ? (
          <div className="overflow-x-auto overflow-y-hidden">
            <div style={{ minWidth: chartMinWidth || undefined }}>
              <ResponsiveContainer width="100%" height={360}>
                <BarChart data={chartData}>
                  <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
                  <XAxis
                    dataKey="name"
                    tick={{ fill: '#64748b', fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                    interval={0}
                    angle={chartData.length > 8 ? -35 : 0}
                    textAnchor={chartData.length > 8 ? 'end' : 'middle'}
                    height={chartData.length > 8 ? 92 : 34}
                  />
                  <YAxis
                    tick={{ fill: '#64748b', fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(value) => selectedMetric.format === 'currency' ? formatCurrency(Number(value)).replace('.00', '') : formatNumber(Number(value))}
                    width={selectedMetric.format === 'currency' ? 92 : 64}
                  />
                  <Tooltip
                    content={<DrillTooltip metricFormat={selectedMetric.format} />}
                    formatter={(value) => formatMetricValue(Number(value), selectedMetric.format)}
                  />
                  <Bar
                    dataKey="value"
                    fill="#0d9488"
                    radius={[4, 4, 0, 0]}
                    onClick={(data) => handleDrill(data as unknown as ChartDataPoint)}
                    style={{ cursor: canDrillDeeper ? 'pointer' : 'default' }}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        ) : (
          <div className="flex h-[260px] items-center justify-center rounded-lg border border-dashed border-gray-200 px-4 text-center text-sm text-gray-500">
            No drill-down data available for this selection.
          </div>
        )}

        {canDrillDeeper && chartData.length > 0 && (
          <p className="mt-4 text-xs text-gray-500">Click a bar to move to the next selected hierarchy level.</p>
        )}
      </div>

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 px-4 py-4 sm:px-6">
          <h2 className="text-base font-semibold text-gray-900 sm:text-lg">Data Table</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] text-sm">
            <thead className="border-b border-gray-200 bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-gray-900 sm:px-6">{currentDimension}</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-900 sm:px-6">{selectedMetric.label}</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-900 sm:px-6">Records</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-900 sm:px-6">Z-Score</th>
              </tr>
            </thead>
            <tbody>
              {chartData.map((row) => (
                <tr
                  key={row.id}
                  className={`border-b border-gray-100 hover:bg-gray-50 ${Math.abs(row.zScore) > 1.5 ? 'bg-yellow-50' : ''}`}
                  onClick={() => handleDrill(row)}
                  style={{ cursor: canDrillDeeper ? 'pointer' : 'default' }}
                >
                  <td className="max-w-[320px] truncate px-4 py-3 font-medium text-gray-900 sm:px-6">{row.name}</td>
                  <td className="px-4 py-3 text-right text-gray-700 sm:px-6">{formatMetricValue(row.value, selectedMetric.format)}</td>
                  <td className="px-4 py-3 text-right text-gray-700 sm:px-6">{formatNumber(row.records)}</td>
                  <td className="px-4 py-3 text-right sm:px-6">
                    <span className={`text-sm font-medium ${Math.abs(row.zScore) > 1.5 ? 'text-orange-600' : 'text-gray-600'}`}>
                      {row.zScore.toFixed(2)}
                    </span>
                  </td>
                </tr>
              ))}
              {chartData.length === 0 && (
                <tr>
                  <td className="px-6 py-6 text-center text-gray-500" colSpan={4}>No rows to display.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
