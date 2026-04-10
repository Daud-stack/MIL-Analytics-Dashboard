'use client';

/**
 * CSV parsing utilities for healthcare data
 * Handles Dashboard, Location, and Claims data formats
 */

import Papa from 'papaparse';
import { DashboardMetrics, LocationData, ClaimsMetrics, YearData } from '@/types';

// ===== COLUMN DEFINITIONS =====

const DASHBOARD_KEYWORDS = [
  'revenue', 'admission', 'theatre', 'pharmacy', 'occupancy',
  'casualty', 'inpatient', 'patient', 'ward', 'bed',
  'month', 'episode', 'util', 'cases', 'minute',
];

const LOCATION_KEYWORDS = [
  'doctor', 'specialty', 'clinic', 'location', 'department',
  'icd', 'cpt', 'code', 'medical aid', 'age group',
  'los', 'procedure', 'episode', 'gender',
];

const CLAIMS_KEYWORDS = [
  'claim', 'approved', 'rejected', 'pending', 'processing',
  'scheme', 'rejection', 'edi', 'apac', 'amount', 'doctor',
];

// ===== UTILITY FUNCTIONS =====

/**
 * Normalize column names
 */
function normalizeColumnName(name: string): string {
  return name.toLowerCase().replace(/[\s_-]/g, '');
}

/**
 * Detect file type based on headers and content
 */
export function detectFileType(
  headers: string[],
  firstRow?: Record<string, unknown>
): 'dashboard' | 'location' | 'claims' | 'unknown' {
  const normalized = headers.map(normalizeColumnName).join(' ');
  const firstRowKeys = firstRow ? Object.keys(firstRow).map((k) => normalizeColumnName(k)).join(' ') : '';
  const combinedText = (normalized + ' ' + firstRowKeys).toLowerCase();

  let dashboardScore = 0;
  let locationScore = 0;
  let claimsScore = 0;

  DASHBOARD_KEYWORDS.forEach((kw) => {
    if (combinedText.includes(kw)) dashboardScore++;
  });
  LOCATION_KEYWORDS.forEach((kw) => {
    if (combinedText.includes(kw)) locationScore++;
  });
  CLAIMS_KEYWORDS.forEach((kw) => {
    if (combinedText.includes(kw)) claimsScore++;
  });

  if (dashboardScore > locationScore && dashboardScore > claimsScore) {
    return 'dashboard';
  } else if (locationScore > claimsScore) {
    return 'location';
  } else if (claimsScore > 0) {
    return 'claims';
  }

  return 'unknown';
}

/**
 * Extract year from CSV text
 */
export function detectYear(csvText: string): number {
  const match = csvText.match(/\b(202[0-9])\b/);
  if (match) return parseInt(match[1], 10);

  const lines = csvText.split('\n');
  for (const line of lines.slice(0, 10)) {
    const m = line.match(/\b(20\d{2})\b/);
    if (m) return parseInt(m[1], 10);
  }

  return new Date().getFullYear();
}

/**
 * Extract facility name from first line of CSV
 */
export function detectFacilityName(csvText: string): string {
  const lines = csvText.split('\n');
  if (lines.length > 0 && lines[0].trim()) {
    return lines[0].trim();
  }
  return 'Avenues Clinic';
}

/**
 * Find column index by keyword matching
 */
function findColumnIndex(
  headers: string[],
  keywords: string[]
): number {
  for (let i = 0; i < headers.length; i++) {
    const normalized = normalizeColumnName(headers[i]);
    for (const kw of keywords) {
      if (normalized.includes(normalizeColumnName(kw))) {
        return i;
      }
    }
  }
  return -1;
}

/**
 * Map month name to month index (0-11)
 */
function getMonthIndex(monthName: string): number {
  const months = ['january', 'february', 'march', 'april', 'may', 'june',
    'july', 'august', 'september', 'october', 'november', 'december'];
  return months.indexOf(monthName.toLowerCase());
}

/**
 * Extract 0-based month index from a date string.
 * Handles: DD/MM/YYYY, DD-MM-YYYY, YYYY-MM-DD, YYYY/MM/DD.
 * Returns -1 if unparseable.
 */
function parseDateMonth(dateStr: string): number {
  if (!dateStr) return -1;

  // Try YYYY-MM-DD or YYYY/MM/DD first (unambiguous — group 2 is always month)
  const isoMatch = dateStr.match(/(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
  if (isoMatch) {
    const m = parseInt(isoMatch[2], 10) - 1;
    return (m >= 0 && m < 12) ? m : -1;
  }

  // Try DD/MM/YYYY or DD-MM-YYYY (Zimbabwe standard)
  // Disambiguate: if group 1 > 12, it must be a day → group 2 is the month
  // If group 2 > 12, it must be a day → group 1 is the month (US format)
  // If both <= 12, assume DD/MM/YYYY (locale default)
  const dmyMatch = dateStr.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (dmyMatch) {
    const g1 = parseInt(dmyMatch[1], 10);
    const g2 = parseInt(dmyMatch[2], 10);

    let month: number;
    if (g1 > 12) {
      // g1 is definitely a day → g2 is month (DD/MM/YYYY)
      month = g2 - 1;
    } else if (g2 > 12) {
      // g2 is definitely a day → g1 is month (MM/DD/YYYY)
      month = g1 - 1;
    } else {
      // Ambiguous — assume DD/MM/YYYY (Zimbabwe locale)
      month = g2 - 1;
    }
    return (month >= 0 && month < 12) ? month : -1;
  }

  return -1;
}

/**
 * Safe parse number, handling decimals, comma-formatted numbers, and quoted values
 */
function parseNumber(value: unknown): number {
  if (value === null || value === undefined) return 0;
  let str = String(value).trim();
  if (!str) return 0;
  // Strip quotes
  str = str.replace(/^["']|["']$/g, '');
  // Strip thousand-separator commas (e.g., "1,234,567.89" → "1234567.89")
  str = str.replace(/,/g, '');
  // Strip currency symbols and spaces
  str = str.replace(/[$£€\s]/g, '');
  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
}

/**
 * Split a CSV line respecting quoted fields
 * e.g., 'January,"1,234",5678' → ['January', '1,234', '5678']
 */
function splitCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

// ===== PARSING FUNCTIONS =====

/** Helper: create zeroed 12-month array */
function z12(): number[] { return new Array(12).fill(0); }

/** Helper: create empty DashboardMetrics shell */
function emptyDashMetrics(year: number): DashboardMetrics {
  return {
    year,
    totalRevenue: 0,
    monthRevenue: z12(), monthEpisodes: z12(),
    admCasualty: z12(), admDay: z12(), admInpatient: z12(), admLab: z12(),
    theatreCases: z12(), theatreMinutes: z12(), theatreUtil: z12(), theatrePctOcc: z12(),
    pharmacyRx: z12(), pharmacyRev: z12(),
    occupancyBeds: z12(),
    patientDays: {}, pctOccWard: {}, patDaysWard: {}, patDaysLOC: {},
    occMidnight: z12(),
    revLocation: {}, admPerWard: {},
    debtRecon: { brought: z12(), revenue: z12(), payments: z12(), sundries: z12(), total: z12() },
    casToInpatient: z12(), epsFinalised: z12(), dischNotFinalised: z12(),
    revPerPatDay: z12(), gpEthical: z12(), gpSurgical: z12(),
    payments: { deposits: z12(), individual: z12(), medAid: z12(), batched: z12() },
    // New fields
    rawColumns: {},
    discharges: {}, dischargesPerWard: {},
    patientsAtMidday: {}, billedPatDays: {},
    cosLocation: {}, gpEthicalPerLoc: {}, gpSurgicalPerLoc: {},
    revPerRevCentre: {},
    chargeableItems: {}, nonChargeableItems: {},
    stockReceiptsDiscount: {}, stockReceipts: {}, stockReceiptsValue: {},
    prescriptionsHospital: z12(), prescriptionsRetail: z12(),
    prescriptionsRevHospital: z12(), prescriptionsRevRetail: z12(),
    dischNotFinalisedValue: z12(), accountSundries: z12(),
  };
}

/**
 * Parse Dashboard CSV (RptManagementDashboard.csv format)
 *
 * Supports COLUMNAR format:
 * Line 1: Facility name (e.g., "Avenues Clinic")
 * Line 2: Report description with date range
 * Line 3: Column headers — "Date,Admissions-CASUALTY PATIENT,Admissions-DAY PATIENT,..."
 * Lines 4+: One row per month — "January,758,68,589,..."
 *
 * Each column header is "Category-SubItem". Months are rows.
 */
export function parseDashboardCSV(csvText: string): YearData {
  const lines = csvText.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  // Extract facility name and year
  const facilityName = lines[0] || 'Avenues Clinic';
  const line2 = lines[1] || '';
  const yearMatch = line2.match(/\b(20\d{2})\b/);
  const year = yearMatch ? parseInt(yearMatch[1], 10) : new Date().getFullYear();

  console.log('[Parser] Facility:', facilityName, '| Year:', year);

  const metrics = emptyDashMetrics(year);

  // Parse column headers (line index 2)
  const headerLine = lines[2] || '';
  const headers = splitCSVLine(headerLine);

  // Store ALL raw column data: parse each month row, place value at month index
  for (let lineIdx = 3; lineIdx < lines.length; lineIdx++) {
    const fields = splitCSVLine(lines[lineIdx]);
    const monthName = (fields[0] || '').trim();
    const mIdx = getMonthIndex(monthName);
    if (mIdx < 0) continue; // skip non-month rows (e.g., "Total")

    for (let col = 1; col < headers.length; col++) {
      const colName = headers[col]?.trim();
      if (!colName) continue;
      if (!metrics.rawColumns[colName]) metrics.rawColumns[colName] = z12();
      metrics.rawColumns[colName][mIdx] = parseNumber(fields[col]);
    }
  }

  console.log('[Parser] Parsed', Object.keys(metrics.rawColumns).length, 'columns across 12 months');

  // ── Map rawColumns into structured metrics ──

  /** Get monthly array for a column by exact name, or return null */
  function col(name: string): number[] | null {
    return metrics.rawColumns[name] ?? null;
  }

  /** Get monthly array, defaulting to z12 */
  function colZ(name: string): number[] {
    return metrics.rawColumns[name] ?? z12();
  }

  // ── Admissions ──
  metrics.admCasualty = colZ('Admissions-CASUALTY PATIENT');
  metrics.admDay = colZ('Admissions-DAY PATIENT');
  metrics.admInpatient = colZ('Admissions-IN-PATIENT');
  metrics.admLab = colZ('Admissions-LABORATORY');

  // ── Admissions Per Ward ──
  for (const [key, vals] of Object.entries(metrics.rawColumns)) {
    if (key.startsWith('Admissions Per Ward-')) {
      metrics.admPerWard[key.replace('Admissions Per Ward-', '')] = vals;
    }
  }

  // ── Discharges ──
  for (const [key, vals] of Object.entries(metrics.rawColumns)) {
    if (key.startsWith('Discharges-')) {
      metrics.discharges[key.replace('Discharges-', '')] = vals;
    }
  }

  // ── Discharges Per Ward ──
  for (const [key, vals] of Object.entries(metrics.rawColumns)) {
    if (key.startsWith('Discharges Per Ward-')) {
      metrics.dischargesPerWard[key.replace('Discharges Per Ward-', '')] = vals;
    }
  }

  // ── Patients Transferred From Casualty To In Patient ──
  metrics.casToInpatient = colZ('Patients Transferred Fom Casualty To In Patient');

  // ── Patients At Midday Per Ward ──
  for (const [key, vals] of Object.entries(metrics.rawColumns)) {
    if (key.startsWith('Patients At Midday Per Ward-')) {
      metrics.patientsAtMidday[key.replace('Patients At Midday Per Ward-', '')] = vals;
    }
  }

  // ── Patients At Midnight Per Ward ──
  for (const [key, vals] of Object.entries(metrics.rawColumns)) {
    if (key.startsWith('Patients At Midnight Per Ward-')) {
      const ward = key.replace('Patients At Midnight Per Ward-', '');
      metrics.patientDays[ward] = vals;
      for (let i = 0; i < 12; i++) metrics.occMidnight[i] += vals[i];
    }
  }

  // ── Billed Patient Days Per Ward ──
  for (const [key, vals] of Object.entries(metrics.rawColumns)) {
    if (key.startsWith('Billed Patient Days Per Ward-')) {
      metrics.billedPatDays[key.replace('Billed Patient Days Per Ward-', '')] = vals;
    }
  }

  // ── Patients Days Per Level Of Care ──
  for (const [key, vals] of Object.entries(metrics.rawColumns)) {
    if (key.startsWith('Patients Days Per Level Of Care-')) {
      metrics.patDaysLOC[key.replace('Patients Days Per Level Of Care-', '')] = vals;
    }
  }

  // ── Patients Days Per Ward ──
  for (const [key, vals] of Object.entries(metrics.rawColumns)) {
    if (key.startsWith('Patients Days Per Ward-')) {
      metrics.patDaysWard[key.replace('Patients Days Per Ward-', '')] = vals;
    }
  }

  // ── Percentage Occupancy Per Ward ──
  for (const [key, vals] of Object.entries(metrics.rawColumns)) {
    if (key.startsWith('Percentage Occupancy Per Ward-')) {
      metrics.pctOccWard[key.replace('Percentage Occupancy Per Ward-', '')] = vals;
    }
  }

  // ── Theatre ──
  metrics.theatrePctOcc = colZ('Percentage Occupancy Per Theatre-THEATRE');
  metrics.theatreCases = colZ('Theatre Cases-THEATRE');
  metrics.theatreMinutes = colZ('Theatre Utilization-THEATRE');
  metrics.theatreUtil = metrics.theatreMinutes.map(v => {
    const avail = 13640;
    return avail > 0 ? (v / avail) * 100 : 0;
  });

  // ── Pharmacy ──
  metrics.prescriptionsHospital = colZ('Number of Prescriptions Dispensed-Hospital');
  metrics.prescriptionsRetail = colZ('Number of Prescriptions Dispensed-Retail');
  metrics.pharmacyRx = metrics.prescriptionsHospital.map((v, i) => v + metrics.prescriptionsRetail[i]);
  metrics.prescriptionsRevHospital = colZ('Revenue of Prescriptions Dispensed-Hospital');
  metrics.prescriptionsRevRetail = colZ('Revenue of Prescriptions Dispensed-Retail');
  metrics.pharmacyRev = metrics.prescriptionsRevHospital.map((v, i) => v + metrics.prescriptionsRevRetail[i]);

  // ── Billing Statistics ──
  metrics.monthRevenue = colZ('Billing Statistics-Total Revenue');
  metrics.revPerPatDay = colZ('Billing Statistics-Revenue Per Patient Day');

  // ── Revenue Per Stock Location ──
  for (const [key, vals] of Object.entries(metrics.rawColumns)) {
    if (key.startsWith('Revenue Per Stock Location-')) {
      metrics.revLocation[key.replace('Revenue Per Stock Location-', '')] = vals;
    }
  }

  // ── COS Per Stock Location ──
  for (const [key, vals] of Object.entries(metrics.rawColumns)) {
    if (key.startsWith('COS Per Stock Location-')) {
      metrics.cosLocation[key.replace('COS Per Stock Location-', '')] = vals;
    }
  }

  // ── GP Percentage For Ethical Stock Items ──
  for (const [key, vals] of Object.entries(metrics.rawColumns)) {
    if (key.startsWith('GP Percentage For Ethical Stock Items')) {
      const loc = key.replace(/^GP Percentage For Ethical Stock Items\s*-\s*/, '');
      metrics.gpEthicalPerLoc[loc] = vals;
    }
  }

  // ── GP Percentage For Surgical Stock Items ──
  for (const [key, vals] of Object.entries(metrics.rawColumns)) {
    if (key.startsWith('GP Percentage For Surgical Stock Items')) {
      const loc = key.replace(/^GP Percentage For Surgical Stock Items\s*-\s*/, '');
      metrics.gpSurgicalPerLoc[loc] = vals;
    }
  }

  // ── Episodes / Discharges Not Finalised ──
  metrics.epsFinalised = colZ('Episodes Finalised');
  metrics.dischNotFinalised = colZ('Discharges Not Finalised');
  metrics.dischNotFinalisedValue = colZ('Discharges Not Finalised Value');

  // ── Revenue Per Revenue Centre ──
  for (const [key, vals] of Object.entries(metrics.rawColumns)) {
    if (key.startsWith('Revenue Per Revenue Centre-')) {
      metrics.revPerRevCentre[key.replace('Revenue Per Revenue Centre-', '')] = vals;
    }
  }

  // ── Payments Per Day ──
  metrics.payments.deposits = colZ('Payments Per Day-Deposits');
  metrics.payments.individual = colZ('Payments Per Day-Individual Payments');
  metrics.payments.medAid = colZ('Payments Per Day-Medical Aid Payments');
  metrics.payments.batched = colZ('Payments Per Day-Batched Payments');

  // ── Account Sundries ──
  metrics.accountSundries = colZ('Account Sundries');

  // ── Debtors Reconciliation Per Day ──
  metrics.debtRecon.brought = colZ('Debtors Reconciliation Per Day-Balance Brought Forward');
  metrics.debtRecon.revenue = colZ('Debtors Reconciliation Per Day-Revenue');
  metrics.debtRecon.payments = colZ('Debtors Reconciliation Per Day-Payments');
  metrics.debtRecon.sundries = colZ('Debtors Reconciliation Per Day-SunList');
  // Calculate total: brought + revenue - payments + sundries
  metrics.debtRecon.total = z12().map((_, i) =>
    metrics.debtRecon.brought[i] + metrics.debtRecon.revenue[i] - Math.abs(metrics.debtRecon.payments[i]) + metrics.debtRecon.sundries[i]
  );

  // ── Chargeable Items Transferred Per Location ──
  for (const [key, vals] of Object.entries(metrics.rawColumns)) {
    if (key.startsWith('Chargeable Items Transferred Per Location-')) {
      metrics.chargeableItems[key.replace('Chargeable Items Transferred Per Location-', '')] = vals;
    }
  }

  // ── Non Chargeable Items Transferred Per Location ──
  for (const [key, vals] of Object.entries(metrics.rawColumns)) {
    if (key.startsWith('Non Chargeable Items Transferred Per Location-')) {
      metrics.nonChargeableItems[key.replace('Non Chargeable Items Transferred Per Location-', '')] = vals;
    }
  }

  // ── Stock Receipts ──
  for (const [key, vals] of Object.entries(metrics.rawColumns)) {
    if (key.startsWith('Stock Receipts Discount Per Location-')) {
      metrics.stockReceiptsDiscount[key.replace('Stock Receipts Discount Per Location-', '')] = vals;
    } else if (key.startsWith('Stock Receipts Value Per Location-')) {
      metrics.stockReceiptsValue[key.replace('Stock Receipts Value Per Location-', '')] = vals;
    } else if (key.startsWith('Stock Receipts Per Location-')) {
      metrics.stockReceipts[key.replace('Stock Receipts Per Location-', '')] = vals;
    }
  }

  // ── Post-processing ──

  // monthEpisodes: use epsFinalised if available, else sum admissions
  metrics.monthEpisodes = z12().map((_, idx) => {
    if (metrics.epsFinalised[idx] > 0) return metrics.epsFinalised[idx];
    const admSum = metrics.admCasualty[idx] + metrics.admDay[idx] + metrics.admInpatient[idx] + metrics.admLab[idx];
    return admSum > 0 ? admSum : 0;
  });

  // Copy patDaysWard → patientDays if patientDays is empty
  if (!Object.keys(metrics.patientDays).length && Object.keys(metrics.patDaysWard).length) {
    metrics.patientDays = { ...metrics.patDaysWard };
  }

  // Calculate average bed occupancy from ward-level percentage occupancy
  if (Object.keys(metrics.pctOccWard).length) {
    metrics.occupancyBeds = Array.from({ length: 12 }, (_, idx) => {
      const wards = Object.values(metrics.pctOccWard);
      const nonZeroWards = wards.filter(w => (w[idx] || 0) > 0);
      const sum = nonZeroWards.reduce((acc, wv) => acc + (wv[idx] || 0), 0);
      return nonZeroWards.length > 0 ? sum / nonZeroWards.length : 0;
    });
  }

  // GP averages (average across all locations)
  const ethVals = Object.values(metrics.gpEthicalPerLoc);
  if (ethVals.length) {
    metrics.gpEthical = z12().map((_, i) => {
      const nonZero = ethVals.filter(v => (v[i] || 0) > 0);
      return nonZero.length ? nonZero.reduce((s, v) => s + v[i], 0) / nonZero.length : 0;
    });
  }
  const surVals = Object.values(metrics.gpSurgicalPerLoc);
  if (surVals.length) {
    metrics.gpSurgical = z12().map((_, i) => {
      const nonZero = surVals.filter(v => (v[i] || 0) > 0);
      return nonZero.length ? nonZero.reduce((s, v) => s + v[i], 0) / nonZero.length : 0;
    });
  }

  // Calculate total revenue
  metrics.totalRevenue = metrics.monthRevenue.reduce((sum, val) => sum + val, 0);

  console.log('[Parser] Total revenue:', metrics.totalRevenue);
  console.log('[Parser] Episodes finalised:', metrics.epsFinalised);
  console.log('[Parser] Admissions casualty:', metrics.admCasualty);
  console.log('[Parser] Theatre cases:', metrics.theatreCases);
  console.log('[Parser] Pharmacy Rx:', metrics.pharmacyRx);
  console.log('[Parser] Occupancy beds (avg %):', metrics.occupancyBeds);
  console.log('[Parser] Wards in pctOccWard:', Object.keys(metrics.pctOccWard));

  return {
    year,
    dash: metrics,
    dashboard: metrics,
    loc: null,
    location: null,
    apac: null,
    claims: null,
    uploads: [],
    datasets: {},
  };
}

/**
 * Parse Location CSV (CPTStatisticsLOC.csv format)
 *
 * Format: Patient-level rows with columns like:
 * Episode, Patient Name, Medical Aid, Medical Aid Scheme, City, Province,
 * Age, Gender, Doctor, Doctor Specialty, Adm Date, Primary ICD Code,
 * Primary CPT Code, ward days/values, THT minutes/values, Pharmacy Stock,
 * Total, LOS, Theatre date, Anaesthetist, etc.
 */
export function parseLocationCSV(csvText: string): YearData {
  const result = Papa.parse(csvText, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: false, // keep as strings for safer parsing
  });

  const year = detectYear(csvText);
  const data = result.data as Record<string, string>[];

  if (!data || data.length === 0) {
    return {
      year,
      dash: null, dashboard: null,
      loc: null, location: null,
      apac: null, claims: null,
      uploads: [],
      datasets: {},
    };
  }

  const headers = result.meta.fields || [];
  console.log('[LOC Parser] Headers:', headers.join(', '));
  console.log('[LOC Parser] Row count:', data.length);

  // Find column names flexibly
  const findCol = (keywords: string[]): string | null => {
    for (const h of headers) {
      const lower = h.toLowerCase().trim();
      for (const kw of keywords) {
        if (lower.includes(kw.toLowerCase())) return h;
      }
    }
    return null;
  };

  const colEpisode = findCol(['episode']);
  const colPatient = findCol(['patient name', 'patient']);
  const colMedAid = findCol(['medical aid scheme', 'med aid scheme', 'scheme']);
  const colMedAidGroup = findCol(['medical aid']);
  const colCity = findCol(['city']);
  const colProvince = findCol(['province']);
  const colAge = findCol(['age']);
  const colGender = findCol(['gender', 'sex']);
  const colDoctor = findCol(['doctor name', 'doctor']);
  const colSpecialty = findCol(['doctor specialty', 'specialty', 'speciality']);
  const colAdmDate = findCol(['adm date', 'admission date', 'admit date']);
  const colICD = findCol(['primary icd', 'icd code', 'icd']);
  const colCPT = findCol(['primary cpt', 'cpt code', 'cpt']);
  // Find "Total" revenue column — must be exact match to avoid "Total Days" etc.
  const colTotal = (() => {
    // First try exact match for header that is just "Total"
    for (const h of headers) {
      if (h.trim().toLowerCase() === 'total') return h;
    }
    // Fallback: find last column containing "total" (revenue is typically the last "Total" column)
    let lastMatch: string | null = null;
    for (const h of headers) {
      if (h.trim().toLowerCase() === 'total') lastMatch = h;
    }
    return lastMatch;
  })();
  const colLOS = findCol(['los', 'length of stay']);

  // Aggregation structures
  const doctorMap: Record<string, { specialty: string; episodes: number; revenue: number; totalLOS: number; patients: Set<string> }> = {};
  const icdCodes: Record<string, { count: number; desc: string }> = {};
  const cptCodes: Record<string, { count: number; desc: string }> = {};
  const specialties: Record<string, number> = {};
  const medAids: Record<string, number> = {};
  const ageGroups: Record<string, number> = {};
  const genders: Record<string, number> = {};
  const losDistribution: Record<string, number> = {};
  const monthEpisodes = new Array(12).fill(0);
  const monthRevenue = new Array(12).fill(0);
  let totalRevenue = 0;
  let totalEpisodes = 0;

  for (const row of data) {
    totalEpisodes++;

    // Parse admission date for monthly aggregation
    const admDateStr = colAdmDate ? (row[colAdmDate] || '').trim() : '';
    const admMonth = parseDateMonth(admDateStr);

    // Revenue
    const revenue = colTotal ? parseNumber(row[colTotal]) : 0;
    totalRevenue += revenue;
    if (admMonth >= 0) {
      monthEpisodes[admMonth]++;
      monthRevenue[admMonth] += revenue;
    }

    // Doctor aggregation
    const doctorName = colDoctor ? (row[colDoctor] || '').trim() : '';
    const specialty = colSpecialty ? (row[colSpecialty] || '').trim() : '';
    const patientName = colPatient ? (row[colPatient] || '').trim() : '';
    const los = colLOS ? parseNumber(row[colLOS]) : 0;

    if (doctorName) {
      if (!doctorMap[doctorName]) {
        doctorMap[doctorName] = { specialty, episodes: 0, revenue: 0, totalLOS: 0, patients: new Set() };
      }
      doctorMap[doctorName].episodes++;
      doctorMap[doctorName].revenue += revenue;
      doctorMap[doctorName].totalLOS += los;
      if (patientName) doctorMap[doctorName].patients.add(patientName);
    }

    // ICD codes
    const icd = colICD ? (row[colICD] || '').trim() : '';
    if (icd) {
      if (!icdCodes[icd]) icdCodes[icd] = { count: 0, desc: icd };
      icdCodes[icd].count++;
    }

    // CPT codes
    const cpt = colCPT ? (row[colCPT] || '').trim() : '';
    if (cpt) {
      if (!cptCodes[cpt]) cptCodes[cpt] = { count: 0, desc: cpt };
      cptCodes[cpt].count++;
    }

    // Specialty
    if (specialty) {
      specialties[specialty] = (specialties[specialty] || 0) + 1;
    }

    // Medical Aid
    const medAid = colMedAidGroup ? (row[colMedAidGroup] || '').trim() : (colMedAid ? (row[colMedAid] || '').trim() : '');
    if (medAid) {
      medAids[medAid] = (medAids[medAid] || 0) + 1;
    }

    // Age groups
    const age = colAge ? parseNumber(row[colAge]) : 0;
    if (age > 0) {
      let ageGroup: string;
      if (age < 18) ageGroup = '0-17';
      else if (age < 30) ageGroup = '18-29';
      else if (age < 45) ageGroup = '30-44';
      else if (age < 60) ageGroup = '45-59';
      else if (age < 75) ageGroup = '60-74';
      else ageGroup = '75+';
      ageGroups[ageGroup] = (ageGroups[ageGroup] || 0) + 1;
    }

    // Gender
    const gender = colGender ? (row[colGender] || '').trim() : '';
    if (gender) {
      genders[gender] = (genders[gender] || 0) + 1;
    }

    // LOS distribution
    if (los > 0) {
      const losBucket = los <= 1 ? '1' : los <= 3 ? '2-3' : los <= 7 ? '4-7' : los <= 14 ? '8-14' : '15+';
      losDistribution[losBucket] = (losDistribution[losBucket] || 0) + 1;
    }
  }

  // Convert doctor map to array
  const doctors = Object.entries(doctorMap)
    .map(([name, d]) => ({
      name,
      specialty: d.specialty,
      episodes: d.episodes,
      revenue: d.revenue,
      avgLOS: d.episodes > 0 ? d.totalLOS / d.episodes : 0,
      patients: d.patients.size,
    }))
    .sort((a, b) => b.revenue - a.revenue);

  console.log('[LOC Parser] Parsed:', totalEpisodes, 'episodes,', doctors.length, 'doctors, revenue:', totalRevenue);

  const metrics: LocationData = {
    year,
    episodes: totalEpisodes,
    totalRevenue,
    monthEpisodes,
    monthRevenue,
    doctors,
    icdCodes,
    cptCodes,
    specialties,
    medAids,
    ageGroups,
    genders,
    los: losDistribution,
    rawRows: data as unknown as Record<string, unknown>[],
  };

  return {
    year,
    dash: null, dashboard: null,
    loc: metrics, location: metrics,
    apac: null, claims: null,
    uploads: [],
    datasets: {},
  };
}

/**
 * Parse Claims CSV (APAC/EDI format)
 *
 * Handles various claims CSV formats with columns like:
 * Claim ID/Number, Status, Amount, Scheme, Doctor, Date, Rejection Reason, etc.
 */
export function parseClaimsCSV(csvText: string): YearData {
  const result = Papa.parse(csvText, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: false,
  });

  const year = detectYear(csvText);
  const data = result.data as Record<string, string>[];
  const headers = result.meta.fields || [];

  if (!data || data.length === 0) {
    return {
      year,
      dash: null, dashboard: null,
      loc: null, location: null,
      apac: null, claims: null,
      uploads: [],
      datasets: {},
    };
  }

  console.log('[Claims Parser] Headers:', headers.join(', '));
  console.log('[Claims Parser] Row count:', data.length);

  const findCol = (keywords: string[]): string | null => {
    for (const h of headers) {
      const lower = h.toLowerCase().trim();
      for (const kw of keywords) {
        if (lower.includes(kw.toLowerCase())) return h;
      }
    }
    return null;
  };

  const colStatus = findCol(['edi status', 'status']);
  const colClaimValue = findCol(['claim value', 'claimed']);
  const colAmountPaid = findCol(['amount paid', 'paid']);
  const colAmount = colClaimValue || findCol(['amount', 'total']);
  const colScheme = findCol(['medical aid', 'scheme', 'funder']);
  const colDoctor = findCol(['doctor', 'provider']);
  const colClaimDate = findCol(['claim date']);
  const colDate = colClaimDate || findCol(['discharge date', 'date', 'submitted']);
  const colReason = findCol(['reason', 'rejection', 'description']);
  const colEpisode = findCol(['episode']);

  const metrics: ClaimsMetrics = {
    year,
    totalClaims: data.length,
    totalClaimed: 0,
    submitted: 0,
    received: 0,
    rejected: 0,
    approved: 0,
    pending: 0,
    byScheme: {},
    byStatus: {},
    byMonth: {},
    byDoctor: {},
    totalClaims_monthly: new Array(12).fill(0),
    approvedClaims_monthly: new Array(12).fill(0),
    rejectedClaims_monthly: new Array(12).fill(0),
    pendingClaims_monthly: new Array(12).fill(0),
    claimAmounts_monthly: new Array(12).fill(0),
    rejectionReasons: {},
  };

  for (const row of data) {
    const rawStatus = colStatus ? (row[colStatus] || '').trim() : '';
    const status = rawStatus.toLowerCase();
    const claimValue = colAmount ? parseNumber(row[colAmount]) : 0;
    const amountPaid = colAmountPaid ? parseNumber(row[colAmountPaid]) : 0;
    const amount = claimValue || amountPaid;
    const scheme = colScheme ? (row[colScheme] || '').trim() : '';
    const doctor = colDoctor ? (row[colDoctor] || '').trim() : '';
    const reason = colReason ? (row[colReason] || '').trim() : '';

    metrics.totalClaimed += claimValue;

    // Status tracking — handle both full words and EDI single-letter codes
    // Common EDI codes: R=Received, A=Accepted/Approved, P=Pending, X/D=Rejected/Declined
    const s = rawStatus.toUpperCase();
    if (status.includes('approved') || status.includes('accepted') || status.includes('paid') || s === 'A') {
      metrics.approved++;
    } else if (status.includes('rejected') || status.includes('declined') || s === 'X' || s === 'D') {
      metrics.rejected++;
      if (reason) metrics.rejectionReasons[reason] = (metrics.rejectionReasons[reason] || 0) + 1;
    } else if (status.includes('pending') || status.includes('processing') || s === 'P') {
      metrics.pending++;
    } else if (status.includes('submitted') || status.includes('sent') || s === 'S') {
      metrics.submitted++;
    } else if (status.includes('received') || s === 'R') {
      metrics.received++;
    }

    metrics.byStatus[status || 'unknown'] = (metrics.byStatus[status || 'unknown'] || 0) + 1;

    // Monthly aggregation
    const dateStr = colDate ? (row[colDate] || '').trim() : '';
    const claimMonth = parseDateMonth(dateStr);
    if (claimMonth >= 0) {
      metrics.totalClaims_monthly[claimMonth]++;
      metrics.claimAmounts_monthly[claimMonth] += claimValue;
      if (status.includes('approved') || status.includes('accepted') || status.includes('paid') || s === 'A') metrics.approvedClaims_monthly[claimMonth]++;
      if (status.includes('rejected') || status.includes('declined') || s === 'X' || s === 'D') metrics.rejectedClaims_monthly[claimMonth]++;
      if (status.includes('pending') || status.includes('processing') || s === 'P') metrics.pendingClaims_monthly[claimMonth]++;
      metrics.byMonth[claimMonth] = (metrics.byMonth[claimMonth] || 0) + 1;
    }

    // By scheme
    if (scheme) {
      if (!metrics.byScheme[scheme]) {
        metrics.byScheme[scheme] = { totalClaimed: 0, submitted: 0, received: 0, rejected: 0, approved: 0, pending: 0 };
      }
      metrics.byScheme[scheme].totalClaimed += claimValue;
      if (status.includes('approved') || status.includes('accepted') || status.includes('paid') || s === 'A') metrics.byScheme[scheme].approved++;
      else if (status.includes('rejected') || status.includes('declined') || s === 'X' || s === 'D') metrics.byScheme[scheme].rejected++;
      else if (status.includes('pending') || status.includes('processing') || s === 'P') metrics.byScheme[scheme].pending++;
      else if (status.includes('received') || s === 'R') metrics.byScheme[scheme].received++;
      else metrics.byScheme[scheme].submitted++;
    }

    // By doctor
    if (doctor) {
      if (!metrics.byDoctor[doctor]) {
        metrics.byDoctor[doctor] = { claims: 0, approved: 0, amount: 0 };
      }
      metrics.byDoctor[doctor].claims++;
      metrics.byDoctor[doctor].amount += claimValue;
      if (status.includes('approved') || status.includes('accepted') || status.includes('paid') || s === 'A') metrics.byDoctor[doctor].approved++;
    }
  }

  console.log('[Claims Parser] Total claims:', metrics.totalClaims, 'Total claimed:', metrics.totalClaimed);

  // Store raw rows for row-level dedup on near-duplicate uploads
  // Cap at 2000 rows to avoid localStorage bloat
  metrics.rawRows = data.length <= 2000 ? data : undefined;

  return {
    year,
    dash: null, dashboard: null,
    loc: null, location: null,
    apac: metrics, claims: metrics,
    uploads: [],
    datasets: {},
  };
}

/**
 * Auto-detect and parse CSV file
 */
export function autoParseCSV(csvText: string): YearData {
  const result = Papa.parse(csvText, { header: true, skipEmptyLines: true });
  const headers = Object.keys((result.data[0] || {}) as Record<string, unknown>);
  const firstRow = (result.data[0] || {}) as Record<string, unknown>;
  const fileType = detectFileType(headers, firstRow);

  switch (fileType) {
    case 'dashboard':
      return parseDashboardCSV(csvText);
    case 'location':
      return parseLocationCSV(csvText);
    case 'claims':
      return parseClaimsCSV(csvText);
    default:
      return {
        year: detectYear(csvText),
        dash: null,
        dashboard: null,
        loc: null,
        location: null,
        apac: null,
        claims: null,
        uploads: [],
        datasets: {},
      };
  }
}

/**
 * Export array of records to CSV format
 */
export function exportToCSV(data: Record<string, unknown>[], filename: string): string {
  if (data.length === 0) return '';

  const headers = Object.keys(data[0]);
  const csvLines = [
    headers.join(','),
    ...data.map((row) =>
      headers
        .map((header) => {
          const value = row[header];
          if (value === null || value === undefined) return '';
          const str = String(value);
          if (str.includes(',') || str.includes('"') || str.includes('\n')) {
            return `"${str.replace(/"/g, '""')}"`;
          }
          return str;
        })
        .join(',')
    ),
  ];

  return csvLines.join('\n');
}

/**
 * Export YearData to CSV files (multiple files, one per data type)
 */
export function exportYearDataToCSV(yearData: YearData): Record<string, string> {
  const files: Record<string, string> = {};

  if (yearData.dashboard) {
    const data = [yearData.dashboard] as unknown as Record<string, unknown>[];
    files[`dashboard_${yearData.year}.csv`] = exportToCSV(data, `dashboard_${yearData.year}.csv`);
  }

  if (yearData.location) {
    const data = [yearData.location] as unknown as Record<string, unknown>[];
    files[`location_${yearData.year}.csv`] = exportToCSV(data, `location_${yearData.year}.csv`);
  }

  if (yearData.claims) {
    const data = [yearData.claims] as unknown as Record<string, unknown>[];
    files[`claims_${yearData.year}.csv`] = exportToCSV(data, `claims_${yearData.year}.csv`);
  }

  return files;
}