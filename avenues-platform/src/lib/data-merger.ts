import { DashboardMetrics, LocationData, ClaimsMetrics, UploadRecord, GenericDataset, ClaimSchemeData } from '../types';

/**
 * Server-side implementation of the data merge logic.
 * Mirrors the logic found in src/store/index.ts but adjusted for server use.
 */

// ──────────────────────────────────────────────────────
// DATA HELPERS
// ──────────────────────────────────────────────────────

const MONTH_COUNT = 12;

export const addArrays = (a: number[] | undefined, b: number[] | undefined): number[] =>
  Array.from({ length: MONTH_COUNT }, (_, i) => ((a?.[i]) || 0) + ((b?.[i]) || 0));

export const maxArrays = (a: number[] | undefined, b: number[] | undefined): number[] =>
  Array.from({ length: MONTH_COUNT }, (_, i) => Math.max((a?.[i]) || 0, (b?.[i]) || 0));

export const incrementCountMap = (
  a: Record<string, number> | undefined,
  b: Record<string, number> | undefined
): Record<string, number> => {
  const result = { ...(a || {}) };
  for (const [k, v] of Object.entries(b || {})) {
    result[k] = (result[k] || 0) + v;
  }
  return result;
};

export const incrementCodeMap = (
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

export const mergeRecordArrays = (
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
// MERGE LOGIC PER CATEGORY
// ──────────────────────────────────────────────────────

/** Merge Dashboard data: Additive for daily deltas */
export function mergeDashboard(
  existing: DashboardMetrics | null,
  incoming: DashboardMetrics
): DashboardMetrics {
  if (!existing) return incoming;

  const a = existing;
  const b = incoming;
  const year = b.year;

  // All number[] fields that should be summed
  const monthRevenue = addArrays(a.monthRevenue, b.monthRevenue);
  const monthEpisodes = addArrays(a.monthEpisodes, b.monthEpisodes);

  return {
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
    theatreUtil: maxArrays(a.theatreUtil, b.theatreUtil),
    theatrePctOcc: maxArrays(a.theatrePctOcc, b.theatrePctOcc),
    pharmacyRx: addArrays(a.pharmacyRx, b.pharmacyRx),
    pharmacyRev: addArrays(a.pharmacyRev, b.pharmacyRev),
    occupancyBeds: maxArrays(a.occupancyBeds, b.occupancyBeds),
    occMidnight: addArrays(a.occMidnight, b.occMidnight),
    casToInpatient: addArrays(a.casToInpatient, b.casToInpatient),
    epsFinalised: addArrays(a.epsFinalised, b.epsFinalised),
    dischNotFinalised: addArrays(a.dischNotFinalised, b.dischNotFinalised),
    revPerPatDay: maxArrays(a.revPerPatDay, b.revPerPatDay),
    gpEthical: maxArrays(a.gpEthical, b.gpEthical),
    gpSurgical: maxArrays(a.gpSurgical, b.gpSurgical),
    prescriptionsHospital: addArrays(a.prescriptionsHospital, b.prescriptionsHospital),
    prescriptionsRetail: addArrays(a.prescriptionsRetail, b.prescriptionsRetail),
    prescriptionsRevHospital: addArrays(a.prescriptionsRevHospital, b.prescriptionsRevHospital),
    prescriptionsRevRetail: addArrays(a.prescriptionsRevRetail, b.prescriptionsRevRetail),
    dischNotFinalisedValue: addArrays(a.dischNotFinalisedValue, b.dischNotFinalisedValue),
    accountSundries: addArrays(a.accountSundries, b.accountSundries),
    // Record<string, number[]> fields
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
    debtRecon: {
      brought: addArrays(a.debtRecon?.brought, b.debtRecon?.brought),
      revenue: addArrays(a.debtRecon?.revenue, b.debtRecon?.revenue),
      payments: addArrays(a.debtRecon?.payments, b.debtRecon?.payments),
      sundries: addArrays(a.debtRecon?.sundries, b.debtRecon?.sundries),
      total: addArrays(a.debtRecon?.total, b.debtRecon?.total),
    },
    payments: {
      deposits: addArrays(a.payments?.deposits, b.payments?.deposits),
      individual: addArrays(a.payments?.individual, b.payments?.individual),
      medAid: addArrays(a.payments?.medAid, b.payments?.medAid),
      batched: addArrays(a.payments?.batched, b.payments?.batched),
    },
  };
}

/** Merge Location data: Append rows with deduplication */
export function mergeLocation(
  existing: LocationData | null,
  incoming: LocationData
): LocationData {
  if (!existing) return incoming;

  const a = existing;
  const b = incoming;
  const year = b.year;

  // Build set of existing Episode IDs for dedup
  const existingEpisodeIds = new Set<string>();
  for (const row of (a.rawRows || [])) {
    const epId = String(row['Episode'] || row['episode'] || '').trim();
    if (epId) existingEpisodeIds.add(epId);
  }

  const incomingRows = b.rawRows || [];
  let newRows: Record<string, unknown>[];
  if (existingEpisodeIds.size > 0 && incomingRows.length > 0) {
    newRows = incomingRows.filter(row => {
      const epId = String(row['Episode'] || row['episode'] || '').trim();
      return !epId || !existingEpisodeIds.has(epId);
    });
  } else {
    newRows = incomingRows;
  }

  const totalIncoming = incomingRows.length || 1;
  const newFraction = newRows.length / totalIncoming;

  const scaleArray = (arr: number[]): number[] => arr.map(v => Math.round(v * newFraction));
  const scaleCountMap = (m: Record<string, number>): Record<string, number> => {
    const result: Record<string, number> = {};
    for (const [k, v] of Object.entries(m)) result[k] = Math.round(v * newFraction);
    return result;
  };
  const scaleCodeMap = (m: Record<string, { count: number; desc: string }>): Record<string, { count: number; desc: string }> => {
    const result: Record<string, { count: number; desc: string }> = {};
    for (const [k, v] of Object.entries(m)) {
      result[k] = { count: Math.round(v.count * newFraction), desc: v.desc };
    }
    return result;
  };

  const docMap = new Map<string, typeof a.doctors[0]>();
  for (const d of a.doctors) docMap.set(d.name, { ...d });
  for (const d of b.doctors) {
    const scaledEps = Math.round(d.episodes * newFraction);
    const scaledRev = d.revenue * newFraction;
    const scaledPat = Math.round(d.patients * newFraction);
    if (scaledEps === 0 && scaledRev === 0) continue;
    const ex = docMap.get(d.name);
    if (ex) {
      const totalEps = ex.episodes + scaledEps;
      docMap.set(d.name, {
        ...d,
        episodes: totalEps,
        revenue: ex.revenue + scaledRev,
        avgLOS: totalEps > 0 ? (ex.avgLOS * ex.episodes + d.avgLOS * scaledEps) / totalEps : ex.avgLOS,
        patients: ex.patients + scaledPat,
      });
    } else {
      docMap.set(d.name, { ...d, episodes: scaledEps, revenue: scaledRev, patients: scaledPat });
    }
  }

  return {
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
}

/** Merge Claims data: Append rows with deduplication */
export function mergeClaims(
  existing: ClaimsMetrics | null,
  incoming: ClaimsMetrics
): ClaimsMetrics {
  if (!existing) return incoming;

  const a = existing;
  const b = incoming;
  const year = b.year;

  let newFraction = 1;
  let mergedClaimRawRows: Record<string, string>[] | undefined = undefined;

  if (a.rawRows && a.rawRows.length > 0 && b.rawRows && b.rawRows.length > 0) {
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
  } else {
    mergedClaimRawRows = b.rawRows ? [...(a.rawRows || []), ...b.rawRows] : a.rawRows;
  }

  const scaleScheme = (s: ClaimSchemeData): ClaimSchemeData => ({
    totalClaimed: Math.round(s.totalClaimed * newFraction * 100) / 100,
    submitted: Math.round(s.submitted * newFraction),
    received: Math.round(s.received * newFraction),
    rejected: Math.round(s.rejected * newFraction),
    approved: Math.round(s.approved * newFraction),
    pending: Math.round(s.pending * newFraction),
  });

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

  return {
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
}
