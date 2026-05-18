'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useStore } from '@/store';
import type { YearData } from '@/types';

const SYNC_DEBOUNCE_MS = 2000; // Wait 2s after last change before writing to DB
const POLL_INTERVAL_MS = 30000; // Poll DB every 30s for changes from other users
const MIGRATION_KEY = 'avenues_db_migrated'; // localStorage flag

/**
 * useDbSync — Hybrid sync between Zustand (localStorage) and Vercel Postgres.
 *
 * On login:
 *   1. If localStorage has data but DB doesn't → migrate localStorage → DB
 *   2. Load DB data into Zustand (DB is source of truth)
 *   3. Keep localStorage as a fast cache for instant page loads
 *
 * On data change (upload/merge):
 *   1. Zustand updates immediately (fast UI)
 *   2. Debounced write pushes changed years to DB
 *
 * Polling:
 *   Every 30s, fetch DB data and merge any new data from other users
 */
export function useDbSync() {
  const { data: session, status } = useSession();
  const isAuthenticated = status === 'authenticated' && !!session?.user;

  const store = useStore();
  const prevYearsRef = useRef<string>('');
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isSyncing = useRef(false);
  const lastPoll = useRef<number>(0);

  // ─── Fetch all years from DB ─────────────────────────────
  const fetchFromDb = useCallback(async (): Promise<Map<number, YearData> | null> => {
    try {
      const res = await fetch('/api/data');
      if (!res.ok) return null;
      const json = await res.json();
      if (!json.success || !json.data) return null;

      const map = new Map<number, YearData>();
      for (const [yearStr, data] of Object.entries(json.data)) {
        const year = parseInt(yearStr, 10);
        const d = data as Record<string, unknown>;
        map.set(year, {
          year,
          dash: d.dashboard as YearData['dash'],
          dashboard: d.dashboard as YearData['dashboard'],
          loc: d.location as YearData['loc'],
          location: d.location as YearData['location'],
          apac: d.claims as YearData['apac'],
          claims: d.claims as YearData['claims'],
          uploads: (d.uploads || []) as YearData['uploads'],
          datasets: (d.datasets || {}) as YearData['datasets'],
        });
      }
      return map;
    } catch (err) {
      console.error('[DbSync] Fetch error:', err);
      return null;
    }
  }, []);

  // ─── Push a single year to DB ────────────────────────────
  const pushYearToDb = useCallback(async (year: number, data: YearData) => {
    try {
      const res = await fetch('/api/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          year,
          dashboard: data.dashboard || data.dash || null,
          location: data.location || data.loc || null,
          claims: data.claims || data.apac || null,
          datasets: data.datasets || {},
          uploads: data.uploads || [],
          // Preserve the server-side dedup index. Without this the next
          // re-upload of the same file via /api/data/ingest no longer
          // short-circuits and the merger double-counts.
          processedHashes: data.processedHashes || [],
        }),
      });
      if (!res.ok) {
        console.error('[DbSync] Push failed for year', year, res.status);
      }
    } catch (err) {
      console.error('[DbSync] Push error for year', year, err);
    }
  }, []);

  // ─── Migration: localStorage → DB (one-time) ─────────────
  const migrateLocalData = useCallback(async () => {
    if (typeof window === 'undefined') return;

    // Check if already migrated
    if (localStorage.getItem(MIGRATION_KEY)) return;

    const localYears = store.years;
    if (localYears.size === 0) {
      localStorage.setItem(MIGRATION_KEY, new Date().toISOString());
      return;
    }

    console.log('[DbSync] Migrating', localYears.size, 'year(s) from localStorage to DB...');

    try {
      const yearsObj: Record<string, YearData> = {};
      localYears.forEach((data, year) => {
        yearsObj[year.toString()] = data;
      });

      const res = await fetch('/api/data/migrate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ years: yearsObj }),
      });

      if (res.ok) {
        const result = await res.json();
        console.log('[DbSync] Migration result:', result.message);
        localStorage.setItem(MIGRATION_KEY, new Date().toISOString());
      }
    } catch (err) {
      console.error('[DbSync] Migration error:', err);
    }
  }, [store.years]);

  // ─── Initial sync on login ────────────────────────────────
  useEffect(() => {
    if (!isAuthenticated) return;

    let cancelled = false;

    const initialSync = async () => {
      isSyncing.current = true;

      // Step 1: Migrate local data if needed
      await migrateLocalData();

      // Step 2: Load from DB (source of truth)
      const dbData = await fetchFromDb();

      if (cancelled) return;

      if (dbData && dbData.size > 0) {
        // Replace Zustand store with DB data — clear first to avoid additive duplication
        dbData.forEach((yearData, year) => {
          store.removeYear(year);
          store.addYearData(year, yearData);
        });
        console.log('[DbSync] Loaded', dbData.size, 'year(s) from DB (replaced)');
      }

      // Snapshot current state for change detection
      prevYearsRef.current = serializeYearsForComparison(store.years);
      isSyncing.current = false;
      lastPoll.current = Date.now();
    };

    initialSync();

    return () => { cancelled = true; };
    // Only run on auth state change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  // ─── Debounced write-back on store changes ────────────────
  // Ref to hold pending flush data so cleanup can fire it immediately
  const pendingFlush = useRef<{ snapshot: string; years: Map<number, YearData> } | null>(null);

  useEffect(() => {
    if (!isAuthenticated || isSyncing.current) return;

    const currentSnapshot = serializeYearsForComparison(store.years);
    if (currentSnapshot === prevYearsRef.current) return;

    // Track the pending data for flush-on-unmount
    pendingFlush.current = { snapshot: currentSnapshot, years: new Map(store.years) };

    // Something changed — debounce the DB write
    if (debounceTimer.current) clearTimeout(debounceTimer.current);

    debounceTimer.current = setTimeout(async () => {
      isSyncing.current = true;
      prevYearsRef.current = currentSnapshot;
      pendingFlush.current = null;

      // Push all years to DB
      const promises: Promise<void>[] = [];
      store.years.forEach((data, year) => {
        promises.push(pushYearToDb(year, data));
      });

      await Promise.all(promises);
      console.log('[DbSync] Pushed', promises.length, 'year(s) to DB');
      isSyncing.current = false;
    }, SYNC_DEBOUNCE_MS);

    return () => {
      // On unmount/re-render: flush pending writes immediately instead of canceling
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
        debounceTimer.current = null;
      }
      if (pendingFlush.current) {
        const { snapshot, years: pendingYears } = pendingFlush.current;
        pendingFlush.current = null;
        prevYearsRef.current = snapshot;
        console.log('[DbSync] Flushing', pendingYears.size, 'year(s) to DB on cleanup');
        pendingYears.forEach((data, year) => {
          pushYearToDb(year, data); // fire-and-forget
        });
      }
    };
  }, [isAuthenticated, store.years, pushYearToDb]);

  // ─── Polling for updates from other users ─────────────────
  useEffect(() => {
    if (!isAuthenticated) return;

    const pollInterval = setInterval(async () => {
      if (isSyncing.current) return;
      if (Date.now() - lastPoll.current < POLL_INTERVAL_MS) return;

      lastPoll.current = Date.now();
      const dbData = await fetchFromDb();

      if (dbData && dbData.size > 0) {
        isSyncing.current = true;
        dbData.forEach((yearData, year) => {
          store.removeYear(year);
          store.addYearData(year, yearData);
        });
        prevYearsRef.current = serializeYearsForComparison(store.years);
        isSyncing.current = false;
      }
    }, POLL_INTERVAL_MS);

    return () => clearInterval(pollInterval);
  }, [isAuthenticated, fetchFromDb, store]);
}

/**
 * Create a lightweight fingerprint of the years Map for comparison.
 * We don't need deep equality — just detect when something has changed.
 */
function serializeYearsForComparison(years: Map<number, YearData>): string {
  const parts: string[] = [];
  years.forEach((data, year) => {
    const dashRev = data.dashboard?.totalRevenue ?? 0;
    const locEps = data.location?.episodes ?? 0;
    const claimsCnt = data.claims?.totalClaims ?? 0;
    const uploadsLen = data.uploads?.length ?? 0;
    parts.push(`${year}:${dashRev}:${locEps}:${claimsCnt}:${uploadsLen}`);
  });
  return parts.sort().join('|');
}
