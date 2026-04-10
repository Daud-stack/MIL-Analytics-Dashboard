'use client';

/**
 * useIngestSync — Client-side hook that polls /api/ingest for new data
 * and merges it into the Zustand store using the existing addYearData action.
 *
 * Usage: Call this hook once in a top-level layout component.
 *
 * Features:
 * - Polls every 10 seconds (configurable)
 * - Only fetches when there's new data (uses `since` timestamp)
 * - Merges into Zustand store using the existing deep-merge logic
 * - Shows a toast/log when new data arrives
 */

import { useEffect, useRef, useCallback } from 'react';
import { useStore } from '@/store';
import type { YearData } from '@/types';

const POLL_INTERVAL_MS = 10_000; // 10 seconds

export function useIngestSync() {
  const addYearData = useStore((s) => s.addYearData);
  const lastSyncRef = useRef<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const sync = useCallback(async () => {
    try {
      const url = lastSyncRef.current
        ? `/api/ingest?since=${encodeURIComponent(lastSyncRef.current)}`
        : '/api/ingest';

      const res = await fetch(url);
      if (!res.ok) return;

      const data = await res.json();

      // No new data
      if (data.hasNewData === false) return;
      if (!data.hasData && !data.years) return;

      const years = data.years as Record<string, YearData> | undefined;
      if (!years || Object.keys(years).length === 0) return;

      // Merge each year into the Zustand store
      for (const [yearStr, yearData] of Object.entries(years)) {
        const year = parseInt(yearStr, 10);
        if (isNaN(year) || !yearData) continue;

        console.log(`[IngestSync] Merging year ${year} from auto-ingest`);
        addYearData(year, yearData as YearData);
      }

      // Update last sync timestamp
      lastSyncRef.current = data.updatedAt || new Date().toISOString();
      console.log('[IngestSync] Sync complete, next check in', POLL_INTERVAL_MS / 1000, 's');
    } catch {
      // Silently fail — the API might not be running (e.g., on Vercel)
    }
  }, [addYearData]);

  useEffect(() => {
    // Initial sync
    sync();

    // Set up polling
    intervalRef.current = setInterval(sync, POLL_INTERVAL_MS);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [sync]);
}
