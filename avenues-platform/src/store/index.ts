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
          const addArrays = (a: number[], b: number[]): number[] =>
            Array.from({ length: 12 }, (_, i) => (a[i] || 0) + (b[i] || 0));

          // Take element-wise max (dedup-safe for re-uploads of same file)
          const maxArrays = (a: number[], b: number[]): number[] =>
            Array.from({ length: 12 }, (_, i) => Math.max(a[i] || 0, b[i] || 0));

          // Merge Record<string, number> maps by incrementing counts
          const incrementCountMap = (
            a: Record<string, number>,
            b: Record<string, number>
          ): Record<string, number> => {
            const result = { ...a };
            for (const [k, v] of Object.entries(b)) {
              result[k] = (result[k] || 0) + v;
            }
            return result;
          };

          // Merge Record<string, {count, desc}> maps by incrementing counts
          const incrementCodeMap = (
            a: Record<string, { count: number; desc: string }>,
            b: Record<string, { count: number; desc: string }>
          ): Record<string, { count: number; desc: string }> => {
            const result = { ...a };
            for (const [code, info] of Object.entries(b)) {
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
            a: Record<string, number[]>,
            b: Record<string, number[]>
          ): Record<string, number[]> => {
            const result = { ...a };
            for (const [k, bArr] of Object.entries(b)) {
              if (result[k]) {
                result[k] = addArrays(result[k], bArr);
              } else {
                result[k] = [...bArr];
              }
            }
            return result;
          };

          // ──────────────────────────────────────────────────────
          // 1. DASHBOARD: Additive merge for daily updates
          //    New monthly data gets ADDED to existing totals.
          //    If only one side has data, use that side.
          // ──────────────────────────────────────────────────────
          let mergedDashboard: DashboardMetrics | null = existing.dashboard;

          if (normalizedData.dashboard && existing.dashboard) {
            const a = existing.dashboard;
            const b = normalizedData.dashboard;

            // All number[] fields that should be summed
            const monthRevenue = addArrays(a.monthRevenue, b.monthRevenue);
            const monthEpisodes = addArrays(a.monthEpisodes, b.monthEpisodes);

            mergedDashboard = {
              ...b,
              year,
              totalRevenue: a.totalRevenue + b.totalRevenue,
              monthRevenue,
              monthEpisodes,
              admCasualty: addArrays(a.admCasualty, b.admCasualty),
              admDay: addArrays(a.admDay, b.admDay),
              admInpatient: addArrays(a.admInpatient, b.admInpatient),
              admLab: addArrays(a.admLab, b.admLab),
              theatreCases: addArrays(a.theatreCases, b.theatreCases),
              theatreMinutes: addArrays(a.theatreMinutes, b.theatreMinutes),
              theatreUtil: maxArrays(a.theatreUtil, b.theatreUtil), // % — take max
              theatrePctOcc: maxArrays(a.theatrePctOcc, b.theatrePctOcc), // % — take max
              pharmacyRx: addArrays(a.pharmacyRx, b.pharmacyRx),
              pharmacyRev: addArrays(a.pharmacyRev, b.pharmacyRev),
              occupancyBeds: maxArrays(a.occupancyBeds, b.occupancyBeds), // % — take max
              occMidnight: addArrays(a.occMidnight, b.occMidnight),
              casToInpatient: addArrays(a.casToInpatient, b.casToInpatient),
              epsFinalised: addArrays(a.epsFinalised, b.epsFinalised),
              dischNotFinalised: addArrays(a.dischNotFinalised, b.dischNotFinalised),
              revPerPatDay: maxArrays(a.revPerPatDay, b.revPerPatDay), // rate — take max
              gpEthical: maxArrays(a.gpEthical, b.gpEthical), // % — take max
              gpSurgical: maxArrays(a.gpSurgical, b.gpSurgical), // % — take max
              prescriptionsHospital: addArrays(a.prescriptionsHospital, b.prescriptionsHospital),
              prescriptionsRetail: addArrays(a.prescriptionsRetail, b.prescriptionsRetail),
              prescriptionsRevHospital: addArrays(a.prescriptionsRevHospital, b.prescriptionsRevHospital),
              prescriptionsRevRetail: addArrays(a.prescriptionsRevRetail, b.prescriptionsRevRetail),
              dischNotFinalisedValue: addArrays(a.dischNotFinalisedValue, b.dischNotFinalisedValue),
              accountSundries: addArrays(a.accountSundries, b.accountSundries),
              // Record<string, number[]> fields — additive merge per key
              patientDays: mergeRecordArrays(a.patientDays, b.patientDays),
              pctOccWard: mergeRecordArrays(a.pctOccWard, b.pctOccWard),
              patDaysWard: mergeRecordArrays(a.patDaysWard, b.patDaysWard),
              patDaysLOC: mergeRecordArrays(a.patDaysLOC, b.patDaysLOC),
              admPerWard: mergeRecordArrays(a.admPerWard, b.admPerWard),
              revLocation: mergeRecordArrays(a.revLocation, b.revLocation),
              rawColumns: mergeRecordArrays(a.rawColumns, b.rawColumns),
              discharges: mergeRecordArrays(a.discharges, b.discharges),
              dischargesPerWard: mergeRecordArrays(a.dischargesPerWard, b.dischargesPerWard),
              patientsAtMidday: mergeRecordArrays(a.patientsAtMidday, b.patientsAtMidday),
              billedPatDays: mergeRecordArrays(a.billedPatDays, b.billedPatDays),
              cosLocation: mergeRecordArrays(a.cosLocation, b.cosLocation),
              gpEthicalPerLoc: mergeRecordArrays(a.gpEthicalPerLoc, b.gpEthicalPerLoc),
              gpSurgicalPerLoc: mergeRecordArrays(a.gpSurgicalPerLoc, b.gpSurgicalPerLoc),
              revPerRevCentre: mergeRecordArrays(a.revPerRevCentre, b.revPerRevCentre),
              chargeableItems: mergeRecordArrays(a.chargeableItems, b.chargeableItems),
              nonChargeableItems: mergeRecordArrays(a.nonChargeableItems, b.nonChargeableItems),
              stockReceiptsDiscount: mergeRecordArrays(a.stockReceiptsDiscount, b.stockReceiptsDiscount),
              stockReceipts: mergeRecordArrays(a.stockReceipts, b.stockReceipts),
              stockReceiptsValue: mergeRecordArrays(a.stockReceiptsValue, b.stockReceiptsValue),
              // Nested objects — additive
              debtRecon: {
                brought: addArrays(a.debtRecon.brought, b.debtRecon.brought),
                revenue: addArrays(a.debtRecon.revenue, b.debtRecon.revenue),
                payments: addArrays(a.debtRecon.payments, b.debtRecon.payments),
                sundries: addArrays(a.debtRecon.sundries, b.debtRecon.sundries),
                total: addArrays(a.debtRecon.total, b.debtRecon.total),
              },
              payments: {
                deposits: addArrays(a.payments.deposits, b.payments.deposits),
                individual: addArrays(a.payments.individual, b.payments.individual),
                medAid: addArrays(a.payments.medAid, b.payments.medAid),
                batched: addArrays(a.payments.batched, b.payments.batched),
              },
            };
          } else if (normalizedData.dashboard) {
            mergedDashboard = normalizedData.dashboard;
          }

          // ──────────────────────────────────────────────────────
          // 2. LOCATION: Append — increment ICD/CPT counts,
          //    add episodes/revenue, merge doctors
          // ──────────────────────────────────────────────────────
          let mergedLocation: LocationData | null = existing.location;

          if (normalizedData.location && existing.location) {
            const a = existing.location;
            const b = normalizedData.location;

            // Merge doctors by name: additive (sum episodes, revenue, patients)
            const docMap = new Map<string, typeof a.doctors[0]>();
            for (const d of a.doctors) docMap.set(d.name, { ...d });
            for (const d of b.doctors) {
              const ex = docMap.get(d.name);
              if (ex) {
                docMap.set(d.name, {
                  ...d,
                  episodes: ex.episodes + d.episodes,
                  revenue: ex.revenue + d.revenue,
                  avgLOS: (ex.avgLOS + d.avgLOS) / 2,
                  patients: ex.patients + d.patients,
                });
              } else {
                docMap.set(d.name, { ...d });
              }
            }

            mergedLocation = {
              ...b,
              year,
              episodes: a.episodes + b.episodes,
              totalRevenue: a.totalRevenue + b.totalRevenue,
              monthEpisodes: addArrays(a.monthEpisodes, b.monthEpisodes),
              monthRevenue: addArrays(a.monthRevenue, b.monthRevenue),
              doctors: Array.from(docMap.values()).sort((x, y) => y.revenue - x.revenue),
              icdCodes: incrementCodeMap(a.icdCodes, b.icdCodes),
              cptCodes: incrementCodeMap(a.cptCodes, b.cptCodes),
              specialties: incrementCountMap(a.specialties, b.specialties),
              medAids: incrementCountMap(a.medAids, b.medAids),
              ageGroups: incrementCountMap(a.ageGroups, b.ageGroups),
              genders: incrementCountMap(a.genders, b.genders),
              los: incrementCountMap(a.los, b.los),
              rawRows: [...(a.rawRows || []), ...(b.rawRows || [])],
            };
          } else if (normalizedData.location) {
            mergedLocation = normalizedData.location;
          }

          // ──────────────────────────────────────────────────────
          // 3. CLAIMS: Append — sum totals, increment scheme/doctor
          //    counts, merge monthly arrays, merge rejection reasons
          // ──────────────────────────────────────────────────────
          let mergedClaims: ClaimsMetrics | null = existing.claims;

          if (normalizedData.claims && existing.claims) {
            const a = existing.claims;
            const b = normalizedData.claims;

            // Merge byScheme: increment each scheme's sub-totals
            const mergedByScheme: Record<string, ClaimSchemeData> = { ...a.byScheme };
            for (const [scheme, bData] of Object.entries(b.byScheme)) {
              const ex = mergedByScheme[scheme];
              if (ex) {
                mergedByScheme[scheme] = {
                  totalClaimed: ex.totalClaimed + bData.totalClaimed,
                  submitted: ex.submitted + bData.submitted,
                  received: ex.received + bData.received,
                  rejected: ex.rejected + bData.rejected,
                  approved: ex.approved + bData.approved,
                  pending: ex.pending + bData.pending,
                };
              } else {
                mergedByScheme[scheme] = { ...bData };
              }
            }

            // Merge byDoctor: increment claims/approved/amount per doctor
            const mergedByDoctor: Record<string, { claims: number; approved: number; amount: number }> = { ...a.byDoctor };
            for (const [doc, bData] of Object.entries(b.byDoctor)) {
              const ex = mergedByDoctor[doc];
              if (ex) {
                mergedByDoctor[doc] = {
                  claims: ex.claims + bData.claims,
                  approved: ex.approved + bData.approved,
                  amount: ex.amount + bData.amount,
                };
              } else {
                mergedByDoctor[doc] = { ...bData };
              }
            }

            mergedClaims = {
              ...b,
              year,
              totalClaims: a.totalClaims + b.totalClaims,
              totalClaimed: a.totalClaimed + b.totalClaimed,
              submitted: a.submitted + b.submitted,
              received: a.received + b.received,
              rejected: a.rejected + b.rejected,
              approved: a.approved + b.approved,
              pending: a.pending + b.pending,
              byScheme: mergedByScheme,
              byStatus: incrementCountMap(a.byStatus, b.byStatus),
              byMonth: incrementCountMap(
                a.byMonth as unknown as Record<string, number>,
                b.byMonth as unknown as Record<string, number>
              ) as unknown as Record<number, number>,
              byDoctor: mergedByDoctor,
              totalClaims_monthly: addArrays(a.totalClaims_monthly, b.totalClaims_monthly),
              approvedClaims_monthly: addArrays(a.approvedClaims_monthly, b.approvedClaims_monthly),
              rejectedClaims_monthly: addArrays(a.rejectedClaims_monthly, b.rejectedClaims_monthly),
              pendingClaims_monthly: addArrays(a.pendingClaims_monthly, b.pendingClaims_monthly),
              claimAmounts_monthly: addArrays(a.claimAmounts_monthly, b.claimAmounts_monthly),
              rejectionReasons: incrementCountMap(a.rejectionReasons, b.rejectionReasons),
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

          const mergedDatasets = {
            ...(existing.datasets || {}),
            ...(normalizedData.datasets || {}),
          };

          // ──────────────────────────────────────────────────────
          // ASSEMBLE the merged YearData
          // ──────────────────────────────────────────────────────
          const merged: YearData = {
            year,
            dash: mergedDashboard,
            dashboard: mergedDashboard,
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
              ).map(([yr, data]) => [yr, { ...data }]);
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
