'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useStore } from '@/store';
import type { YearData } from '@/types';

const SYNC_DEBOUNCE_MS = 2000; // Wait 2s after last change before writing to DB
const POLL_INTERVAL_MS = 30000; // Poll DB every 30s for changes from other users
const MIGRATION_KEY = 'avenues_db_migrated'; // localStorage flag

/**
 * useDbSync — Hybrid sync between Zustand (localStorage) and Postgres.
 *
 * On login:
 *   1. If localStorage has data but DB doesn't → migrate localStorage → DB
 *   2. Load DB data into Zustand (DB is source of truth)
 *   3. Keep localStorage as a fast cache for instant page loads
 *
 * On data change (upload/merge):
 *   1. Zustand updates immediately (fast UI)
 *   2. Debounced write pushes changed years to DB with an optimistic-lock
 *      precondition (ifUnmodifiedSince) so two users can't silently clobber
 *      each other — on conflict we re-load from the DB instead of overwriting.
 *
 * Polling:
 *   Every 30s, fetch DB data and replace local state — skipped while local
 *   changes are still waiting to be flushed, so they aren't clobbered.
 */
export function useDbSync() {
  const { data: session, status } = useSession();
  const isAuthenticated = status === 'authenticated' && !!session?.user;

  // Subscribe ONLY to `years` — subscribing to the whole store re-rendered the
  // dashboard layout on every unrelated store change.
  const years = useStore((state) => state.years);

  const prevYearsRef = useRef<string>('');
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isSyncing = useRef(false);
  const lastPoll = useRef<number>(0);
  /** Last known DB updatedAt per year — the optimistic-lock token. */
  const dbUpdatedAt = useRef<Record<number, string>>({});
  /** Pending (debounced) local changes awaiting a flush. */
  const pendingFlush = useRef<{ snapshot: string; years: Map<number, YearData> } | null>(null);

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
        if (typeof d.updatedAt === 'string') {
          dbUpdatedAt.current[year] = d.updatedAt;
        }
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
          processedHashes: (d.processedHashes || []) as YearData['processedHashes'],
        });
      }
      return map;
    } catch (err) {
      console.error('[DbSync] Fetch error:', err);
      return null;
    }
  }, []);

  /** Replace the local store with a DB snapshot and reset the fingerprint. */
  const replaceStoreWithDb = useCallback((dbData: Map<number, YearData>) => {
    const state = useStore.getState();
    Array.from(state.years.keys()).forEach((y) => state.removeYear(y));
    dbData.forEach((yearData, year) => {
      useStore.getState().addYearData(year, yearData);
    });
    // Read FRESH state for the fingerprint — reading a stale render snapshot
    // here caused a spurious full push-back to the DB after every load.
    prevYearsRef.current = serializeYearsForComparison(useStore.getState().years);
  }, []);

  // ─── Push a single year to DB (optimistic lock) ──────────
  // Returns 'ok' | 'conflict' | 'error'
  const pushYearToDb = useCallback(async (year: number, data: YearData): Promise<'ok' | 'conflict' | 'error'> => {
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
          // Optimistic lock: refuse the write if someone else (another user,
          // the file watcher) updated this year since we last read it.
          ifUnmodifiedSince: dbUpdatedAt.current[year] || null,
        }),
      });
      if (res.status === 409) {
        console.warn('[DbSync] Conflict on year', year, '- DB changed since last read; reloading');
        return 'conflict';
      }
      if (!res.ok) {
        console.error('[DbSync] Push failed for year', year, res.status);
        return 'error';
      }
      const json = await res.json();
      if (typeof json.updatedAt === 'string') {
        dbUpdatedAt.current[year] = json.updatedAt;
      }
      return 'ok';
    } catch (err) {
      console.error('[DbSync] Push error for year', year, err);
      return 'error';
    }
  }, []);

  /** Flush the pending local changes to the DB. */
  const flushPending = useCallback(async () => {
    const pending = pendingFlush.current;
    if (!pending) return;
    pendingFlush.current = null;

    isSyncing.current = true;
    prevYearsRef.current = pending.snapshot;

    const results = await Promise.all(
      Array.from(pending.years.entries()).map(([year, data]) => pushYearToDb(year, data))
    );
    console.log('[DbSync] Pushed', results.length, 'year(s) to DB');

    if (results.includes('conflict')) {
      // Someone else wrote first: reload the DB state (their write + ours were
      // both merges of the same base, so the safest resolution is re-reading
      // and letting the user's next change re-merge on the fresh base).
      const dbData = await fetchFromDb();
      if (dbData && dbData.size > 0) replaceStoreWithDb(dbData);
    }
    isSyncing.current = false;
  }, [pushYearToDb, fetchFromDb, replaceStoreWithDb]);

  // ─── Initial sync on login ────────────────────────────────
  useEffect(() => {
    if (!isAuthenticated) return;

    let cancelled = false;

    const initialSync = async () => {
      isSyncing.current = true;

      // Step 1: Migrate local data if needed (one-time)
      if (typeof window !== 'undefined' && !localStorage.getItem(MIGRATION_KEY)) {
        const localYears = useStore.getState().years;
        if (localYears.size === 0) {
          localStorage.setItem(MIGRATION_KEY, new Date().toISOString());
        } else {
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
        }
      }

      // Step 2: Load from DB (source of truth)
      const dbData = await fetchFromDb();

      if (cancelled) return;

      const state = useStore.getState();
      if (dbData && dbData.size > 0) {
        replaceStoreWithDb(dbData);
        console.log('[DbSync] Loaded', dbData.size, 'year(s) from DB (replaced)');
      } else if (dbData && dbData.size === 0 && state.years.size > 0) {
        // If DB is completely empty but local store has data, it means the DB
        // was wiped. Wipe the local store too so it can't resurrect the data.
        console.log('[DbSync] DB is empty! Wiping local store to match DB.');
        Array.from(state.years.keys()).forEach((y) => state.removeYear(y));
        prevYearsRef.current = serializeYearsForComparison(useStore.getState().years);
      } else {
        prevYearsRef.current = serializeYearsForComparison(useStore.getState().years);
      }

      isSyncing.current = false;
      lastPoll.current = Date.now();
    };

    initialSync();

    return () => { cancelled = true; };
    // Only run on auth state change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  // ─── Debounced write-back on store changes ────────────────
  useEffect(() => {
    if (!isAuthenticated || isSyncing.current) return;

    const currentSnapshot = serializeYearsForComparison(years);
    if (currentSnapshot === prevYearsRef.current) return;

    // Track the pending data so the unmount effect below can flush it
    pendingFlush.current = { snapshot: currentSnapshot, years: new Map(years) };

    // Something changed — debounce the DB write. The cleanup ONLY clears the
    // timer: flushing here fired on every store change and defeated the
    // debounce entirely, producing overlapping writes.
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      debounceTimer.current = null;
      void flushPending();
    }, SYNC_DEBOUNCE_MS);

    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
        debounceTimer.current = null;
      }
    };
  }, [isAuthenticated, years, flushPending]);

  // ─── Flush on real unmount / logout only ──────────────────
  useEffect(() => {
    if (!isAuthenticated) return;
    return () => {
      if (pendingFlush.current) {
        console.log('[DbSync] Flushing pending year(s) to DB on unmount');
        void flushPending(); // fire-and-forget
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  // ─── Polling for updates from other users ─────────────────
  useEffect(() => {
    if (!isAuthenticated) return;

    const pollInterval = setInterval(async () => {
      if (isSyncing.current) return;
      // Don't clobber local changes that haven't been flushed yet
      if (pendingFlush.current || debounceTimer.current) return;
      if (Date.now() - lastPoll.current < POLL_INTERVAL_MS) return;

      lastPoll.current = Date.now();
      const dbData = await fetchFromDb();

      if (dbData && dbData.size > 0 && !pendingFlush.current && !debounceTimer.current) {
        isSyncing.current = true;
        replaceStoreWithDb(dbData);
        isSyncing.current = false;
      }
    }, POLL_INTERVAL_MS);

    return () => clearInterval(pollInterval);
  }, [isAuthenticated, fetchFromDb, replaceStoreWithDb]);
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
