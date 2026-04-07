'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { StoreState, FilterState, YearData, Theme, MONTHS } from '@/types';

const currentYear = new Date().getFullYear();

const initialState = {
  years: new Map<number, YearData>(),
  currentYear,
  currentMonth: 0,
  compareYears: [],
  activePage: 'dashboard',
  theme: 'light' as Theme,
  sidebarOpen: true,
  filters: {
    years: [currentYear],
    months: [],
  } as FilterState,
};

export const useStore = create<StoreState>()(
  persist(
    (set, get) => ({
      // Initial state
      ...initialState,

      // ===== DATA ACTIONS =====

      addYearData: (year: number, data: YearData) => {
        set((state) => {
          const newYears = new Map(state.years);
          const existing = newYears.get(year);
          if (existing) {
            // MERGE: keep existing data for types not present in new data.
            // For Dashboard: if both exist, ADDITIVELY merge monthly arrays
            // (supports multiple facility files for same year)
            let mergedDashboard = data.dashboard || existing.dashboard;
            if (data.dashboard && existing.dashboard) {
              const a = existing.dashboard;
              const b = data.dashboard;
              const addArrays = (x: number[], y: number[]) => x.map((v, i) => v + (y[i] || 0));
              const mergeRecordArrays = (x: Record<string, number[]>, y: Record<string, number[]>) => {
                const result: Record<string, number[]> = { ...x };
                for (const [key, arr] of Object.entries(y)) {
                  result[key] = result[key] ? addArrays(result[key], arr) : [...arr];
                }
                return result;
              };
              mergedDashboard = {
                ...b,
                year,
                totalRevenue: a.totalRevenue + b.totalRevenue,
                monthRevenue: addArrays(a.monthRevenue, b.monthRevenue),
                monthEpisodes: addArrays(a.monthEpisodes, b.monthEpisodes),
                admCasualty: addArrays(a.admCasualty, b.admCasualty),
                admDay: addArrays(a.admDay, b.admDay),
                admInpatient: addArrays(a.admInpatient, b.admInpatient),
                admLab: addArrays(a.admLab, b.admLab),
                theatreCases: addArrays(a.theatreCases, b.theatreCases),
                theatreMinutes: addArrays(a.theatreMinutes, b.theatreMinutes),
                theatreUtil: addArrays(a.theatreUtil, b.theatreUtil),
                theatrePctOcc: addArrays(a.theatrePctOcc, b.theatrePctOcc),
                pharmacyRx: addArrays(a.pharmacyRx, b.pharmacyRx),
                pharmacyRev: addArrays(a.pharmacyRev, b.pharmacyRev),
                occupancyBeds: addArrays(a.occupancyBeds, b.occupancyBeds),
                occMidnight: addArrays(a.occMidnight, b.occMidnight),
                casToInpatient: addArrays(a.casToInpatient, b.casToInpatient),
                epsFinalised: addArrays(a.epsFinalised, b.epsFinalised),
                dischNotFinalised: addArrays(a.dischNotFinalised, b.dischNotFinalised),
                revPerPatDay: addArrays(a.revPerPatDay, b.revPerPatDay),
                gpEthical: addArrays(a.gpEthical, b.gpEthical),
                gpSurgical: addArrays(a.gpSurgical, b.gpSurgical),
                revLocation: mergeRecordArrays(a.revLocation, b.revLocation),
                patientDays: mergeRecordArrays(a.patientDays, b.patientDays),
                pctOccWard: mergeRecordArrays(a.pctOccWard, b.pctOccWard),
                patDaysWard: mergeRecordArrays(a.patDaysWard, b.patDaysWard),
                patDaysLOC: mergeRecordArrays(a.patDaysLOC, b.patDaysLOC),
                admPerWard: mergeRecordArrays(a.admPerWard, b.admPerWard),
                debtRecon: {
                  // For debtors: use the LATEST file's values (not additive — these are balances)
                  brought: b.debtRecon.brought.some(v => v > 0) ? b.debtRecon.brought : a.debtRecon.brought,
                  revenue: addArrays(a.debtRecon.revenue, b.debtRecon.revenue),
                  payments: addArrays(a.debtRecon.payments, b.debtRecon.payments),
                  sundries: addArrays(a.debtRecon.sundries, b.debtRecon.sundries),
                  total: b.debtRecon.total.some(v => v > 0) ? b.debtRecon.total : a.debtRecon.total,
                },
                payments: {
                  deposits: addArrays(a.payments.deposits, b.payments.deposits),
                  individual: addArrays(a.payments.individual, b.payments.individual),
                  medAid: addArrays(a.payments.medAid, b.payments.medAid),
                  batched: addArrays(a.payments.batched, b.payments.batched),
                },
              };
            }

            // For Location: merge doctor lists
            let mergedLocation = data.location || existing.location;
            if (data.location && existing.location) {
              const aDocs = existing.location.doctors || [];
              const bDocs = data.location.doctors || [];
              // Merge doctors by name
              const docMap = new Map<string, typeof aDocs[0]>();
              for (const d of aDocs) docMap.set(d.name, d);
              for (const d of bDocs) {
                const ex = docMap.get(d.name);
                if (ex) {
                  docMap.set(d.name, { ...ex, episodes: ex.episodes + d.episodes, revenue: ex.revenue + d.revenue, patients: ex.patients + d.patients });
                } else {
                  docMap.set(d.name, d);
                }
              }
              mergedLocation = {
                ...data.location,
                episodes: (existing.location.episodes || 0) + (data.location.episodes || 0),
                totalRevenue: (existing.location.totalRevenue || 0) + (data.location.totalRevenue || 0),
                doctors: Array.from(docMap.values()),
                rawRows: [...(existing.location.rawRows || []), ...(data.location.rawRows || [])],
              };
            }

            const merged: YearData = {
              year,
              dash: mergedDashboard,
              dashboard: mergedDashboard,
              loc: mergedLocation,
              location: mergedLocation,
              apac: data.claims || existing.claims,
              claims: data.claims || existing.claims,
            };
            newYears.set(year, merged);
          } else {
            newYears.set(year, data);
          }
          // Auto-switch to the year that was just added
          return { years: newYears, currentYear: year };
        });
      },

      removeYear: (year: number) => {
        set((state) => {
          const newYears = new Map(state.years);
          newYears.delete(year);
          return { years: newYears };
        });
      },

      setYear: (year: number) => {
        set({ currentYear: year });
      },

      setMonth: (month: number) => {
        set({ currentMonth: month });
      },

      toggleCompare: (year: number) => {
        set((state) => {
          const idx = state.compareYears.indexOf(year);
          if (idx > -1) {
            return {
              compareYears: state.compareYears.filter((y) => y !== year),
            };
          }
          return {
            compareYears: [...state.compareYears, year],
          };
        });
      },

      clearCompare: () => {
        set({ compareYears: [] });
      },

      // ===== UI ACTIONS =====

      setTheme: (theme: Theme) => {
        set({ theme });
        if (typeof document !== 'undefined') {
          if (theme === 'dark') {
            document.documentElement.classList.add('dark');
          } else {
            document.documentElement.classList.remove('dark');
          }
        }
      },

      toggleSidebar: () => {
        set((state) => ({ sidebarOpen: !state.sidebarOpen }));
      },

      setFilters: (filters: FilterState) => {
        set({ filters });
      },

      reset: () => {
        set(initialState);
      },
    }),
    {
      name: 'avenues-clinic-store',
      version: 1,
      storage: {
        getItem: (key: string) => {
          if (typeof window === 'undefined') return null;
          try {
            const item = localStorage.getItem(key);
            if (!item) return null;
            const data = JSON.parse(item);
            return {
              state: {
                ...data.state,
                years: new Map(data.state.years || []),
              },
              version: data.version,
            };
          } catch {
            return null;
          }
        },
        setItem: (key: string, value: { state: StoreState; version?: number }) => {
          if (typeof window === 'undefined') return;
          try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const stateToSave: Record<string, any> = { ...value.state };
            // Handle Map serialization if years exists and is a Map
            if (stateToSave.years instanceof Map) {
              stateToSave.years = Array.from((stateToSave.years as Map<number, YearData>).entries()).map(([year, data]) => [
                year,
                {
                  year: data.year,
                  dash: data.dash,
                  dashboard: data.dashboard,
                  loc: data.loc,
                  location: data.location,
                  apac: data.apac,
                  claims: data.claims,
                },
              ]);
            } else {
              // partialize stripped years out — just skip it
              delete stateToSave.years;
            }
            localStorage.setItem(key, JSON.stringify({ state: stateToSave, version: value.version }));
          } catch (error) {
            console.error('Failed to save store:', error);
          }
        },
        removeItem: (key: string) => {
          if (typeof window !== 'undefined') {
            localStorage.removeItem(key);
          }
        },
      },
      // Persist essential keys including years data
      partialize: (state) => ({
        years: state.years,
        currentYear: state.currentYear,
        currentMonth: state.currentMonth,
        compareYears: state.compareYears,
        activePage: state.activePage,
        theme: state.theme,
        sidebarOpen: state.sidebarOpen,
        filters: state.filters,
      }) as unknown as StoreState,
    }
  )
);

// ===== SELECTOR HOOKS =====

export const useYears = () => useStore((state) => state.years);
export const useCurrentYear = () => useStore((state) => state.currentYear);
export const useCurrentMonth = () => useStore((state) => state.currentMonth);
export const useCompareYears = () => useStore((state) => state.compareYears);
export const useActivePage = () => useStore((state) => state.activePage);
export const useTheme = () => useStore((state) => state.theme);
export const useSidebarOpen = () => useStore((state) => state.sidebarOpen);
export const useFilters = () => useStore((state) => state.filters);

// ===== HELPER SELECTORS =====

/**
 * Get the current year's full YearData
 */
export const useCurrentYearData = () =>
  useStore((state) => state.years.get(state.currentYear));

/**
 * Get the dashboard data for current year
 */
export const useDashboard = () =>
  useStore((state) => {
    const yearData = state.years.get(state.currentYear);
    return yearData?.dashboard || yearData?.dash || null;
  });

/**
 * Get the location data for current year
 */
export const useLocation = () =>
  useStore((state) => {
    const yearData = state.years.get(state.currentYear);
    return yearData?.location || yearData?.loc || null;
  });

/**
 * Get the claims data for current year
 */
export const useClaims = () =>
  useStore((state) => {
    const yearData = state.years.get(state.currentYear);
    return yearData?.claims || yearData?.apac || null;
  });

/**
 * Get a single month value from an array, or sum if month is 0 (full year)
 * @param arr - array of 12 monthly values
 * @param month - 0-11 for specific month, or 0 for sum of all (from currentMonth state)
 */
export const useMonthValue = (arr?: number[]) => {
  const currentMonth = useCurrentMonth();
  if (!arr) return 0;
  if (currentMonth === 0) {
    return arr.reduce((a, b) => a + b, 0);
  }
  return arr[currentMonth] || 0;
};

/**
 * Get a month slice or full array
 * @param arr - array of 12 monthly values
 * @returns the full array or sliced array based on currentMonth
 */
export const useMonthData = (arr?: number[]) => {
  const currentMonth = useCurrentMonth();
  if (!arr) return [];
  if (currentMonth === 0) {
    return arr;
  }
  return currentMonth > 0 && currentMonth < arr.length ? [arr[currentMonth]] : [];
};

/**
 * Get month labels (abbreviated or full)
 */
export const useMonthLabels = (abbreviated = false) => {
  const currentMonth = useCurrentMonth();
  if (currentMonth === 0) {
    return abbreviated ? ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'] : MONTHS;
  }
  return [MONTHS[currentMonth]];
};

// ===== ACTION HOOKS =====

export const useSetYear = () => useStore((state) => state.setYear);
export const useSetMonth = () => useStore((state) => state.setMonth);
export const useAddYearData = () => useStore((state) => state.addYearData);
export const useRemoveYear = () => useStore((state) => state.removeYear);
export const useToggleCompare = () => useStore((state) => state.toggleCompare);
export const useClearCompare = () => useStore((state) => state.clearCompare);
export const useSetTheme = () => useStore((state) => state.setTheme);
export const useToggleSidebar = () => useStore((state) => state.toggleSidebar);
export const useSetFilters = () => useStore((state) => state.setFilters);
export const useResetStore = () => useStore((state) => state.reset);
