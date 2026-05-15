import * as fs from 'fs';
import * as path from 'path';
import { generateSampleDashboardMetrics, generateSampleLocationData, generateSampleClaimsData } from '../src/lib/sample-data';
import { MONTHS } from '../src/types';

// Ensure output directory exists
const outDir = path.join(__dirname, '..', 'data', 'test-samples');
const facilityName = process.env.SAMPLE_FACILITY_NAME || process.env.NEXT_PUBLIC_DEFAULT_FACILITY_NAME || 'Sample Facility';
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

const year = 2026;

// 1. Generate Dashboard CSV (FORMAT A Columnar)
function exportDashboardCSV() {
  const dash = generateSampleDashboardMetrics(year);
  
  // Create headers
  const headers = ['Month', 'Admissions-CASUALTY PATIENT', 'Admissions-DAY PATIENT', 'Admissions-IN-PATIENT', 'Admissions-LABORATORY', 'Billing Statistics-Total Revenue', 'Theatre Cases-THEATRE'];
  
  let csvContent = `${facilityName}\nManagement Dashboard Report With Capture Date 01/01/${year} To 31/12/${year}\n`;
  csvContent += headers.join(',') + '\n';
  
  for (let i = 0; i < 12; i++) {
    const row = [
      MONTHS[i],
      dash.admCasualty[i],
      dash.admDay[i],
      dash.admInpatient[i],
      dash.admLab[i],
      dash.monthRevenue[i],
      dash.theatreCases[i]
    ];
    csvContent += row.join(',') + '\n';
  }
  
  const filePath = path.join(outDir, `RptManagementDashboard_${year}.csv`);
  fs.writeFileSync(filePath, csvContent);
  console.log(`Generated: ${filePath}`);
}

// 2. Generate Location CSV (Patient-level)
function exportLocationCSV() {
  const loc = generateSampleLocationData(year);
  
  const headers = ['Patient Name', 'Doctor', 'Specialty', 'Age Group', 'Gender', 'Medical Aid'];
  let csvContent = headers.join(',') + '\n';
  
  // Fake some rows based on the aggregates
  for(let i=0; i<300; i++) {
    const doctor = loc.doctors[i % loc.doctors.length];
    const row = [
      `Patient_${i}`,
      doctor.name,
      doctor.specialty,
      Object.keys(loc.ageGroups)[i % 8],
      i % 2 === 0 ? 'Male' : 'Female',
      Object.keys(loc.medAids)[i % 5]
    ];
    csvContent += row.join(',') + '\n';
  }
  
  const filePath = path.join(outDir, `CPTStatisticsLOC_${year}.csv`);
  fs.writeFileSync(filePath, csvContent);
  console.log(`Generated: ${filePath}`);
}

// 3. Generate Claims CSV 
function exportClaimsCSV() {
  const claims = generateSampleClaimsData(year);
  
  const headers = ['Month', 'Total Claims', 'Approved Claims', 'Rejected Claims', 'Claim Amounts'];
  let csvContent = `${facilityName} Claims Report ${year}\n`;
  csvContent += headers.join(',') + '\n';
  
  for(let i=0; i<12; i++) {
    const row = [
      MONTHS[i],
      claims.totalClaims_monthly[i],
      claims.approvedClaims_monthly[i],
      claims.rejectedClaims_monthly[i],
      claims.claimAmounts_monthly[i]
    ];
    csvContent += row.join(',') + '\n';
  }

  const filePath = path.join(outDir, `ClaimsReport_${year}.csv`);
  fs.writeFileSync(filePath, csvContent);
  console.log(`Generated: ${filePath}`);
}

exportDashboardCSV();
exportLocationCSV();
exportClaimsCSV();
console.log('Sample generation complete.');
