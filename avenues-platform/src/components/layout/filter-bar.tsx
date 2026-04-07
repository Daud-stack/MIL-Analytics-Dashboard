"use client";

import React from "react";
import { useFilterStore } from "@/store/filter";
import { X } from "lucide-react";

export function FilterBar() {
  const { year, month, compareYear, setMonth, setCompareYear } = useFilterStore();

  // Only show filter bar if there are active filters
  const hasActiveFilters = month !== "Full Year" || compareYear;

  if (!hasActiveFilters) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-4 py-1.5 md:px-6 text-xs">
      {/* Year Badge */}
      <span className="text-slate-600 dark:text-slate-400 font-medium">
        Year: {year}
      </span>

      {/* Month Badge */}
      {month !== "Full Year" && (
        <div className="inline-flex items-center gap-1 rounded-md bg-slate-200 dark:bg-slate-700 px-2 py-1 text-slate-700 dark:text-slate-300">
          <span>{month}</span>
          <button
            onClick={() => setMonth("Full Year")}
            className="ml-1 hover:text-slate-900 dark:hover:text-white transition-colors"
            aria-label="Clear month filter"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}

      {/* Compare Year Badge */}
      {compareYear && (
        <div className="inline-flex items-center gap-1 rounded-md bg-amber-100 dark:bg-amber-900/30 px-2 py-1 text-amber-700 dark:text-amber-400">
          <span>Compare: {compareYear}</span>
          <button
            onClick={() => setCompareYear(undefined)}
            className="ml-1 hover:text-amber-900 dark:hover:text-amber-300 transition-colors"
            aria-label="Clear comparison filter"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}
    </div>
  );
}
