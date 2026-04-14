'use client';

import React, { useMemo, useState } from 'react';
import { useStore, getLatestNonZeroIndex } from '@/store';
import { AlertTriangle, TrendingUp, X } from 'lucide-react';

export function CapacityAlert() {
  const years = useStore((state) => state.years);
  const currentYear = useStore((state) => state.currentYear);
  const [dismissed, setDismissed] = useState(false);

  const alertData = useMemo(() => {
    const data = years.get(currentYear);
    if (!data?.dashboard) return null;

    const dash = data.dashboard;

    // Try to derive a real occupancy percentage:
    // 1. Use pctOccWard (actual percentages per ward) — average across wards
    // 2. Fall back to occupancyBeds only if values look like percentages (0-100 range)
    let occupancyPct: number | null = null;

    // Option 1: Average of ward-level occupancy percentages
    const pctOccWard = dash.pctOccWard;
    if (pctOccWard && Object.keys(pctOccWard).length > 0) {
      const wardArrays = Object.values(pctOccWard).filter(arr => arr.some(v => v > 0));
      if (wardArrays.length > 0) {
        // For each ward, find the latest non-zero month, then average across wards
        const latestValues = wardArrays.map(arr => {
          const idx = getLatestNonZeroIndex(arr);
          return idx >= 0 ? arr[idx] : 0;
        }).filter(v => v > 0);
        if (latestValues.length > 0) {
          occupancyPct = latestValues.reduce((s, v) => s + v, 0) / latestValues.length;
        }
      }
    }

    // Option 2: occupancyBeds — only if values are in percentage range
    if (occupancyPct === null && dash.occupancyBeds) {
      const occ = dash.occupancyBeds;
      const lastIdx = getLatestNonZeroIndex(occ);
      if (lastIdx >= 0) {
        const val = occ[lastIdx];
        // Only use if it looks like a real percentage (0–100)
        if (val > 0 && val <= 100) {
          occupancyPct = val;
        }
      }
    }

    if (occupancyPct === null || occupancyPct <= 0) return null;

    // Clamp to sane range
    const currentOcc = Math.min(100, occupancyPct);
    
    // Find previous month for trend
    let prevOcc = 0;
    if (pctOccWard && Object.keys(pctOccWard).length > 0) {
      const wardArrays = Object.values(pctOccWard).filter(arr => arr.some(v => v > 0));
      if (wardArrays.length > 0) {
        const latestIdx = wardArrays.map(arr => getLatestNonZeroIndex(arr));
        const prevValues = wardArrays.map((arr, i) => {
          const idx = latestIdx[i];
          return idx > 0 ? arr[idx - 1] : 0;
        }).filter(v => v > 0);
        if (prevValues.length > 0) {
          prevOcc = prevValues.reduce((s, v) => s + v, 0) / prevValues.length;
        }
      }
    }
    
    // Using 85 as warning threshold and 95 as critical
    if (currentOcc > 85) {
      const isCritical = currentOcc > 95;
      const trend = prevOcc > 0 ? ((currentOcc - prevOcc) / prevOcc) * 100 : 0;
      
      return {
        level: isCritical ? 'critical' : 'warning',
        occupancy: currentOcc,
        trend: trend,
        message: isCritical 
          ? `CRITICAL CAPACITY: Global ward occupancy is at ${currentOcc.toFixed(1)}%. Immediate diversion protocols may be required.`
          : `High Capacity Warning: Global ward occupancy is trending high at ${currentOcc.toFixed(1)}%.`
      };
    }

    return null;
  }, [years, currentYear]);

  if (!alertData || dismissed) return null;

  const bgClasses = alertData.level === 'critical' 
    ? 'bg-red-500 text-white' 
    : 'bg-amber-500 text-white';

  return (
    <div className={`w-full px-4 py-3 flex items-center justify-between shadow-md mb-6 rounded-lg animate-in fade-in slide-in-from-top-4 ${bgClasses}`}>
      <div className="flex items-center gap-3">
        <AlertTriangle className="h-5 w-5 animate-pulse" />
        <div className="flex flex-col">
          <span className="font-bold text-sm tracking-wide uppercase">
            {alertData.level === 'critical' ? 'Capacity Critical' : 'Capacity Alert'}
          </span>
          <span className="text-sm opacity-90">{alertData.message}</span>
        </div>
        
        {alertData.trend > 0 && (
          <div className="ml-4 flex items-center bg-white/20 px-2 py-1 rounded text-xs font-semibold">
            <TrendingUp className="h-3 w-3 mr-1" />
            {(alertData.trend).toFixed(1)}% vs Last Month
          </div>
        )}
      </div>
      <button 
        onClick={() => setDismissed(true)}
        className="p-1 hover:bg-black/10 rounded transition-colors"
        aria-label="Dismiss alert"
      >
        <X className="h-5 w-5" />
      </button>
    </div>
  );
}
