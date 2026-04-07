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
 * Safe parse number, handling decimals and comma-free formats
 */
function parseNumber(value: unknown): number {
  if (value === null || value === undefined) return 0;
  const str = String(value).trim();
  if (!str) return 0;
  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
}

// ===== PARSING FUNCTIONS =====

/**
 * Parse Dashboard CSV (RptManagementDashboard.csv format)
 *
 * Format:
 * Line 1: Facility name (e.g., "Avenues Laboratory")
 * Line 2: Report description with date range (e.g., "Management Dashboard Report With Capture Date 01/01/2025 To 31/12/2025")
 * Line 3: Column headers (comma-separated)
 * Lines 4-15: Monthly data rows (January through December)
 */
export function parseDashboardCSV(csvText: string): YearData {
  const lines = csvText.split('\n').map(l => l.trim());

  // Extract facility name and year
  const facilityName = lines[0] || 'Avenues Clinic';
  const line2 = lines[1] || '';
  const yearMatch = line2.match(/\b(20\d{2})\b/);
  const year = yearMatch ? parseInt(yearMatch[1], 10) : new Date().getFullYear();

  // Parse headers from line 3 (index 2). Split and keep all non-empty.
  const headerLine = lines[2] || '';
  const allHeaders = headerLine.split(',').map(h => h.trim());
  // First header is "Date", rest are data columns. Filter trailing empties.
  const dataHeaders = allHeaders.slice(1).filter(h => h.length > 0);

  console.log('[Parser] Facility:', facilityName, '| Year:', year);
  console.log('[Parser] Found', dataHeaders.length, 'data columns');

  // Initialize metrics with fresh arrays (not fill which shares refs)
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
    revLocation: {
      'ADJUSTMENT': new Array(12).fill(0),
      'Laboratory Fee': new Array(12).fill(0),
      'None': new Array(12).fill(0),
    },
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

  // Parse data rows starting at line index 3 (after facility, description, headers)
  for (let lineIdx = 3; lineIdx < lines.length; lineIdx++) {
    const line = lines[lineIdx];
    if (!line) continue;

    // Split the entire line by comma
    const rawValues = line.split(',');

    // First value is month name
    const monthName = (rawValues[0] || '').trim();
    const monthIdx = getMonthIndex(monthName);

    if (monthIdx < 0 || monthIdx >= 12) continue;

    // Map each data header to its numeric value
    // rawValues[0] = month name, rawValues[1..N] = data values matching dataHeaders
    const valueMap = new Map<string, number>();
    dataHeaders.forEach((header, idx) => {
      valueMap.set(header, parseNumber(rawValues[idx + 1]));
    });

    console.log(`[Parser] ${monthName}: revenue=${valueMap.get('Billing Statistics-Total Revenue')}, admLab=${valueMap.get('Admissions-LABORATORY')}, episodes=${valueMap.get('Episodes Finalised')}`);

    // Extract and assign values
    metrics.admCasualty[monthIdx] = valueMap.get('Admissions-CASUALTY PATIENT') || 0;
    metrics.admLab[monthIdx] = valueMap.get('Admissions-LABORATORY') || 0;
    metrics.casToInpatient[monthIdx] = valueMap.get('Patients Transferred Fom Casualty To In Patient') || 0;

    const rxHospital = valueMap.get('Number of Prescriptions Dispensed-Hospital') || 0;
    const rxRetail = valueMap.get('Number of Prescriptions Dispensed-Retail') || 0;
    metrics.pharmacyRx[monthIdx] = rxHospital + rxRetail;

    const revHospital = valueMap.get('Revenue of Prescriptions Dispensed-Hospital') || 0;
    const revRetail = valueMap.get('Revenue of Prescriptions Dispensed-Retail') || 0;
    metrics.pharmacyRev[monthIdx] = revHospital + revRetail;

    metrics.monthRevenue[monthIdx] = valueMap.get('Billing Statistics-Total Revenue') || 0;
    metrics.revPerPatDay[monthIdx] = valueMap.get('Billing Statistics-Revenue Per Patient Day') || 0;
    metrics.epsFinalised[monthIdx] = valueMap.get('Episodes Finalised') || 0;
    metrics.dischNotFinalised[monthIdx] = valueMap.get('Discharges Not Finalised') || 0;

    // Revenue by location/centre (arrays already initialized above)
    metrics.revLocation['ADJUSTMENT'][monthIdx] = valueMap.get('Revenue Per Revenue Centre-ADJUSTMENT') || 0;
    metrics.revLocation['Laboratory Fee'][monthIdx] = valueMap.get('Revenue Per Revenue Centre-Laboratory Fee') || 0;
    metrics.revLocation['None'][monthIdx] = valueMap.get('Revenue Per Revenue Centre-None') || 0;

    // Payments
    metrics.payments.deposits[monthIdx] = valueMap.get('Payments Per Day-Deposits') || 0;
    metrics.payments.individual[monthIdx] = valueMap.get('Payments Per Day-Individual Payments') || 0;
    metrics.payments.medAid[monthIdx] = valueMap.get('Payments Per Day-Medical Aid Payments') || 0;
    metrics.payments.batched[monthIdx] = valueMap.get('Payments Per Day-Batched Payments') || 0;

    // Debtors reconciliation
    // Note: "Account Sundries" and "SunList" contain the same value.
    // Only SunList enters the debtors formula: Closing = BF + Revenue - Payments + SunList
    metrics.debtRecon.brought[monthIdx] = valueMap.get('Debtors Reconciliation Per Day-Balance Brought Forward') || 0;
    metrics.debtRecon.revenue[monthIdx] = valueMap.get('Debtors Reconciliation Per Day-Revenue') || 0;
    metrics.debtRecon.payments[monthIdx] = valueMap.get('Debtors Reconciliation Per Day-Payments') || 0;
    metrics.debtRecon.sundries[monthIdx] = valueMap.get('Debtors Reconciliation Per Day-SunList') || 0;

    // Closing balance = BF + Revenue - Payments + Sundries
    metrics.debtRecon.total[monthIdx] =
      metrics.debtRecon.brought[monthIdx] +
      metrics.debtRecon.revenue[monthIdx] -
      metrics.debtRecon.payments[monthIdx] +
      metrics.debtRecon.sundries[monthIdx];
  }

  // Calculate total revenue
  metrics.totalRevenue = metrics.monthRevenue.reduce((sum, val) => sum + val, 0);

  return {
    year,
    dash: metrics,
    dashboard: metrics,
    loc: null,
    location: null,
    apac: null,
    claims: null,
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
  const colTotal = findCol(['total']);
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

  const colStatus = findCol(['status']);
  const colAmount = findCol(['amount', 'total', 'claimed']);
  const colScheme = findCol(['scheme', 'medical aid', 'funder']);
  const colDoctor = findCol(['doctor', 'provider']);
  const colDate = findCol(['date', 'submitted']);
  const colReason = findCol(['reason', 'rejection']);

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
    const status = colStatus ? (row[colStatus] || '').trim().toLowerCase() : '';
    const amount = colAmount ? parseNumber(row[colAmount]) : 0;
    const scheme = colScheme ? (row[colScheme] || '').trim() : '';
    const doctor = colDoctor ? (row[colDoctor] || '').trim() : '';
    const reason = colReason ? (row[colReason] || '').trim() : '';

    metrics.totalClaimed += amount;

    // Status tracking
    if (status.includes('approved') || status.includes('accepted') || status.includes('paid')) {
      metrics.approved++;
    } else if (status.includes('rejected') || status.includes('declined')) {
      metrics.rejected++;
      if (reason) metrics.rejectionReasons[reason] = (metrics.rejectionReasons[reason] || 0) + 1;
    } else if (status.includes('pending') || status.includes('processing')) {
      metrics.pending++;
    } else if (status.includes('submitted') || status.includes('sent')) {
      metrics.submitted++;
    } else if (status.includes('received')) {
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
          metrics.claimAmounts_monthly[month] += amount;
          if (status.includes('approved') || status.includes('paid')) metrics.approvedClaims_monthly[month]++;
          if (status.includes('rejected')) metrics.rejectedClaims_monthly[month]++;
          if (status.includes('pending')) metrics.pendingClaims_monthly[month]++;
          metrics.byMonth[month] = (metrics.byMonth[month] || 0) + 1;
        }
      }
    }

    // By scheme
    if (scheme) {
      if (!metrics.byScheme[scheme]) {
        metrics.byScheme[scheme] = { totalClaimed: 0, submitted: 0, received: 0, rejected: 0, approved: 0, pending: 0 };
      }
      metrics.byScheme[scheme].totalClaimed += amount;
      if (status.includes('approved') || status.includes('paid')) metrics.byScheme[scheme].approved++;
      else if (status.includes('rejected')) metrics.byScheme[scheme].rejected++;
      else if (status.includes('pending')) metrics.byScheme[scheme].pending++;
      else metrics.byScheme[scheme].submitted++;
    }

    // By doctor
    if (doctor) {
      if (!metrics.byDoctor[doctor]) {
        metrics.byDoctor[doctor] = { claims: 0, approved: 0, amount: 0 };
      }
      metrics.byDoctor[doctor].claims++;
      metrics.byDoctor[doctor].amount += amount;
      if (status.includes('approved') || status.includes('paid')) metrics.byDoctor[doctor].approved++;
    }
  }

  console.log('[Claims Parser] Total claims:', metrics.totalClaims, 'Total claimed:', metrics.totalClaimed);

  return {
    year,
    dash: null, dashboard: null,
    loc: null, location: null,
    apac: metrics, claims: metrics,
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
    const data = [yearData.dashboard];
    files[`dashboard_${yearData.year}.csv`] = exportToCSV(data, `dashboard_${yearData.year}.csv`);
  }

  if (yearData.location) {
    const data = [yearData.location];
    files[`location_${yearData.year}.csv`] = exportToCSV(data, `location_${yearData.year}.csv`);
  }

  if (yearData.claims) {
    const data = [yearData.claims];
    files[`claims_${yearData.year}.csv`] = exportToCSV(data, `claims_${yearData.year}.csv`);
  }

  return files;
}
