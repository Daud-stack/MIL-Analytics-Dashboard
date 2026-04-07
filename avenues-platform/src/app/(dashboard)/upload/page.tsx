'use client';

import React, { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Upload, X, CheckCircle, AlertCircle, File, Zap, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAddYearData } from '@/store';
import { YearData } from '@/types';
import { parseDashboardCSV, parseLocationCSV, parseClaimsCSV, detectYear, detectFacilityName } from '@/lib/parsers';

interface FileUpload {
  id: string;
  file: File;
  type: 'Dashboard' | 'Location' | 'Claims' | 'Unknown';
  year: number;
  facilityName: string;
  progress: number;
  status: 'pending' | 'processing' | 'complete' | 'error';
  error?: string;
  columnScore: number;
  rowCount: number;
  parsedData?: YearData;
  debugInfo?: string;
}

/**
 * Robust file type detection using multiple strategies:
 * 1. Check for Dashboard format (2-line header + "Date," column headers)
 * 2. Check for Location/Episode format (patient-level columns)
 * 3. Check for Claims format (claim-related columns)
 * 4. Fallback: try each parser and use whichever produces meaningful data
 */
function detectAndParse(csvText: string, manualYear: number | null): {
  type: 'Dashboard' | 'Location' | 'Claims' | 'Unknown';
  facilityName: string;
  year: number;
  parsedData: YearData | undefined;
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
    // Primary: line 2 mentions "dashboard report" or "management" + "report"
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

  // ====== STRATEGY 2: Location/Episode CSV Detection ======
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
      const yearMatch = csvText.match(/\b(202[0-9])\b/);
      const year = manualYear || (yearMatch ? parseInt(yearMatch[1], 10) : new Date().getFullYear());
      const parsedData = parseLocationCSV(csvText);
      const rowCount = lines.length - 1;
      const doctorCount = parsedData?.location?.doctors?.length || 0;
      const score = doctorCount > 0 ? 100 : (parsedData?.location ? 50 : 25);
      console.log('[Upload] Detected Location/LOC CSV: Year:', year, 'Rows:', rowCount, 'Doctors:', doctorCount);
      return { type: 'Location', facilityName: 'Avenues Clinic', year, parsedData, rowCount, columnScore: score, debugInfo: `Location: ${rowCount} episodes, ${doctorCount} doctors` };
    } catch (e) {
      console.error('[Upload] Location parse error:', e);
    }
  }

  // ====== STRATEGY 3: Claims CSV Detection ======
  const isClaims =
    firstLine.toLowerCase().includes('claim') ||
    firstLine.toLowerCase().includes('apac') ||
    firstLine.toLowerCase().includes('edi') ||
    firstLine.toLowerCase().includes('submitted') ||
    firstLine.toLowerCase().includes('rejection') ||
    allText.includes('claim_id') ||
    allText.includes('claim number');

  if (isClaims) {
    try {
      const year = manualYear || detectYear(csvText);
      const parsedData = parseClaimsCSV(csvText);
      const rowCount = lines.length - 1;
      const score = (parsedData?.claims?.totalClaims ?? 0) > 0 ? 100 : 50;
      console.log('[Upload] Detected Claims CSV: Year:', year, 'Claims:', parsedData?.claims?.totalClaims);
      return { type: 'Claims', facilityName: 'Avenues Clinic', year, parsedData, rowCount, columnScore: score, debugInfo: `Claims: ${parsedData?.claims?.totalClaims || 0} records` };
    } catch (e) {
      console.error('[Upload] Claims parse error:', e);
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
  } catch {}

  // Try Location parser
  try {
    const locResult = parseLocationCSV(csvText);
    if (locResult?.location && ((locResult.location.doctors?.length ?? 0) > 0 || (locResult.location.episodes ?? 0) > 0)) {
      const yearMatch = csvText.match(/\b(202[0-9])\b/);
      const year = manualYear || (yearMatch ? parseInt(yearMatch[1], 10) : new Date().getFullYear());
      console.log('[Upload] Fallback: Location parser succeeded. Episodes:', locResult.location.episodes);
      return { type: 'Location', facilityName: 'Avenues Clinic', year, parsedData: locResult, rowCount: lines.length - 1, columnScore: 75, debugInfo: `Fallback Location: ${locResult.location.episodes} episodes` };
    }
  } catch {}

  // Try Claims parser
  try {
    const claimsResult = parseClaimsCSV(csvText);
    if (claimsResult?.claims && (claimsResult.claims.totalClaims ?? 0) > 0) {
      const year = manualYear || detectYear(csvText);
      console.log('[Upload] Fallback: Claims parser succeeded. Claims:', claimsResult.claims.totalClaims);
      return { type: 'Claims', facilityName: 'Avenues Clinic', year, parsedData: claimsResult, rowCount: lines.length - 1, columnScore: 75, debugInfo: `Fallback Claims: ${claimsResult.claims.totalClaims} records` };
    }
  } catch {}

  // Nothing worked
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
  const router = useRouter();

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
      const id = Math.random().toString(36).substring(7);
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
      reader.onload = (e) => {
        try {
          const csvText = e.target?.result as string;
          if (!csvText || csvText.trim().length === 0) {
            throw new Error('File is empty');
          }

          console.log(`[Upload] Parsing file: ${file.name} (${csvText.length} chars)`);
          const result = detectAndParse(csvText, manualYear);

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
                    debugInfo: result.debugInfo,
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

  const handleProcessUploads = () => {
    const completed = uploads.filter(u => u.status === 'complete' && u.parsedData);
    if (completed.length === 0) return;

    setProcessing(true);
    console.log(`[Upload] Committing ${completed.length} files to store`);

    // Sort: Dashboard files first, then Location, then Claims
    // This ensures dashboard data is set before location/claims merge in
    const sorted = [...completed].sort((a, b) => {
      const order = { Dashboard: 0, Location: 1, Claims: 2, Unknown: 3 };
      return (order[a.type] || 3) - (order[b.type] || 3);
    });

    sorted.forEach(upload => {
      if (upload.parsedData) {
        console.log(`[Upload] Adding ${upload.type} data for year ${upload.year}:`, {
          hasDashboard: !!upload.parsedData.dashboard,
          hasLocation: !!upload.parsedData.location,
          hasClaims: !!upload.parsedData.claims,
          revenue: upload.parsedData.dashboard?.totalRevenue,
        });
        addYearData(upload.year, upload.parsedData);
      }
    });

    setUploads([]);
    setProcessing(false);
    router.push('/dashboard');
  };

  const completedCount = uploads.filter(u => u.status === 'complete').length;
  const errorCount = uploads.filter(u => u.status === 'error').length;
  const processingCount = uploads.filter(u => u.status === 'processing').length;

  return (
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
                      {upload.status === 'complete' && <CheckCircle className="h-5 w-5 text-green-600 ml-auto shrink-0" />}
                      {upload.status === 'error' && <AlertCircle className="h-5 w-5 text-red-600 ml-auto shrink-0" />}
                      {upload.status === 'processing' && <RefreshCw className="h-5 w-5 text-blue-500 ml-auto shrink-0 animate-spin" />}
                    </div>

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

      {/* Supported Formats */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-3 h-3 rounded-full bg-teal-500" />
            <h3 className="font-semibold text-gray-900">Dashboard CSV</h3>
          </div>
          <p className="text-xs text-gray-600 mb-2">RptManagementDashboard format</p>
          <p className="text-xs text-gray-500">Line 1: Facility name, Line 2: Report description with dates, Line 3: Column headers (Date, Admissions, Revenue, etc.), Lines 4+: Monthly data</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-3 h-3 rounded-full bg-blue-500" />
            <h3 className="font-semibold text-gray-900">Location/Episode CSV</h3>
          </div>
          <p className="text-xs text-gray-600 mb-2">CPTStatisticsLOC format</p>
          <p className="text-xs text-gray-500">Patient-level data with columns: Episode, Patient Name, Medical Aid, Doctor, Specialty, ICD Code, CPT Code, LOS, etc.</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-3 h-3 rounded-full bg-amber-500" />
            <h3 className="font-semibold text-gray-900">Claims CSV</h3>
          </div>
          <p className="text-xs text-gray-600 mb-2">APAC/EDI claims format</p>
          <p className="text-xs text-gray-500">Claims records with: Claim ID, Status, Amount, Scheme, Doctor, Date, Rejection Reason, etc.</p>
        </div>
      </div>
    </div>
  );
}
