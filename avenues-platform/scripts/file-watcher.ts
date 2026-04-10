#!/usr/bin/env tsx
/**
 * Avenues Clinic — Automated CSV File Watcher
 *
 * Monitors `./uploads` for new .csv files, auto-parses them using the
 * existing detection + parsing logic, stores results in `data/ingested.json`,
 * and moves processed files to `./archived`.
 *
 * Duplicate prevention: SHA-256 hash of each file is checked before processing.
 * If the same file content has already been ingested, it is skipped and archived.
 *
 * Usage:
 *   npx tsx scripts/file-watcher.ts
 *   # or via npm script:
 *   npm run watch:files
 *
 * Environment variables:
 *   WATCH_DIR    — directory to monitor (default: ./uploads)
 *   ARCHIVE_DIR  — where processed files go (default: ./archived)
 *   POLL_MS      — polling interval in ms, useful for network drives (default: 2000)
 */

import fs from 'fs';
import path from 'path';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const chokidar = require('chokidar');
import {
  readIngestStore,
  writeIngestStore,
  hashFile,
  isDuplicate,
  recordProcessed,
  type IngestLogEntry,
} from '../src/lib/ingest-store';

// ── Inline parsers (we can't import client-side modules directly,
//    so we import the shared parsing logic) ──
// The parsers use 'use client' directive but the actual logic is pure JS.
// We strip the directive at runtime — tsx handles this.

import {
  parseDashboardCSV,
  parseLocationCSV,
  parseClaimsCSV,
} from '../src/lib/parsers';

import { parseGenericCSV } from '../src/lib/generic-parser';

// ── Config ──

const WATCH_DIR = path.resolve(process.env.WATCH_DIR || './uploads');
const ARCHIVE_DIR = path.resolve(process.env.ARCHIVE_DIR || './archived');
const POLL_MS = parseInt(process.env.POLL_MS || '2000', 10);

// ── Ensure directories exist ──

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`📁 Created directory: ${dir}`);
  }
}

ensureDir(WATCH_DIR);
ensureDir(ARCHIVE_DIR);

// ── File type detection (mirrors upload/page.tsx logic) ──

function detectFileType(csvText: string, fileName: string): 'Dashboard' | 'Location' | 'Claims' | 'Generic' {
  const lines = csvText.split('\n').map(l => l.trim());
  const firstLine = (lines[2] || lines[0] || '').toLowerCase();
  const allText = csvText.substring(0, 3000).toLowerCase();

  // Dashboard: has "Management Dashboard" in line 2, or columnar headers with "Admissions-"
  if (
    allText.includes('management dashboard') ||
    allText.includes('capture date') ||
    (firstLine.includes('admissions-') && firstLine.includes('discharges-'))
  ) {
    return 'Dashboard';
  }

  // Claims: has APAC/EDI-specific columns
  const claimsSignals = [
    firstLine.includes('claim date'),
    firstLine.includes('claim value'),
    firstLine.includes('edi status'),
    firstLine.includes('amount paid'),
    allText.includes('apac'),
    allText.includes('rejection'),
  ].filter(Boolean).length;

  if (
    claimsSignals >= 2 ||
    (firstLine.includes('claim') && firstLine.includes('edi')) ||
    (firstLine.includes('claim') && firstLine.includes('amount paid'))
  ) {
    return 'Claims';
  }

  // Location: has doctor/specialty/ICD columns
  const locationSignals = [
    firstLine.includes('doctor'),
    firstLine.includes('specialty'),
    firstLine.includes('icd'),
    firstLine.includes('cpt'),
    firstLine.includes('medical aid'),
    firstLine.includes('province'),
    firstLine.includes('los'),
  ].filter(Boolean).length;

  if (locationSignals >= 3) {
    return 'Location';
  }

  return 'Generic';
}

// ── Process a single CSV file ──

async function processFile(filePath: string): Promise<void> {
  const fileName = path.basename(filePath);
  const ext = path.extname(fileName).toLowerCase();

  // Only process .csv files
  if (ext !== '.csv') {
    console.log(`⏭  Skipping non-CSV file: ${fileName}`);
    return;
  }

  console.log(`\n📄 Processing: ${fileName}`);

  // Step 1: Hash the file for duplicate detection
  let sha256: string;
  try {
    sha256 = hashFile(filePath);
  } catch (err) {
    console.error(`❌ Could not read file: ${fileName}`, err);
    return;
  }

  // Step 2: Check for duplicates
  const store = readIngestStore();
  if (isDuplicate(store, sha256)) {
    console.log(`⚠️  DUPLICATE detected (same SHA-256 hash). Skipping: ${fileName}`);
    archiveFile(filePath, fileName, '_dup');
    return;
  }

  // Step 3: Read file content
  let csvText: string;
  try {
    csvText = fs.readFileSync(filePath, 'utf-8');
  } catch (err) {
    console.error(`❌ Could not read file content: ${fileName}`, err);
    return;
  }

  if (csvText.trim().length === 0) {
    console.log(`⚠️  Empty file, skipping: ${fileName}`);
    archiveFile(filePath, fileName, '_empty');
    return;
  }

  // Step 4: Detect file type
  const fileType = detectFileType(csvText, fileName);
  console.log(`   Type detected: ${fileType}`);

  // Step 5: Parse
  let yearData: Record<string, unknown> | null = null;
  let year = new Date().getFullYear();
  let rowCount = 0;

  try {
    switch (fileType) {
      case 'Dashboard': {
        const result = parseDashboardCSV(csvText);
        year = result.year;
        yearData = JSON.parse(JSON.stringify(result)) as Record<string, unknown>;
        rowCount = Object.keys(result.dashboard?.rawColumns || {}).length;
        break;
      }
      case 'Location': {
        const result = parseLocationCSV(csvText);
        year = result.year;
        yearData = JSON.parse(JSON.stringify(result)) as Record<string, unknown>;
        rowCount = (result.location as { episodes?: number } | null)?.episodes || 0;
        break;
      }
      case 'Claims': {
        const result = parseClaimsCSV(csvText);
        year = result.year;
        yearData = JSON.parse(JSON.stringify(result)) as Record<string, unknown>;
        break;
      }
      case 'Generic': {
        const result = parseGenericCSV(csvText, fileName);
        yearData = {
          year,
          dash: null, dashboard: null,
          loc: null, location: null,
          apac: null, claims: null,
          uploads: [],
          datasets: { [result.id]: result },
        };
        rowCount = result.rowCount;
        break;
      }
    }
  } catch (err) {
    console.error(`❌ Parse error for ${fileName}:`, err);
    archiveFile(filePath, fileName, '_error');
    return;
  }

  if (!yearData) {
    console.error(`❌ No data extracted from ${fileName}`);
    archiveFile(filePath, fileName, '_nodata');
    return;
  }

  // Step 6: Add upload record to yearData
  const uploadRecord = {
    id: sha256.substring(0, 12),
    fileName,
    category: fileType,
    uploadedAt: new Date().toISOString(),
    recordCount: rowCount,
    year,
    sha256,
    source: 'auto-ingest',
  };

  if (Array.isArray(yearData.uploads)) {
    (yearData.uploads as unknown[]).push(uploadRecord);
  } else {
    yearData.uploads = [uploadRecord];
  }

  // Step 7: Record in ingest store
  const logEntry: IngestLogEntry = {
    fileName,
    sha256,
    fileType,
    year,
    processedAt: new Date().toISOString(),
    rowCount,
  };

  recordProcessed(store, logEntry, yearData);
  writeIngestStore(store);

  console.log(`✅ Ingested: ${fileName} → year ${year} (${fileType}, ${rowCount} records)`);

  // Step 8: Archive the processed file
  archiveFile(filePath, fileName);
}

// ── Archive a file (move to ./archived with timestamp prefix) ──

function archiveFile(filePath: string, fileName: string, suffix = ''): void {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
    const archiveName = `${timestamp}_${fileName}${suffix ? suffix : ''}`;
    const archivePath = path.join(ARCHIVE_DIR, archiveName);
    fs.renameSync(filePath, archivePath);
    console.log(`📦 Archived: ${archiveName}`);
  } catch (err) {
    console.error(`⚠️  Could not archive ${fileName}:`, err);
    // Try copy + delete as fallback (cross-device)
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
      const archiveName = `${timestamp}_${fileName}${suffix ? suffix : ''}`;
      const archivePath = path.join(ARCHIVE_DIR, archiveName);
      fs.copyFileSync(filePath, archivePath);
      fs.unlinkSync(filePath);
      console.log(`📦 Archived (copy+delete): ${archiveName}`);
    } catch (err2) {
      console.error(`❌ Archive fallback also failed:`, err2);
    }
  }
}

// ── Process existing files in the watch directory ──

async function processExistingFiles(): Promise<void> {
  const files = fs.readdirSync(WATCH_DIR).filter(f => f.toLowerCase().endsWith('.csv'));
  if (files.length > 0) {
    console.log(`\n🔍 Found ${files.length} existing CSV file(s) in ${WATCH_DIR}`);
    for (const file of files) {
      await processFile(path.join(WATCH_DIR, file));
    }
  }
}

// ── Start the watcher ──

console.log('╔══════════════════════════════════════════════════════╗');
console.log('║   Avenues Clinic — CSV File Watcher                 ║');
console.log('╠══════════════════════════════════════════════════════╣');
console.log(`║  Watching: ${WATCH_DIR.padEnd(41)}║`);
console.log(`║  Archive:  ${ARCHIVE_DIR.padEnd(41)}║`);
console.log(`║  Poll:     ${String(POLL_MS + 'ms').padEnd(41)}║`);
console.log('╚══════════════════════════════════════════════════════╝');

// Process any files already in the directory
processExistingFiles().then(() => {
  // Set up chokidar to watch for new files
  const watcher = chokidar.watch(path.join(WATCH_DIR, '*.csv'), {
    persistent: true,
    ignoreInitial: true,       // We already processed existing files above
    awaitWriteFinish: {
      stabilityThreshold: 1500, // Wait 1.5s after last write before processing
      pollInterval: 500,
    },
    usePolling: true,           // More reliable on network drives / OneDrive
    interval: POLL_MS,
  });

  watcher
    .on('add', (filePath: string) => {
      console.log(`\n🆕 New file detected: ${path.basename(filePath)}`);
      processFile(filePath);
    })
    .on('error', (error: Error) => {
      console.error('❌ Watcher error:', error);
    });

  console.log('\n👀 Watching for new CSV files... (Ctrl+C to stop)\n');
});
