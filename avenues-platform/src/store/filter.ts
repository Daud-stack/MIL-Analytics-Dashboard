import { create } from "zustand";

// ─── Time Period Types ───────────────────────────────────────

export type PeriodGranularity = "day" | "week" | "month" | "quarter" | "year";

export interface DateRange {
  startMonth: number; // 0-11
  endMonth: number;   // 0-11 (inclusive)
}

/** Quarter definitions: Q1=Jan-Mar, Q2=Apr-Jun, Q3=Jul-Sep, Q4=Oct-Dec */
export const QUARTERS: Record<string, DateRange> = {
  Q1: { startMonth: 0, endMonth: 2 },
  Q2: { startMonth: 3, endMonth: 5 },
  Q3: { startMonth: 6, endMonth: 8 },
  Q4: { startMonth: 9, endMonth: 11 },
};

/** Week approximations mapped to months (for monthly-granularity data) */
export const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
] as const;

// ─── Filter Store ────────────────────────────────────────────

interface FilterState {
  // Existing
  year: number;
  month: string;              // "Full Year" | "Jan" | "Feb" | ... | "Dec"
  compareYear?: number;
  isOnline: boolean;

  // New: drill-down
  granularity: PeriodGranularity;
  selectedQuarter?: string;   // "Q1" | "Q2" | "Q3" | "Q4"
  selectedMonths: number[];   // 0-11, which months are active in the view
  dateRange: DateRange;       // derived from selection

  // Actions — existing
  setYear: (year: number) => void;
  setMonth: (month: string) => void;
  setCompareYear: (year: number | undefined) => void;
  setIsOnline: (online: boolean) => void;

  // Actions — new
  setGranularity: (g: PeriodGranularity) => void;
  setSelectedQuarter: (q: string | undefined) => void;
  setSelectedMonths: (months: number[]) => void;
  setDateRange: (range: DateRange) => void;
  resetDrillDown: () => void;
}

const currentYear = new Date().getFullYear();

const FULL_YEAR_RANGE: DateRange = { startMonth: 0, endMonth: 11 };
const ALL_MONTHS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

export const useFilterStore = create<FilterState>((set) => ({
  year: currentYear,
  month: "Full Year",
  compareYear: undefined,
  isOnline: true,

  granularity: "month",
  selectedQuarter: undefined,
  selectedMonths: ALL_MONTHS,
  dateRange: FULL_YEAR_RANGE,

  setYear: (year: number) => set({ year }),
  setMonth: (month: string) => {
    if (month === "Full Year") {
      set({
        month,
        granularity: "month",
        selectedMonths: ALL_MONTHS,
        dateRange: FULL_YEAR_RANGE,
        selectedQuarter: undefined,
      });
    } else {
      const idx = MONTH_NAMES.indexOf(month as typeof MONTH_NAMES[number]);
      if (idx >= 0) {
        set({
          month,
          granularity: "month",
          selectedMonths: [idx],
          dateRange: { startMonth: idx, endMonth: idx },
          selectedQuarter: undefined,
        });
      }
    }
  },
  setCompareYear: (compareYear) => set({ compareYear }),
  setIsOnline: (isOnline) => set({ isOnline }),

  setGranularity: (granularity) => {
    if (granularity === "year") {
      set({
        granularity,
        selectedMonths: ALL_MONTHS,
        dateRange: FULL_YEAR_RANGE,
        selectedQuarter: undefined,
        month: "Full Year",
      });
    } else if (granularity === "quarter") {
      // Default to Q1 when switching to quarter view
      set({
        granularity,
        selectedQuarter: "Q1",
        selectedMonths: [0, 1, 2],
        dateRange: QUARTERS.Q1,
        month: "Full Year",
      });
    } else {
      set({ granularity });
    }
  },

  setSelectedQuarter: (q) => {
    if (q && QUARTERS[q]) {
      const range = QUARTERS[q];
      const months = [];
      for (let i = range.startMonth; i <= range.endMonth; i++) months.push(i);
      set({
        selectedQuarter: q,
        selectedMonths: months,
        dateRange: range,
        month: "Full Year",
      });
    } else {
      set({
        selectedQuarter: undefined,
        selectedMonths: ALL_MONTHS,
        dateRange: FULL_YEAR_RANGE,
      });
    }
  },

  setSelectedMonths: (months) => {
    const sorted = [...months].sort((a, b) => a - b);
    set({
      selectedMonths: sorted,
      dateRange: {
        startMonth: sorted[0] ?? 0,
        endMonth: sorted[sorted.length - 1] ?? 11,
      },
    });
  },

  setDateRange: (dateRange) => {
    const months = [];
    for (let i = dateRange.startMonth; i <= dateRange.endMonth; i++) months.push(i);
    set({ dateRange, selectedMonths: months });
  },

  resetDrillDown: () =>
    set({
      granularity: "month",
      selectedQuarter: undefined,
      selectedMonths: ALL_MONTHS,
      dateRange: FULL_YEAR_RANGE,
      month: "Full Year",
    }),
}));
