#!/usr/bin/env tsx
/**
 * Automated CSV File Watcher (API-based)
 *
 * Monitors a configurable directory for new .csv files, auto-parses them using
 * the existing detection + parsing logic, and POSTs parsed data directly to the
 * Vercel API at /api/data/ingest using machine-to-machine authentication.
 *
 * Duplicate prevention: SHA-256 hash of each file is checked before processing.
 * If the same file content has already been ingested, it is skipped and archived.
 *
 * Processed files are moved to the archive directory.
 *
 * Usage:
 *   npx tsx scripts/file-watcher.ts
 *   # or via npm script:
 *   npm run watch:files
 *
 * Environment variables (.env.watcher):
 *   API_URL      — deployment URL for the app (required)
 *   INGEST_API_KEY  — API key for authentication (required)
 *   ORG_ID       — Organization ID (required)
 *   WATCH_DIR    — directory to monitor (default: ./uploads)
 *   ARCHIVE_DIR  — where processed files go (default: ./archived)
 *   POLL_MS      — polling interval in ms (default: 2000)
 */

import 'dotenv/config';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

// Load .env.watcher if it exists (overrides .env)
dotenv.config({ path: path.resolve(process.cwd(), '.env.watcher'), override: true });
// eslint-disable-next-line @typescript-eslint/no-require-imports
const chokidar = require('chokidar');

import {
  parseDashboardCSV,
  parseLocationCSV,
  parseClaimsCSV,
} from '../src/lib/parsers';

import { parseGenericCSV } from '../src/lib/generic-parser';

// ── Configuration ──

const API_URL = (process.env.API_URL || '').replace(/\/$/, '');
const INGEST_API_KEY = process.env.INGEST_API_KEY;
const ORG_ID = process.env.ORG_ID;
const APP_NAME = process.env.APP_NAME || process.env.NEXT_PUBLIC_APP_NAME || 'MIL Analytics Dashboard';
const WATCH_DIR = path.resolve(process.env.WATCH_DIR || './uploads');
const ARCHIVE_DIR = path.resolve(process.env.ARCHIVE_DIR || './archived');
const POLL_MS = parseInt(process.env.POLL_MS || '2000', 10);
const API_RETRY_COUNT = 3;
const API_RETRY_DELAY_MS = 5000;

// ── Validate required environment variables ──

function validateConfig(): void {
  const errors: string[] = [];

  if (!INGEST_API_KEY) {
    errors.push('INGEST_API_KEY environment variable is required');
  }

  if (!ORG_ID) {
    errors.push('ORG_ID environment variable is required');
  }

  if (!API_URL) {
    errors.push('API_URL environment variable is required');
  }

  if (errors.length > 0) {
    console.error('\n❌ Configuration error:');
    errors.forEach(err => console.error(`   ${err}`));
    console.error('\n📝 Set these in .env.watcher or as environment variables.\n');
    process.exit(1);
  }
}

validateConfig();

// ── Ensure directories exist ──

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`📁 Created directory: ${dir}`);
  }
}

ensureDir(WATCH_DIR);
ensureDir(ARCHIVE_DIR);

// ── SHA-256 Hash Computation ──

function computeHash(filePath: string): string {
  const buffer = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

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

// ── POST to API with retry logic ──

async function postToAPI(
  fileType: 'Dashboard' | 'Location' | 'Claims' | 'Generic',
  data: Record<string, unknown>,
  year: number,
  fileName: string,
  sha256: string,
  attempt: number = 1
): Promise<{ success: boolean; duplicate?: boolean; error?: string }> {
  try {
    const body = {
      year,
      fileType: fileType === 'Generic' ? 'Dashboard' : fileType,
      data,
      fileName,
      sha256,
    };

    const response = await fetch(`${API_URL}/api/data/ingest`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': INGEST_API_KEY!,
        'X-Org-Id': ORG_ID!,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API returned ${response.status}: ${errorText}`);
    }

    const result = await response.json();
    return { success: true, duplicate: result.duplicate };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    if (attempt < API_RETRY_COUNT) {
      console.warn(
        `   ⚠️  Attempt ${attempt}/${API_RETRY_COUNT} failed: ${message}. Retrying in ${API_RETRY_DELAY_MS}ms...`
      );
      await new Promise(resolve => setTimeout(resolve, API_RETRY_DELAY_MS));
      return postToAPI(fileType, data, year, fileName, sha256, attempt + 1);
    }

    return {
      success: false,
      error: `API call failed after ${API_RETRY_COUNT} attempts: ${message}`,
    };
  }
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
    sha256 = computeHash(filePath);
    console.log(`   SHA-256: ${sha256.substring(0, 12)}...`);
  } catch (err) {
    console.error(`❌ Could not read file: ${fileName}`, err);
    archiveFile(filePath, fileName, '_error');
    return;
  }

  // Step 2: Read file content
  let csvText: string;
  try {
    csvText = fs.readFileSync(filePath, 'utf-8');
  } catch (err) {
    console.error(`❌ Could not read file content: ${fileName}`, err);
    archiveFile(filePath, fileName, '_error');
    return;
  }

  if (csvText.trim().length === 0) {
    console.log(`⚠️  Empty file, skipping: ${fileName}`);
    archiveFile(filePath, fileName, '_empty');
    return;
  }

  // Step 3: Detect file type
  const fileType = detectFileType(csvText, fileName);
  console.log(`   Type detected: ${fileType}`);

  // Step 4: Parse
  let yearData: Record<string, unknown> | null = null;
  let year = new Date().getFullYear();

  try {
    switch (fileType) {
      case 'Dashboard': {
        const result = parseDashboardCSV(csvText);
        year = result.year;
        yearData = {
          dashboard: result.dashboard,
          year: result.year,
        };
        break;
      }
      case 'Location': {
        const result = parseLocationCSV(csvText);
        year = result.year;
        yearData = {
          location: result.location,
          year: result.year,
        };
        break;
      }
      case 'Claims': {
        const result = parseClaimsCSV(csvText);
        year = result.year;
        yearData = {
          claims: result.claims,
          year: result.year,
        };
        break;
      }
      case 'Generic': {
        const result = parseGenericCSV(csvText, fileName);
        yearData = {
          datasets: { [result.id]: result },
          year,
        };
        break;
      }
    }
  } catch (err) {
    console.error(`❌ Parse error for ${fileName}:`, err);
    archiveFile(filePath, fileName, '_parse_error');
    return;
  }

  if (!yearData) {
    console.error(`❌ No data extracted from ${fileName}`);
    archiveFile(filePath, fileName, '_nodata');
    return;
  }

  // Step 5: POST to API
  console.log(`   Posting to ${API_URL}/api/data/ingest...`);

  // For Generic files, use the datasets object directly
  let dataToSend: Record<string, unknown>;
  if (fileType === 'Generic') {
    dataToSend = yearData.datasets as Record<string, unknown>;
  } else {
    // For Dashboard/Location/Claims, send the specific field value
    if (fileType === 'Dashboard') {
      dataToSend = yearData.dashboard as Record<string, unknown>;
    } else if (fileType === 'Location') {
      dataToSend = yearData.location as Record<string, unknown>;
    } else {
      dataToSend = yearData.claims as Record<string, unknown>;
    }
  }

  const apiResult = await postToAPI(fileType, dataToSend, year, fileName, sha256);

  if (!apiResult.success) {
    console.error(`❌ ${apiResult.error}`);
    archiveFile(filePath, fileName, '_api_error');
    return;
  }

  if (apiResult.duplicate) {
    console.log(`⚠️  DUPLICATE detected. File already processed (same hash).`);
    archiveFile(filePath, fileName, '_dup');
    return;
  }

  console.log(`✅ Ingested: ${fileName} → year ${year} (${fileType})`);

  // Step 6: Archive the processed file
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
    // Try copy + delete as fallback (cross-device move on network drives)
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
console.log(`║   ${APP_NAME.substring(0, 30).padEnd(30)} CSV Watcher   ║`);
console.log('╠══════════════════════════════════════════════════════╣');
console.log(`║  API URL:  ${API_URL.substring(0, 45).padEnd(45)}║`);
console.log(`║  Org ID:   ${ORG_ID!.substring(0, 45).padEnd(45)}║`);
console.log(`║  Watching: ${WATCH_DIR.substring(0, 45).padEnd(45)}║`);
console.log(`║  Archive:  ${ARCHIVE_DIR.substring(0, 45).padEnd(45)}║`);
console.log(`║  Poll:     ${String(POLL_MS + 'ms').padEnd(45)}║`);
console.log('╚══════════════════════════════════════════════════════╝');

// Process any files already in the directory
processExistingFiles()
  .then(() => {
    // Set up chokidar to watch for new files
    const watcher = chokidar.watch(path.join(WATCH_DIR, '*.csv'), {
      persistent: true,
      ignoreInitial: true, // We already processed existing files above
      awaitWriteFinish: {
        stabilityThreshold: 1500, // Wait 1.5s after last write before processing
        pollInterval: 500,
      },
      usePolling: true, // More reliable on network drives / OneDrive
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
  })
  .catch(err => {
    console.error('❌ Failed to process existing files:', err);
    process.exit(1);
  });
