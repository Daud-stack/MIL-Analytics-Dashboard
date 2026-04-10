'use client';

/**
 * Generic CSV Parser with Auto Column Detection & Profiling
 *
 * Ingests any CSV, auto-detects column types (numeric, categorical, date, text, boolean),
 * computes per-column statistics, and returns a GenericDataset ready for dynamic insights.
 */

import Papa from 'papaparse';
import { GenericDataset, DatasetSchema, ColumnProfile, ColumnType } from '@/types';

// ===== COLUMN TYPE DETECTION =====

const DATE_PATTERNS = [
  /^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}$/,               // DD/MM/YYYY or MM/DD/YYYY
  /^\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}$/,                   // YYYY-MM-DD
  /^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\s+\d{1,2}:\d{2}/, // with time
  /^\d{4}-\d{2}-\d{2}T/,                                   // ISO 8601
];

const BOOLEAN_VALUES = new Set(['true', 'false', 'yes', 'no', 'y', 'n', '1', '0', 't', 'f']);

function isDateString(value: string): boolean {
  return DATE_PATTERNS.some(p => p.test(value.trim()));
}

function isNumericString(value: string): boolean {
  const cleaned = value.trim().replace(/^[$£€]/, '').replace(/,/g, '').replace(/\s/g, '');
  if (cleaned === '' || cleaned === '-') return false;
  return !isNaN(parseFloat(cleaned)) && isFinite(parseFloat(cleaned));
}

function isBooleanString(value: string): boolean {
  return BOOLEAN_VALUES.has(value.trim().toLowerCase());
}

/**
 * Detect column type by sampling values.
 * Strategy: check the first N non-empty values and vote.
 */
function detectColumnType(values: string[]): ColumnType {
  const nonEmpty = values.filter(v => v != null && v.toString().trim() !== '').slice(0, 100);
  if (nonEmpty.length === 0) return 'text';

  let numericCount = 0;
  let dateCount = 0;
  let boolCount = 0;

  for (const v of nonEmpty) {
    const s = v.toString().trim();
    if (isNumericString(s)) numericCount++;
    if (isDateString(s)) dateCount++;
    if (isBooleanString(s)) boolCount++;
  }

  const threshold = nonEmpty.length * 0.7; // 70% agreement needed

  if (dateCount >= threshold) return 'date';
  if (boolCount >= threshold) return 'boolean';
  if (numericCount >= threshold) return 'numeric';

  // If many unique values, it's text; fewer = categorical
  const uniqueValues = new Set(nonEmpty.map(v => v.toString().trim().toLowerCase()));
  if (uniqueValues.size <= Math.min(50, nonEmpty.length * 0.3)) return 'categorical';

  return 'text';
}

// ===== COLUMN PROFILING =====

function parseNumeric(value: unknown): number | null {
  if (value == null) return null;
  const s = String(value).trim().replace(/^[$£€]/, '').replace(/,/g, '').replace(/\s/g, '');
  if (s === '' || s === '-') return null;
  const num = parseFloat(s);
  return isNaN(num) ? null : num;
}

function computeMedian(sorted: number[]): number {
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function profileColumn(name: string, values: unknown[], type: ColumnType): ColumnProfile {
  const total = values.length;
  const nonNullValues = values.filter(v => v != null && String(v).trim() !== '');
  const missing = total - nonNullValues.length;
  const uniqueSet = new Set(nonNullValues.map(v => String(v).trim()));

  const profile: ColumnProfile = {
    name,
    type,
    nonNull: nonNullValues.length,
    unique: uniqueSet.size,
    missing,
  };

  if (type === 'numeric') {
    const nums = nonNullValues.map(v => parseNumeric(v)).filter((n): n is number => n !== null);
    if (nums.length > 0) {
      nums.sort((a, b) => a - b);
      profile.min = nums[0];
      profile.max = nums[nums.length - 1];
      profile.sum = nums.reduce((a, b) => a + b, 0);
      profile.mean = profile.sum / nums.length;
      profile.median = computeMedian(nums);
      const variance = nums.reduce((acc, v) => acc + (v - profile.mean!) ** 2, 0) / nums.length;
      profile.std = Math.sqrt(variance);
    }
  }

  if (type === 'categorical' || type === 'text') {
    const counts: Record<string, number> = {};
    for (const v of nonNullValues) {
      const key = String(v).trim();
      counts[key] = (counts[key] || 0) + 1;
    }
    profile.topValues = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([value, count]) => ({ value, count }));
  }

  if (type === 'date') {
    const dateStrings = nonNullValues.map(v => String(v).trim()).sort();
    if (dateStrings.length > 0) {
      profile.minDate = dateStrings[0];
      profile.maxDate = dateStrings[dateStrings.length - 1];
    }
  }

  return profile;
}

// ===== SCHEMA FINGERPRINTING =====

function computeSchemaId(columnNames: string[], columnTypes: ColumnType[]): string {
  // Create a stable fingerprint from sorted column name+type pairs
  const pairs = columnNames.map((n, i) => `${n.toLowerCase().trim()}:${columnTypes[i]}`);
  pairs.sort();
  // Simple hash
  let hash = 0;
  const str = pairs.join('|');
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return 'schema_' + Math.abs(hash).toString(36);
}

// ===== MAIN PARSER =====

export function parseGenericCSV(
  csvText: string,
  fileName: string,
  datasetName?: string,
): GenericDataset {
  const result = Papa.parse(csvText, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: false, // keep as strings for type detection
  });

  const headers = result.meta.fields || [];
  const data = result.data as Record<string, string>[];

  // Limit to 2000 rows for in-browser analysis
  const maxRows = 2000;
  const rows = data.slice(0, maxRows);
  const allRows = data; // use all for profiling

  // Detect column types
  const columnTypes: ColumnType[] = headers.map(header => {
    const colValues = allRows.map(row => row[header] || '');
    return detectColumnType(colValues);
  });

  // Profile each column
  const columnProfiles: ColumnProfile[] = headers.map((header, i) => {
    const colValues = allRows.map(row => row[header]);
    return profileColumn(header, colValues, columnTypes[i]);
  });

  // Build schema
  const schemaId = computeSchemaId(headers, columnTypes);
  const schema: DatasetSchema = {
    id: schemaId,
    columns: columnProfiles,
    columnNames: headers,
  };

  // Add _uploadedAt to each row
  const now = new Date().toISOString();
  const stampedRows = rows.map(row => ({
    ...row,
    _uploadedAt: now,
  }));

  const id = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : Date.now().toString(36) + Math.random().toString(36).substring(7);

  const name = datasetName || fileName.replace(/\.csv$/i, '').replace(/[_-]+/g, ' ').trim();

  console.log(`[GenericParser] Parsed "${name}": ${allRows.length} rows, ${headers.length} columns`);
  console.log(`[GenericParser] Column types:`, headers.map((h, i) => `${h}=${columnTypes[i]}`).join(', '));
  console.log(`[GenericParser] Schema ID: ${schemaId}`);

  return {
    id,
    name,
    fileName,
    schemaId,
    schema,
    uploadedAt: now,
    rowCount: allRows.length,
    rows: stampedRows,
    columnProfiles,
  };
}

/**
 * Merge two datasets with the same schema (append logic).
 * Deduplicates by row content hash if rows overlap.
 */
export function mergeDatasets(existing: GenericDataset, incoming: GenericDataset): GenericDataset {
  // Simple dedup: build a set of row fingerprints from existing
  const existingFingerprints = new Set(
    existing.rows.map(row => {
      const vals = existing.schema.columnNames
        .map(col => String(row[col] ?? '').trim())
        .join('|');
      return vals;
    })
  );

  // Only append rows that aren't already present
  const newRows = incoming.rows.filter(row => {
    const fp = incoming.schema.columnNames
      .map(col => String(row[col] ?? '').trim())
      .join('|');
    return !existingFingerprints.has(fp);
  });

  const mergedRows = [...existing.rows, ...newRows].slice(0, 2000);

  // Re-profile columns with merged data
  const allValues = mergedRows;
  const columnProfiles = existing.schema.columnNames.map((name, i) => {
    const colValues = allValues.map(row => row[name]);
    return profileColumn(name, colValues, existing.schema.columns[i].type);
  });

  return {
    ...existing,
    rowCount: existing.rowCount + incoming.rowCount - (incoming.rows.length - newRows.length),
    rows: mergedRows,
    columnProfiles,
    uploadedAt: incoming.uploadedAt, // update to latest
  };
}
