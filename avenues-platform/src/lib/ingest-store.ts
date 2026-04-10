/**
 * Server-side ingestion store
 *
 * Manages a local JSON file (`data/ingested.json`) that holds:
 * - Parsed YearData keyed by year
 * - A set of SHA-256 file hashes for duplicate prevention
 * - A processing log with timestamps
 *
 * This module is Node.js-only (uses `fs` and `crypto`).
 * It is consumed by:
 *   1. The file-watcher script (writes parsed data)
 *   2. The /api/ingest route (serves data to the browser)
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

// ── Types ──

export interface IngestLogEntry {
  fileName: string;
  sha256: string;
  fileType: string;
  year: number;
  processedAt: string;    // ISO timestamp
  rowCount?: number;
}

export interface IngestStoreData {
  /** Parsed year data — serialised as Record<string(year), YearData-like object> */
  years: Record<string, unknown>;
  /** Set of SHA-256 hashes of files already processed */
  processedHashes: string[];
  /** Audit trail */
  log: IngestLogEntry[];
  /** Last updated timestamp */
  updatedAt: string;
}

// ── Paths ──

const DATA_DIR = path.resolve(process.cwd(), 'data');
const STORE_FILE = path.join(DATA_DIR, 'ingested.json');

// ── Helpers ──

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function emptyStore(): IngestStoreData {
  return {
    years: {},
    processedHashes: [],
    log: [],
    updatedAt: new Date().toISOString(),
  };
}

// ── Public API ──

/**
 * Read the current ingest store from disk
 */
export function readIngestStore(): IngestStoreData {
  ensureDataDir();
  if (!fs.existsSync(STORE_FILE)) return emptyStore();

  try {
    const raw = fs.readFileSync(STORE_FILE, 'utf-8');
    const data = JSON.parse(raw) as Partial<IngestStoreData>;
    return {
      years: data.years || {},
      processedHashes: data.processedHashes || [],
      log: data.log || [],
      updatedAt: data.updatedAt || new Date().toISOString(),
    };
  } catch {
    console.warn('[IngestStore] Corrupt store file, resetting');
    return emptyStore();
  }
}

/**
 * Write the ingest store to disk (atomic write with temp file)
 */
export function writeIngestStore(store: IngestStoreData): void {
  ensureDataDir();
  store.updatedAt = new Date().toISOString();

  const tmpFile = STORE_FILE + '.tmp';
  fs.writeFileSync(tmpFile, JSON.stringify(store, null, 2), 'utf-8');
  fs.renameSync(tmpFile, STORE_FILE);
}

/**
 * Compute SHA-256 hash of file contents
 */
export function hashFile(filePath: string): string {
  const content = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(content).digest('hex');
}

/**
 * Compute SHA-256 hash of a string (e.g., CSV text)
 */
export function hashString(text: string): string {
  return crypto.createHash('sha256').update(text).digest('hex');
}

/**
 * Check if a file has already been processed (by hash)
 */
export function isDuplicate(store: IngestStoreData, sha256: string): boolean {
  return store.processedHashes.includes(sha256);
}

/**
 * Record a successfully processed file
 */
export function recordProcessed(
  store: IngestStoreData,
  entry: IngestLogEntry,
  yearData: Record<string, unknown>
): void {
  // Add hash to dedup set
  if (!store.processedHashes.includes(entry.sha256)) {
    store.processedHashes.push(entry.sha256);
  }

  // Add log entry
  store.log.push(entry);

  // Merge year data
  const yearKey = String(entry.year);
  const existing = store.years[yearKey] as Record<string, unknown> | undefined;

  if (!existing) {
    store.years[yearKey] = yearData;
  } else {
    // Deep merge: the file watcher will handle category-specific merge logic
    // Here we do a simple top-level merge (dashboard replaces, location/claims append)
    store.years[yearKey] = {
      ...existing,
      ...yearData,
      // Preserve existing fields that aren't in new data
      uploads: [
        ...((existing.uploads as unknown[]) || []),
        ...((yearData.uploads as unknown[]) || []),
      ],
      datasets: {
        ...((existing.datasets as Record<string, unknown>) || {}),
        ...((yearData.datasets as Record<string, unknown>) || {}),
      },
    };
  }
}

/**
 * Get the full store path (for external tools)
 */
export function getStorePath(): string {
  return STORE_FILE;
}
