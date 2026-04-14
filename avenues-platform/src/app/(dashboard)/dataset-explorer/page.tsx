'use client';

import React, { useState, useMemo } from 'react';
import {
  Database,
  Table2,
  BarChart3,
  PieChart as PieIcon,
  Hash,
  Type,
  Calendar,
  ChevronDown,
  ChevronRight,
  Layers,
  TrendingUp,
  ArrowUpDown,
  Eye,
  Columns3,
  Rows3,
  Download,
} from 'lucide-react';
import { useDatasetList, useCurrentYear } from '@/store';
import { GenericDataset, ColumnProfile, COLOR_PALETTE, CHART_COLORS } from '@/types';
import { ChartCard } from '@/components/charts/chart-card';
import { BarChartComponent } from '@/components/charts/bar-chart';
import { LineChartComponent } from '@/components/charts/line-chart';
import { PieChartComponent, PieDataItem } from '@/components/charts/pie-chart';
import { StatCard } from '@/components/charts/stat-card';

function formatNumber(n: number): string {
  if (Math.abs(n) >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (Math.abs(n) >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  if (Number.isInteger(n)) return n.toLocaleString();
  return n.toFixed(2);
}

function formatCurrency(n: number): string {
  if (Math.abs(n) >= 1_000_000) return '$' + (n / 1_000_000).toFixed(1) + 'M';
  if (Math.abs(n) >= 1_000) return '$' + (n / 1_000).toFixed(1) + 'K';
  return '$' + n.toFixed(2);
}

/** Guess if a numeric column is currency-related based on name */
function isCurrencyColumn(name: string): boolean {
  const lower = name.toLowerCase();
  return /rev|amount|cost|price|fee|charge|payment|salary|income|total.*val|claim.*val|billed|paid/i.test(lower);
}

/** Generate stat cards from numeric column profiles */
function NumericStats({ columns }: { columns: ColumnProfile[] }) {
  const stats = columns.slice(0, 8); // show up to 8 stat cards
  const colors: Array<'teal' | 'blue' | 'violet' | 'amber' | 'rose' | 'green' | 'purple'> = [
    'teal', 'blue', 'violet', 'amber', 'rose', 'green', 'purple', 'teal',
  ];
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
      {stats.map((col, i) => {
        const isCurrency = isCurrencyColumn(col.name);
        const fmt = isCurrency ? formatCurrency : formatNumber;
        return (
          <StatCard
            key={col.name}
            title={col.name}
            value={col.sum !== undefined ? fmt(col.sum) : col.mean !== undefined ? fmt(col.mean) : '—'}
            subtitle={col.sum !== undefined ? `Avg: ${fmt(col.mean ?? 0)}` : col.min !== undefined ? `Range: ${fmt(col.min)} – ${fmt(col.max ?? 0)}` : undefined}
            color={colors[i % colors.length]}
            icon={isCurrency ? TrendingUp : Hash}
          />
        );
      })}
    </div>
  );
}

/** Bar chart showing distribution of top values for a categorical column */
function CategoricalBreakdown({ col, rows }: { col: ColumnProfile; rows: Record<string, unknown>[] }) {
  const data = useMemo(() => {
    if (col.topValues && col.topValues.length > 0) {
      return col.topValues.slice(0, 10).map(tv => ({
        name: String(tv.value).length > 20 ? String(tv.value).slice(0, 18) + '…' : String(tv.value),
        count: tv.count,
      }));
    }
    // Fallback: compute from rows
    const counts: Record<string, number> = {};
    rows.forEach(row => {
      const val = String(row[col.name] ?? '');
      if (val) counts[val] = (counts[val] || 0) + 1;
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, count]) => ({ name: name.length > 20 ? name.slice(0, 18) + '…' : name, count }));
  }, [col, rows]);

  if (data.length === 0) return null;

  // Use pie chart for ≤6 categories, bar chart for more
  if (data.length <= 6) {
    const pieData: PieDataItem[] = data.map((d, i) => ({
      name: d.name,
      value: d.count,
      color: CHART_COLORS[i % CHART_COLORS.length],
    }));
    return (
      <ChartCard title={col.name} description={`${col.unique} unique values · ${col.nonNull} non-null`}>
        <PieChartComponent data={pieData} height={260} innerRadius={50} />
      </ChartCard>
    );
  }

  return (
    <ChartCard title={col.name} description={`Top ${data.length} of ${col.unique} unique values`}>
      <BarChartComponent
        data={data}
        xKey="name"
        bars={[{ key: 'count', color: CHART_COLORS[0], name: 'Count' }]}
        height={260}
        showLegend={false}
      />
    </ChartCard>
  );
}

/** Scatter/distribution chart for numeric columns — shows histogram-like bar chart */
function NumericDistribution({ col, rows }: { col: ColumnProfile; rows: Record<string, unknown>[] }) {
  const data = useMemo(() => {
    if (col.min === undefined || col.max === undefined) return [];
    const values = rows
      .map(r => Number(r[col.name]))
      .filter(v => !isNaN(v));
    if (values.length === 0) return [];

    // Create histogram bins
    const binCount = Math.min(15, Math.max(5, Math.ceil(Math.sqrt(values.length))));
    const range = col.max - col.min;
    if (range === 0) return [{ bin: formatNumber(col.min), count: values.length }];
    const binWidth = range / binCount;

    const bins = Array.from({ length: binCount }, (_, i) => ({
      bin: formatNumber(col.min! + i * binWidth),
      count: 0,
    }));

    values.forEach(v => {
      let idx = Math.floor((v - col.min!) / binWidth);
      if (idx >= binCount) idx = binCount - 1;
      bins[idx].count++;
    });

    return bins;
  }, [col, rows]);

  if (data.length === 0) return null;

  return (
    <ChartCard title={col.name} description={`Distribution · Mean: ${formatNumber(col.mean ?? 0)} · Std: ${formatNumber(col.std ?? 0)}`}>
      <BarChartComponent
        data={data}
        xKey="bin"
        bars={[{ key: 'count', color: '#7c3aed', name: 'Frequency' }]}
        height={240}
        showLegend={false}
      />
    </ChartCard>
  );
}

/** Correlation matrix heatmap for numeric columns — simplified as a ranked list */
function CorrelationInsights({ numericCols, rows }: { numericCols: ColumnProfile[]; rows: Record<string, unknown>[] }) {
  const correlations = useMemo(() => {
    if (numericCols.length < 2) return [];
    const pairs: { pair: string; corr: number; absCorr: number }[] = [];

    for (let i = 0; i < Math.min(numericCols.length, 8); i++) {
      for (let j = i + 1; j < Math.min(numericCols.length, 8); j++) {
        const col1 = numericCols[i].name;
        const col2 = numericCols[j].name;
        const vals = rows
          .map(r => [Number(r[col1]), Number(r[col2])])
          .filter(([a, b]) => !isNaN(a) && !isNaN(b));
        if (vals.length < 10) continue;

        const n = vals.length;
        const mean1 = vals.reduce((s, v) => s + v[0], 0) / n;
        const mean2 = vals.reduce((s, v) => s + v[1], 0) / n;
        let cov = 0, var1 = 0, var2 = 0;
        vals.forEach(([a, b]) => {
          cov += (a - mean1) * (b - mean2);
          var1 += (a - mean1) ** 2;
          var2 += (b - mean2) ** 2;
        });
        const denom = Math.sqrt(var1 * var2);
        if (denom === 0) continue;
        const corr = cov / denom;
        pairs.push({ pair: `${col1} ↔ ${col2}`, corr, absCorr: Math.abs(corr) });
      }
    }

    return pairs.sort((a, b) => b.absCorr - a.absCorr).slice(0, 8);
  }, [numericCols, rows]);

  if (correlations.length === 0) return null;

  return (
    <ChartCard title="Top Correlations" description="Strongest linear relationships between numeric columns">
      <div className="space-y-2">
        {correlations.map(({ pair, corr }) => (
          <div key={pair} className="flex items-center gap-3">
            <span className="text-xs text-slate-600 dark:text-slate-400 w-48 truncate" title={pair}>{pair}</span>
            <div className="flex-1 h-4 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${corr > 0 ? 'bg-teal-500' : 'bg-rose-500'}`}
                style={{ width: `${Math.abs(corr) * 100}%` }}
              />
            </div>
            <span className={`text-xs font-mono w-14 text-right ${corr > 0.5 ? 'text-teal-600' : corr < -0.5 ? 'text-rose-600' : 'text-slate-500'}`}>
              {corr.toFixed(2)}
            </span>
          </div>
        ))}
      </div>
    </ChartCard>
  );
}

/** Data table preview with sortable columns */
function DataTablePreview({ dataset }: { dataset: GenericDataset }) {
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortAsc, setSortAsc] = useState(true);
  const [page, setPage] = useState(0);
  const pageSize = 25;

  const columns = dataset.schema.columnNames;
  const sortedRows = useMemo(() => {
    const rows = [...dataset.rows];
    if (sortCol) {
      rows.sort((a, b) => {
        const va = a[sortCol] as string | number | null;
        const vb = b[sortCol] as string | number | null;
        if (va == null && vb == null) return 0;
        if (va == null) return 1;
        if (vb == null) return -1;
        if (typeof va === 'number' && typeof vb === 'number') return sortAsc ? va - vb : vb - va;
        return sortAsc ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va));
      });
    }
    return rows;
  }, [dataset.rows, sortCol, sortAsc]);

  const pageRows = sortedRows.slice(page * pageSize, (page + 1) * pageSize);
  const totalPages = Math.ceil(sortedRows.length / pageSize);

  const handleSort = (col: string) => {
    if (sortCol === col) {
      setSortAsc(!sortAsc);
    } else {
      setSortCol(col);
      setSortAsc(true);
    }
    setPage(0);
  };

  return (
    <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
              {columns.map(col => (
                <th
                  key={col}
                  className="px-3 py-2 text-left font-semibold text-slate-700 dark:text-slate-300 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 whitespace-nowrap"
                  onClick={() => handleSort(col)}
                >
                  <span className="flex items-center gap-1">
                    {col}
                    {sortCol === col ? (
                      <ArrowUpDown className="w-3 h-3 text-teal-500" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 text-slate-300" />
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageRows.map((row, i) => (
              <tr
                key={i}
                className={`border-b border-slate-100 dark:border-slate-800 ${i % 2 === 0 ? '' : 'bg-slate-50/50 dark:bg-slate-800/30'}`}
              >
                {columns.map(col => (
                  <td key={col} className="px-3 py-1.5 text-slate-600 dark:text-slate-400 whitespace-nowrap max-w-[200px] truncate">
                    {row[col] != null ? String(row[col]) : <span className="text-slate-300">—</span>}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-2 bg-slate-50 dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700">
          <span className="text-xs text-slate-500">
            Showing {page * pageSize + 1}–{Math.min((page + 1) * pageSize, sortedRows.length)} of {sortedRows.length.toLocaleString()} rows
          </span>
          <div className="flex gap-1">
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              className="px-2 py-1 text-xs rounded bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-600"
            >
              Prev
            </button>
            <span className="px-2 py-1 text-xs text-slate-500">{page + 1} / {totalPages}</span>
            <button
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="px-2 py-1 text-xs rounded bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-600"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Column Schema panel — shows all column types and stats */
function SchemaPanel({ dataset }: { dataset: GenericDataset }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const typeIcon = (type: string) => {
    switch (type) {
      case 'numeric': return <Hash className="w-3.5 h-3.5 text-blue-500" />;
      case 'categorical': return <Type className="w-3.5 h-3.5 text-violet-500" />;
      case 'date': return <Calendar className="w-3.5 h-3.5 text-amber-500" />;
      case 'text': return <Type className="w-3.5 h-3.5 text-slate-400" />;
      default: return <Type className="w-3.5 h-3.5 text-slate-400" />;
    }
  };

  return (
    <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
      <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
          <Columns3 className="w-4 h-4" />
          Schema · {dataset.schema.columnNames.length} columns
        </h3>
      </div>
      <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-[500px] overflow-y-auto">
        {dataset.columnProfiles.map(col => (
          <div key={col.name} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
            <button
              className="w-full px-4 py-2 flex items-center gap-3 text-left"
              onClick={() => setExpanded(expanded === col.name ? null : col.name)}
            >
              {expanded === col.name ? <ChevronDown className="w-3 h-3 text-slate-400" /> : <ChevronRight className="w-3 h-3 text-slate-400" />}
              {typeIcon(col.type)}
              <span className="text-xs font-medium text-slate-800 dark:text-slate-200 flex-1 truncate">{col.name}</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400">{col.type}</span>
              {col.missing > 0 && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400">{col.missing} null</span>
              )}
            </button>
            {expanded === col.name && (
              <div className="px-4 pb-3 ml-9 text-xs text-slate-500 dark:text-slate-400 space-y-1">
                <div>Non-null: {col.nonNull.toLocaleString()} · Unique: {col.unique.toLocaleString()}</div>
                {col.type === 'numeric' && (
                  <>
                    <div>Min: {formatNumber(col.min ?? 0)} · Max: {formatNumber(col.max ?? 0)}</div>
                    <div>Mean: {formatNumber(col.mean ?? 0)} · Median: {formatNumber(col.median ?? 0)} · Std: {formatNumber(col.std ?? 0)}</div>
                    {col.sum !== undefined && <div>Sum: {formatNumber(col.sum)}</div>}
                  </>
                )}
                {col.type === 'categorical' && col.topValues && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {col.topValues.slice(0, 5).map(tv => (
                      <span key={tv.value} className="px-1.5 py-0.5 rounded bg-violet-50 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400 text-[10px]">
                        {tv.value} ({tv.count})
                      </span>
                    ))}
                  </div>
                )}
                {col.type === 'date' && (
                  <div>Range: {col.minDate ?? '?'} → {col.maxDate ?? '?'}</div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ==================== MAIN PAGE ====================

type ViewTab = 'overview' | 'charts' | 'table' | 'schema';

export default function DatasetExplorerPage() {
  const datasets = useDatasetList();
  const currentYear = useCurrentYear();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ViewTab>('overview');

  const selected = useMemo(
    () => datasets.find(d => d.id === selectedId) || datasets[0] || null,
    [datasets, selectedId]
  );

  const numericCols = useMemo(
    () => selected?.columnProfiles.filter(c => c.type === 'numeric') || [],
    [selected]
  );

  const categoricalCols = useMemo(
    () => selected?.columnProfiles.filter(c => c.type === 'categorical') || [],
    [selected]
  );

  const dateCols = useMemo(
    () => selected?.columnProfiles.filter(c => c.type === 'date') || [],
    [selected]
  );

  // Auto-select first dataset
  React.useEffect(() => {
    if (!selectedId && datasets.length > 0) {
      setSelectedId(datasets[0].id);
    }
  }, [datasets, selectedId]);

  if (datasets.length === 0) {
    return (
      <div className="p-6 max-w-5xl mx-auto">
        <div className="text-center py-20">
          <Database className="w-16 h-16 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-2">No Datasets Yet</h2>
          <p className="text-slate-500 dark:text-slate-400 max-w-md mx-auto mb-6">
            Upload any CSV file on the Upload page. Files that don&apos;t match Dashboard, Location, or Claims formats will be auto-profiled as generic datasets and appear here.
          </p>
          <a
            href="/upload"
            className="inline-flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 text-sm font-medium"
          >
            Go to Upload
          </a>
        </div>
      </div>
    );
  }

  const tabs: { key: ViewTab; label: string; icon: React.ReactNode }[] = [
    { key: 'overview', label: 'Overview', icon: <Eye className="w-3.5 h-3.5" /> },
    { key: 'charts', label: 'Charts', icon: <BarChart3 className="w-3.5 h-3.5" /> },
    { key: 'table', label: 'Data Table', icon: <Table2 className="w-3.5 h-3.5" /> },
    { key: 'schema', label: 'Schema', icon: <Columns3 className="w-3.5 h-3.5" /> },
  ];

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Database className="w-6 h-6 text-teal-500" />
            Dataset Explorer
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Dynamic insights auto-generated from uploaded datasets · {currentYear}
          </p>
        </div>

        {/* Dataset selector */}
        {datasets.length > 1 && (
          <div className="relative">
            <select
              value={selected?.id || ''}
              onChange={(e) => { setSelectedId(e.target.value); setActiveTab('overview'); }}
              className="appearance-none pl-3 pr-8 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-teal-500 focus:outline-none"
            >
              {datasets.map(ds => (
                <option key={ds.id} value={ds.id}>
                  {ds.name} ({ds.rowCount.toLocaleString()} rows, {ds.schema.columnNames.length} cols)
                </option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        )}
      </div>

      {selected && (
        <>
          {/* Quick stats bar */}
          <div className="flex flex-wrap gap-4 text-xs text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 rounded-lg px-4 py-3 border border-slate-200 dark:border-slate-700">
            <span className="flex items-center gap-1"><Rows3 className="w-3.5 h-3.5" /> {selected.rowCount.toLocaleString()} rows</span>
            <span className="flex items-center gap-1"><Columns3 className="w-3.5 h-3.5" /> {selected.schema.columnNames.length} columns</span>
            <span className="flex items-center gap-1"><Hash className="w-3.5 h-3.5 text-blue-500" /> {numericCols.length} numeric</span>
            <span className="flex items-center gap-1"><Type className="w-3.5 h-3.5 text-violet-500" /> {categoricalCols.length} categorical</span>
            <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5 text-amber-500" /> {dateCols.length} date</span>
            <span className="ml-auto text-slate-400">Uploaded {new Date(selected.uploadedAt).toLocaleDateString()}</span>
          </div>

          {/* Tab bar */}
          <div className="flex gap-1 border-b border-slate-200 dark:border-slate-700">
            {tabs.map(tab => (
              <button
                key={tab.key}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.key
                    ? 'border-teal-500 text-teal-600 dark:text-teal-400'
                    : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
                onClick={() => setActiveTab(tab.key)}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Numeric KPI stat cards */}
              {numericCols.length > 0 && (
                <section>
                  <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
                    <Hash className="w-4 h-4 text-blue-500" />
                    Numeric Summary
                  </h2>
                  <NumericStats columns={numericCols} />
                </section>
              )}

              {/* Top categorical breakdowns */}
              {categoricalCols.length > 0 && (
                <section>
                  <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
                    <PieIcon className="w-4 h-4 text-violet-500" />
                    Categorical Breakdowns
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {categoricalCols.slice(0, 4).map(col => (
                      <CategoricalBreakdown key={col.name} col={col} rows={selected.rows} />
                    ))}
                  </div>
                </section>
              )}

              {/* Correlations */}
              {numericCols.length >= 2 && (
                <section>
                  <CorrelationInsights numericCols={numericCols} rows={selected.rows} />
                </section>
              )}
            </div>
          )}

          {activeTab === 'charts' && (
            <div className="space-y-6">
              {/* Numeric distributions */}
              {numericCols.length > 0 && (
                <section>
                  <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-blue-500" />
                    Numeric Distributions
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {numericCols.slice(0, 8).map(col => (
                      <NumericDistribution key={col.name} col={col} rows={selected.rows} />
                    ))}
                  </div>
                </section>
              )}

              {/* All categorical breakdowns */}
              {categoricalCols.length > 0 && (
                <section>
                  <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
                    <PieIcon className="w-4 h-4 text-violet-500" />
                    All Categorical Columns
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {categoricalCols.map(col => (
                      <CategoricalBreakdown key={col.name} col={col} rows={selected.rows} />
                    ))}
                  </div>
                </section>
              )}

              {/* Correlations */}
              {numericCols.length >= 2 && (
                <CorrelationInsights numericCols={numericCols} rows={selected.rows} />
              )}
            </div>
          )}

          {activeTab === 'table' && (
            <DataTablePreview dataset={selected} />
          )}

          {activeTab === 'schema' && (
            <SchemaPanel dataset={selected} />
          )}
        </>
      )}
    </div>
  );
}
