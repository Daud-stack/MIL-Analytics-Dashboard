"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useSidebarStore } from "@/store/sidebar";
import {
  Upload,
  LayoutDashboard,
  Layers,
  Activity,
  UserPlus,
  Hotel,
  BedDouble,
  Scissors,
  Stethoscope,
  Users,
  Ambulance,
  DollarSign,
  Pill,
  CreditCard,
  FileText,
  Lightbulb,
  TrendingUp,
  GitBranch,
  Target,
  BarChart3,
  Calendar,
  FlaskConical,
  Brain,
  Hexagon,
  Cpu,
  ShieldCheck,
  Database,
  Search,
  ChevronDown,
} from "lucide-react";

interface SidebarItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface SidebarSection {
  title: string;
  key: string;
  items: SidebarItem[];
}

const sections: SidebarSection[] = [
  {
    title: "PRIMARY",
    key: "primary",
    items: [
      { label: "Upload Data", href: "/upload", icon: Upload },
      { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
      { label: "Drill-Down", href: "/drilldown", icon: Layers },
      { label: "Episode Analytics", href: "/episodes", icon: Activity },
    ],
  },
  {
    title: "CLINICAL",
    key: "clinical",
    items: [
      { label: "Admissions", href: "/admissions", icon: UserPlus },
      { label: "Occupancy", href: "/occupancy", icon: Hotel },
      { label: "Ward Beds", href: "/ward-beds", icon: BedDouble },
      { label: "Theatre", href: "/theatre", icon: Scissors },
      { label: "Diagnoses", href: "/diagnoses", icon: Stethoscope },
      { label: "Patients", href: "/patients", icon: Users },
      { label: "Casualty", href: "/casualty", icon: Ambulance },
    ],
  },
  {
    title: "FINANCIAL",
    key: "financial",
    items: [
      { label: "Revenue", href: "/revenue", icon: DollarSign },
      { label: "Pharmacy", href: "/pharmacy", icon: Pill },
      { label: "Debtors", href: "/debtors", icon: CreditCard },
      { label: "Claims", href: "/claims", icon: FileText },
    ],
  },
  {
    title: "AI & ANALYTICS",
    key: "ai",
    items: [
      { label: "Insights", href: "/insights", icon: Lightbulb },
      { label: "Forecasting", href: "/forecast", icon: TrendingUp },
      { label: "Correlations", href: "/correlations", icon: GitBranch },
      { label: "Benchmarks", href: "/benchmarks", icon: Target },
      { label: "Compare", href: "/compare", icon: BarChart3 },
      { label: "Year Compare", href: "/year-compare", icon: Calendar },
      { label: "Stats Tests", href: "/stats-test", icon: FlaskConical },
      { label: "ML Models", href: "/ml-models", icon: Brain },
      { label: "Clustering", href: "/clustering", icon: Hexagon },
      { label: "AutoML", href: "/automl", icon: Cpu },
    ],
  },
  {
    title: "DATA",
    key: "data",
    items: [
      { label: "Dataset Explorer", href: "/dataset-explorer", icon: Database },
      { label: "Data Quality", href: "/data-qa", icon: ShieldCheck },
      { label: "Robust Data", href: "/data-robust", icon: Database },
      { label: "Search", href: "/search", icon: Search },
    ],
  },
];

function SidebarContent() {
  const pathname = usePathname();
  const { expandedSections, toggleSection, toggleSidebar } = useSidebarStore();

  const isActive = (href: string) => pathname === href;

  return (
    <div className="flex flex-col h-full bg-slate-900 dark:bg-slate-950">
      {/* Logo Area */}
      <div className="border-b border-slate-700 px-6 py-5">
        <div className="flex items-baseline gap-1">
          <h1 className="text-base font-bold text-white">
            Avenues
          </h1>
          <span className="text-base font-semibold text-teal-400">
            Intelligence
          </span>
        </div>
      </div>

      {/* Navigation */}
      <nav aria-label="Main navigation" className="flex-1 overflow-y-auto space-y-6 px-3 py-5">
        {sections.map((section) => (
          <div key={section.key} role="group" aria-labelledby={`nav-section-${section.key}`}>
            {/* Section Header */}
            <button
              id={`nav-section-${section.key}`}
              onClick={() => toggleSection(section.key)}
              aria-expanded={!!expandedSections[section.key]}
              aria-controls={`nav-items-${section.key}`}
              className={cn(
                "flex w-full items-center justify-between px-3 py-2 text-[11px] font-semibold uppercase tracking-widest transition-colors",
                "text-slate-500 hover:text-slate-300 border-b border-slate-700 pb-2",
                expandedSections[section.key] && "text-slate-300"
              )}
            >
              {section.title}
              <ChevronDown
                className={cn(
                  "h-3.5 w-3.5 transition-transform",
                  expandedSections[section.key] && "rotate-180"
                )}
              />
            </button>

            {/* Section Items */}
            {expandedSections[section.key] && (
              <div id={`nav-items-${section.key}`} role="list" className="space-y-0.5 mt-2">
                {section.items.map((item) => {
                  const active = isActive(item.href);
                  const Icon = item.icon;

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      role="listitem"
                      aria-label={item.label}
                      aria-current={isActive(item.href) ? "page" : undefined}
                      onClick={() => {
                        if (window.innerWidth < 768) toggleSidebar();
                      }}
                      className={cn(
                        "flex items-center gap-3 rounded-lg px-3 py-1.5 text-sm font-medium transition-all",
                        active
                          ? "bg-teal-600/10 text-teal-400 border-l-2 border-l-teal-400"
                          : "text-slate-400 hover:text-slate-300 hover:bg-slate-800/50"
                      )}
                    >
                      <Icon className={cn(
                        "h-4 w-4 shrink-0",
                        active ? "text-teal-400" : "text-slate-500"
                      )} />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="border-t border-slate-700 px-4 py-3 text-xs text-slate-500">
        <p>© Avenues Clinic Intelligence</p>
      </div>
    </div>
  );
}

export function Sidebar() {
  const { isOpen, toggleSidebar } = useSidebarStore();

  return (
    <>
      {/* DESKTOP SIDEBAR (always visible, in document flow) */}
      <aside aria-label="Sidebar navigation" className="hidden md:flex w-64 shrink-0 flex-col border-r border-slate-700 bg-slate-900 dark:bg-slate-950">
        <SidebarContent />
      </aside>

      {/* MOBILE SIDEBAR (fixed overlay) */}
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          aria-hidden="true"
          onClick={toggleSidebar}
        />
      )}

      {/* Drawer */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 dark:bg-slate-950 transition-transform duration-300 md:hidden",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <SidebarContent />
      </aside>
    </>
  );
}
