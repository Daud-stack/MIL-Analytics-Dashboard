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

/**
 * Parse Dashboard CSV (RptManagementDashboard.csv format)
 *
 * Format: Section-based, row-oriented
 * Line 1: Facility name (e.g., "Avenues Clinic")
 * Line 2: Report description with date range
 * Line 3: "DataSet,January,February,...,December,Total"
 * Lines 4+: Section headers followed by metric rows
 *   - Section headers are lines with no comma-separated values (e.g., "Admissions")
 *   - Metric rows: "METRIC_NAME,jan,feb,...,dec,total"
 */
export function parseDashboardCSV(csvText: string): YearData {
  const lines = csvText.split('\n').map(l => l.trim());

  // Extract facility name and year
  const facilityName = lines[0] || 'Avenues Clinic';
  const line2 = lines[1] || '';
  const yearMatch = line2.match(/\b(20\d{2})\b/);
  const year = yearMatch ? parseInt(yearMatch[1], 10) : new Date().getFullYear();

  console.log('[Parser] Facility:', facilityName, '| Year:', year);

  // Initialize metrics
  const metrics: DashboardMetrics = {
    year,
    totalRevenue: 0,
    monthRevenue: new Array(12).fill(0),
    monthEpisodes: new Array(12).fill(0),
    admCasualty: new Array(12).fill(0),
    admDay: new Array(12).fill(0),
    admInpatient: new Array(12).fill(0),
    admLab: new Array(12).fill(0),
    theatreCases: new Array(12).fill(0),
    theatreMinutes: new Array(12).fill(0),
    theatreUtil: new Array(12).fill(0),
    theatrePctOcc: new Array(12).fill(0),
    pharmacyRx: new Array(12).fill(0),
    pharmacyRev: new Array(12).fill(0),
    occupancyBeds: new Array(12).fill(0),
    patientDays: {},
    pctOccWard: {},
    patDaysWard: {},
    patDaysLOC: {},
    occMidnight: new Array(12).fill(0),
    revLocation: {},
    admPerWard: {},
    debtRecon: {
      brought: new Array(12).fill(0),
      revenue: new Array(12).fill(0),
      payments: new Array(12).fill(0),
      sundries: new Array(12).fill(0),
      total: new Array(12).fill(0),
    },
    casToInpatient: new Array(12).fill(0),
    epsFinalised: new Array(12).fill(0),
    dischNotFinalised: new Array(12).fill(0),
    revPerPatDay: new Array(12).fill(0),
    gpEthical: new Array(12).fill(0),
    gpSurgical: new Array(12).fill(0),
    payments: {
      deposits: new Array(12).fill(0),
      individual: new Array(12).fill(0),
      medAid: new Array(12).fill(0),
      batched: new Array(12).fill(0),
    },
  };

  /**
   * Extract 12 monthly values from a CSV row.
   * Row format: "LABEL,jan,feb,...,dec,total"
   * Returns array of 12 numbers (indices 0-11).
   */
  function getMonthlyValues(fields: string[]): number[] {
    const vals = new Array(12).fill(0);
    for (let i = 0; i < 12; i++) {
      vals[i] = parseNumber(fields[i + 1]); // fields[0] is label, fields[1..12] are months
    }
    return vals;
  }

  /** Add monthly values to a target array */
  function addToArray(target: number[], source: number[]): void {
    for (let i = 0; i < 12; i++) {
      target[i] += source[i];
    }
  }

  // Track current section context as we parse line by line
  let currentSection = '';
  let currentSubSection = '';

  // Parse starting at line 3 (skip facility, description, column headers)
  for (let lineIdx = 3; lineIdx < lines.length; lineIdx++) {
    const line = lines[lineIdx];
    if (!line) continue;

    const fields = splitCSVLine(line);
    const label = (fields[0] || '').trim();
    if (!label) {
      // Empty label but has data values → use current section context
      // e.g., "Patients Transferred From Casualty To In Patient" section has unlabeled data row
      if (fields.length > 2 && parseNumber(fields[1]) !== 0) {
        const vals = getMonthlyValues(fields);
        const sectionLower = currentSection.toLowerCase();
        if (sectionLower.includes('transferred') && sectionLower.includes('casualty')) {
          metrics.casToInpatient = vals;
        }
      }
      continue;
    }

    // Count how many numeric-looking values follow the label
    let numericCount = 0;
    for (let i = 1; i < Math.min(fields.length, 14); i++) {
      const v = fields[i]?.trim();
      if (v && v !== '' && !isNaN(parseFloat(v.replace(/,/g, '')))) {
        numericCount++;
      }
    }

    // If we have >=6 numeric values after the label, this is a data row
    const isDataRow = numericCount >= 6 && fields.length >= 7;

    if (!isDataRow) {
      // This is a section header or sub-section header
      const labelLower = label.toLowerCase();

      // Check if it's a sub-section within a parent section
      if (labelLower.includes('patients at midnight') || labelLower.includes('patients at midday') ||
          labelLower.includes('patients days per ward') || labelLower.includes('percentage occupancy per ward') ||
          labelLower.includes('patients days per level') || labelLower.includes('billed patient days') ||
          labelLower.includes('theatre cases') || labelLower.includes('theatre utilization') ||
          labelLower.includes('percentage occupancy per theatre') ||
          labelLower.includes('total number of prescriptions') || labelLower.includes('total revenue of prescriptions') ||
          labelLower.includes('revenue per patient day')) {
        currentSubSection = label;
      } else {
        // Top-level section
        currentSection = label;
        currentSubSection = '';
      }
      continue;
    }

    // ── DATA ROW: extract monthly values ──
    const vals = getMonthlyValues(fields);
    const labelLower = label.toLowerCase();
    const sectionLower = currentSection.toLowerCase();
    const subSectionLower = currentSubSection.toLowerCase();

    // Skip "Total" and "Average" summary rows for most sections,
    // but let specific sections handle them (debtors total, GP averages)
    if (labelLower === 'total' || labelLower === 'average') {
      // Allow debtors reconciliation "Total" row
      if (labelLower === 'total' && sectionLower.includes('debtors reconciliation')) {
        metrics.debtRecon.total = vals;
      }
      // Allow GP percentage "Average" rows
      if (labelLower === 'average' && sectionLower.includes('gp percentage') && sectionLower.includes('ethical')) {
        metrics.gpEthical = vals;
      }
      if (labelLower === 'average' && sectionLower.includes('gp percentage') && sectionLower.includes('surgical')) {
        metrics.gpSurgical = vals;
      }
      continue;
    }

    // ── ADMISSIONS ──
    if (sectionLower === 'admissions' && !subSectionLower) {
      if (labelLower.includes('casualty')) {
        metrics.admCasualty = vals;
      } else if (labelLower.includes('day')) {
        metrics.admDay = vals;
      } else if (labelLower.includes('in-patient') || labelLower.includes('inpatient') || labelLower.includes('in patient')) {
        metrics.admInpatient = vals;
      } else if (labelLower.includes('laboratory')) {
        metrics.admLab = vals;
      }
    }

    // ── PATIENTS TRANSFERRED FROM CASUALTY TO IN PATIENT ──
    else if (sectionLower.includes('transferred') && sectionLower.includes('casualty')) {
      metrics.casToInpatient = vals;
    }

    // ── ADMISSIONS PER WARD ──
    else if (sectionLower.includes('admissions per ward')) {
      if (!metrics.admPerWard[label]) metrics.admPerWard[label] = new Array(12).fill(0);
      metrics.admPerWard[label] = vals;
    }

    // ── OCCUPANCY: Patients At Midnight Per Ward ──
    else if (sectionLower === 'occupancy' && subSectionLower.includes('patients at midnight')) {
      if (!metrics.patientDays[label]) metrics.patientDays[label] = new Array(12).fill(0);
      metrics.patientDays[label] = vals;
      // Also accumulate for occMidnight total
      addToArray(metrics.occMidnight, vals);
    }

    // ── OCCUPANCY: Patients Days Per Ward ──
    else if (subSectionLower.includes('patients days per ward')) {
      if (!metrics.patDaysWard[label]) metrics.patDaysWard[label] = new Array(12).fill(0);
      metrics.patDaysWard[label] = vals;
    }

    // ── OCCUPANCY: Percentage Occupancy Per Ward ──
    else if (subSectionLower.includes('percentage occupancy per ward')) {
      if (!metrics.pctOccWard[label]) metrics.pctOccWard[label] = new Array(12).fill(0);
      metrics.pctOccWard[label] = vals;
    }

    // ── Patients Days Per Level Of Care ──
    else if (subSectionLower.includes('patients days per level') || sectionLower.includes('patients days per level')) {
      if (!metrics.patDaysLOC[label]) metrics.patDaysLOC[label] = new Array(12).fill(0);
      metrics.patDaysLOC[label] = vals;
    }

    // ── THEATRE STATISTICS: Theatre Cases ──
    else if (sectionLower.includes('theatre') && subSectionLower.includes('theatre cases')) {
      if (labelLower === 'theatre') {
        metrics.theatreCases = vals;
      }
    }

    // ── THEATRE UTILIZATION ──
    else if (subSectionLower.includes('theatre utilization')) {
      if (labelLower === 'theatre') {
        metrics.theatreMinutes = vals;
        // Calculate utilization % = actual minutes / available minutes per month
        // Available = ~620 mins/day * ~22 working days = ~13640 mins
        // But store raw minutes, let UI calculate %
        metrics.theatreUtil = vals.map(v => {
          const availableMinutes = 13640; // approximate monthly available minutes
          return availableMinutes > 0 ? (v / availableMinutes) * 100 : 0;
        });
      }
    }

    // ── PERCENTAGE OCCUPANCY PER THEATRE ──
    else if (subSectionLower.includes('percentage occupancy per theatre')) {
      if (labelLower === 'theatre' || labelLower === 'average') {
        metrics.theatrePctOcc = vals;
      }
    }

    // ── PHARMACY: Total Number of Prescriptions Dispensed ──
    else if (sectionLower.includes('pharmacy') && subSectionLower.includes('number of prescriptions')) {
      if (labelLower === 'hospital' || labelLower === 'retail') {
        addToArray(metrics.pharmacyRx, vals);
      }
    }

    // ── PHARMACY: Total Revenue of Prescriptions Dispensed ──
    else if (subSectionLower.includes('revenue of prescriptions')) {
      if (labelLower === 'hospital' || labelLower === 'retail') {
        addToArray(metrics.pharmacyRev, vals);
      }
    }

    // ── BILLING STATISTICS: Total Revenue ──
    else if (sectionLower.includes('billing statistics')) {
      if (labelLower.includes('total revenue')) {
        metrics.monthRevenue = vals;
        console.log('[Parser] Revenue:', vals);
      }
    }

    // ── REVENUE PER PATIENT DAY ──
    else if (sectionLower.includes('revenue per patient day') || subSectionLower.includes('revenue per patient day')) {
      metrics.revPerPatDay = vals;
    }

    // ── REVENUE PER STOCK LOCATION ──
    else if (sectionLower.includes('revenue per stock location')) {
      if (!metrics.revLocation[label]) metrics.revLocation[label] = new Array(12).fill(0);
      metrics.revLocation[label] = vals;
    }

    // ── COS PER STOCK LOCATION (skip — not in DashboardMetrics) ──
    else if (sectionLower.includes('cos per stock location')) {
      // Skip cost of sales data
    }

    // ── GP PERCENTAGE FOR ETHICAL/SURGICAL STOCK ──
    // (Average rows handled above in the skip block)

    // ── EPISODES FINALISED ──
    else if (labelLower.includes('episodes finalised') || labelLower.includes('episodes finalized')) {
      metrics.epsFinalised = vals;
    }

    // ── DISCHARGES NOT FINALISED (count, not value) ──
    else if (labelLower === 'discharges not finalised' || labelLower === 'discharges not finalized') {
      metrics.dischNotFinalised = vals;
    }

    // ── REVENUE PER REVENUE CENTRE ──
    else if (sectionLower.includes('revenue per revenue centre') || sectionLower.includes('revenue per revenue center')) {
      if (!metrics.revLocation[label]) metrics.revLocation[label] = new Array(12).fill(0);
      metrics.revLocation[label] = vals;
    }

    // ── PAYMENTS PER DAY ──
    else if (sectionLower.includes('payments per day')) {
      if (labelLower.includes('deposits')) {
        metrics.payments.deposits = vals;
      } else if (labelLower.includes('individual')) {
        metrics.payments.individual = vals;
      } else if (labelLower.includes('medical aid')) {
        metrics.payments.medAid = vals;
      } else if (labelLower.includes('batched')) {
        metrics.payments.batched = vals;
      }
    }

    // ── ACCOUNT SUNDRIES ──
    else if (sectionLower.includes('account sundries') || labelLower.includes('account sundries')) {
      // Store in debtRecon.sundries if needed, or skip
    }

    // ── DEBTORS RECONCILIATION PER DAY ──
    else if (sectionLower.includes('debtors reconciliation')) {
      if (labelLower.includes('balance brought forward') || labelLower.includes('brought forward')) {
        metrics.debtRecon.brought = vals;
      } else if (labelLower === 'revenue') {
        metrics.debtRecon.revenue = vals;
      } else if (labelLower === 'payments') {
        metrics.debtRecon.payments = vals;
      } else if (labelLower === 'sundries') {
        metrics.debtRecon.sundries = vals;
      }
    }
  }

  // ── Post-processing ──

  // monthEpisodes: use epsFinalised if available, else sum admissions
  metrics.monthEpisodes = metrics.monthEpisodes.map((value, idx) => {
    if (metrics.epsFinalised[idx] > 0) return metrics.epsFinalised[idx];
    const admSum = metrics.admCasualty[idx] + metrics.admDay[idx] + metrics.admInpatient[idx] + metrics.admLab[idx];
    return admSum > 0 ? admSum : value;
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
      const sum = nonZeroWards.reduce((acc, wardValues) => acc + (wardValues[idx] || 0), 0);
      return nonZeroWards.length > 0 ? sum / nonZeroWards.length : 0;
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
    let admMonth = -1;
    if (admDateStr) {
      // Try various date formats: DD/MM/YYYY, YYYY-MM-DD, MM/DD/YYYY
      const dmyMatch = admDateStr.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
      if (dmyMatch) {
        const month = parseInt(dmyMatch[2], 10) - 1;
        if (month >= 0 && month < 12) admMonth = month;
      }
    }

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
    if (dateStr) {
      const dateMatch = dateStr.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
      if (dateMatch) {
        const month = parseInt(dateMatch[2], 10) - 1;
        if (month >= 0 && month < 12) {
          metrics.totalClaims_monthly[month]++;
          metrics.claimAmounts_monthly[month] += claimValue;
          if (status.includes('approved') || status.includes('accepted') || status.includes('paid') || s === 'A') metrics.approvedClaims_monthly[month]++;
          if (status.includes('rejected') || status.includes('declined') || s === 'X' || s === 'D') metrics.rejectedClaims_monthly[month]++;
          if (status.includes('pending') || status.includes('processing') || s === 'P') metrics.pendingClaims_monthly[month]++;
          metrics.byMonth[month] = (metrics.byMonth[month] || 0) + 1;
        }
      }
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