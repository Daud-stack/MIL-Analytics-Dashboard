#!/usr/bin/env tsx
/**
 * Automated CSV file watcher.
 *
 * Monitors a configurable directory for new CSV files, detects Dashboard,
 * Location, or Claims uploads, parses them with the shared app parsers, and
 * posts the parsed payload to /api/data/ingest using machine-to-machine auth.
 */

import 'dotenv/config';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

dotenv.config({ path: path.resolve(process.cwd(), '.env.watcher'), override: true });
// eslint-disable-next-line @typescript-eslint/no-require-imports
const chokidar = require('chokidar');

import {
  parseDashboardCSV,
  parseLocationCSV,
  parseClaimsCSV,
  detectYearOrNull,
} from '../src/lib/parsers';
import { parseGenericCSV } from '../src/lib/generic-parser';

type SupportedFileType = 'Dashboard' | 'Location' | 'Claims' | 'Generic';
type DetectedFileType = SupportedFileType;

const API_URL = (process.env.API_URL || '').replace(/\/$/, '');
const INGEST_API_KEY = process.env.INGEST_API_KEY;
const ORG_ID = process.env.ORG_ID;
const APP_NAME = process.env.APP_NAME || process.env.NEXT_PUBLIC_APP_NAME || 'MIL Analytics Dashboard';
const WATCH_DIR = path.resolve(process.env.WATCH_DIR || './uploads');
const ARCHIVE_DIR = path.resolve(process.env.ARCHIVE_DIR || './archived');
const POLL_MS = parseInt(process.env.POLL_MS || '2000', 10);
const API_RETRY_COUNT = 3;
const API_RETRY_DELAY_MS = 5000;

function asPayloadObject(
  value: object | null,
  label: SupportedFileType
): Record<string, unknown> {
  if (!value) {
    throw new Error(`${label} parser returned no data`);
  }

  return value as unknown as Record<string, unknown>;
}

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
    console.error('\n[watcher] Configuration error:');
    errors.forEach(err => console.error(`   ${err}`));
    console.error('\n[watcher] Set these in .env.watcher or as environment variables.\n');
    process.exit(1);
  }
}

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`[watcher] Created directory: ${dir}`);
  }
}

function computeHash(filePath: string): string {
  const buffer = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function detectFileType(csvText: string): DetectedFileType {
  const lines = csvText.split('\n').map(line => line.trim());
  const firstLine = (lines[2] || lines[0] || '').toLowerCase();
  const allText = csvText.substring(0, 3000).toLowerCase();

  if (
    allText.includes('management dashboard') ||
    allText.includes('capture date') ||
    (firstLine.includes('admissions-') && firstLine.includes('discharges-'))
  ) {
    return 'Dashboard';
  }

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

async function postToAPI(
  fileType: SupportedFileType,
  data: Record<string, unknown>,
  year: number,
  fileName: string,
  sha256: string,
  attempt = 1
): Promise<{ success: boolean; duplicate?: boolean; error?: string }> {
  try {
    const response = await fetch(`${API_URL}/api/data/ingest`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': INGEST_API_KEY!,
        'X-Org-Id': ORG_ID!,
      },
      body: JSON.stringify({
        year,
        fileType,
        data,
        fileName,
        sha256,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API returned ${response.status}: ${errorText}`);
    }

    const result = await response.json();
    return { success: true, duplicate: result.duplicate };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    if (attempt < API_RETRY_COUNT) {
      console.warn(
        `   Attempt ${attempt}/${API_RETRY_COUNT} failed: ${message}. Retrying in ${API_RETRY_DELAY_MS}ms...`
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

function archiveFile(filePath: string, fileName: string, suffix = ''): void {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
  const archiveName = `${timestamp}_${fileName}${suffix}`;
  const archivePath = path.join(ARCHIVE_DIR, archiveName);

  try {
    fs.renameSync(filePath, archivePath);
    console.log(`[watcher] Archived: ${archiveName}`);
  } catch {
    try {
      fs.copyFileSync(filePath, archivePath);
      fs.unlinkSync(filePath);
      console.log(`[watcher] Archived (copy+delete): ${archiveName}`);
    } catch (fallbackError) {
      console.error('[watcher] Archive fallback also failed:', fallbackError);
    }
  }
}

function extractPayload(
  fileType: SupportedFileType,
  csvText: string,
  fileName: string
): { year: number; data: Record<string, unknown> } {
  if (fileType === 'Dashboard') {
    const result = parseDashboardCSV(csvText);
    return { year: result.year, data: asPayloadObject(result.dashboard, fileType) };
  }

  if (fileType === 'Location') {
    const result = parseLocationCSV(csvText);
    return { year: result.year, data: asPayloadObject(result.location, fileType) };
  }

  if (fileType === 'Generic') {
    const result = parseGenericCSV(csvText, fileName);
    return {
      year: new Date().getFullYear(),
      data: { [result.id]: result } as Record<string, unknown>,
    };
  }

  const result = parseClaimsCSV(csvText);
  return { year: result.year, data: asPayloadObject(result.claims, fileType) };
}

async function processFile(filePath: string): Promise<void> {
  const fileName = path.basename(filePath);

  if (path.extname(fileName).toLowerCase() !== '.csv') {
    console.log(`[watcher] Skipping non-CSV file: ${fileName}`);
    return;
  }

  console.log(`\n[watcher] Processing: ${fileName}`);

  let sha256: string;
  try {
    sha256 = computeHash(filePath);
    console.log(`   SHA-256: ${sha256.substring(0, 12)}...`);
  } catch (error) {
    console.error(`[watcher] Could not read file: ${fileName}`, error);
    archiveFile(filePath, fileName, '_error');
    return;
  }

  let csvText: string;
  try {
    csvText = fs.readFileSync(filePath, 'utf-8');
    // Strip UTF-8 BOM left behind by Excel-exported CSVs.
    if (csvText.charCodeAt(0) === 0xfeff) csvText = csvText.slice(1);
  } catch (error) {
    console.error(`[watcher] Could not read file content: ${fileName}`, error);
    archiveFile(filePath, fileName, '_error');
    return;
  }

  if (csvText.trim().length === 0) {
    console.log(`[watcher] Empty file, skipping: ${fileName}`);
    archiveFile(filePath, fileName, '_empty');
    return;
  }

  // If the CSV itself doesn't carry a year, the parsers fall back to
  // new Date().getFullYear(). Surface that decision so it isn't silent.
  const yearInCsv = detectYearOrNull(csvText);
  if (yearInCsv === null) {
    console.warn(`[watcher] No year found in ${fileName}; will file under current year.`);
  }

  const fileType = detectFileType(csvText);
  console.log(`   Type detected: ${fileType}`);

  let payload: { year: number; data: Record<string, unknown> };
  try {
    payload = extractPayload(fileType, csvText, fileName);
  } catch (error) {
    console.error(`[watcher] Parse error for ${fileName}:`, error);
    archiveFile(filePath, fileName, '_parse_error');
    return;
  }

  console.log(`   Posting to ${API_URL}/api/data/ingest...`);
  const apiResult = await postToAPI(fileType, payload.data, payload.year, fileName, sha256);

  if (!apiResult.success) {
    console.error(`[watcher] ${apiResult.error}`);
    archiveFile(filePath, fileName, '_api_error');
    return;
  }

  if (apiResult.duplicate) {
    console.log('[watcher] Duplicate detected. File already processed (same hash).');
    archiveFile(filePath, fileName, '_dup');
    return;
  }

  console.log(`[watcher] Ingested: ${fileName} -> year ${payload.year} (${fileType})`);
  archiveFile(filePath, fileName);
}

async function processExistingFiles(): Promise<void> {
  const files = fs.readdirSync(WATCH_DIR).filter(file => file.toLowerCase().endsWith('.csv'));

  if (files.length > 0) {
    console.log(`\n[watcher] Found ${files.length} existing CSV file(s) in ${WATCH_DIR}`);
  }

  for (const file of files) {
    await processFile(path.join(WATCH_DIR, file));
  }
}

function printBanner(): void {
  console.log('============================================================');
  console.log(`${APP_NAME} CSV File Watcher`);
  console.log('============================================================');
  console.log(`API URL : ${API_URL}`);
  console.log(`Org ID  : ${ORG_ID}`);
  console.log(`Watch   : ${WATCH_DIR}`);
  console.log(`Archive : ${ARCHIVE_DIR}`);
  console.log(`Poll    : ${POLL_MS}ms`);
  console.log('============================================================\n');
}

async function startWatcher(): Promise<void> {
  validateConfig();
  ensureDir(WATCH_DIR);
  ensureDir(ARCHIVE_DIR);
  printBanner();
  await processExistingFiles();

  const watcher = chokidar.watch(path.join(WATCH_DIR, '*.csv'), {
    persistent: true,
    ignoreInitial: true,
    awaitWriteFinish: {
      stabilityThreshold: 1500,
      pollInterval: 500,
    },
    usePolling: true,
    interval: POLL_MS,
  });

  watcher.on('add', (filePath: string) => {
    console.log(`\n[watcher] New file detected: ${path.basename(filePath)}`);
    void processFile(filePath);
  });

  watcher.on('error', (error: Error) => {
    console.error('[watcher] Watcher error:', error);
  });

  const shutdown = async (signal: string) => {
    console.log(`\n[watcher] Received ${signal}. Closing watcher...`);
    await watcher.close();
    process.exit(0);
  };

  process.on('SIGINT', () => {
    void shutdown('SIGINT');
  });

  process.on('SIGTERM', () => {
    void shutdown('SIGTERM');
  });

  console.log('[watcher] Watching for new CSV files... Press Ctrl+C to stop.\n');
}

void startWatcher().catch(error => {
  console.error('[watcher] Failed to start:', error);
  process.exit(1);
});
