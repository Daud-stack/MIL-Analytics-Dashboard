"use client";

import React from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { FilterBar } from "@/components/layout/filter-bar";
import { useIngestSync } from "@/hooks/useIngestSync";
import { useDbSync } from "@/hooks/useDbSync";
import { ErrorBoundary } from "@/components/ui/error-boundary";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Sync Zustand ↔ Vercel Postgres (source of truth)
  useDbSync();
  // Auto-sync with file watcher's ingested data (polls /api/ingest every 10s)
  useIngestSync();
  return (
    <div className="flex h-screen overflow-hidden bg-white dark:bg-slate-950">
      {/* Sidebar — always in flow on desktop */}
      <Sidebar />

      {/* Main area */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Header */}
        <Header />

        {/* Filter Bar */}
        <FilterBar />

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-900">
          <div className="px-4 py-6 md:px-6 md:py-8 max-w-7xl mx-auto">
            <ErrorBoundary name="Dashboard Area">
              {children}
            </ErrorBoundary>
          </div>
        </main>
      </div>
    </div>
  );
}
