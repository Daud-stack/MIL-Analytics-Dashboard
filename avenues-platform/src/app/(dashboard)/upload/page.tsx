'use client';

import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { RoleGuard } from '@/components/auth/role-guard';
import { useNotifications } from '@/store/notifications';
import { useRouter } from 'next/navigation';
import { useStore, useAddYearData, useUploads, useRemoveUpload, useCurrentYear, useDatasetList, useRemoveDataset, useIsFileProcessed, useMarkFileProcessed, useYears } from '@/store';
import { YearData, UploadRecord, UploadCategory, GenericDataset } from '@/types';
import { parseDashboardCSV, parseLocationCSV, parseClaimsCSV, detectYear, detectFacilityName } from '@/lib/parsers';
import { parseGenericCSV } from '@/lib/generic-parser';
import { DEFAULT_FACILITY_NAME } from '@/lib/app-config';
import { Upload, FileText, CheckCircle, AlertCircle, X, Loader2, Database, Trash2, Calendar, FileType, Info, ChevronRight, File, RefreshCw, Zap, Clock } from 'lucide-react';

interface FileUpload {
  id: string;
  file: File;
  type: 'Dashboard' | 'Location' | 'Claims' | 'Generic' | 'Unknown';
  year: number;
  facilityName: string;
  progress: number;
  status: 'pending' | 'processing' | 'complete' | 'error';
  error?: string;
  columnScore: number;
  rowCount: number;
  parsedData?: YearData;
  genericData?: GenericDataset;  // for generic/unrecognised CSVs
  debugInfo?: string;
  fileHash?: string;             // SHA-256 hash for duplicate prevention
  isDuplicate?: boolean;         // true if this file was already processed
  forceProcess?: boolean;        // true if user wants to bypass duplicate check
}

/** Compute SHA-256 hex digest of a string using Web Crypto API */
async function hashString(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Detect the most common year from admission dates in a LOC CSV.
 * Scans up to 200 data rows looking for DD/MM/YYYY dates in the Adm Date column.
 * Returns the year that appears most frequently (majority vote).
 */
function detectYearFromAdmDates(csvText: string): number {
  const lines = csvText.split('\n');
  if (lines.length < 2) return new Date().getFullYear();

  // Find "Adm Date" column index from header
  const headerCols = lines[0].split(',').map(h => h.trim().toLowerCase());
  const admDateIdx = headerCols.findIndex(h => h.includes('adm date') || h.includes('admission date'));

  if (admDateIdx < 0) {
    // Fallback to detectYear if no Adm Date column
    return detectYear(csvText);
  }

  const yearCounts: Record<number, number> = {};
  const limit = Math.min(lines.length, 202); // header + up to 200 rows
  for (let i = 1; i < limit; i++) {
    const cols = lines[i].split(',');
    const dateStr = (cols[admDateIdx] || '').trim();
    const match = dateStr.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
    if (match) {
      const yr = parseInt(match[3], 10);
      yearCounts[yr] = (yearCounts[yr] || 0) + 1;
    }
  }

  // Return the year with the highest count
  let bestYear = new Date().getFullYear();
  let bestCount = 0;
  for (const [yr, count] of Object.entries(yearCounts)) {
    if (count > bestCount) {
      bestCount = count;
      bestYear = parseInt(yr, 10);
    }
  }
  return bestYear;
}

/**
 * Robust file type detection using multiple strategies:
 * 1. Check for Dashboard format (2-line header + "Date," column headers)
 * 2. Check for Location/Episode format (patient-level columns)
 * 3. Check for Claims format (claim-related columns)
 * 4. Fallback: try each parser and use whichever produces meaningful data
 */
function detectAndParse(csvText: string, manualYear: number | null): {
  type: 'Dashboard' | 'Location' | 'Claims' | 'Generic' | 'Unknown';
  facilityName: string;
  year: number;
  parsedData: YearData | undefined;
  genericData?: GenericDataset;
  rowCount: number;
  columnScore: number;
  debugInfo: string;
} {
  const lines = csvText.split('\n').filter(l => l.trim());
  if (lines.length < 2) {
    return { type: 'Unknown', facilityName: 'Unknown', year: manualYear || new Date().getFullYear(), parsedData: undefined, rowCount: 0, columnScore: 0, debugInfo: 'File has fewer than 2 lines' };
  }

  const firstLine = (lines[0] || '').trim();
  const secondLine = (lines[1] || '').trim();
  const thirdLine = (lines[2] || '').trim();
  const allText = csvText.substring(0, 2000).toLowerCase();

  // ====== STRATEGY 1: Dashboard CSV Detection ======
  // Dashboard CSVs have: Line 1 = facility, Line 2 = report description with date range, Line 3 = "Date,..." headers
  const isDashboard =
    secondLine.toLowerCase().includes('dashboard report') ||
    secondLine.toLowerCase().includes('management report') ||
    (secondLine.toLowerCase().includes('report') && secondLine.match(/\d{2}\/\d{2}\/\d{4}/)) ||
    // Secondary: line 3 starts with "Date," and has admissions/revenue columns
    (thirdLine.startsWith('Date,') && (thirdLine.includes('Admissions') || thirdLine.includes('Revenue') || thirdLine.includes('Episodes'))) ||
    // Tertiary: file has typical dashboard column names anywhere in first 3 lines
    (allText.includes('billing statistics') || allText.includes('debtors reconciliation') || allText.includes('revenue per revenue centre'));

  if (isDashboard) {
    try {
      const facilityName = detectFacilityName(csvText);
      const year = manualYear || detectYear(csvText);
      const parsedData = parseDashboardCSV(csvText);
      const hasData = parsedData?.dashboard?.totalRevenue !== undefined;
      const dataRowCount = Math.min(12, Math.max(0, lines.length - 3));
      const score = (parsedData?.dashboard?.totalRevenue ?? 0) > 0 ? 100 : (hasData ? 50 : 25);
      console.log('[Upload] Detected Dashboard CSV:', facilityName, 'Year:', year, 'Revenue:', parsedData?.dashboard?.totalRevenue);
      return { type: 'Dashboard', facilityName, year, parsedData, rowCount: dataRowCount, columnScore: score, debugInfo: `Dashboard: ${facilityName}, ${dataRowCount} months` };
    } catch (e) {
      console.error('[Upload] Dashboard parse error:', e);
    }
  }

  // ====== STRATEGY 2: Claims CSV Detection ======
  // Claims CSVs have claim-specific columns (Claim Date, Claim Value, EDI Status, Amount Paid).
  // Check the first 10 lines for these keywords, as files may have report headers.
  const topLines = lines.slice(0, 10);
  const claimsSignals = topLines.some(l => {
    const lower = l.toLowerCase();
    return (
      lower.includes('claim date') ||
      lower.includes('claim value') ||
      lower.includes('edi status') ||
      lower.includes('amount paid') ||
      lower.includes('apac') ||
      lower.includes('rejection')
    );
  });

  const allTextLower = allText.toLowerCase();
  const isClaims = claimsSignals ||
    (allTextLower.includes('claim date') && allTextLower.includes('edi status')) ||
    (allTextLower.includes('claim value') && allTextLower.includes('amount paid')) ||
    (allTextLower.includes('apac') && allTextLower.includes('status'));

  if (isClaims) {
    try {
      const year = manualYear || detectYear(csvText);
      const parsedData = parseClaimsCSV(csvText);
      const rowCount = lines.length - 1;
      const score = (parsedData?.claims?.totalClaims ?? 0) > 0 ? 100 : 50;
      console.log('[Upload] Detected Claims CSV: Year:', year, 'Claims:', parsedData?.claims?.totalClaims);
      return { type: 'Claims', facilityName: DEFAULT_FACILITY_NAME, year, parsedData, rowCount, columnScore: score, debugInfo: `Claims: ${parsedData?.claims?.totalClaims || 0} records` };
    } catch (e) {
      console.error('[Upload] Claims parse error:', e);
    }
  }

  // ====== STRATEGY 3: Location/Episode CSV Detection ======
  // LOC CSVs have patient-level rows with columns like Episode, Patient Name, Doctor, ICD, CPT, etc.
  const isLocation =
    firstLine.startsWith('Episode') ||
    firstLine.includes('Patient Name') ||
    firstLine.includes('Doctor Specialty') ||
    firstLine.includes('ICD Code') ||
    firstLine.includes('CPT Code') ||
    firstLine.includes('Medical Aid') ||
    firstLine.includes('Adm Date') ||
    firstLine.includes('Anaesthetist') ||
    firstLine.includes('Ward Days') ||
    firstLine.includes('LOS') ||
    // Also check second line in case there's a header row
    secondLine.startsWith('Episode') ||
    secondLine.includes('Patient Name');

  if (isLocation) {
    try {
      // Detect year from the majority of admission dates, not the first regex match.
      // The first data row may have a prior-year admission (e.g., Dec 2024 admitted, Jan 2025 discharged).
      const year = manualYear || detectYearFromAdmDates(csvText);
      const parsedData = parseLocationCSV(csvText);
      const rowCount = lines.length - 1;
      const doctorCount = parsedData?.location?.doctors?.length || 0;
      const score = doctorCount > 0 ? 100 : (parsedData?.location ? 50 : 25);
      console.log('[Upload] Detected Location/LOC CSV: Year:', year, 'Rows:', rowCount, 'Doctors:', doctorCount);
      return { type: 'Location', facilityName: DEFAULT_FACILITY_NAME, year, parsedData, rowCount, columnScore: score, debugInfo: `Location: ${rowCount} episodes, ${doctorCount} doctors` };
    } catch (e) {
      console.error('[Upload] Location parse error:', e);
    }
  }

  // ====== STRATEGY 4: Fallback — try all parsers and pick the best result ======
  console.log('[Upload] No match from content detection. Trying all parsers as fallback...');
  console.log('[Upload] First line:', firstLine.substring(0, 120));
  console.log('[Upload] Second line:', secondLine.substring(0, 120));

  // Try Dashboard parser
  try {
    const dashResult = parseDashboardCSV(csvText);
    if (dashResult?.dashboard && (dashResult.dashboard.totalRevenue > 0 || dashResult.dashboard.admLab.some(v => v > 0))) {
      const facilityName = detectFacilityName(csvText);
      const year = manualYear || detectYear(csvText);
      console.log('[Upload] Fallback: Dashboard parser succeeded. Revenue:', dashResult.dashboard.totalRevenue);
      return { type: 'Dashboard', facilityName, year, parsedData: dashResult, rowCount: lines.length - 3, columnScore: 75, debugInfo: `Fallback Dashboard: ${facilityName}` };
    }
  } catch (e) { console.warn('[Upload] Dashboard fallback parse failed:', e); }

  // Try Location parser
  try {
    const locResult = parseLocationCSV(csvText);
    if (locResult?.location && ((locResult.location.doctors?.length ?? 0) > 0 || (locResult.location.episodes ?? 0) > 0)) {
      const yearMatch = csvText.match(/\b(202[0-9])\b/);
      const year = manualYear || (yearMatch ? parseInt(yearMatch[1], 10) : new Date().getFullYear());
      console.log('[Upload] Fallback: Location parser succeeded. Episodes:', locResult.location.episodes);
      return { type: 'Location', facilityName: DEFAULT_FACILITY_NAME, year, parsedData: locResult, rowCount: lines.length - 1, columnScore: 75, debugInfo: `Fallback Location: ${locResult.location.episodes} episodes` };
    }
  } catch (e) { console.warn('[Upload] Location fallback parse failed:', e); }

  // Try Claims parser
  try {
    const claimsResult = parseClaimsCSV(csvText);
    if (claimsResult?.claims && (claimsResult.claims.totalClaims ?? 0) > 0) {
      const year = manualYear || detectYear(csvText);
      console.log('[Upload] Fallback: Claims parser succeeded. Claims:', claimsResult.claims.totalClaims);
      return { type: 'Claims', facilityName: DEFAULT_FACILITY_NAME, year, parsedData: claimsResult, rowCount: lines.length - 1, columnScore: 75, debugInfo: `Fallback Claims: ${claimsResult.claims.totalClaims} records` };
    }
  } catch (e) { console.warn('[Upload] Claims fallback parse failed:', e); }

  // ====== STRATEGY 5: Generic CSV — auto-profile any CSV with columns ======
  // If we have at least a header row and some data, ingest as a generic dataset
  if (lines.length >= 2 && firstLine.includes(',')) {
    try {
      console.log('[Upload] Falling back to Generic CSV parser');
      const year = manualYear || detectYear(csvText) || new Date().getFullYear();
      // filename will be set later by the caller
      const genericData = parseGenericCSV(csvText, 'unknown.csv');
      const numCols = genericData.schema.columnNames.length;
      const numericCols = genericData.columnProfiles.filter(c => c.type === 'numeric').length;
      const score = Math.min(100, 50 + numericCols * 5);
      console.log('[Upload] Generic CSV: ', genericData.rowCount, 'rows,', numCols, 'columns,', numericCols, 'numeric');
      return {
        type: 'Generic',
        facilityName: 'Custom Dataset',
        year,
        parsedData: undefined,
        genericData,
        rowCount: genericData.rowCount,
        columnScore: score,
        debugInfo: `Generic: ${genericData.rowCount} rows, ${numCols} cols (${numericCols} numeric, ${genericData.columnProfiles.filter(c => c.type === 'categorical').length} categorical)`,
      };
    } catch (e) {
      console.error('[Upload] Generic parse error:', e);
    }
  }

  // Truly nothing worked
  return {
    type: 'Unknown',
    facilityName: 'Unknown',
    year: manualYear || new Date().getFullYear(),
    parsedData: undefined,
    rowCount: 0,
    columnScore: 0,
    debugInfo: `Could not detect type. Line 1: "${firstLine.substring(0, 80)}..." Line 2: "${secondLine.substring(0, 80)}..."`,
  };
}

export default function UploadPage() {
  const [uploads, setUploads] = useState<FileUpload[]>([]);
  const [manualYear, setManualYear] = useState<number | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [processing, setProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const addYearData = useAddYearData();
  const years = useYears();
  const existingUploads = useUploads();
  const existingDatasets = useDatasetList();
  const removeUpload = useRemoveUpload();
  const removeDataset = useRemoveDataset();
  const currentYear = useCurrentYear();
  const isFileProcessed = useIsFileProcessed();
  const markFileProcessed = useMarkFileProcessed();
  const router = useRouter();
  const { addNotification } = useNotifications();

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const files = [...e.dataTransfer.files];
    processFiles(files);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = [...(e.target.files || [])];
    processFiles(files);
    // Reset the input so the same files can be re-selected
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const processFiles = (files: File[]) => {
    const csvFiles = files.filter(f => f.name.toLowerCase().endsWith('.csv'));
    if (csvFiles.length === 0) return;

    console.log(`[Upload] Processing ${csvFiles.length} CSV files`);

    csvFiles.forEach(file => {
      const id = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).substring(7);
      const newUpload: FileUpload = {
        id,
        file,
        type: 'Unknown',
        year: manualYear || new Date().getFullYear(),
        facilityName: 'Reading...',
        progress: 10,
        status: 'processing',
        columnScore: 0,
        rowCount: 0,
      };

      setUploads(prev => [...prev, newUpload]);

      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const csvText = e.target?.result as string;
          if (!csvText || csvText.trim().length === 0) {
            throw new Error('File is empty');
          }

          // Compute SHA-256 hash for duplicate detection
          const fileHash = await hashString(csvText);
          const duplicate = isFileProcessed(fileHash);
          if (duplicate) {
            console.warn(`[Upload] Duplicate file detected: ${file.name} (hash: ${fileHash.substring(0, 12)}...)`);
          }

          console.log(`[Upload] Parsing file: ${file.name} (${csvText.length} chars, hash: ${fileHash.substring(0, 12)}...)`);
          const result = detectAndParse(csvText, manualYear);

          // For generic datasets, set the proper filename
          if (result.genericData) {
            result.genericData.fileName = file.name;
            result.genericData.name = file.name.replace(/\.csv$/i, '').replace(/[_-]+/g, ' ').trim();
          }

          setUploads(prev =>
            prev.map(u =>
              u.id === id
                ? {
                    ...u,
                    type: result.type,
                    facilityName: result.facilityName,
                    columnScore: result.columnScore,
                    rowCount: result.rowCount,
                    year: result.year,
                    progress: 100,
                    status: result.type === 'Unknown' ? 'error' : 'complete',
                    error: result.type === 'Unknown' ? result.debugInfo : undefined,
                    parsedData: result.parsedData,
                    genericData: result.genericData,
                    debugInfo: result.debugInfo,
                    fileHash,
                    isDuplicate: duplicate,
                  }
                : u
            )
          );
        } catch (error) {
          console.error(`[Upload] Parse error for ${file.name}:`, error);
          setUploads(prev =>
            prev.map(u =>
              u.id === id
                ? {
                    ...u,
                    status: 'error',
                    error: error instanceof Error ? error.message : 'Failed to parse file',
                    progress: 0,
                  }
                : u
            )
          );
        }
      };

      reader.onerror = () => {
        setUploads(prev =>
          prev.map(u =>
            u.id === id
              ? { ...u, status: 'error', error: 'Failed to read file', progress: 0 }
              : u
          )
        );
      };

      reader.readAsText(file);
    });
  };

  const handleRemoveUpload = (id: string) => {
    setUploads(prev => prev.filter(u => u.id !== id));
  };

  const handleProcessUploads = async () => {
    const completed = uploads.filter(u => u.status === 'complete' && (u.parsedData || u.genericData));
    if (completed.length === 0) return;

    setProcessing(true);
    const now = new Date().toISOString();
    console.log(`[Upload] Committing ${completed.length} files to store at ${now}`);

    try {
      // Sort: Dashboard files first, then Location, then Claims
      // This ensures dashboard data is set before location/claims merge in
      const sorted = [...completed].sort((a, b) => {
        const order: Record<string, number> = { Dashboard: 0, Location: 1, Claims: 2, Generic: 3, Unknown: 4 };
        return (order[a.type] ?? 4) - (order[b.type] ?? 4);
      });

      sorted.forEach(upload => {
        // Skip duplicates that the user hasn't explicitly re-confirmed
        if (upload.isDuplicate && !upload.forceProcess) {
          console.log(`[Upload] Skipping duplicate file: ${upload.file.name}`);
          return;
        }

        // Handle Generic datasets separately
        if (upload.type === 'Generic' && upload.genericData) {
          console.log(`[Upload] Adding generic dataset "${upload.genericData.name}" for year ${upload.year}`);
          const uploadId = typeof crypto !== 'undefined' && crypto.randomUUID
            ? crypto.randomUUID()
            : Date.now().toString(36) + Math.random().toString(36).substring(7);

          const uploadRecord: UploadRecord = {
            id: uploadId,
            category: 'Generic',
            fileName: upload.file.name,
            fileHash: upload.fileHash,
            uploadedAt: now,
            rowCount: upload.rowCount,
            action: 'append',
          };

          addYearData(upload.year, {
            year: upload.year,
            dash: null,
            dashboard: null,
            loc: null,
            location: null,
            apac: null,
            claims: null,
            datasets: { [upload.genericData.id]: upload.genericData },
            uploads: [uploadRecord],
          });
          if (upload.fileHash) markFileProcessed(upload.fileHash);
          return;
        }

        if (upload.parsedData) {
          const uploadId = typeof crypto !== 'undefined' && crypto.randomUUID
            ? crypto.randomUUID()
            : Date.now().toString(36) + Math.random().toString(36).substring(7);

          // Determine category for UploadRecord
          const category: UploadCategory =
            upload.type === 'Dashboard' ? 'Dashboard' :
            upload.type === 'Location' ? 'Location' :
            upload.type === 'Claims' ? 'Claims' : 'Dashboard';

          // Determine action: All categories now append (additive for Dashboard)
          const action: 'append' = 'append';

          // Create upload tracking record
          const uploadRecord: UploadRecord = {
            id: uploadId,
            category,
            fileName: upload.file.name,
            fileHash: upload.fileHash,
            uploadedAt: now,
            rowCount: upload.rowCount,
            action,
          };

          // Strip rawRows before committing to store to avoid memory/localStorage issues
          // But first, stamp each LOC row with Date_Uploaded for traceability
          const dataToStore: YearData = { ...upload.parsedData, uploads: [uploadRecord] };
          if (dataToStore.location) {
            const stamped = (dataToStore.location.rawRows || []).map(row => ({
              ...row,
              _uploadedAt: now,
              _uploadId: uploadId,
              _fileName: upload.file.name,
            }));
            dataToStore.location = { ...dataToStore.location, rawRows: stamped.length > 500 ? [] : stamped };
          }
          if (dataToStore.loc) {
            dataToStore.loc = dataToStore.location;
          }
          // Cap claims rawRows to avoid localStorage bloat (keep for dedup)
          if (dataToStore.claims && dataToStore.claims.rawRows) {
            dataToStore.claims = {
              ...dataToStore.claims,
              rawRows: dataToStore.claims.rawRows.length > 2000 ? undefined : dataToStore.claims.rawRows,
            };
          }
          if (dataToStore.apac) {
            dataToStore.apac = dataToStore.claims;
          }

          console.log(`[Upload] ${action.toUpperCase()} ${upload.type} data for year ${upload.year}:`, {
            uploadId,
            fileName: upload.file.name,
            hasDashboard: !!dataToStore.dashboard,
            hasLocation: !!dataToStore.location,
            hasClaims: !!dataToStore.claims,
            revenue: dataToStore.dashboard?.totalRevenue,
            episodes: dataToStore.location?.episodes,
            doctors: dataToStore.location?.doctors?.length,
          });
          addYearData(upload.year, dataToStore);

          // Create Audit Log
          fetch('/api/audit', {
            method: 'POST',
            body: JSON.stringify({
              action: 'UPLOAD',
              category: 'Dashboard',
              details: `Uploaded ${upload.type} file: ${upload.file.name} for year ${upload.year}`,
              metadata: {
                fileName: upload.file.name,
                type: upload.type,
                year: upload.year,
                rowCount: upload.rowCount,
              }
            })
          });

          // Add Notification
          addNotification({
            type: 'success',
            title: 'Data Uploaded',
            message: `Successfully processed ${upload.file.name} (${upload.rowCount} rows)`,
            link: '/dashboard'
          });

          // Mark file as processed to prevent future duplicates
          if (upload.fileHash) {
            markFileProcessed(upload.fileHash);
          }
        }
      });

      // ── Flush to DB immediately before navigating ──
      // useDbSync uses a 2s debounce, but we navigate after 100ms,
      // so the cleanup function cancels the pending write. Push directly.
      const updatedYears = useStore.getState().years;
      const dbPushPromises: Promise<void>[] = [];
      const pushedYears = new Set<number>();
      sorted.forEach(upload => {
        if ((upload.isDuplicate && !upload.forceProcess) || (!upload.parsedData && !upload.genericData)) return;
        if (pushedYears.has(upload.year)) return;
        pushedYears.add(upload.year);
      });
      // Push all affected years from the store (merged state)
      for (const yr of pushedYears) {
        const yearData = updatedYears.get(yr);
        if (!yearData) continue;
        dbPushPromises.push(
          fetch('/api/data', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              year: yr,
              dashboard: yearData.dashboard || yearData.dash || null,
              location: yearData.location || yearData.loc || null,
              claims: yearData.claims || yearData.apac || null,
              datasets: yearData.datasets || {},
              uploads: yearData.uploads || [],
              // Persist the file-hash dedup index so re-uploads short-circuit.
              processedHashes: yearData.processedHashes || [],
            }),
          }).then(res => {
            if (!res.ok) console.error('[Upload] DB push failed for year', yr, res.status);
            else console.log('[Upload] DB push succeeded for year', yr);
          }).catch(err => console.error('[Upload] DB push error for year', yr, err))
        );
      }
      await Promise.all(dbPushPromises);
      console.log('[Upload] All DB pushes complete, navigating to dashboard');

      setUploads([]);
      setProcessing(false);

      router.push('/dashboard');
    } catch (error) {
      console.error('[Upload] Error processing files:', error);
      setProcessing(false);
    }
  };

  const completedCount = uploads.filter(u => u.status === 'complete').length;
  const errorCount = uploads.filter(u => u.status === 'error').length;
  const processingCount = uploads.filter(u => u.status === 'processing').length;

  return (
    <RoleGuard allowedRoles={['ADMIN', 'ANALYST']}>
      <div className="space-y-6 p-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Data Upload</h1>
          <p className="mt-1 text-sm text-gray-500">Import CSV files — Dashboard, Location/Episode, and Claims formats are auto-detected</p>
        </div>

        {/* Manual Year Override */}
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-5">
          <label className="block text-sm font-medium text-gray-700 mb-2">Override Year Detection</label>
          <input
            type="number"
            value={manualYear || ''}
            onChange={(e) => setManualYear(e.target.value ? parseInt(e.target.value) : null)}
            min="2020"
            max="2030"
            placeholder="Auto-detect (optional)"
            className="w-full max-w-xs px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
          <p className="mt-1 text-xs text-gray-500">Leave blank to auto-detect from file content</p>
        </div>

        {/* Drag and Drop Zone */}
        <div
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          className={`rounded-xl border-2 border-dashed p-12 text-center transition ${
            dragActive
              ? 'border-teal-500 bg-teal-50'
              : 'border-gray-300 bg-gray-50 hover:border-gray-400'
          }`}
        >
          <Upload className="mx-auto h-12 w-12 text-gray-400 mb-3" />
          <h3 className="text-lg font-semibold text-gray-900 mb-1">Drag files here</h3>
          <p className="text-sm text-gray-500 mb-4">or click to select CSV files</p>
          <Button
            onClick={() => fileInputRef.current?.click()}
            variant="outline"
            className="mb-3"
          >
            Select Files
          </Button>
          <p className="text-xs text-gray-500">Supports: Management Dashboard, CPT Statistics/LOC, Claims CSV files</p>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".csv"
            onChange={handleChange}
            className="hidden"
          />
        </div>

        {/* Upload Queue */}
        {uploads.length > 0 && (
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-200 px-5 py-4">
              <h2 className="text-sm font-semibold text-gray-900">Upload Queue — {uploads.length} file(s)</h2>
              <p className="mt-1 text-xs text-gray-500">
                {processingCount > 0 && <span className="text-blue-600">{processingCount} parsing... </span>}
                {completedCount > 0 && <span className="text-green-600">{completedCount} ready </span>}
                {errorCount > 0 && <span className="text-red-600">{errorCount} failed </span>}
              </p>
            </div>
            <div className="divide-y divide-gray-200">
              {uploads.map(upload => (
                <div key={upload.id} className="px-5 py-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <File className="h-5 w-5 text-gray-400 shrink-0" />
                        <div className="min-w-0">
                          <p className="font-medium text-gray-900 truncate">{upload.file.name}</p>
                          <p className="text-xs text-gray-500">
                            {upload.type !== 'Unknown' && (
                              <>
                                <span className={`inline-block px-1.5 py-0.5 rounded text-xs font-semibold mr-2 ${
                                  upload.type === 'Dashboard' ? 'bg-teal-100 text-teal-800' :
                                  upload.type === 'Location' ? 'bg-blue-100 text-blue-800' :
                                  'bg-amber-100 text-amber-800'
                                }`}>{upload.type}</span>
                              </>
                            )}
                            {upload.facilityName !== 'Unknown' && upload.facilityName !== 'Reading...' && (
                              <span>{upload.facilityName} · </span>
                            )}
                            Year: {upload.year} · {upload.rowCount} rows
                          </p>
                        </div>
                        {upload.status === 'complete' && !upload.isDuplicate && <CheckCircle className="h-5 w-5 text-green-600 ml-auto shrink-0" />}
                        {upload.status === 'complete' && upload.isDuplicate && <Info className="h-5 w-5 text-blue-500 ml-auto shrink-0" />}
                        {upload.status === 'error' && <AlertCircle className="h-5 w-5 text-red-600 ml-auto shrink-0" />}
                        {upload.status === 'processing' && <RefreshCw className="h-5 w-5 text-blue-500 ml-auto shrink-0 animate-spin" />}
                      </div>

                      {/* Duplicate Warning */}
                      {upload.isDuplicate && (
                        <div className="mb-3 rounded-lg bg-blue-50 border border-blue-200 p-3 flex items-start gap-3">
                          <Info className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                          <div className="flex-1">
                            <p className="text-[11px] font-medium text-blue-800">
                              Duplicate content detected. This file is already in the data store.
                            </p>
                            <div className="mt-2">
                              <Button
                                size="sm"
                                variant={upload.forceProcess ? "default" : "outline"}
                                className={`h-7 text-[10px] ${upload.forceProcess ? 'bg-blue-600' : 'text-blue-700 border-blue-300'}`}
                                onClick={() => {
                                  setUploads(prev => prev.map(u => u.id === upload.id ? { ...u, forceProcess: !u.forceProcess } : u));
                                }}
                              >
                                {upload.forceProcess ? 'Process Anyway (Enabled)' : 'Process Anyway'}
                              </Button>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Error Message */}
                      {upload.status === 'error' && (
                        <div className="mb-3 rounded-lg bg-red-50 border border-red-200 p-3 flex items-start gap-3">
                          <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                          <div className="flex-1">
                            <p className="text-xs font-semibold text-red-800">Parsing Error</p>
                            <p className="text-[11px] text-red-600 mt-0.5 leading-relaxed">
                              {upload.error || 'Failed to detect data format.'}
                            </p>
                            {upload.debugInfo && (
                              <div className="mt-2 p-2 bg-red-100/50 rounded text-[9px] font-mono text-red-700 overflow-x-auto">
                                {upload.debugInfo}
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Parsing Validation Bar */}
                      {upload.columnScore > 0 && (
                        <div className="mb-2">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-medium text-gray-600">Parsing Validation</span>
                            <span className="text-xs font-bold text-gray-900">{upload.columnScore}%</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full transition ${
                                upload.columnScore >= 80 ? 'bg-green-500' :
                                upload.columnScore >= 50 ? 'bg-yellow-500' : 'bg-red-500'
                              }`}
                              style={{ width: `${upload.columnScore}%` }}
                            />
                          </div>
                        </div>
                      )}

                      {/* Progress Bar */}
                      <div className="w-full bg-gray-200 rounded-full h-1.5">
                        <div
                          className={`h-1.5 rounded-full transition ${upload.status === 'processing' ? 'bg-blue-400 animate-pulse' : 'bg-teal-500'}`}
                          style={{ width: `${upload.progress}%` }}
                        />
                      </div>

                      {/* Preview of parsed data */}
                      {upload.status === 'complete' && upload.type === 'Dashboard' && upload.parsedData?.dashboard && (
                        <div className="mt-3 rounded-lg bg-teal-50 p-3 text-xs text-teal-800">
                          <p className="font-semibold mb-1">Dashboard Data Preview:</p>
                          <div className="grid grid-cols-2 gap-1">
                            <div>Total Revenue: ${upload.parsedData.dashboard.totalRevenue.toLocaleString('en-US', { maximumFractionDigits: 2 })}</div>
                            <div>Episodes: {upload.parsedData.dashboard.epsFinalised.reduce((a: number, b: number) => a + b, 0).toLocaleString()}</div>
                            <div>Lab Admissions: {upload.parsedData.dashboard.admLab.reduce((a: number, b: number) => a + b, 0).toLocaleString()}</div>
                            <div>Prescriptions: {upload.parsedData.dashboard.pharmacyRx.reduce((a: number, b: number) => a + b, 0).toLocaleString()}</div>
                          </div>
                        </div>
                      )}
                      {upload.status === 'complete' && upload.type === 'Location' && upload.parsedData?.location && (
                        <div className="mt-3 rounded-lg bg-blue-50 p-3 text-xs text-blue-800">
                          <p className="font-semibold mb-1">Location/Episode Data Preview:</p>
                          <div className="grid grid-cols-2 gap-1">
                            <div>Episodes: {(upload.parsedData.location.episodes || upload.rowCount).toLocaleString()}</div>
                            <div>Doctors: {upload.parsedData.location.doctors?.length || 0}</div>
                            <div>Revenue: ${(upload.parsedData.location.totalRevenue || 0).toLocaleString('en-US', { maximumFractionDigits: 2 })}</div>
                            <div>Specialties: {Object.keys(upload.parsedData.location.specialties || {}).length}</div>
                          </div>
                        </div>
                      )}
                      {upload.status === 'complete' && upload.type === 'Claims' && upload.parsedData?.claims && (
                        <div className="mt-3 rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
                          <p className="font-semibold mb-1">Claims Data Preview:</p>
                          <div className="grid grid-cols-2 gap-1">
                            <div>Total Claims: {upload.parsedData.claims.totalClaims.toLocaleString()}</div>
                            <div>Total Claimed: ${upload.parsedData.claims.totalClaimed.toLocaleString('en-US', { maximumFractionDigits: 2 })}</div>
                          </div>
                        </div>
                      )}

                      {upload.status === 'complete' && upload.type === 'Generic' && upload.genericData && (
                        <div className="mt-3 rounded-lg bg-violet-50 p-3 text-xs text-violet-800">
                          <p className="font-semibold mb-1">Generic Dataset Preview:</p>
                          <div className="grid grid-cols-2 gap-1">
                            <div>Rows: {upload.genericData.rowCount.toLocaleString()}</div>
                            <div>Columns: {upload.genericData.schema.columnNames.length}</div>
                            <div>Numeric: {upload.genericData.columnProfiles.filter(c => c.type === 'numeric').length}</div>
                            <div>Categorical: {upload.genericData.columnProfiles.filter(c => c.type === 'categorical').length}</div>
                          </div>
                          <p className="mt-1 text-[10px] text-violet-600">Cols: {upload.genericData.schema.columnNames.slice(0, 8).join(', ')}{upload.genericData.schema.columnNames.length > 8 ? '...' : ''}</p>
                        </div>
                      )}

                      {/* Duplicate file warning */}
                      {upload.isDuplicate && upload.status === 'complete' && (
                        <div className="mt-3 rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800 flex items-start gap-2">
                          <AlertCircle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                          <div>
                            <p className="font-semibold">Duplicate file detected</p>
                            <p className="mt-0.5">This file has already been processed. It will be <strong>skipped</strong> to prevent double-counting. Remove it from the queue or upload a different file.</p>
                          </div>
                        </div>
                      )}

                      {upload.status === 'error' && upload.error && (
                        <p className="mt-2 text-xs text-red-600">{upload.error}</p>
                      )}

                      {upload.debugInfo && upload.status !== 'error' && (
                        <p className="mt-1 text-xs text-gray-400">{upload.debugInfo}</p>
                      )}
                    </div>
                    <button
                      onClick={() => handleRemoveUpload(upload.id)}
                      className="ml-4 text-gray-400 hover:text-red-600 transition shrink-0"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Action Bar */}
            <div className="border-t border-gray-200 px-5 py-4 flex items-center justify-between gap-4">
              <div className="text-sm text-gray-600">
                <strong>{completedCount}</strong> file(s) ready to process
              </div>
              <div className="flex gap-3">
                <Button onClick={() => setUploads([])} variant="outline" size="sm">
                  Clear All
                </Button>
                <Button
                  onClick={handleProcessUploads}
                  disabled={completedCount === 0 || processing}
                  size="sm"
                  className="gap-2"
                >
                  <Zap className="h-4 w-4" />
                  Process {completedCount} File{completedCount !== 1 ? 's' : ''}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Upload History — shows all files ingested for the current year */}
        {existingUploads.length > 0 && (
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-3">
              <Database className="h-5 w-5 text-gray-500" />
              <div>
                <h2 className="font-semibold text-gray-900">Data Store — {currentYear}</h2>
                <p className="text-xs text-gray-500">{existingUploads.length} file(s) loaded. All categories use additive merging/appending for daily updates.</p>
              </div>
            </div>
            <div className="divide-y divide-gray-100">
              {existingUploads.map((rec) => {
                const catColor = rec.category === 'Dashboard' ? 'bg-teal-500' : rec.category === 'Location' ? 'bg-blue-500' : 'bg-amber-500';
                return (
                  <div key={rec.id} className="px-5 py-3 flex items-center gap-4 hover:bg-gray-50 transition">
                    <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${catColor}`} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900 truncate">{rec.fileName}</p>
                      <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
                        <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />{new Date(rec.uploadedAt).toLocaleString()}</span>
                        <span>{rec.category}</span>
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase ${rec.action === 'append' ? 'bg-blue-100 text-blue-700' : 'bg-teal-100 text-teal-700'}`}>{rec.action}</span>
                        {rec.rowCount > 0 && <span>{rec.rowCount.toLocaleString()} rows</span>}
                      </div>
                    </div>
                    <button
                      onClick={() => removeUpload(currentYear, rec.id)}
                      className="text-gray-400 hover:text-red-600 transition shrink-0"
                      title="Remove this upload"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Supported Formats */}
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-5">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-3 h-3 rounded-full bg-teal-500" />
              <h3 className="font-semibold text-gray-900">Dashboard CSV</h3>
            </div>
            <p className="text-xs text-gray-600 mb-2">RptManagementDashboard format — appends/sums on re-upload</p>
            <p className="text-xs text-gray-500">Line 1: Facility name, Line 2: Report description with dates, Line 3: Column headers, Lines 4+: Section-based metric rows</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-5">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-3 h-3 rounded-full bg-blue-500" />
              <h3 className="font-semibold text-gray-900">Location/Episode CSV</h3>
            </div>
            <p className="text-xs text-gray-600 mb-2">CPTStatisticsLOC format — appends on re-upload</p>
            <p className="text-xs text-gray-500">Patient-level data with columns: Episode, Patient Name, Medical Aid, Doctor, Specialty, ICD Code, CPT Code, LOS, etc.</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-5">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-3 h-3 rounded-full bg-amber-500" />
              <h3 className="font-semibold text-gray-900">Claims CSV</h3>
            </div>
            <p className="text-xs text-gray-600 mb-2">APAC/EDI claims format — appends on re-upload</p>
            <p className="text-xs text-gray-500">Claims records with: Claim ID, Status, Amount, Scheme, Doctor, Date, Rejection Reason, etc.</p>
          </div>
        </div>
      </div>
    </RoleGuard>
  );
}
