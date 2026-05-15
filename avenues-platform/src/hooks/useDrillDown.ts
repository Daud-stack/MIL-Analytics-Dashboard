'use client';

import { useMemo } from 'react';
import {
  useFilterStore,
  QUARTERS,
  MONTH_NAMES,
  type PeriodGranularity,
} from '@/store/filter';

// ─── Types ───────────────────────────────────────────────────

export interface DrillDownPoint {
  label: string;
  value: number;
  monthIndices: number[]; // which original month indices this point aggregates
}

export interface DrillDownResult {
  /** Aggregated data points for charts/tables */
  points: DrillDownPoint[];
  /** Labels only (convenience for chart xAxis) */
  labels: string[];
  /** Values only (convenience for chart data) */
  values: number[];
  /** Sum across all visible points */
  total: number;
  /** Average across all visible points */
  average: number;
  /** Currently active granularity */
  granularity: PeriodGranularity;
  /** Currently selected months (0-11) */
  selectedMonths: number[];
  /** Whether we're viewing the full year or a subset */
  isFiltered: boolean;
}

// ─── Aggregation Logic ───────────────────────────────────────

/**
 * Aggregate a 12-element monthly array into quarterly buckets.
 */
function toQuarterly(data: number[]): DrillDownPoint[] {
  return Object.entries(QUARTERS).map(([label, range]) => {
    let sum = 0;
    const indices: number[] = [];
    for (let i = range.startMonth; i <= range.endMonth; i++) {
      sum += data[i] || 0;
      indices.push(i);
    }
    return { label, value: sum, monthIndices: indices };
  });
}

/**
 * Aggregate a 12-element monthly array into a single yearly total.
 */
function toYearly(data: number[]): DrillDownPoint[] {
  const sum = data.reduce((acc, v) => acc + (v || 0), 0);
  return [{ label: 'Total', value: sum, monthIndices: Array.from({ length: 12 }, (_, i) => i) }];
}

/**
 * Return monthly data as individual points.
 */
function toMonthly(data: number[]): DrillDownPoint[] {
  return data.map((value, idx) => ({
    label: MONTH_NAMES[idx],
    value: value || 0,
    monthIndices: [idx],
  }));
}

/**
 * Approximate weekly breakdown from monthly data.
 * Splits each month into ~4.33 weeks, distributing the value evenly.
 * This is an approximation since the source data is monthly.
 */
function toWeekly(data: number[]): DrillDownPoint[] {
  const points: DrillDownPoint[] = [];
  let weekNum = 1;
  for (let m = 0; m < 12; m++) {
    const monthVal = data[m] || 0;
    // Each month has ~4.33 weeks; use 4 weeks for simplicity
    const weeksInMonth = m === 1 ? 4 : (([3, 5, 8, 10].includes(m)) ? 4 : 5); // rough
    const perWeek = monthVal / weeksInMonth;
    for (let w = 0; w < weeksInMonth && weekNum <= 52; w++) {
      points.push({
        label: `W${weekNum}`,
        value: Math.round(perWeek * 100) / 100,
        monthIndices: [m],
      });
      weekNum++;
    }
  }
  return points;
}

/**
 * Approximate daily breakdown from monthly data.
 * Distributes each month's value evenly across its days.
 */
function toDaily(data: number[]): DrillDownPoint[] {
  const daysInMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const points: DrillDownPoint[] = [];
  let dayOfYear = 1;
  for (let m = 0; m < 12; m++) {
    const monthVal = data[m] || 0;
    const days = daysInMonth[m];
    const perDay = monthVal / days;
    for (let d = 0; d < days; d++) {
      points.push({
        label: `${MONTH_NAMES[m]} ${d + 1}`,
        value: Math.round(perDay * 100) / 100,
        monthIndices: [m],
      });
      dayOfYear++;
    }
  }
  return points;
}

// ─── Main Hook ───────────────────────────────────────────────

/**
 * useDrillDown — transform any 12-element monthly array based on
 * the global filter store's granularity and selected period.
 *
 * Usage:
 *   const revenue = useDrillDown(dashData.monthRevenue);
 *   // revenue.points → aggregated data
 *   // revenue.labels → ["Q1", "Q2", "Q3", "Q4"] or ["Jan", "Feb", ...] etc.
 *   // revenue.total → sum of visible data
 */
export function useDrillDown(monthlyData: number[] | undefined): DrillDownResult {
  const { granularity, selectedMonths } = useFilterStore();

  return useMemo(() => {
    const data = monthlyData && monthlyData.length === 12
      ? monthlyData
      : new Array(12).fill(0);

    // Step 1: Aggregate by granularity
    let allPoints: DrillDownPoint[];
    switch (granularity) {
      case 'day':
        allPoints = toDaily(data);
        break;
      case 'week':
        allPoints = toWeekly(data);
        break;
      case 'quarter':
        allPoints = toQuarterly(data);
        break;
      case 'year':
        allPoints = toYearly(data);
        break;
      case 'month':
      default:
        allPoints = toMonthly(data);
        break;
    }

    // Step 2: Filter to selected months
    const isFiltered = selectedMonths.length < 12;
    const selectedSet = new Set(selectedMonths);
    const points = isFiltered
      ? allPoints.filter((p) => p.monthIndices.some((mi) => selectedSet.has(mi)))
      : allPoints;

    const values = points.map((p) => p.value);
    const total = values.reduce((sum, v) => sum + v, 0);
    const average = values.length > 0 ? total / values.length : 0;

    return {
      points,
      labels: points.map((p) => p.label),
      values,
      total,
      average,
      granularity,
      selectedMonths,
      isFiltered,
    };
  }, [monthlyData, granularity, selectedMonths]);
}

/**
 * useDrillDownRecord — drill-down for Record<string, number[]> data
 * (e.g., patientDays by ward, revenue by location).
 * Returns a Map of key → DrillDownResult.
 */
export function useDrillDownRecord(
  record: Record<string, number[]> | undefined
): Map<string, DrillDownResult> {
  const { granularity, selectedMonths } = useFilterStore();

  return useMemo(() => {
    const result = new Map<string, DrillDownResult>();
    if (!record) return result;

    for (const [key, monthlyData] of Object.entries(record)) {
      const data = monthlyData?.length === 12 ? monthlyData : new Array(12).fill(0);

      let allPoints: DrillDownPoint[];
      switch (granularity) {
        case 'day': allPoints = toDaily(data); break;
        case 'week': allPoints = toWeekly(data); break;
        case 'quarter': allPoints = toQuarterly(data); break;
        case 'year': allPoints = toYearly(data); break;
        default: allPoints = toMonthly(data); break;
      }

      const isFiltered = selectedMonths.length < 12;
      const selectedSet = new Set(selectedMonths);
      const points = isFiltered
        ? allPoints.filter((p) => p.monthIndices.some((mi) => selectedSet.has(mi)))
        : allPoints;

      const values = points.map((p) => p.value);
      const total = values.reduce((sum, v) => sum + v, 0);
      const average = values.length > 0 ? total / values.length : 0;

      result.set(key, { points, labels: points.map((p) => p.label), values, total, average, granularity, selectedMonths, isFiltered });
    }

    return result;
  }, [record, granularity, selectedMonths]);
}

/**
 * useDrillDownScalar — for single summary values that don't have monthly arrays.
 * Filters claims/location scalar data based on selected month range.
 */
export function useFilteredTotal(monthlyData: number[] | undefined): number {
  const { selectedMonths } = useFilterStore();

  return useMemo(() => {
    if (!monthlyData) return 0;
    return selectedMonths.reduce((sum, mi) => sum + (monthlyData[mi] || 0), 0);
  }, [monthlyData, selectedMonths]);
}
