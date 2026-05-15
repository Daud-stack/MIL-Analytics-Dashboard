"use client";

import React from "react";
import { useFilterStore, MONTH_NAMES, type PeriodGranularity } from "@/store/filter";
import { X, Calendar, ChevronDown } from "lucide-react";

const GRANULARITY_OPTIONS: { value: PeriodGranularity; label: string; icon: string }[] = [
  { value: "day", label: "Day", icon: "D" },
  { value: "week", label: "Week", icon: "W" },
  { value: "month", label: "Month", icon: "M" },
  { value: "quarter", label: "Quarter", icon: "Q" },
  { value: "year", label: "Year", icon: "Y" },
];

const QUARTER_OPTIONS = ["Q1", "Q2", "Q3", "Q4"];

export function FilterBar() {
  const {
    year,
    month,
    compareYear,
    granularity,
    selectedQuarter,
    selectedMonths,
    setMonth,
    setCompareYear,
    setGranularity,
    setSelectedQuarter,
    setSelectedMonths,
    resetDrillDown,
  } = useFilterStore();

  const isFiltered = selectedMonths.length < 12 || granularity !== "month";

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-4 py-2 md:px-6 text-xs">
      {/* Year Badge */}
      <span className="text-slate-600 dark:text-slate-400 font-medium flex items-center gap-1">
        <Calendar className="h-3 w-3" />
        {year}
      </span>

      <span className="text-slate-300 dark:text-slate-600">|</span>

      {/* Granularity Selector */}
      <div className="inline-flex rounded-md bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 overflow-hidden">
        {GRANULARITY_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setGranularity(opt.value)}
            className={`px-2.5 py-1 text-xs font-medium transition-colors ${
              granularity === opt.value
                ? "bg-teal-600 text-white"
                : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-600"
            }`}
            title={opt.label}
          >
            {opt.icon}
          </button>
        ))}
      </div>

      {/* Quarter Selector — only visible in quarter mode */}
      {granularity === "quarter" && (
        <div className="inline-flex rounded-md bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 overflow-hidden">
          {QUARTER_OPTIONS.map((q) => (
            <button
              key={q}
              onClick={() => setSelectedQuarter(q)}
              className={`px-2.5 py-1 text-xs font-medium transition-colors ${
                selectedQuarter === q
                  ? "bg-blue-600 text-white"
                  : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-600"
              }`}
            >
              {q}
            </button>
          ))}
        </div>
      )}

      {/* Month Chips — visible in month/day/week mode when not full year */}
      {(granularity === "month" || granularity === "day" || granularity === "week") && (
        <div className="inline-flex flex-wrap gap-0.5">
          <button
            onClick={() => {
              if (selectedMonths.length === 12) {
                setSelectedMonths([new Date().getMonth()]);
              } else {
                setSelectedMonths([0,1,2,3,4,5,6,7,8,9,10,11]);
              }
            }}
            className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
              selectedMonths.length === 12
                ? "bg-teal-600 text-white"
                : "bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600 hover:bg-slate-100"
            }`}
          >
            All
          </button>
          {MONTH_NAMES.map((m, idx) => {
            const isActive = selectedMonths.includes(idx);
            return (
              <button
                key={m}
                onClick={() => {
                  if (isActive && selectedMonths.length === 1) return; // must keep at least one
                  const next = isActive
                    ? selectedMonths.filter((i) => i !== idx)
                    : [...selectedMonths, idx];
                  setSelectedMonths(next);
                }}
                className={`px-1.5 py-1 rounded text-[10px] font-medium transition-colors ${
                  isActive
                    ? "bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300"
                    : "text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700"
                }`}
              >
                {m}
              </button>
            );
          })}
        </div>
      )}

      <span className="text-slate-300 dark:text-slate-600">|</span>

      {(granularity === "day" || granularity === "week") && (
        <>
          <span className="rounded-md bg-amber-50 px-2 py-1 text-[11px] font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
            Distributed from monthly totals
          </span>
          <span className="text-slate-300 dark:text-slate-600">|</span>
        </>
      )}

      {/* Month Badge (from header selector) */}
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
          <span>vs {compareYear}</span>
          <button
            onClick={() => setCompareYear(undefined)}
            className="ml-1 hover:text-amber-900 dark:hover:text-amber-300 transition-colors"
            aria-label="Clear comparison filter"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}

      {/* Reset button — shown when filters are active */}
      {isFiltered && (
        <button
          onClick={resetDrillDown}
          className="ml-auto inline-flex items-center gap-1 rounded-md bg-slate-200 dark:bg-slate-700 px-2.5 py-1 text-slate-600 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors"
        >
          <X className="h-3 w-3" />
          Reset
        </button>
      )}
    </div>
  );
}
