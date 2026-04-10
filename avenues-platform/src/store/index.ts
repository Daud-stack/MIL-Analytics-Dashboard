'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { StoreState, FilterState, YearData, Theme, MONTHS, DashboardMetrics, UploadRecord, GenericDataset } from '@/types';

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

type PersistedStoreState = Pick<
  StoreState,
  'years' | 'currentYear' | 'currentMonth' | 'compareYears' | 'activePage' | 'theme' | 'sidebarOpen' | 'filters'
>;

const MONTH_COUNT = 12;

function normalizeSeries(values?: number[]): number[] {
  return Array.from({ length: MONTH_COUNT }, (_, idx) => {
    const value = values?.[idx];
    return typeof value === 'number' && Number.isFinite(value) ? value : 0;
  });
}

function hasNonZero(values?: number[]): boolean {
  return (values || []).some((value) => Number.isFinite(value) && value !== 0);
}

export function getLatestNonZeroIndex(values?: number[]): number {
  if (!values || values.length === 0) return -1;

  for (let idx = values.length - 1; idx >= 0; idx--) {
    const value = values[idx];
    if (Number.isFinite(value) && value !== 0) {
      return idx;
    }
  }

  return values.length - 1;
}

function averageRecordSeries(record?: Record<string, number[]>): number[] {
  const series = Object.values(record || {}).filter((entry) => entry.length > 0);
  if (series.length === 0) return new Array(MONTH_COUNT).fill(0);

  return Array.from({ length: MONTH_COUNT }, (_, idx) => {
    const sum = series.reduce((acc, entry) => acc + (entry[idx] || 0), 0);
    return sum / series.length;
  });
}

function normalizeDashboardMetrics(metrics: DashboardMetrics | null): DashboardMetrics | null {
  if (!metrics) return null;

  const monthRevenue = normalizeSeries(metrics.monthRevenue);
  const epsFinalised = normalizeSeries(metrics.epsFinalised);
  const admissionsFallback = Array.from({ length: MONTH_COUNT }, (_, idx) =>
    (metrics.admCasualty?.[idx] || 0) +
    (metrics.admDay?.[idx] || 0) +
    (metrics.admInpatient?.[idx] || 0) +
    (metrics.admLab?.[idx] || 0)
  );
  const wardOccupancyAverage = averageRecordSeries(metrics.pctOccWard);

  const monthEpisodes = hasNonZero(metrics.monthEpisodes)
    ? normalizeSeries(metrics.monthEpisodes)
    : hasNonZero(epsFinalised)
      ? epsFinalised
      : admissionsFallback;

  const occupancyBeds = hasNonZero(metrics.occupancyBeds)
    ? normalizeSeries(metrics.occupancyBeds)
    : hasNonZero(wardOccupancyAverage)
      ? wardOccupancyAverage
      : normalizeSeries(metrics.theatrePctOcc);

  const theatreUtil = hasNonZero(metrics.theatreUtil)
    ? normalizeSeries(metrics.theatreUtil)
    : normalizeSeries(metrics.theatrePctOcc);

  const patientDays = Object.keys(metrics.patientDays || {}).length > 0
    ? metrics.patientDays
    : metrics.patDaysWard;

  const totalRevenue = metrics.totalRevenue > 0
    ? metrics.totalRevenue
    : monthRevenue.reduce((sum, value) => sum + value, 0);

  return {
    ...metrics,
    totalRevenue,
    monthRevenue,
    monthEpisodes,
    theatreUtil,
    theatrePctOcc: normalizeSeries(metrics.theatrePctOcc),
    theatreCases: normalizeSeries(metrics.theatreCases),
    theatreMinutes: normalizeSeries(metrics.theatreMinutes),
    admCasualty: normalizeSeries(metrics.admCasualty),
    admDay: normalizeSeries(metrics.admDay),
    admInpatient: normalizeSeries(metrics.admInpatient),
    admLab: normalizeSeries(metrics.admLab),
    pharmacyRx: normalizeSeries(metrics.pharmacyRx),
    pharmacyRev: normalizeSeries(metrics.pharmacyRev),
    occupancyBeds,
    occMidnight: normalizeSeries(metrics.occMidnight),
    casToInpatient: normalizeSeries(metrics.casToInpatient),
    epsFinalised,
    dischNotFinalised: normalizeSeries(metrics.dischNotFinalised),
    revPerPatDay: normalizeSeries(metrics.revPerPatDay),
    gpEthical: normalizeSeries(metrics.gpEthical),
    gpSurgical: normalizeSeries(metrics.gpSurgical),
    patientDays,
  };
}

export const useStore = create<StoreState>()(
  persist(
    (set, get) => ({
      // Initial state
      ...initialState,

      // ===== DATA ACTIONS =====

      addYearData: (year: number, data: YearData) => {
        // Normalize dashboard metrics ONCE at storage time (not in selectors)
        const normalizedData: YearData = {
          ...data,
          dash: normalizeDashboardMetrics(data.dash),
          dashboard: normalizeDashboardMetrics(data.dashboard),
          uploads: data.uploads || [],
        };

        set((state) => {
          const newYears = new Map(state.years);
          const existing = newYears.get(year);

          if (!existing) {
            // First upload for this year — store directly
            newYears.set(year, normalizedData);
            return { years: newYears, currentYear: year };
          }

          // ── MERGE with existing year data ──
          // Strategy per category:
          //   Dashboard → REPLACE (aggregate metrics, re-uploading = correction)
          //   Location  → APPEND  (row-level, daily updates add new episodes)
          //   Claims    → APPEND  (row-level, daily updates add new claims)

          // Dashboard: latest upload always wins (no additive doubling)
          const mergedDashboard = normalizedData.dashboard || existing.dashboard;

          // Location: APPEND — merge aggregates, dedup doctors by name
          let mergedLocation = normalizedData.location || existing.location;
          if (normalizedData.location && existing.location) {
            const a = existing.location;
            const b = normalizedData.location;

            // Merge doctors by name: if doctor exists, take the HIGHER values (dedup-safe)
            const docMap = new Map<string, typeof a.doctors[0]>();
            for (const d of a.doctors) docMap.set(d.name, d);
            for (const d of b.doctors) {
              const ex = docMap.get(d.name);
              if (ex) {
                // Dedup: take the max of each aggregate (handles re-upload of same file)
                docMap.set(d.name, {
                  ...d,
                  episodes: Math.max(ex.episodes, d.episodes),
                  revenue: Math.max(ex.revenue, d.revenue),
                  avgLOS: d.avgLOS || ex.avgLOS,
                  patients: Math.max(ex.patients, d.patients),
                });
              } else {
                docMap.set(d.name, d);
              }
            }

            // Merge code maps (dedup by key — take max count)
            const mergeCodeMaps = (
              x: Record<string, { count: number; desc: string }>,
              y: Record<string, { count: number; desc: string }>
            ) => {
              const result = { ...x };
              for (const [code, info] of Object.entries(y)) {
                if (result[code]) {
                  result[code] = { count: Math.max(result[code].count, info.count), desc: info.desc || result[code].desc };
                } else {
                  result[code] = info;
                }
              }
              return result;
            };

            // Merge simple count maps (take max for dedup safety)
            const mergeCountMaps = (x: Record<string, number>, y: Record<string, number>) => {
              const result = { ...x };
              for (const [k, v] of Object.entries(y)) {
                result[k] = Math.max(result[k] || 0, v);
              }
              return result;
            };

            // Merge monthly arrays: element-wise max (dedup-safe for same-file re-upload)
            const maxArrays = (x: number[], y: number[]) =>
              Array.from({ length: 12 }, (_, i) => Math.max(x[i] || 0, y[i] || 0));

            // For truly NEW data (different date ranges), use additive merge
            // Heuristic: if total episodes differ significantly, it's new data → add
            const isNewData = Math.abs(a.episodes - b.episodes) > (a.episodes * 0.1);
            const addArrays = (x: number[], y: number[]) => x.map((v, i) => v + (y[i] || 0));
            const mergeArrays = isNewData ? addArrays : maxArrays;

            mergedLocation = {
              ...b,
              year,
              episodes: isNewData ? a.episodes + b.episodes : Math.max(a.episodes, b.episodes),
              totalRevenue: isNewData ? a.totalRevenue + b.totalRevenue : Math.max(a.totalRevenue, b.totalRevenue),
              monthEpisodes: mergeArrays(a.monthEpisodes, b.monthEpisodes),
              monthRevenue: mergeArrays(a.monthRevenue, b.monthRevenue),
              doctors: Array.from(docMap.values()).sort((x, y) => y.revenue - x.revenue),
              icdCodes: mergeCodeMaps(a.icdCodes, b.icdCodes),
              cptCodes: mergeCodeMaps(a.cptCodes, b.cptCodes),
              specialties: mergeCountMaps(a.specialties, b.specialties),
              medAids: mergeCountMaps(a.medAids, b.medAids),
              ageGroups: mergeCountMaps(a.ageGroups, b.ageGroups),
              genders: mergeCountMaps(a.genders, b.genders),
              los: mergeCountMaps(a.los, b.los),
              rawRows: [...(a.rawRows || []), ...(b.rawRows || [])],
            };
          }

          // Claims: latest upload replaces (append not yet needed)
          const mergedClaims = normalizedData.claims || existing.claims;

          // Merge upload history
          const mergedUploads = [
            ...(existing.uploads || []),
            ...(normalizedData.uploads || []),
          ];

          const merged: YearData = {
            year,
            dash: mergedDashboard,
            dashboard: mergedDashboard,
            loc: mergedLocation,
            location: mergedLocation,
            apac: mergedClaims,
            claims: mergedClaims,
            uploads: mergedUploads,
            datasets: { ...(existing.datasets || {}), ...(normalizedData.datasets || {}) },
          };
          newYears.set(year, merged);
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

      removeUpload: (year: number, uploadId: string) => {
        set((state) => {
          const newYears = new Map(state.years);
          const existing = newYears.get(year);
          if (!existing) return state;

          const upload = (existing.uploads || []).find(u => u.id === uploadId);
          if (!upload) return state;

          // Remove the upload record
          const updatedUploads = (existing.uploads || []).filter(u => u.id !== uploadId);

          // If this was the only upload for that category, null out the data slot
          const remainingForCategory = updatedUploads.filter(u => u.category === upload.category);
          const updated: YearData = {
            ...existing,
            uploads: updatedUploads,
          };

          if (remainingForCategory.length === 0) {
            if (upload.category === 'Dashboard') {
              updated.dash = null;
              updated.dashboard = null;
            } else if (upload.category === 'Location') {
              updated.loc = null;
              updated.location = null;
            } else if (upload.category === 'Claims') {
              updated.apac = null;
              updated.claims = null;
            }
          }

          newYears.set(year, updated);
          return { years: newYears };
        });
      },

      addDataset: (year: number, dataset: GenericDataset) => {
        set((state) => {
          const newYears = new Map(state.years);
          const existing = newYears.get(year) || {
            year, dash: null, dashboard: null, loc: null, location: null,
            apac: null, claims: null, uploads: [], datasets: {},
          };
          const datasets = { ...(existing.datasets || {}) };

          // If same schema already exists, merge (append with dedup)
          const existingDs = Object.values(datasets).find(d => d.schemaId === dataset.schemaId);
          if (existingDs) {
            // Import mergeDatasets lazily to avoid circular deps
            const { mergeDatasets } = require('@/lib/generic-parser');
            datasets[existingDs.id] = mergeDatasets(existingDs, dataset);
          } else {
            datasets[dataset.id] = dataset;
          }

          newYears.set(year, { ...existing, datasets });
          return { years: newYears, currentYear: year };
        });
      },

      removeDataset: (year: number, datasetId: string) => {
        set((state) => {
          const newYears = new Map(state.years);
          const existing = newYears.get(year);
          if (!existing) return state;
          const datasets = { ...(existing.datasets || {}) };
          delete datasets[datasetId];
          newYears.set(year, { ...existing, datasets });
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
      version: 3,
      migrate: (persistedState, version) => {
        if (!persistedState || version < 3) {
          return {
            ...initialState,
            years: new Map<number, YearData>(),
          } as unknown as StoreState;
        }

        const state = persistedState as Partial<PersistedStoreState> & {
          years?: Map<number, YearData> | Array<[number, YearData]>;
        };

        return {
          ...initialState,
          ...state,
          years: state.years instanceof Map ? state.years : new Map(state.years || []),
        } as unknown as StoreState;
      },
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
            const stateToSave: Record<string, unknown> = { ...value.state };
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
                  uploads: data.uploads || [],
                  datasets: data.datasets || {},
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
 * Get the raw dashboard data for current year.
 * NOTE: normalizeDashboardMetrics must NOT be called inside a Zustand selector
 * because it creates new object references on every call, causing infinite re-renders.
 * Use the exported normalizeDashboardMetrics function in components with useMemo instead.
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
export const useRemoveUpload = () => useStore((state) => state.removeUpload);
export const useToggleCompare = () => useStore((state) => state.toggleCompare);
export const useClearCompare = () => useStore((state) => state.clearCompare);
export const useSetTheme = () => useStore((state) => state.setTheme);
export const useToggleSidebar = () => useStore((state) => state.toggleSidebar);
export const useSetFilters = () => useStore((state) => state.setFilters);
export const useResetStore = () => useStore((state) => state.reset);

// Upload history for current year
export const useUploads = () =>
  useStore((state) => {
    const yearData = state.years.get(state.currentYear);
    return yearData?.uploads || [];
  });

// Generic datasets for current year
export const useDatasets = () =>
  useStore((state) => {
    const yearData = state.years.get(state.currentYear);
    return yearData?.datasets || {};
  });

export const useDatasetList = () =>
  useStore((state) => {
    const yearData = state.years.get(state.currentYear);
    return Object.values(yearData?.datasets || {});
  });

export const useAddDataset = () => useStore((state) => state.addDataset);
export const useRemoveDataset = () => useStore((state) => state.removeDataset);
