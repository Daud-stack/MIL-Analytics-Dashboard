/**
 * Normalized episode extraction (phase 1 of the relational data model).
 *
 * Converts the row objects stored in year_data.location.rawRows into rows for
 * the `episodes` table, where they can be aggregated with SQL instead of
 * client-side JSON crunching.
 *
 * PHI note: patient names, national IDs and medical-aid membership numbers are
 * deliberately NOT copied into the episodes table — only operational fields
 * (dates, amounts, doctor, scheme name, codes, demographics bands).
 */

import { Prisma } from '@prisma/client';
import prisma from './prisma'; // relative so tsx scripts can import without path aliases

type RawRow = Record<string, unknown>;

const val = (row: RawRow, keys: string[]): string => {
  for (const wanted of keys) {
    for (const k of Object.keys(row)) {
      if (k.trim().toLowerCase().includes(wanted)) {
        const v = row[k];
        if (v !== null && v !== undefined && String(v).trim() !== '') {
          return String(v).trim();
        }
      }
    }
  }
  return '';
};

function parseAmount(s: string): number {
  if (!s) return 0;
  let str = s.trim().replace(/^["']|["']$/g, '').trim();
  let neg = false;
  if (/^\(.*\)$/.test(str)) { neg = true; str = str.slice(1, -1); }
  str = str.replace(/,/g, '').replace(/[$£€\s]/g, '').replace(/^[A-Za-z]+\$?/, '');
  if (!/[eE][+-]?[0-9]+$/.test(str)) str = str.replace(/[A-Za-z%]+$/, '');
  const n = parseFloat(str);
  return Number.isFinite(n) ? (neg ? -n : n) : 0;
}

function parseDmyDate(s: string): Date | null {
  const m = s.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if (!m) return null;
  let [, d, mo, y] = m;
  const year = y.length === 2 ? 2000 + parseInt(y, 10) : parseInt(y, 10);
  const date = new Date(Date.UTC(year, parseInt(mo, 10) - 1, parseInt(d, 10)));
  return Number.isNaN(date.getTime()) ? null : date;
}

function ageGroupOf(ageStr: string): string | null {
  const age = parseInt(ageStr, 10);
  if (!Number.isFinite(age) || age < 0 || age > 130) return null;
  if (age < 18) return '0-17';
  if (age < 36) return '18-35';
  if (age < 51) return '36-50';
  if (age < 66) return '51-65';
  return '65+';
}

export interface EpisodeRow {
  orgId: string;
  year: number;
  episodeKey: string;
  month: number | null;
  admDate: Date | null;
  revenue: number;
  los: number | null;
  doctor: string | null;
  specialty: string | null;
  medAid: string | null;
  ward: string | null;
  icdCode: string | null;
  cptCode: string | null;
  gender: string | null;
  ageGroup: string | null;
  city: string | null;
  sourceHash: string | null;
}

/** Extract Episode rows from location rawRows. Rows without an episode key or
 * without any substantive data (skeleton dedup rows) are skipped. */
export function extractEpisodeRows(
  rawRows: RawRow[] | null | undefined,
  orgId: string,
  year: number,
  sourceHash?: string | null
): EpisodeRow[] {
  if (!rawRows || rawRows.length === 0) return [];

  const out: EpisodeRow[] = [];
  const seen = new Set<string>();

  for (const row of rawRows) {
    const episodeKey = val(row, ['episode']).split(':')[0].trim().toUpperCase();
    if (!episodeKey || seen.has(episodeKey)) continue;

    const admStr = val(row, ['adm date', 'admission date']);
    const admDate = admStr ? parseDmyDate(admStr) : null;
    const totalStr = val(row, ['total']);
    const revenue = parseAmount(totalStr);

    // Skeleton rows (Episode-key only, kept for dedup) carry no data — skip.
    if (!admDate && revenue === 0) continue;

    seen.add(episodeKey);
    const losStr = val(row, ['los', 'length of stay']);
    const los = losStr ? parseFloat(losStr) : NaN;

    out.push({
      orgId,
      year,
      episodeKey,
      month: admDate ? admDate.getUTCMonth() : null,
      admDate,
      revenue,
      los: Number.isFinite(los) ? los : null,
      doctor: val(row, ['doctor name', 'doctor']) || null,
      specialty: val(row, ['doctor specialty', 'specialty', 'speciality']) || null,
      medAid: val(row, ['medical aid scheme', 'med aid scheme', 'scheme', 'medical aid']) || null,
      ward: val(row, ['ward']) || null,
      icdCode: val(row, ['primary icd', 'icd code']) || null,
      cptCode: val(row, ['primary cpt', 'cpt code']) || null,
      gender: val(row, ['gender', 'sex']) || null,
      ageGroup: ageGroupOf(val(row, ['age'])),
      city: val(row, ['city']) || null,
      sourceHash: sourceHash ?? null,
    });
  }

  return out;
}

/**
 * Write episode rows for (orgId, year). Append-only + idempotent:
 * createMany with skipDuplicates means re-ingesting the same file never
 * double-inserts (unique [orgId, year, episodeKey]).
 * With replace=true, existing rows for the year are deleted first (used by
 * the backfill script to refresh corrected values).
 */
export async function syncEpisodes(
  rows: EpisodeRow[],
  options: { replace?: boolean; orgId?: string; year?: number } = {}
): Promise<{ inserted: number; deleted: number }> {
  let deleted = 0;
  if (options.replace && options.orgId && options.year !== undefined) {
    const res = await prisma.episode.deleteMany({
      where: { orgId: options.orgId, year: options.year },
    });
    deleted = res.count;
  }
  if (rows.length === 0) return { inserted: 0, deleted };

  let inserted = 0;
  const CHUNK = 500;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const res = await prisma.episode.createMany({
      data: rows.slice(i, i + CHUNK) as Prisma.EpisodeCreateManyInput[],
      skipDuplicates: true,
    });
    inserted += res.count;
  }
  return { inserted, deleted };
}
