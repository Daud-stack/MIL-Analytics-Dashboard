/**
 * Comprehensive sample data generator for Avenues Clinic Intelligence Platform
 * Generates realistic healthcare data for dashboard, location, and claims
 * Uses seeded PRNG (mulberry32) for reproducible data
 */

import { DashboardMetrics, LocationData, DoctorMetric, ClaimsMetrics, ClaimSchemeData, YearData, MONTHS } from '@/types';

// ── Seeded PRNG (mulberry32) ────────────────────────────────
function createRng(seed: number) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── Constants ───────────────────────────────────────────────
const DOCTOR_NAMES = [
  'Dr. Sarah Johnson', 'Dr. Michael Chen', 'Dr. Emily Rodriguez', 'Dr. James Wilson',
  'Dr. Lisa Martinez', 'Dr. Robert Kumar', 'Dr. Jessica Lee', 'Dr. David Brown',
  'Dr. Patricia Taylor', 'Dr. Christopher Wong', 'Dr. Amanda Davis', 'Dr. Thomas Anderson',
  'Dr. Michelle Clark', 'Dr. Andrew Martin', 'Dr. Jennifer White', 'Dr. Kevin Garcia',
  'Dr. Lauren Thompson', 'Dr. Daniel Jackson', 'Dr. Nicole Harris', 'Dr. Ryan Moore',
];

const SPECIALTIES = ['Cardiology', 'Orthopedics', 'Neurology', 'General Surgery', 'Pediatrics', 'Oncology'];

const WARDS = ['ICU', 'General Ward', 'Maternity', 'Pediatric', 'Surgical', 'Medical'];

const LOCATIONS_OF_CARE = ['Main Hospital', 'North Clinic', 'South Clinic', 'East Clinic', 'West Center'];

const MEDICAL_AIDS = [
  'Government Insurance', 'Private Insurance A', 'Private Insurance B',
  'Corporate Plan', 'Self Pay',
];

const ICD_CODES: Record<string, string> = {
  'I10': 'Essential Hypertension',
  'E11': 'Type 2 Diabetes Mellitus',
  'M79.3': 'Myalgia',
  'J44.9': 'COPD, unspecified',
  'I50.9': 'Unspecified Heart Failure',
  'E78.5': 'Hyperlipidemia, unspecified',
  'M54.5': 'Low back pain',
  'F32.9': 'Depressive episode, unspecified',
  'K21.9': 'Unspecified GERD',
  'N18.3': 'Chronic kidney disease, stage 3',
  'J06.9': 'Acute upper respiratory infection',
  'K80.9': 'Unspecified cholelithiasis',
  'I21.9': 'STEMI, unspecified',
  'E11.9': 'Type 2 diabetes without complications',
  'M17.1': 'Primary osteoarthritis, left knee',
};

const CPT_CODES: Record<string, string> = {
  '99213': 'Office visit, established patient',
  '99214': 'Office visit, established patient (high)',
  '93000': 'EKG',
  '71046': 'Chest X-ray',
  '80053': 'Comprehensive metabolic panel',
  '99232': 'Hospital visit, established patient',
  '99252': 'Inpatient consultation',
  '70450': 'Head CT',
  '93005': 'EKG with interpretation',
  '99285': 'Emergency department visit',
  '81000': 'Urinalysis',
  '36415': 'Venipuncture',
  '43239': 'Upper endoscopy with biopsy',
  '73610': 'Ankle X-ray',
  '92004': 'Eye exam, comprehensive',
};

// ── Dashboard Data Generator ────────────────────────────────

export function generateSampleDashboardMetrics(year: number): DashboardMetrics {
  const rand = createRng(42 + year);

  const monthRevenue: number[] = [];
  const monthEpisodes: number[] = [];
  const admCasualty: number[] = [];
  const admDay: number[] = [];
  const admInpatient: number[] = [];
  const admLab: number[] = [];
  const theatreCases: number[] = [];
  const theatreMinutes: number[] = [];
  const theatreUtil: number[] = [];
  const theatrePctOcc: number[] = [];
  const pharmacyRx: number[] = [];
  const pharmacyRev: number[] = [];
  const occMidnight: number[] = [];
  const casToInpatient: number[] = [];
  const epsFinalised: number[] = [];
  const dischNotFinalised: number[] = [];
  const revPerPatDay: number[] = [];
  const gpEthical: number[] = [];
  const gpSurgical: number[] = [];

  const pctOccWard: Record<string, number[]> = {};
  const patDaysWard: Record<string, number[]> = {};
  const patDaysLOC: Record<string, number[]> = {};
  const revLocation: Record<string, number[]> = {};
  const admPerWard: Record<string, number[]> = {};

  WARDS.forEach((ward) => {
    pctOccWard[ward] = [];
    patDaysWard[ward] = [];
    admPerWard[ward] = [];
  });

  LOCATIONS_OF_CARE.forEach((loc) => {
    patDaysLOC[loc] = [];
    revLocation[loc] = [];
  });

  const debtRecon = {
    brought: [] as number[],
    revenue: [] as number[],
    payments: [] as number[],
    sundries: [] as number[],
    total: [] as number[],
  };

  const payments = {
    deposits: [] as number[],
    individual: [] as number[],
    medAid: [] as number[],
    batched: [] as number[],
  };

  for (let i = 0; i < 12; i++) {
    const baseRevenue = 3000000 + rand() * 1500000;
    monthRevenue.push(baseRevenue);
    monthEpisodes.push(900 + Math.floor(rand() * 300));

    admCasualty.push(250 + Math.floor(rand() * 120));
    admDay.push(180 + Math.floor(rand() * 120));
    admInpatient.push(350 + Math.floor(rand() * 200));
    admLab.push(400 + Math.floor(rand() * 200));

    theatreCases.push(60 + Math.floor(rand() * 40));
    theatreMinutes.push(8000 + Math.floor(rand() * 4000));
    theatreUtil.push(70 + rand() * 25);
    theatrePctOcc.push(60 + rand() * 30);

    pharmacyRx.push(1500 + Math.floor(rand() * 500));
    pharmacyRev.push(1000000 + rand() * 400000);

    occMidnight.push(200 + Math.floor(rand() * 80));
    casToInpatient.push(15 + Math.floor(rand() * 10));
    epsFinalised.push(850 + Math.floor(rand() * 250));
    dischNotFinalised.push(50 + Math.floor(rand() * 30));
    revPerPatDay.push(4500 + rand() * 2000);
    gpEthical.push(100 + Math.floor(rand() * 80));
    gpSurgical.push(60 + Math.floor(rand() * 50));

    // Ward data
    WARDS.forEach((ward) => {
      pctOccWard[ward].push(65 + rand() * 30);
      patDaysWard[ward].push(180 + Math.floor(rand() * 120));
      admPerWard[ward].push(40 + Math.floor(rand() * 40));
    });

    // Location data
    LOCATIONS_OF_CARE.forEach((loc) => {
      patDaysLOC[loc].push(100 + Math.floor(rand() * 80));
      revLocation[loc].push(baseRevenue / 5 + rand() * 200000);
    });

    // Debt reconciliation
    const brought = 500000 + rand() * 200000;
    const rev = baseRevenue * 0.95;
    const payment = rev * 0.85;
    debtRecon.brought.push(brought);
    debtRecon.revenue.push(rev);
    debtRecon.payments.push(payment);
    debtRecon.sundries.push(rand() * 50000);
    debtRecon.total.push(brought + rev - payment);

    // Payments
    payments.deposits.push(baseRevenue * 0.15);
    payments.individual.push(baseRevenue * 0.25);
    payments.medAid.push(baseRevenue * 0.40);
    payments.batched.push(baseRevenue * 0.20);
  }

  return {
    year,
    totalRevenue: monthRevenue.reduce((a, b) => a + b, 0),
    monthRevenue,
    monthEpisodes,
    admCasualty,
    admDay,
    admInpatient,
    admLab,
    theatreCases,
    theatreMinutes,
    theatreUtil,
    theatrePctOcc,
    pharmacyRx,
    pharmacyRev,
    occupancyBeds: [...Array(12)].map(() => 200 + Math.floor(rand() * 80)),
    patientDays: { ...patDaysWard },
    pctOccWard,
    patDaysWard,
    patDaysLOC,
    occMidnight,
    revLocation,
    admPerWard,
    debtRecon,
    casToInpatient,
    epsFinalised,
    dischNotFinalised,
    revPerPatDay,
    gpEthical,
    gpSurgical,
    payments,
  };
}

// ── Location Data Generator ────────────────────────────────

export function generateSampleLocationData(year: number): LocationData {
  const rand = createRng(99 + year);

  const doctors: DoctorMetric[] = DOCTOR_NAMES.slice(0, 20).map((name) => {
    const specialty = SPECIALTIES[Math.floor(rand() * SPECIALTIES.length)];
    const episodes = 150 + Math.floor(rand() * 250);
    const revenue = 400000 + rand() * 1200000;
    return {
      name,
      specialty,
      episodes,
      revenue,
      avgLOS: 2 + rand() * 5,
      patients: Math.floor(episodes * (0.7 + rand() * 0.3)),
    };
  });

  const icdCodes: Record<string, { count: number; desc: string }> = {};
  Object.entries(ICD_CODES).forEach(([code, desc]) => {
    icdCodes[code] = {
      count: 80 + Math.floor(rand() * 300),
      desc,
    };
  });

  const cptCodes: Record<string, { count: number; desc: string }> = {};
  Object.entries(CPT_CODES).forEach(([code, desc]) => {
    cptCodes[code] = {
      count: 60 + Math.floor(rand() * 200),
      desc,
    };
  });

  const specialties: Record<string, number> = {};
  SPECIALTIES.forEach((spec) => {
    specialties[spec] = 400 + Math.floor(rand() * 300);
  });

  const medAids: Record<string, number> = {};
  MEDICAL_AIDS.forEach((aid) => {
    medAids[aid] = 500 + Math.floor(rand() * 400);
  });

  const ageGroups: Record<string, number> = {
    '0-10': 200 + Math.floor(rand() * 150),
    '11-20': 180 + Math.floor(rand() * 150),
    '21-30': 300 + Math.floor(rand() * 200),
    '31-40': 350 + Math.floor(rand() * 200),
    '41-50': 380 + Math.floor(rand() * 200),
    '51-60': 400 + Math.floor(rand() * 250),
    '61-70': 350 + Math.floor(rand() * 200),
    '71+': 250 + Math.floor(rand() * 150),
  };

  const genders: Record<string, number> = {
    Male: 2500 + Math.floor(rand() * 400),
    Female: 2400 + Math.floor(rand() * 400),
  };

  const los: Record<string, number> = {};
  for (let days = 1; days <= 30; days++) {
    los[days.toString()] = Math.floor((1200 / days) * (0.8 + rand() * 0.4));
  }

  const monthEpisodes: number[] = [];
  const monthRevenue: number[] = [];
  for (let i = 0; i < 12; i++) {
    monthEpisodes.push(350 + Math.floor(rand() * 200));
    monthRevenue.push(900000 + rand() * 600000);
  }

  return {
    year,
    episodes: monthEpisodes.reduce((a, b) => a + b, 0),
    totalRevenue: monthRevenue.reduce((a, b) => a + b, 0),
    monthEpisodes,
    monthRevenue,
    doctors,
    icdCodes,
    cptCodes,
    specialties,
    medAids,
    ageGroups,
    genders,
    los,
    rawRows: [],
  };
}

// ── Claims Data Generator ──────────────────────────────────

export function generateSampleClaimsData(year: number): ClaimsMetrics {
  const rand = createRng(77 + year);

  const totalClaims: number[] = [];
  const approvedClaims: number[] = [];
  const rejectedClaims: number[] = [];
  const pendingClaims: number[] = [];
  const claimAmounts: number[] = [];
  const approvedAmounts: number[] = [];
  const rejectedAmounts: number[] = [];
  const avgProcessingDays: number[] = [];

  let totalClaimsSum = 0;
  let approvedSum = 0;
  let rejectedSum = 0;
  let pendingSum = 0;
  let totalAmount = 0;
  let approvedAmount = 0;
  let rejectedAmount = 0;

  const byMonth: Record<number, number> = {};
  const rejectionReasons: Record<string, number> = {
    'Incomplete documentation': 0,
    'Authorization not obtained': 0,
    'Out of network': 0,
    'Duplicate claim': 0,
    'Non-covered service': 0,
    'Coding error': 0,
    'Other': 0,
  };

  for (let i = 0; i < 12; i++) {
    const claims = 400 + Math.floor(rand() * 300);
    const approved = Math.floor(claims * (0.75 + rand() * 0.15));
    const rejected = Math.floor(claims * (0.1 + rand() * 0.1));
    const pending = claims - approved - rejected;
    const amount = 1200000 + rand() * 800000;
    const appAmount = amount * (approved / claims);
    const rejAmount = amount * (rejected / claims);

    totalClaims.push(claims);
    approvedClaims.push(approved);
    rejectedClaims.push(rejected);
    pendingClaims.push(pending);
    claimAmounts.push(amount);
    approvedAmounts.push(appAmount);
    rejectedAmounts.push(rejAmount);
    avgProcessingDays.push(8 + Math.floor(rand() * 12));

    totalClaimsSum += claims;
    approvedSum += approved;
    rejectedSum += rejected;
    pendingSum += pending;
    totalAmount += amount;
    approvedAmount += appAmount;
    rejectedAmount += rejAmount;
    byMonth[i] = claims;
  }

  // Rejection reason distribution
  Object.keys(rejectionReasons).forEach((reason) => {
    rejectionReasons[reason] = Math.floor(rejectedSum / Object.keys(rejectionReasons).length * (0.8 + rand() * 0.4));
  });

  // Medical schemes
  const byScheme: Record<string, ClaimSchemeData> = {};
  MEDICAL_AIDS.forEach((scheme) => {
    const schemeSubmitted = Math.floor(totalClaimsSum / MEDICAL_AIDS.length * (0.7 + rand() * 0.6));
    const schemeApproved = Math.floor(schemeSubmitted * (0.75 + rand() * 0.15));
    const schemeRejected = Math.floor(schemeSubmitted * (0.1 + rand() * 0.1));
    const schemePending = schemeSubmitted - schemeApproved - schemeRejected;
    byScheme[scheme] = {
      totalClaimed: totalAmount / MEDICAL_AIDS.length * (0.7 + rand() * 0.6),
      submitted: schemeSubmitted,
      received: Math.floor(schemeSubmitted * 0.98),
      rejected: schemeRejected,
      approved: schemeApproved,
      pending: schemePending,
    };
  });

  // Doctor claims
  const byDoctor: Record<string, { claims: number; approved: number; amount: number }> = {};
  DOCTOR_NAMES.slice(0, 20).forEach((doctor) => {
    const docClaims = Math.floor(totalClaimsSum / 20 * (0.6 + rand() * 0.8));
    byDoctor[doctor] = {
      claims: docClaims,
      approved: Math.floor(docClaims * (0.75 + rand() * 0.15)),
      amount: (totalAmount / 20) * (0.6 + rand() * 0.8),
    };
  });

  return {
    year,
    totalClaims: totalClaimsSum,
    totalClaimed: totalAmount,
    submitted: totalClaimsSum,
    received: Math.floor(totalClaimsSum * 0.98),
    rejected: rejectedSum,
    approved: approvedSum,
    pending: pendingSum,
    byScheme,
    byStatus: {
      'Approved': approvedSum,
      'Rejected': rejectedSum,
      'Pending': pendingSum,
    },
    byMonth,
    byDoctor,
    totalClaims_monthly: totalClaims,
    approvedClaims_monthly: approvedClaims,
    rejectedClaims_monthly: rejectedClaims,
    pendingClaims_monthly: pendingClaims,
    claimAmounts_monthly: claimAmounts,
    rejectionReasons,
  };
}

// ── Year Data Generator ────────────────────────────────────

export function generateSampleYearData(year: number): YearData {
  return {
    year,
    dash: generateSampleDashboardMetrics(year),
    dashboard: generateSampleDashboardMetrics(year),
    loc: generateSampleLocationData(year),
    location: generateSampleLocationData(year),
    apac: generateSampleClaimsData(year),
    claims: generateSampleClaimsData(year),
  };
}

// ── Bulk Data Generator ────────────────────────────────────

export function generateSampleData(years: number[] = [2024, 2025, 2026]): Map<number, YearData> {
  const data = new Map<number, YearData>();
  years.forEach((year) => {
    data.set(year, generateSampleYearData(year));
  });
  return data;
}
