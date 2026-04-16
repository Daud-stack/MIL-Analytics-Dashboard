'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { produce } from 'immer';
import { StoreState, FilterState, YearData, Theme, MONTHS, DashboardMetrics, UploadRecord, GenericDataset, ClaimsMetrics, LocationData, ClaimSchemeData, DailyDataPatch } from '@/types';

const currentYear = new Date().getFullYear();

const initialState = {
  years: new Map<number, YearData>(),
  currentYear,
  currentMonth: 0,
  compareYears: [] as number[],
  processedFileHashes: [] as string[],
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
  'years' | 'currentYear' | 'currentMonth' | 'compareYears' | 'processedFileHashes' | 'activePage' | 'theme' | 'sidebarOpen' | 'filters'
>;

const MONTH_COUNT = 12;

function normalizeSeries(values?: number[]): number[] {
  return Array.from({ length: MONTH_COUNT }, (_, idx) => {
    const value = values?.[idx];
    return Number.isFinite(value) ? Number(value) : 0;
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

/**
 * Sum multiple DashboardMetrics objects into one.
 * Used for aggregating snapshots from different files.
 */
function sumDashboardMetrics(snapshots: Record<string, DashboardMetrics>, year: number): DashboardMetrics | null {
  const keys = Object.keys(snapshots);
  if (keys.length === 0) return null;
  if (keys.length === 1) return snapshots[keys[0]];

  // Identity helpers
  const MONTH_COUNT = 12;
  const add = (a: number[] | undefined, b: number[] | undefined): number[] =>
    Array.from({ length: 12 }, (_, i) => {
      const valA = a?.[i] ?? 0;
      const valB = b?.[i] ?? 0;
      const sum = (Number.isFinite(valA) ? valA : 0) + (Number.isFinite(valB) ? valB : 0);
      return Number.isFinite(sum) ? sum : 0;
    });
  const max = (a: number[] | undefined, b: number[] | undefined): number[] =>
    Array.from({ length: 12 }, (_, i) => {
      const valA = a?.[i] ?? 0;
      const valB = b?.[i] ?? 0;
      const m = Math.max(Number.isFinite(valA) ? valA : 0, Number.isFinite(valB) ? valB : 0);
      return Number.isFinite(m) ? m : 0;
    });
  const mergeRecords = (a: Record<string, number[]> | undefined, b: Record<string, number[]> | undefined): Record<string, number[]> => {
    const res = { ...(a || {}) };
    for (const [k, bArr] of Object.entries(b || {})) {
      res[k] = res[k] ? add(res[k], bArr) : [...bArr];
    }
    return res;
  };

  // Start with empty metrics
  let total: DashboardMetrics = {
    year, totalRevenue: 0, monthRevenue: new Array(12).fill(0), monthEpisodes: new Array(12).fill(0),
    admCasualty: new Array(12).fill(0), admDay: new Array(12).fill(0), admInpatient: new Array(12).fill(0), admLab: new Array(12).fill(0),
    theatreCases: new Array(12).fill(0), theatreMinutes: new Array(12).fill(0), theatreUtil: new Array(12).fill(0), theatrePctOcc: new Array(12).fill(0),
    pharmacyRx: new Array(12).fill(0), pharmacyRev: new Array(12).fill(0), occupancyBeds: new Array(12).fill(0), patientDays: {},
    pctOccWard: {}, patDaysWard: {}, patDaysLOC: {}, occMidnight: new Array(12).fill(0), revLocation: {}, admPerWard: {},
    debtRecon: { brought: new Array(12).fill(0), revenue: new Array(12).fill(0), payments: new Array(12).fill(0), sundries: new Array(12).fill(0), total: new Array(12).fill(0) },
    casToInpatient: new Array(12).fill(0), epsFinalised: new Array(12).fill(0), dischNotFinalised: new Array(12).fill(0),
    revPerPatDay: new Array(12).fill(0), gpEthical: new Array(12).fill(0), gpSurgical: new Array(12).fill(0),
    payments: { deposits: new Array(12).fill(0), individual: new Array(12).fill(0), medAid: new Array(12).fill(0), batched: new Array(12).fill(0) },
    rawColumns: {}, discharges: {}, dischargesPerWard: {}, patientsAtMidday: {}, billedPatDays: {}, cosLocation: {},
    gpEthicalPerLoc: {}, gpSurgicalPerLoc: {}, revPerRevCentre: {}, chargeableItems: {}, nonChargeableItems: {},
    stockReceiptsDiscount: {}, stockReceipts: {}, stockReceiptsValue: {}, prescriptionsHospital: new Array(12).fill(0),
    prescriptionsRetail: new Array(12).fill(0), prescriptionsRevHospital: new Array(12).fill(0), prescriptionsRevRetail: new Array(12).fill(0),
    dischNotFinalisedValue: new Array(12).fill(0), accountSundries: new Array(12).fill(0)
  };

  for (const snap of Object.values(snapshots)) {
    total = {
      ...snap, // carry over base properties
      year,
      totalRevenue: total.totalRevenue + snap.totalRevenue,
      monthRevenue: add(total.monthRevenue, snap.monthRevenue),
      monthEpisodes: add(total.monthEpisodes, snap.monthEpisodes),
      admCasualty: add(total.admCasualty, snap.admCasualty),
      admDay: add(total.admDay, snap.admDay),
      admInpatient: add(total.admInpatient, snap.admInpatient),
      admLab: add(total.admLab, snap.admLab),
      theatreCases: add(total.theatreCases, snap.theatreCases),
      theatreMinutes: add(total.theatreMinutes, snap.theatreMinutes),
      theatreUtil: max(total.theatreUtil, snap.theatreUtil),
      theatrePctOcc: max(total.theatrePctOcc, snap.theatrePctOcc),
      pharmacyRx: add(total.pharmacyRx, snap.pharmacyRx),
      pharmacyRev: add(total.pharmacyRev, snap.pharmacyRev),
      occupancyBeds: max(total.occupancyBeds, snap.occupancyBeds),
      occMidnight: add(total.occMidnight, snap.occMidnight),
      casToInpatient: add(total.casToInpatient, snap.casToInpatient),
      epsFinalised: add(total.epsFinalised, snap.epsFinalised),
      dischNotFinalised: add(total.dischNotFinalised, snap.dischNotFinalised),
      revPerPatDay: max(total.revPerPatDay, snap.revPerPatDay),
      gpEthical: max(total.gpEthical, snap.gpEthical),
      gpSurgical: max(total.gpSurgical, snap.gpSurgical),
      prescriptionsHospital: add(total.prescriptionsHospital, snap.prescriptionsHospital),
      prescriptionsRetail: add(total.prescriptionsRetail, snap.prescriptionsRetail),
      prescriptionsRevHospital: add(total.prescriptionsRevHospital, snap.prescriptionsRevHospital),
      prescriptionsRevRetail: add(total.prescriptionsRevRetail, snap.prescriptionsRevRetail),
      dischNotFinalisedValue: add(total.dischNotFinalisedValue, snap.dischNotFinalisedValue),
      accountSundries: add(total.accountSundries, snap.accountSundries),
      // Record maps
      patientDays: mergeRecords(total.patientDays, snap.patientDays),
      pctOccWard: mergeRecords(total.pctOccWard, snap.pctOccWard),
      patDaysWard: mergeRecords(total.patDaysWard, snap.patDaysWard),
      patDaysLOC: mergeRecords(total.patDaysLOC, snap.patDaysLOC),
      admPerWard: mergeRecords(total.admPerWard, snap.admPerWard),
      revLocation: mergeRecords(total.revLocation, snap.revLocation),
      rawColumns: mergeRecords(total.rawColumns, snap.rawColumns),
      discharges: mergeRecords(total.discharges, snap.discharges),
      dischargesPerWard: mergeRecords(total.dischargesPerWard, snap.dischargesPerWard),
      patientsAtMidday: mergeRecords(total.patientsAtMidday, snap.patientsAtMidday),
      billedPatDays: mergeRecords(total.billedPatDays, snap.billedPatDays),
      cosLocation: mergeRecords(total.cosLocation, snap.cosLocation),
      gpEthicalPerLoc: mergeRecords(total.gpEthicalPerLoc, snap.gpEthicalPerLoc),
      gpSurgicalPerLoc: mergeRecords(total.gpSurgicalPerLoc, snap.gpSurgicalPerLoc),
      revPerRevCentre: mergeRecords(total.revPerRevCentre, snap.revPerRevCentre),
      chargeableItems: mergeRecords(total.chargeableItems, snap.chargeableItems),
      nonChargeableItems: mergeRecords(total.nonChargeableItems, snap.nonChargeableItems),
      stockReceiptsDiscount: mergeRecords(total.stockReceiptsDiscount, snap.stockReceiptsDiscount),
      stockReceipts: mergeRecords(total.stockReceipts, snap.stockReceipts),
      stockReceiptsValue: mergeRecords(total.stockReceiptsValue, snap.stockReceiptsValue),
      debtRecon: {
        brought: add(total.debtRecon.brought, snap.debtRecon.brought),
        revenue: add(total.debtRecon.revenue, snap.debtRecon.revenue),
        payments: add(total.debtRecon.payments, snap.debtRecon.payments),
        sundries: add(total.debtRecon.sundries, snap.debtRecon.sundries),
        total: add(total.debtRecon.total, snap.debtRecon.total),
      },
      payments: {
        deposits: add(total.payments.deposits, snap.payments.deposits),
        individual: add(total.payments.individual, snap.payments.individual),
        medAid: add(total.payments.medAid, snap.payments.medAid),
        batched: add(total.payments.batched, snap.payments.batched),
      },
    };
  }

  return total;
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

          // ════════════════════════════════════════════════════════
          // ── DEEP MERGE with existing year data ──
          //
          // Core principle: uploading one file type must NEVER wipe
          // another type's data. We merge per-category:
          //
          //   Dashboard → ADDITIVE  (sum monthly arrays for daily updates)
          //   Location  → APPEND    (add new episodes, increment ICD counts)
          //   Claims    → APPEND    (add new claims, increment scheme counts)
          //   Datasets  → APPEND    (add new generic datasets)
          // ════════════════════════════════════════════════════════

          // ──────────────────────────────────────────────────────
          // HELPER: Add two 12-element monthly arrays element-wise
          // ──────────────────────────────────────────────────────
          const addArrays = (a: number[] | undefined, b: number[] | undefined): number[] =>
            Array.from({ length: 12 }, (_, i) => {
              const valA = a?.[i] ?? 0;
              const valB = b?.[i] ?? 0;
              const sum = (Number.isFinite(valA) ? valA : 0) + (Number.isFinite(valB) ? valB : 0);
              return Number.isFinite(sum) ? sum : 0;
            });

          // Take element-wise max (dedup-safe for re-uploads of same file)
          const maxArrays = (a: number[] | undefined, b: number[] | undefined): number[] =>
            Array.from({ length: 12 }, (_, i) => {
              const valA = a?.[i] ?? 0;
              const valB = b?.[i] ?? 0;
              const max = Math.max(Number.isFinite(valA) ? valA : 0, Number.isFinite(valB) ? valB : 0);
              return Number.isFinite(max) ? max : 0;
            });

          // Merge Record<string, number> maps by incrementing counts
          const incrementCountMap = (
            a: Record<string, number> | undefined,
            b: Record<string, number> | undefined
          ): Record<string, number> => {
            const result = { ...(a || {}) };
            for (const [k, v] of Object.entries(b || {})) {
              const valA = result[k] ?? 0;
              const valB = v ?? 0;
              const sum = (Number.isFinite(valA) ? valA : 0) + (Number.isFinite(valB) ? valB : 0);
              result[k] = Number.isFinite(sum) ? sum : 0;
            }
            return result;
          };

          // Merge Record<string, {count, desc}> maps by incrementing counts
          const incrementCodeMap = (
            a: Record<string, { count: number; desc: string }> | undefined,
            b: Record<string, { count: number; desc: string }> | undefined
          ): Record<string, { count: number; desc: string }> => {
            const result = { ...(a || {}) };
            for (const [code, info] of Object.entries(b || {})) {
              if (result[code]) {
                result[code] = {
                  count: result[code].count + info.count,
                  desc: info.desc || result[code].desc,
                };
              } else {
                result[code] = { ...info };
              }
            }
            return result;
          };

          // Merge Record<string, number[]> by adding arrays per key
          const mergeRecordArrays = (
            a: Record<string, number[]> | undefined,
            b: Record<string, number[]> | undefined
          ): Record<string, number[]> => {
            const result = { ...(a || {}) };
            for (const [k, bArr] of Object.entries(b || {})) {
              if (result[k]) {
                result[k] = addArrays(result[k], bArr);
              } else {
                result[k] = [...bArr];
              }
            }
            return result;
          };

          // ──────────────────────────────────────────────────────
          // 1. DASHBOARD: Idempotent Snapshot-based Merge
          //    Each file hash gets its own slot. Doubling is impossible.
          // ──────────────────────────────────────────────────────
          let mergedDashboardSnapshots: Record<string, DashboardMetrics> = existing.dashboardSnapshots || {};
          
          // Legacy migration
          if (Object.keys(mergedDashboardSnapshots).length === 0 && existing.dashboard) {
            mergedDashboardSnapshots['legacy'] = existing.dashboard;
          }

          if (normalizedData.dashboard) {
            // Find hash from the incoming upload record
            const incomingUpload = normalizedData.uploads.find(u => u.category === 'Dashboard');
            const hash = incomingUpload?.fileHash || incomingUpload?.id || 'unknown';
            
            // Store the new snapshot (replaces if same hash)
            mergedDashboardSnapshots = {
              ...mergedDashboardSnapshots,
              [hash]: normalizedData.dashboard,
            };
            
            console.log(`[Store] Stored Dashboard snapshot for hash: ${hash}. Total snapshots: ${Object.keys(mergedDashboardSnapshots).length}`);
          }

          // Compute global dashboard by summing all snapshots
          const mergedDashboard = sumDashboardMetrics(mergedDashboardSnapshots, year);
            mergedDashboard = normalizedData.dashboard;
          }

          // ──────────────────────────────────────────────────────
          // 2. LOCATION: Append with row-level deduplication
          //    If a user uploads an "updated" LOC file (same rows + new rows),
          //    only the truly new rows contribute to aggregates.
          // ──────────────────────────────────────────────────────
          let mergedLocation: LocationData | null = existing.location;

          if (normalizedData.location && existing.location) {
            const a = existing.location;
            const b = normalizedData.location;

            // Build set of existing Episode IDs for dedup
            const existingEpisodeIds = new Set<string>();
            for (const row of (a.rawRows || [])) {
              // Try Episode column (most common key)
              const epId = String(row['Episode'] || row['episode'] || '').trim();
              if (epId) existingEpisodeIds.add(epId);
            }

            // Filter incoming rawRows to only truly NEW rows
            const incomingRows = b.rawRows || [];
            let newRows: Record<string, unknown>[];
            if (existingEpisodeIds.size > 0 && incomingRows.length > 0) {
              newRows = incomingRows.filter(row => {
                const epId = String(row['Episode'] || row['episode'] || '').trim();
                return !epId || !existingEpisodeIds.has(epId);
              });
              console.log(`[Store] Location dedup: ${incomingRows.length} incoming, ${newRows.length} new (${incomingRows.length - newRows.length} duplicates skipped)`);
            } else {
              newRows = incomingRows;
            }

            // Compute the fraction of new rows vs total incoming
            // Use this to scale aggregates proportionally
            const totalIncoming = incomingRows.length || 1;
            const newFraction = newRows.length / totalIncoming;

            // Scale the incoming aggregates by the fraction of new rows
            const scaleArray = (arr: number[]): number[] =>
              arr.map(v => Math.round(v * newFraction));
            const scaleCountMap = (m: Record<string, number>): Record<string, number> => {
              const result: Record<string, number> = {};
              for (const [k, v] of Object.entries(m)) {
                result[k] = Math.round(v * newFraction);
              }
              return result;
            };
            const scaleCodeMap = (m: Record<string, { count: number; desc: string }>): Record<string, { count: number; desc: string }> => {
              const result: Record<string, { count: number; desc: string }> = {};
              for (const [k, v] of Object.entries(m)) {
                result[k] = { count: Math.round(v.count * newFraction), desc: v.desc };
              }
              return result;
            };

            // Merge doctors by name: scale incoming by new fraction
            const docMap = new Map<string, typeof a.doctors[0]>();
            for (const d of a.doctors) docMap.set(d.name, { ...d });
            for (const d of b.doctors) {
              const scaledEps = Math.round(d.episodes * newFraction);
              const scaledRev = d.revenue * newFraction;
              const scaledPat = Math.round(d.patients * newFraction);
              if (scaledEps === 0 && scaledRev === 0) continue; // nothing new for this doctor
              const ex = docMap.get(d.name);
              if (ex) {
                const totalEps = ex.episodes + scaledEps;
                docMap.set(d.name, {
                  ...d,
                  episodes: totalEps,
                  revenue: ex.revenue + scaledRev,
                  avgLOS: totalEps > 0
                    ? (ex.avgLOS * ex.episodes + d.avgLOS * scaledEps) / totalEps
                    : ex.avgLOS,
                  patients: ex.patients + scaledPat,
                });
              } else {
                docMap.set(d.name, { ...d, episodes: scaledEps, revenue: scaledRev, patients: scaledPat });
              }
            }

            mergedLocation = {
              ...b,
              year,
              episodes: a.episodes + newRows.length,
              totalRevenue: a.totalRevenue + (b.totalRevenue * newFraction),
              monthEpisodes: addArrays(a.monthEpisodes, scaleArray(b.monthEpisodes)),
              monthRevenue: addArrays(a.monthRevenue, b.monthRevenue.map(v => v * newFraction)),
              doctors: Array.from(docMap.values()).sort((x, y) => y.revenue - x.revenue),
              icdCodes: incrementCodeMap(a.icdCodes, scaleCodeMap(b.icdCodes)),
              cptCodes: incrementCodeMap(a.cptCodes, scaleCodeMap(b.cptCodes)),
              specialties: incrementCountMap(a.specialties, scaleCountMap(b.specialties)),
              medAids: incrementCountMap(a.medAids, scaleCountMap(b.medAids)),
              ageGroups: incrementCountMap(a.ageGroups, scaleCountMap(b.ageGroups)),
              genders: incrementCountMap(a.genders, scaleCountMap(b.genders)),
              los: incrementCountMap(a.los, scaleCountMap(b.los)),
              rawRows: [...(a.rawRows || []), ...newRows],
            };
          } else if (normalizedData.location) {
            mergedLocation = normalizedData.location;
          }

          // ──────────────────────────────────────────────────────
          // 3. CLAIMS: Append with row-level deduplication
          //    Uses Episode + ClaimDate composite key to detect
          //    overlapping rows in near-duplicate uploads
          // ──────────────────────────────────────────────────────
          let mergedClaims: ClaimsMetrics | null = existing.claims;

          if (normalizedData.claims && existing.claims) {
            const a = existing.claims;
            const b = normalizedData.claims;

            // Row-level dedup using composite key from rawRows
            let newFraction = 1;
            let mergedClaimRawRows: Record<string, string>[] | undefined = undefined;

            if (a.rawRows && a.rawRows.length > 0 && b.rawRows && b.rawRows.length > 0) {
              // Build set of existing composite keys: Episode|Date|Amount
              const existingKeys = new Set<string>();
              for (const row of a.rawRows) {
                const ep = (row['Episode'] || row['episode'] || '').trim();
                const dt = (row['Claim Date'] || row['claim date'] || row['Date'] || row['date'] || '').trim();
                const amt = (row['Claim Value'] || row['claim value'] || row['Amount'] || row['amount'] || '').trim();
                existingKeys.add(`${ep}|${dt}|${amt}`);
              }

              const incomingRows = b.rawRows;
              const newRows = incomingRows.filter(row => {
                const ep = (row['Episode'] || row['episode'] || '').trim();
                const dt = (row['Claim Date'] || row['claim date'] || row['Date'] || row['date'] || '').trim();
                const amt = (row['Claim Value'] || row['claim value'] || row['Amount'] || row['amount'] || '').trim();
                return !existingKeys.has(`${ep}|${dt}|${amt}`);
              });

              newFraction = incomingRows.length > 0 ? newRows.length / incomingRows.length : 0;
              mergedClaimRawRows = [...a.rawRows, ...newRows];
              console.log(`[Store] Claims dedup: ${incomingRows.length} incoming, ${newRows.length} new (${incomingRows.length - newRows.length} duplicates skipped)`);
            } else {
              // No rawRows for dedup — fall back to full additive merge
              mergedClaimRawRows = b.rawRows ? [...(a.rawRows || []), ...b.rawRows] : a.rawRows;
            }

            // Scale incoming aggregates by fraction of truly new rows
            const scaleScheme = (s: ClaimSchemeData): ClaimSchemeData => ({
              totalClaimed: Math.round(s.totalClaimed * newFraction * 100) / 100,
              submitted: Math.round(s.submitted * newFraction),
              received: Math.round(s.received * newFraction),
              rejected: Math.round(s.rejected * newFraction),
              approved: Math.round(s.approved * newFraction),
              pending: Math.round(s.pending * newFraction),
            });

            // Merge byScheme: scale then increment
            const mergedByScheme: Record<string, ClaimSchemeData> = { ...a.byScheme };
            for (const [scheme, bData] of Object.entries(b.byScheme)) {
              const scaled = scaleScheme(bData);
              const ex = mergedByScheme[scheme];
              if (ex) {
                mergedByScheme[scheme] = {
                  totalClaimed: ex.totalClaimed + scaled.totalClaimed,
                  submitted: ex.submitted + scaled.submitted,
                  received: ex.received + scaled.received,
                  rejected: ex.rejected + scaled.rejected,
                  approved: ex.approved + scaled.approved,
                  pending: ex.pending + scaled.pending,
                };
              } else {
                mergedByScheme[scheme] = scaled;
              }
            }

            // Merge byDoctor: scale then increment
            const mergedByDoctor: Record<string, { claims: number; approved: number; amount: number }> = { ...a.byDoctor };
            for (const [doc, bData] of Object.entries(b.byDoctor)) {
              const scaledClaims = Math.round(bData.claims * newFraction);
              const scaledApproved = Math.round(bData.approved * newFraction);
              const scaledAmount = bData.amount * newFraction;
              const ex = mergedByDoctor[doc];
              if (ex) {
                mergedByDoctor[doc] = {
                  claims: ex.claims + scaledClaims,
                  approved: ex.approved + scaledApproved,
                  amount: ex.amount + scaledAmount,
                };
              } else {
                mergedByDoctor[doc] = { claims: scaledClaims, approved: scaledApproved, amount: scaledAmount };
              }
            }

            const scaleCountMapFn = (m: Record<string, number>): Record<string, number> => {
              const result: Record<string, number> = {};
              for (const [k, v] of Object.entries(m)) result[k] = Math.round(v * newFraction);
              return result;
            };

            mergedClaims = {
              ...b,
              year,
              totalClaims: a.totalClaims + Math.round(b.totalClaims * newFraction),
              totalClaimed: Math.round((a.totalClaimed + b.totalClaimed * newFraction) * 100) / 100,
              submitted: a.submitted + Math.round(b.submitted * newFraction),
              received: a.received + Math.round(b.received * newFraction),
              rejected: a.rejected + Math.round(b.rejected * newFraction),
              approved: a.approved + Math.round(b.approved * newFraction),
              pending: a.pending + Math.round(b.pending * newFraction),
              byScheme: mergedByScheme,
              byStatus: incrementCountMap(a.byStatus, scaleCountMapFn(b.byStatus)),
              byMonth: incrementCountMap(
                a.byMonth as unknown as Record<string, number>,
                scaleCountMapFn(b.byMonth as unknown as Record<string, number>)
              ) as unknown as Record<number, number>,
              byDoctor: mergedByDoctor,
              totalClaims_monthly: addArrays(a.totalClaims_monthly, b.totalClaims_monthly.map(v => Math.round(v * newFraction))),
              approvedClaims_monthly: addArrays(a.approvedClaims_monthly, b.approvedClaims_monthly.map(v => Math.round(v * newFraction))),
              rejectedClaims_monthly: addArrays(a.rejectedClaims_monthly, b.rejectedClaims_monthly.map(v => Math.round(v * newFraction))),
              pendingClaims_monthly: addArrays(a.pendingClaims_monthly, b.pendingClaims_monthly.map(v => Math.round(v * newFraction))),
              claimAmounts_monthly: addArrays(a.claimAmounts_monthly, b.claimAmounts_monthly.map(v => v * newFraction)),
              rejectionReasons: incrementCountMap(a.rejectionReasons, scaleCountMapFn(b.rejectionReasons)),
              rawRows: mergedClaimRawRows,
            };
          } else if (normalizedData.claims) {
            mergedClaims = normalizedData.claims;
          }

          // ──────────────────────────────────────────────────────
          // 4. UPLOADS + DATASETS: Always append
          // ──────────────────────────────────────────────────────
          const mergedUploads = [
            ...(existing.uploads || []),
            ...(normalizedData.uploads || []),
          ];

          // Merge datasets with schema-aware deduplication
          const mergedDatasets = { ...(existing.datasets || {}) };
          if (normalizedData.datasets) {
            for (const [id, incoming] of Object.entries(normalizedData.datasets)) {
              const ds = incoming as GenericDataset;
              // Check if a dataset with the same schemaId already exists
              const existingDs = Object.values(mergedDatasets).find(
                (d) => (d as GenericDataset).schemaId === ds.schemaId
              ) as GenericDataset | undefined;
              if (existingDs) {
                try {
                  const { mergeDatasets } = require('@/lib/generic-parser');
                  mergedDatasets[existingDs.id] = mergeDatasets(existingDs, ds);
                } catch {
                  // Fallback: overwrite if merge unavailable
                  mergedDatasets[id] = ds;
                }
              } else {
                mergedDatasets[id] = ds;
              }
            }
          }

          // ──────────────────────────────────────────────────────
          // ASSEMBLE the merged YearData
          // ──────────────────────────────────────────────────────
          const merged: YearData = {
            year,
            dash: mergedDashboard,
            dashboard: mergedDashboard,
            dashboardSnapshots: mergedDashboardSnapshots,
            loc: mergedLocation,
            location: mergedLocation,
            apac: mergedClaims,
            claims: mergedClaims,
            uploads: mergedUploads,
            datasets: mergedDatasets,
          };
          newYears.set(year, merged);
          return { years: newYears, currentYear: year };
        });
      },

      // ════════════════════════════════════════════════════════════
      // appendDailyData — Lightweight incremental update for a single day.
      // Uses Immer's `produce` for safe deep nested mutations.
      // Called by the file watcher for daily data ingests.
      // ════════════════════════════════════════════════════════════
      appendDailyData: (year: number, monthIndex: number, patch: DailyDataPatch) => {
        set((state) => {
          const newYears = new Map(state.years);
          const existing = newYears.get(year);
          if (!existing) return state; // no year data yet — use addYearData for first load

          const mi = Math.max(0, Math.min(11, monthIndex)); // clamp to 0–11

          // Use Immer produce for safe deep nested mutations
          const updated = produce(existing, (draft) => {
            // ── Dashboard increments ──
            if (patch.admissions && draft.dashboard) {
              const d = draft.dashboard;
              if (patch.admissions.casualty) d.admCasualty[mi] += patch.admissions.casualty;
              if (patch.admissions.day) d.admDay[mi] += patch.admissions.day;
              if (patch.admissions.inpatient) d.admInpatient[mi] += patch.admissions.inpatient;
              if (patch.admissions.lab) d.admLab[mi] += patch.admissions.lab;
            }

            if (patch.revenue && draft.dashboard) {
              draft.dashboard.monthRevenue[mi] += patch.revenue;
              draft.dashboard.totalRevenue += patch.revenue;
            }

            if (patch.theatreCases && draft.dashboard) {
              draft.dashboard.theatreCases[mi] += patch.theatreCases;
            }

            if (patch.theatreMinutes && draft.dashboard) {
              draft.dashboard.theatreMinutes[mi] += patch.theatreMinutes;
            }

            if (patch.pharmacyRx && draft.dashboard) {
              draft.dashboard.pharmacyRx[mi] += patch.pharmacyRx;
            }

            if (patch.pharmacyRev && draft.dashboard) {
              draft.dashboard.pharmacyRev[mi] += patch.pharmacyRev;
            }

            if (patch.epsFinalised && draft.dashboard) {
              draft.dashboard.epsFinalised[mi] += patch.epsFinalised;
              draft.dashboard.monthEpisodes[mi] += patch.epsFinalised;
            }

            if (patch.payments && draft.dashboard) {
              const p = draft.dashboard.payments;
              if (patch.payments.deposits) p.deposits[mi] += patch.payments.deposits;
              if (patch.payments.individual) p.individual[mi] += patch.payments.individual;
              if (patch.payments.medAid) p.medAid[mi] += patch.payments.medAid;
              if (patch.payments.batched) p.batched[mi] += patch.payments.batched;
            }

            if (patch.wardAdmissions && draft.dashboard) {
              for (const [ward, count] of Object.entries(patch.wardAdmissions)) {
                if (!draft.dashboard.admPerWard[ward]) {
                  draft.dashboard.admPerWard[ward] = new Array(12).fill(0);
                }
                draft.dashboard.admPerWard[ward][mi] += count;
              }
            }

            if (patch.discharges && draft.dashboard) {
              for (const [type, count] of Object.entries(patch.discharges)) {
                if (!draft.dashboard.discharges[type]) {
                  draft.dashboard.discharges[type] = new Array(12).fill(0);
                }
                draft.dashboard.discharges[type][mi] += count;
              }
            }

            // Sync dash alias
            if (draft.dashboard) draft.dash = draft.dashboard;

            // ── Location increments ──
            if (draft.location) {
              if (patch.newEpisodes) {
                draft.location.episodes += patch.newEpisodes;
                draft.location.monthEpisodes[mi] += patch.newEpisodes;
              }
              if (patch.newLocationRevenue) {
                draft.location.totalRevenue += patch.newLocationRevenue;
                draft.location.monthRevenue[mi] += patch.newLocationRevenue;
              }
              if (patch.newIcdCodes) {
                for (const [code, info] of Object.entries(patch.newIcdCodes)) {
                  if (draft.location.icdCodes[code]) {
                    draft.location.icdCodes[code].count += info.count;
                  } else {
                    draft.location.icdCodes[code] = { ...info };
                  }
                }
              }
              if (patch.newCptCodes) {
                for (const [code, info] of Object.entries(patch.newCptCodes)) {
                  if (draft.location.cptCodes[code]) {
                    draft.location.cptCodes[code].count += info.count;
                  } else {
                    draft.location.cptCodes[code] = { ...info };
                  }
                }
              }
              // Sync loc alias
              draft.loc = draft.location;
            }

            // ── Claims increments ──
            if (patch.newClaims && draft.claims) {
              const c = draft.claims;
              if (patch.newClaims.total) {
                c.totalClaims += patch.newClaims.total;
                c.totalClaims_monthly[mi] += patch.newClaims.total;
              }
              if (patch.newClaims.approved) {
                c.approved += patch.newClaims.approved;
                c.approvedClaims_monthly[mi] += patch.newClaims.approved;
              }
              if (patch.newClaims.rejected) {
                c.rejected += patch.newClaims.rejected;
                c.rejectedClaims_monthly[mi] += patch.newClaims.rejected;
              }
              if (patch.newClaims.pending) {
                c.pending += patch.newClaims.pending;
                c.pendingClaims_monthly[mi] += patch.newClaims.pending;
              }
              if (patch.newClaims.amount) {
                c.totalClaimed += patch.newClaims.amount;
                c.claimAmounts_monthly[mi] += patch.newClaims.amount;
              }
            }

            if (patch.newClaimsByScheme && draft.claims) {
              for (const [scheme, data] of Object.entries(patch.newClaimsByScheme)) {
                if (!draft.claims.byScheme[scheme]) {
                  draft.claims.byScheme[scheme] = {
                    totalClaimed: 0, submitted: 0, received: 0,
                    rejected: 0, approved: 0, pending: 0,
                  };
                }
                const s = draft.claims.byScheme[scheme];
                s.totalClaimed += data.claimed;
                s.approved += data.approved;
                s.rejected += data.rejected;
              }
              // Sync apac alias
              draft.apac = draft.claims;
            }
          });

          newYears.set(year, updated);
          return { years: newYears };
        });
      },

      // ════════════════════════════════════════════════════════════
      // Duplicate prevention — client-side file hash tracking
      // ════════════════════════════════════════════════════════════
      isFileProcessed: (hash: string) => {
        return get().processedFileHashes.includes(hash);
      },

      markFileProcessed: (hash: string) => {
        set((state) => {
          if (state.processedFileHashes.includes(hash)) return state;
          // Cap at 2000 most recent hashes to prevent unbounded localStorage growth
          const MAX_HASHES = 2000;
          const updated = [...state.processedFileHashes, hash];
          return {
            processedFileHashes: updated.length > MAX_HASHES
              ? updated.slice(updated.length - MAX_HASHES)
              : updated,
          };
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
      // Custom merge: default shallow merge uses object spread which destroys Maps
      // ({ ...currentState, ...persistedState }) turns Map into {} because Maps don't spread.
      // We must explicitly preserve the years Map during hydration.
      merge: (persistedState, currentState) => {
        const persisted = persistedState as Partial<StoreState> | undefined;
        return {
          ...currentState,
          ...persisted,
          years: persisted?.years instanceof Map && persisted.years.size > 0
            ? persisted.years
            : (currentState as StoreState).years,
        } as StoreState;
      },
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
            // Passthrough ALL YearData fields (no manual list — future-proof)
            if (stateToSave.years instanceof Map) {
              stateToSave.years = Array.from(
                (stateToSave.years as Map<number, YearData>).entries()
              ).map(([yr, data]) => {
                // Strip heavy rawRows from location/claims to avoid QuotaExceededError
                const slimData = { ...data };
                if (slimData.location) {
                  slimData.location = { ...slimData.location, rawRows: [] };
                }
                if (slimData.claims) {
                  slimData.claims = { ...slimData.claims, rawRows: [] };
                }
                // Strip heavy conversionRecords array
                if (slimData.location?.conversions) {
                  slimData.location = {
                    ...slimData.location,
                    conversions: { ...slimData.location.conversions, conversionRecords: [] },
                  };
                }
                return [yr, slimData];
              });
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
        processedFileHashes: state.processedFileHashes,
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
export const useIsFileProcessed = () => useStore((state) => state.isFileProcessed);
export const useMarkFileProcessed = () => useStore((state) => state.markFileProcessed);

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
const EMPTY_UPLOADS: UploadRecord[] = [];
const EMPTY_DATASETS: Record<string, GenericDataset> = {};
const EMPTY_DATASET_LIST: GenericDataset[] = [];

export const useUploads = () =>
  useStore((state) => {
    const yearData = state.years.get(state.currentYear);
    return yearData?.uploads ?? EMPTY_UPLOADS;
  });

// Generic datasets for current year
export const useDatasets = () =>
  useStore((state) => {
    const yearData = state.years.get(state.currentYear);
    return yearData?.datasets ?? EMPTY_DATASETS;
  });

export const useDatasetList = () =>
  useStore((state) => {
    const yearData = state.years.get(state.currentYear);
    const datasets = yearData?.datasets;
    if (!datasets || Object.keys(datasets).length === 0) return EMPTY_DATASET_LIST;
    return Object.values(datasets);
  });

export const useAddDataset = () => useStore((state) => state.addDataset);
export const useRemoveDataset = () => useStore((state) => state.removeDataset);
