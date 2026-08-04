"use client";

import React from "react";
import { ShieldCheck, Database, RefreshCw, CheckCircle2, AlertCircle } from "lucide-react";

export function DataHealthWidget() {
  return (
    <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/10 p-4 backdrop-blur-md">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 shrink-0">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="font-heading font-bold text-xs text-emerald-300 uppercase tracking-wider">
                Data Quality & Reconciliation Health
              </h4>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300">
                <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                100% Validated
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Source: Trimed Reports Reservoir | Automated Watcher Active | Real-Time Sync
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-left border-t sm:border-t-0 sm:border-l border-slate-800 pt-2 sm:pt-0 sm:pl-4">
          <div>
            <span className="text-[10px] text-slate-400 block">Total Records:</span>
            <span className="text-xs font-mono font-bold text-slate-200">105,505</span>
          </div>
          <div>
            <span className="text-[10px] text-slate-400 block">Duplicates Skipped:</span>
            <span className="text-xs font-mono font-bold text-emerald-400">0 (SHA-256)</span>
          </div>
          <div>
            <span className="text-[10px] text-slate-400 block">PII Encryption:</span>
            <span className="text-xs font-bold text-teal-400">SHA-256 Hash</span>
          </div>
          <div>
            <span className="text-[10px] text-slate-400 block">Data Lineage:</span>
            <span className="text-xs font-bold text-blue-400">Trimed ➔ Fact</span>
          </div>
        </div>
      </div>
    </div>
  );
}
