'use client';

/**
 * CSV parsing utilities for healthcare data
 * Handles Dashboard, Location, and Claims data formats
 */

import Papa from 'papaparse';
import { DashboardMetrics, LocationData, ClaimsMetrics, YearData, ConversionMetrics, ConversionRecord } from '@/types';

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
  'funder', 'medical aid', 'rpt', 'value', 'claimed',
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
 * Detect delimiter: tab or comma. If the line contains tabs, use tab.
 */
function detectDelimiter(line: string): string {
  return line.includes('\t') ? '\t' : ',';
}

/**
 * Split a CSV/TSV line respecting quoted fields.
 * Auto-detects tab or comma delimiter.
 * e.g., 'January,"1,234",5678' → ['January', '1,234', '5678']
 * e.g., 'CASUALTY PATIENT\t758\t694' → ['CASUALTY PATIENT', '758', '694']
 */
function splitCSVLine(line: string, delimiter?: string): string[] {
  const delim = delimiter ?? detectDelimiter(line);
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === delim && !inQuotes) {
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
 * Supports THREE formats:
 *
 * FORMAT A — COLUMNAR (column headers like "Admissions-CASUALTY PATIENT"):
 *   Line 1: Facility name
 *   Line 2: Report description with date range
 *   Line 3: Column headers — "Date,Admissions-CASUALTY PATIENT,..."
 *   Lines 4+: One row per month — "January,758,68,..."
 *
 * FORMAT B — SECTION-BASED with month names (tab-delimited):
 *   Line 3: "Months\tJanuary\tFebruary\t..."
 *   Sections as row groups with data beneath.
 *
 * FORMAT C — SECTION-BASED with numeric columns (comma-delimited):
 *   Line 2: "Management Dashboard Report With Capture Date DD/MM/YYYY To DD/MM/YYYY"
 *   Line 3: "DataSet,1,2,3,...,N,Total"
 *   Sections as row groups. Columns are month numbers (1=Jan) for multi-month
 *   reports, or day numbers for single-month reports.
 *
 * Detection:
 *   - Line 3 starts with "Months" → Format B
 *   - Line 3 starts with "DataSet" → Format C
 *   - Otherwise → Format A
 */
export function parseDashboardCSV(csvText: string): YearData {
  // Keep ALL lines (including blanks) so section breaks can be detected
  const rawLines = csvText.split('\n').map(l => l.trim());
  // Filtered version for header detection (first 3 non-empty lines)
  const lines = rawLines.filter(l => l.length > 0);

  // Extract facility name and year
  const facilityName = lines[0] || 'Avenues Clinic';
  const line2 = lines[1] || '';
  const yearMatch = line2.match(/\b(20\d{2})\b/);
  const year = yearMatch ? parseInt(yearMatch[1], 10) : new Date().getFullYear();

  console.log('[Parser] Facility:', facilityName, '| Year:', year);

  const metrics = emptyDashMetrics(year);

  // Detect delimiter from the first substantial data line
  const delim = detectDelimiter(lines[2] || lines[3] || '');

  // Detect format from line 3 (index 2)
  const headerLine = lines[2] || '';
  const headerFields = splitCSVLine(headerLine, delim);
  const firstHeader = headerFields[0]?.toLowerCase().trim() || '';

  // Find the raw line index of the header so section parsing starts from the correct position
  const rawHeaderIdx = rawLines.findIndex(l => l.trim() === headerLine.trim());
  const rawDataStart = rawHeaderIdx >= 0 ? rawHeaderIdx + 1 : 3;

  const isFormatB = firstHeader.startsWith('month');   // "Months\tJanuary\t..."
  const isFormatC = firstHeader === 'dataset';          // "DataSet,1,2,3,...,Total"

  // ── For Format C: determine column meaning from date range ──
  // "Capture Date DD/MM/YYYY To DD/MM/YYYY"
  // If range spans multiple months (e.g., 01/01 to 31/12) → columns are MONTHS (1=Jan, 2=Feb, ...)
  // If range is within a single month (e.g., 01/04 to 30/04) → columns are DAYS, aggregate into that month
  // If range is a few days / 1 week → columns are DAYS, map each to its calendar month
  let formatCStartDate: Date | null = null;
  let formatCIsMonthly = false; // true = columns are month numbers

  if (isFormatC) {
    const dateRangeMatch = line2.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})\s+To\s+(\d{1,2})\/(\d{1,2})\/(\d{4})/i);
    if (dateRangeMatch) {
      const startDay = parseInt(dateRangeMatch[1], 10);
      const startMonth = parseInt(dateRangeMatch[2], 10) - 1; // 0-based
      const startYear = parseInt(dateRangeMatch[3], 10);
      const endMonth = parseInt(dateRangeMatch[5], 10) - 1;
      const endYear = parseInt(dateRangeMatch[6], 10);

      formatCStartDate = new Date(startYear, startMonth, startDay);

      // If the range spans more than 1 month, columns represent months
      const totalMonthSpan = (endYear - startYear) * 12 + (endMonth - startMonth);
      formatCIsMonthly = totalMonthSpan > 1;

      console.log('[Parser] Date range:', dateRangeMatch[0],
        '| Mode:', formatCIsMonthly ? 'monthly (columns=months)' : 'daily (columns=days)',
        '| Month span:', totalMonthSpan);
    }
  }

  // ── Helper: parse section-based rows (shared by Format B and C) ──
  // Uses rawLines (with blanks) so blank lines reset the section context.
  // startLine is 0-based index into rawLines.
  function parseSectionRows(
    startLine: number,
    lineDelim: string,
    mapColumnToMonth: (colIndex: number) => number, // maps 1-based col position → 0-based month index (-1 to skip)
  ) {
    let currentSection = '';

    for (let lineIdx = startLine; lineIdx < rawLines.length; lineIdx++) {
      const line = rawLines[lineIdx];

      // Blank line = section break → reset section so standalone metrics don't inherit a stale section
      if (line === '') {
        currentSection = '';
        continue;
      }

      const fields = splitCSVLine(line, lineDelim);
      const firstField = (fields[0] || '').trim();

      // Skip "Total" and "Average" rows
      if (firstField.toLowerCase() === 'total' || firstField.toLowerCase() === 'average') continue;

      // Is this a section header? Check if fields[1..] have any non-zero numeric data.
      const hasData = fields.slice(1).some(f => {
        const trimmed = f.trim();
        if (trimmed === '' || trimmed.toLowerCase() === 'total') return false;
        const num = parseNumber(trimmed);
        return num !== 0;
      });

      // Section header: only 1 field, or no numeric data in remaining fields, and non-empty first field
      const isSectionHeader = (fields.length <= 1 || !hasData) && firstField !== '';

      if (isSectionHeader) {
        currentSection = firstField;
        continue;
      }

      // Data row
      // Empty first field = unnamed row (e.g., transfers section), use section name directly
      const colName = firstField === ''
        ? currentSection
        : currentSection ? `${currentSection}-${firstField}` : firstField;
      if (!colName) continue;
      if (!metrics.rawColumns[colName]) metrics.rawColumns[colName] = z12();

      for (let i = 1; i < fields.length; i++) {
        const fieldVal = fields[i]?.trim();
        if (!fieldVal || fieldVal.toLowerCase() === 'total') continue;
        const mIdx = mapColumnToMonth(i);
        if (mIdx >= 0 && mIdx < 12) {
          metrics.rawColumns[colName][mIdx] += parseNumber(fields[i]);
        }
      }
    }
  }

  if (isFormatB) {
    // ── FORMAT B: Section-based with month names ──
    const monthIndices: number[] = [];
    for (let i = 1; i < headerFields.length; i++) {
      monthIndices.push(getMonthIndex(headerFields[i]?.trim() || ''));
    }
    parseSectionRows(rawDataStart, delim, (col) => monthIndices[col - 1] ?? -1);

  } else if (isFormatC) {
    // ── FORMAT C: Section-based with "DataSet" header ──
    // Columns can be either:
    //   - Numeric: "DataSet,1,2,3,...,12,Total" (month or day numbers)
    //   - Month names: "DataSet,January,February,...,December,Total" (hybrid format)
    const colToMonth: number[] = new Array(headerFields.length).fill(-1);

    // First, try month name mapping (hybrid: DataSet + month names)
    let monthNamesMapped = 0;
    for (let i = 1; i < headerFields.length; i++) {
      const headerVal = headerFields[i]?.trim() || '';
      if (!headerVal || headerVal.toLowerCase() === 'total') continue;
      const mIdx = getMonthIndex(headerVal);
      if (mIdx >= 0) {
        colToMonth[i] = mIdx;
        monthNamesMapped++;
      }
    }

    // If month names didn't work, fall back to numeric column mapping
    if (monthNamesMapped === 0) {
      for (let i = 1; i < headerFields.length; i++) {
        const headerVal = headerFields[i]?.trim().toLowerCase();
        if (!headerVal || headerVal === 'total') continue;
        const num = parseInt(headerVal, 10);
        if (isNaN(num) || num < 1) continue;

        if (formatCIsMonthly) {
          // Columns are month numbers: 1=Jan, 2=Feb, ..., 12=Dec
          if (num >= 1 && num <= 12) {
            colToMonth[i] = num - 1;
          }
        } else if (formatCStartDate) {
          // Columns are day offsets from start date
          const date = new Date(formatCStartDate.getTime());
          date.setDate(date.getDate() + num - 1);
          colToMonth[i] = date.getMonth();
        }
      }
    }

    console.log('[Parser] Format C column mapping:', colToMonth.filter(m => m >= 0).length, 'mapped columns',
      monthNamesMapped > 0 ? '(month names)' : '(numeric)');

    parseSectionRows(rawDataStart, delim, (col) => {
      return colToMonth[col] ?? -1;
    });

  } else {
    // ── FORMAT A: Columnar (category-item column headers, months as rows) ──
    const headers = headerFields;

    for (let lineIdx = 3; lineIdx < lines.length; lineIdx++) {
      const fields = splitCSVLine(lines[lineIdx], delim);
      const monthName = (fields[0] || '').trim();
      const mIdx = getMonthIndex(monthName);
      if (mIdx < 0) continue;

      for (let col = 1; col < headers.length; col++) {
        const colName = headers[col]?.trim();
        if (!colName) continue;
        if (!metrics.rawColumns[colName]) metrics.rawColumns[colName] = z12();
        metrics.rawColumns[colName][mIdx] = parseNumber(fields[col]);
      }
    }
  }

  console.log('[Parser] Parsed', Object.keys(metrics.rawColumns).length, 'columns across 12 months');

  // ── Map rawColumns into structured metrics ──

  /** Get monthly array for a column by exact or fuzzy name, or return null */
  function col(name: string): number[] | null {
    // Exact match
    if (metrics.rawColumns[name]) return metrics.rawColumns[name];
    // Try suffix match (handles section prefix changes, e.g., "Total Number of X-Y" matches "Number of X-Y")
    const lowerName = name.toLowerCase();
    for (const key of Object.keys(metrics.rawColumns)) {
      if (key.toLowerCase().endsWith(lowerName)) return metrics.rawColumns[key];
    }
    // Try contains match
    for (const key of Object.keys(metrics.rawColumns)) {
      if (key.toLowerCase().includes(lowerName)) return metrics.rawColumns[key];
    }
    return null;
  }

  /** Get monthly array, defaulting to z12 */
  function colZ(name: string): number[] {
    return col(name) ?? z12();
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
  metrics.revPerPatDay = col('Billing Statistics-Revenue Per Patient Day')
    || col('Revenue Per Patient Day-Revenue Per Patient Day')
    || col('Revenue Per Patient Day')
    || z12();

  // Fallback: compute Revenue Per Patient Day from Total Revenue / Total Patient Days
  const revPerPatDayAllZero = metrics.revPerPatDay.every(v => v === 0);
  if (revPerPatDayAllZero && metrics.monthRevenue.some(v => v > 0)) {
    // Sum all patient days across wards per month
    const totalPatDaysPerMonth = z12();
    for (const arr of Object.values(metrics.patDaysWard)) {
      for (let i = 0; i < 12; i++) totalPatDaysPerMonth[i] += arr[i];
    }
    // If patDaysWard is empty, try billedPatDays
    if (totalPatDaysPerMonth.every(v => v === 0)) {
      for (const arr of Object.values(metrics.billedPatDays)) {
        for (let i = 0; i < 12; i++) totalPatDaysPerMonth[i] += arr[i];
      }
    }
    metrics.revPerPatDay = metrics.monthRevenue.map((rev, i) =>
      totalPatDaysPerMonth[i] > 0 ? Math.round(rev / totalPatDaysPerMonth[i]) : 0
    );
    console.log('[Parser] Computed revPerPatDay as fallback from revenue/patientDays');
  }

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
  metrics.debtRecon.sundries = col('Debtors Reconciliation Per Day-SunList')
    || col('Debtors Reconciliation Per Day-Sundries')
    || z12();
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

  // ══════════════════════════════════════════════════════════════
  // Casualty-to-Inpatient Conversion Analytics (AHRQ Standard)
  //
  // Definition: A "conversion" occurs when a patient presents at
  // Casualty/ED (C-episode) and is subsequently admitted as an
  // inpatient (A-episode) within 48 hours (0-2 calendar days).
  // Reference: AHRQ QI Technical Specifications, WHO ICD guidelines.
  // ══════════════════════════════════════════════════════════════

  const CONVERSION_WINDOW_DAYS = 2; // 0-48hrs per AHRQ standard

  // Ward columns for determining primary ward
  const wardDayCols = headers.filter(h =>
    h.toLowerCase().endsWith(' days') && h.toLowerCase() !== 'total days'
  );

  const colICDDesc = findCol(['primary icd desc', 'icd description']);
  const colDischDate = findCol(['disch date', 'discharge date']);

  // Helper: parse date string to Date object
  function parseFullDate(dateStr: string): Date | null {
    if (!dateStr) return null;
    // Try DD/MM/YYYY (Zimbabwe standard)
    const dmyMatch = dateStr.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
    if (dmyMatch) {
      const g1 = parseInt(dmyMatch[1], 10);
      const g2 = parseInt(dmyMatch[2], 10);
      const yr = parseInt(dmyMatch[3], 10);
      // If g1 > 12 → DD/MM, if g2 > 12 → MM/DD, else assume DD/MM
      if (g1 > 12) return new Date(yr, g2 - 1, g1);
      if (g2 > 12) return new Date(yr, g1 - 1, g2);
      return new Date(yr, g2 - 1, g1); // DD/MM/YYYY default
    }
    // Try YYYY-MM-DD
    const isoMatch = dateStr.match(/(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
    if (isoMatch) return new Date(parseInt(isoMatch[1], 10), parseInt(isoMatch[2], 10) - 1, parseInt(isoMatch[3], 10));
    return null;
  }

  function toAgeGroup(age: number): string {
    if (age < 18) return '0-17';
    if (age < 30) return '18-29';
    if (age < 45) return '30-44';
    if (age < 60) return '45-59';
    if (age < 75) return '60-74';
    return '75+';
  }

  // ── Episode data structure ──
  interface EpRecord {
    episode: string;
    name: string;          // uppercase patient name
    admDateStr: string;
    admDate: Date;
    admMonth: number;      // 0-11
    dischDate: Date | null;
    specialty: string;
    icdCode: string;
    icdDesc: string;
    los: number;
    revenue: number;
    ward: string;          // primary ward (highest days)
    medAid: string;
    age: number;
    gender: string;
  }

  // ── Build per-patient episode lists ──
  const patientCasualty = new Map<string, EpRecord[]>();
  const patientInpatient = new Map<string, EpRecord[]>();

  for (const row of data) {
    const ep = colEpisode ? (row[colEpisode] || '').trim() : '';
    if (!ep) continue;
    const epType = ep.charAt(0).toUpperCase();
    if (epType !== 'C' && epType !== 'A') continue;

    const name = colPatient ? (row[colPatient] || '').trim().toUpperCase() : '';
    const admDateStr = colAdmDate ? (row[colAdmDate] || '').trim() : '';
    const admDate = parseFullDate(admDateStr);
    const admMo = parseDateMonth(admDateStr);
    if (!name || !admDate || admMo < 0) continue;

    const dischDateStr = colDischDate ? (row[colDischDate] || '').trim() : '';
    const dischDate = parseFullDate(dischDateStr);

    // Primary ward
    let primaryWard = '';
    let maxWardDays = 0;
    for (const wCol of wardDayCols) {
      const d = parseNumber(row[wCol]);
      if (d > maxWardDays) { maxWardDays = d; primaryWard = wCol.replace(/ Days$/i, '').trim(); }
    }

    const rec: EpRecord = {
      episode: ep,
      name,
      admDateStr,
      admDate,
      admMonth: admMo,
      dischDate,
      specialty: colSpecialty ? (row[colSpecialty] || '').trim() : '',
      icdCode: colICD ? (row[colICD] || '').trim() : '',
      icdDesc: colICDDesc ? (row[colICDDesc] || '').trim() : '',
      los: colLOS ? parseNumber(row[colLOS]) : 0,
      revenue: colTotal ? parseNumber(row[colTotal]) : 0,
      ward: primaryWard,
      medAid: colMedAidGroup ? (row[colMedAidGroup] || '').trim() : (colMedAid ? (row[colMedAid] || '').trim() : ''),
      age: colAge ? parseNumber(row[colAge]) : 0,
      gender: colGender ? (row[colGender] || '').trim() : '',
    };

    if (epType === 'C') {
      if (!patientCasualty.has(name)) patientCasualty.set(name, []);
      patientCasualty.get(name)!.push(rec);
    } else {
      if (!patientInpatient.has(name)) patientInpatient.set(name, []);
      patientInpatient.get(name)!.push(rec);
    }
  }

  // ── Monthly accumulators ──
  const monthlyCasualty = new Array(12).fill(0);
  const monthlyInpatient = new Array(12).fill(0);
  const monthlyConversions = new Array(12).fill(0);
  const monthlyConvLOS = new Array(12).fill(0);
  const monthlyConvRev = new Array(12).fill(0);
  const monthlyConvCnt = new Array(12).fill(0);
  const monthlyDirectLOS = new Array(12).fill(0);
  const monthlyDirectRev = new Array(12).fill(0);
  const monthlyDirectCnt = new Array(12).fill(0);

  const convBySpecialty: Record<string, number> = {};
  const convByICD: Record<string, { count: number; desc: string }> = {};
  const convByWard: Record<string, number> = {};
  const convByMedAid: Record<string, number> = {};
  const convByAge: Record<string, number> = {};
  const convByGender: Record<string, number> = {};
  const conversionRecords: ConversionRecord[] = [];

  // Count monthly casualty totals
  for (const cList of patientCasualty.values()) {
    for (const c of cList) monthlyCasualty[c.admMonth]++;
  }

  // Track which A episodes are conversions vs direct admissions
  const convertedAEpisodes = new Set<string>();

  // ── Match C→A within CONVERSION_WINDOW_DAYS per patient ──
  for (const [name, cList] of patientCasualty) {
    const aList = patientInpatient.get(name);
    if (!aList || aList.length === 0) continue;

    // Sort both by admission date
    const sortedC = [...cList].sort((a, b) => a.admDate.getTime() - b.admDate.getTime());
    const sortedA = [...aList].sort((a, b) => a.admDate.getTime() - b.admDate.getTime());
    const usedA = new Set<string>();

    for (const ce of sortedC) {
      for (const ae of sortedA) {
        if (usedA.has(ae.episode)) continue;
        const diffMs = ae.admDate.getTime() - ce.admDate.getTime();
        const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
        if (diffDays < 0 || diffDays > CONVERSION_WINDOW_DAYS) continue;

        // Match found — this C episode converted to this A episode
        usedA.add(ae.episode);
        convertedAEpisodes.add(ae.episode);
        const mo = ae.admMonth;

        monthlyConversions[mo]++;
        monthlyConvLOS[mo] += ae.los;
        monthlyConvRev[mo] += ae.revenue;
        monthlyConvCnt[mo]++;

        if (ae.specialty) convBySpecialty[ae.specialty] = (convBySpecialty[ae.specialty] || 0) + 1;
        if (ae.icdCode) {
          if (!convByICD[ae.icdCode]) convByICD[ae.icdCode] = { count: 0, desc: ae.icdDesc || ae.icdCode };
          convByICD[ae.icdCode].count++;
        }
        if (ae.ward) convByWard[ae.ward] = (convByWard[ae.ward] || 0) + 1;
        if (ae.medAid) convByMedAid[ae.medAid] = (convByMedAid[ae.medAid] || 0) + 1;
        if (ae.age > 0) convByAge[toAgeGroup(ae.age)] = (convByAge[toAgeGroup(ae.age)] || 0) + 1;
        if (ae.gender) convByGender[ae.gender] = (convByGender[ae.gender] || 0) + 1;

        conversionRecords.push({
          patientName: ae.name,
          admDate: ae.admDateStr,
          casualtyEpisode: ce.episode,
          inpatientEpisode: ae.episode,
          specialty: ae.specialty,
          icdCode: ae.icdCode,
          icdDesc: ae.icdDesc,
          los: ae.los,
          revenue: ae.revenue,
          ward: ae.ward,
          medAid: ae.medAid,
          age: ae.age,
          gender: ae.gender,
          daysToConversion: diffDays,
        });
        break; // one A per C
      }
    }
  }

  // Count monthly inpatient totals and track direct (non-conversion) admissions
  for (const aList of patientInpatient.values()) {
    for (const a of aList) {
      monthlyInpatient[a.admMonth]++;
      if (!convertedAEpisodes.has(a.episode)) {
        // Direct admission (not from casualty)
        monthlyDirectLOS[a.admMonth] += a.los;
        monthlyDirectRev[a.admMonth] += a.revenue;
        monthlyDirectCnt[a.admMonth]++;
      }
    }
  }

  // ── Compute derived monthly metrics ──
  const monthlyConvRate = monthlyCasualty.map((c, i) =>
    c > 0 ? (monthlyConversions[i] / c) * 100 : 0
  );
  const monthlyConvALOS = monthlyConvCnt.map((cnt, i) =>
    cnt > 0 ? monthlyConvLOS[i] / cnt : 0
  );
  const monthlyConvAvgRev = monthlyConvCnt.map((cnt, i) =>
    cnt > 0 ? monthlyConvRev[i] / cnt : 0
  );
  const monthlyDirALOS = monthlyDirectCnt.map((cnt, i) =>
    cnt > 0 ? monthlyDirectLOS[i] / cnt : 0
  );
  const monthlyDirAvgRev = monthlyDirectCnt.map((cnt, i) =>
    cnt > 0 ? monthlyDirectRev[i] / cnt : 0
  );

  // Summary totals
  const totalConv = monthlyConversions.reduce((a, b) => a + b, 0);
  const totalCas = monthlyCasualty.reduce((a, b) => a + b, 0);
  const totalInp = monthlyInpatient.reduce((a, b) => a + b, 0);
  const totalConvLOS = monthlyConvLOS.reduce((a, b) => a + b, 0);
  const totalConvRev = monthlyConvRev.reduce((a, b) => a + b, 0);
  const totalDirLOS = monthlyDirectLOS.reduce((a, b) => a + b, 0);
  const totalDirRev = monthlyDirectRev.reduce((a, b) => a + b, 0);
  const totalDirCnt = monthlyDirectCnt.reduce((a, b) => a + b, 0);

  console.log(`[LOC Parser] Conversions: ${totalConv} of ${totalCas} casualty (${totalCas > 0 ? ((totalConv / totalCas) * 100).toFixed(1) : 0}%), ` +
    `ALOS conv=${totalConv > 0 ? (totalConvLOS / totalConv).toFixed(1) : '—'} vs direct=${totalDirCnt > 0 ? (totalDirLOS / totalDirCnt).toFixed(1) : '—'}`);

  const conversions: ConversionMetrics = {
    monthlyCasualty,
    monthlyInpatient,
    monthlyConversions,
    monthlyConversionRate: monthlyConvRate,
    monthlyConversionALOS: monthlyConvALOS,
    monthlyConversionRevenue: monthlyConvAvgRev,
    monthlyDirectALOS: monthlyDirALOS,
    monthlyDirectRevenue: monthlyDirAvgRev,
    conversionsBySpecialty: convBySpecialty,
    conversionsByICD: convByICD,
    conversionsByWard: convByWard,
    conversionsByMedAid: convByMedAid,
    conversionsByAge: convByAge,
    conversionsByGender: convByGender,
    conversionRecords: conversionRecords.sort((a, b) => b.revenue - a.revenue),
    totalCasualty: totalCas,
    totalInpatient: totalInp,
    totalConversions: totalConv,
    overallConversionRate: totalCas > 0 ? (totalConv / totalCas) * 100 : 0,
    avgConversionLOS: totalConv > 0 ? totalConvLOS / totalConv : 0,
    avgDirectLOS: totalDirCnt > 0 ? totalDirLOS / totalDirCnt : 0,
    avgConversionRevenue: totalConv > 0 ? totalConvRev / totalConv : 0,
    avgDirectRevenue: totalDirCnt > 0 ? totalDirRev / totalDirCnt : 0,
  };

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
    conversions,
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
 * Handles leading junk/noise in report files by scanning for the header row.
 */
export function parseClaimsCSV(csvText: string): YearData {
  const lines = csvText.split('\n');
  let headerRowIndex = 0;

  // Scan first 15 lines for the real header row (most keyword matches)
  const scanLimit = Math.min(lines.length, 15);
  let bestRow = 0;
  let maxMatches = 0;

  for (let i = 0; i < scanLimit; i++) {
    const lower = lines[i].toLowerCase();
    const matches = CLAIMS_KEYWORDS.filter(kw => lower.includes(kw.toLowerCase())).length;
    if (matches > maxMatches) {
      maxMatches = matches;
      bestRow = i;
    }
  }

  // If we found a strong header row (at least 2 matches), skip preceding junk
  let cleanCsv = csvText;
  if (maxMatches >= 2 && bestRow > 0) {
    console.log(`[Claims Parser] Skipping ${bestRow} junk lines before headers...`);
    cleanCsv = lines.slice(bestRow).join('\n');
  }

  const result = Papa.parse(cleanCsv, {
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

  const colStatus = findCol(['edi status', 'status', 'state', 'stage']);
  const colClaimValue = findCol(['claim value', 'claimed', 'bill amount', 'gross']);
  const colAmountPaid = findCol(['amount paid', 'paid', 'remittance', 'net']);
  const colAmount = colClaimValue || findCol(['amount', 'total', 'value']);
  const colScheme = findCol(['medical aid', 'scheme', 'funder', 'payer', 'insurer']);
  const colDoctor = findCol(['doctor', 'provider', 'practitioner', 'referring']);
  const colClaimDate = findCol(['claim date', 'submission date']);
  const colDate = colClaimDate || findCol(['discharge date', 'date', 'submitted', 'processed']);
  const colReason = findCol(['reason', 'rejection', 'description', 'message', 'comment']);
  const colEpisode = findCol(['episode', 'visit', 'account']);

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
