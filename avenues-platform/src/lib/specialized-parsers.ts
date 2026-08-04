import Papa from 'papaparse';
import { DashboardMetrics, YearData } from '@/types';
import { emptyDashMetrics } from './parsers';

// Utility to parse numeric amounts
function parseAmount(val: any): number {
  if (!val) return 0;
  let s = String(val).replace(/,/g, '').replace(/[^\d.-]/g, '');
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

// Utility to parse months
function parseMonthIndex(dateStr: string): number {
  if (!dateStr) return -1;
  const match = dateStr.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (match) {
    const p1 = parseInt(match[1]);
    const p2 = parseInt(match[2]);
    // Assume DD/MM/YYYY
    if (p2 <= 12) return p2 - 1;
    if (p1 <= 12) return p1 - 1;
  }
  const isoMatch = dateStr.match(/(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
  if (isoMatch) {
    return parseInt(isoMatch[2]) - 1;
  }
  return -1;
}

export function parseCancellationsCSV(csvText: string, year: number): Partial<DashboardMetrics> {
  const result = Papa.parse(csvText, { header: true, skipEmptyLines: true });
  const data = result.data as Record<string, string>[];
  
  const byReason: Record<string, {count: number, value: number}> = {};
  const byLoc: Record<string, {count: number, value: number}> = {};
  const byMonth = new Array(12).fill(0);
  const valByMonth = new Array(12).fill(0);

  for (const row of data) {
    const loc = row['Location'] || row['location'] || 'Unknown';
    const reason = row['Cancellation Reason'] || row['cancellation reason'] || 'Unknown';
    const date = row['Cancellation Date'] || row['cancellation date'] || row['Transaction Date'];
    const amount = parseAmount(row['Cancellation Amount'] || row['cancellation amount']);
    
    if (!byReason[reason]) byReason[reason] = { count: 0, value: 0 };
    byReason[reason].count++;
    byReason[reason].value += amount;

    if (!byLoc[loc]) byLoc[loc] = { count: 0, value: 0 };
    byLoc[loc].count++;
    byLoc[loc].value += amount;

    const mIdx = parseMonthIndex(date);
    if (mIdx >= 0 && mIdx < 12) {
      byMonth[mIdx]++;
      valByMonth[mIdx] += amount;
    }
  }

  return { cancellationsByReason: byReason, cancellationsByLocation: byLoc, cancellationsByMonth: byMonth, cancellationValueByMonth: valByMonth };
}

export function parsePaymentsCSV(csvText: string, year: number): Partial<DashboardMetrics> {
  const result = Papa.parse(csvText, { header: true, skipEmptyLines: true });
  const data = result.data as Record<string, string>[];

  const byType: Record<string, {count: number, amount: number}> = {};
  const byLoc: Record<string, {count: number, amount: number}> = {};
  const pByMonth = new Array(12).fill(0);
  const vByMonth = new Array(12).fill(0);
  
  const retailRevByFunder: Record<string, number[]> = {};
  const labRevByFunder: Record<string, number[]> = {};

  for (const row of data) {
    const type = row['Payment Type'] || 'Unknown';
    const loc = row['Location'] || 'Unknown';
    const date = row['Date Time'] || '';
    const funder = row['Medical Aid'] || 'Unknown';
    const amount = parseAmount(row['Payment / Deposit Amount'] || row['Payment Amount'] || 0);

    if (!byType[type]) byType[type] = { count: 0, amount: 0 };
    byType[type].count++;
    byType[type].amount += amount;

    if (!byLoc[loc]) byLoc[loc] = { count: 0, amount: 0 };
    byLoc[loc].count++;
    byLoc[loc].amount += amount;

    const mIdx = parseMonthIndex(date);
    if (mIdx >= 0 && mIdx < 12) {
      pByMonth[mIdx]++;
      vByMonth[mIdx] += amount;
      
      const locLower = loc.toLowerCase();
      if (locLower.includes('pharmacy') || locLower.includes('retail')) {
        if (!retailRevByFunder[funder]) retailRevByFunder[funder] = new Array(12).fill(0);
        retailRevByFunder[funder][mIdx] += amount;
      }
      if (locLower.includes('laboratory') || locLower.includes('lab')) {
        if (!labRevByFunder[funder]) labRevByFunder[funder] = new Array(12).fill(0);
        labRevByFunder[funder][mIdx] += amount;
      }
    }
  }

  return { 
    paymentsByType: byType, 
    paymentsByLocation: byLoc, 
    paymentsByMonth: pByMonth, 
    paymentAmountByMonth: vByMonth,
    retailRevenueByFunder: retailRevByFunder,
    labRevenueByFunder: labRevByFunder
  };
}

export function parseReleasesCSV(csvText: string, year: number): Partial<DashboardMetrics> {
  const result = Papa.parse(csvText, { header: true, skipEmptyLines: true });
  const data = result.data as Record<string, string>[];

  const slaDays: Record<string, number> = { "0-3 Days": 0, "4-7 Days": 0, "8-14 Days": 0, "15+ Days": 0, "Not Released": 0 };
  const outByMonth = new Array(12).fill(0);
  const unreleasedReason: Record<string, {count: number, value: number}> = {};

  for (const row of data) {
    const disDateStr = row['Discharge Date '] || row['Discharge Date'];
    const daysPost = row['Days Post Discharge'];
    const amount = parseAmount(row['Outstanding Amount']);
    const reason = row['Not Released Reason'] || 'Unknown';
    
    const mIdx = parseMonthIndex(disDateStr);
    if (mIdx >= 0 && mIdx < 12) {
      outByMonth[mIdx] += amount;
    }

    if (!daysPost || String(daysPost).trim() === '') {
      slaDays["Not Released"]++;
      if (!unreleasedReason[reason]) unreleasedReason[reason] = { count: 0, value: 0 };
      unreleasedReason[reason].count++;
      unreleasedReason[reason].value += amount;
    } else {
      const days = parseInt(daysPost);
      if (isNaN(days)) slaDays["Not Released"]++;
      else if (days <= 3) slaDays["0-3 Days"]++;
      else if (days <= 7) slaDays["4-7 Days"]++;
      else if (days <= 14) slaDays["8-14 Days"]++;
      else slaDays["15+ Days"]++;
    }
  }

  return { slaDaysToStatement: slaDays, outstandingAmountByMonth: outByMonth, unreleasedByReason: unreleasedReason };
}

export function parseDischargesCSV(csvText: string, year: number): Partial<DashboardMetrics> {
  const result = Papa.parse(csvText, { header: true, skipEmptyLines: true });
  const data = result.data as Record<string, string>[];

  const byType: Record<string, number> = {};
  const byWard: Record<string, number> = {};

  for (const row of data) {
    const type = row['Discharge Type'] || 'Unknown';
    const ward = row['Ward'] || 'Unknown';
    
    byType[type] = (byType[type] || 0) + 1;
    byWard[ward] = (byWard[ward] || 0) + 1;
  }

  return { dischargesByType: byType, dischargesByWardAgg: byWard };
}

export function parseRevenueCentersCSV(csvText: string, year: number): Partial<DashboardMetrics> {
  const result = Papa.parse(csvText, { header: true, skipEmptyLines: true });
  const data = result.data as Record<string, string>[];

  const revPerRevCentre: Record<string, number[]> = {};

  for (const row of data) {
    const desc = row['Description'] || 'Unknown';
    const income = parseAmount(row['Total Income'] || row['Income'] || 0);

    if (!revPerRevCentre[desc]) {
      revPerRevCentre[desc] = new Array(12).fill(0);
    }
    revPerRevCentre[desc][0] += income;
  }

  return { revPerRevCentre };
}

