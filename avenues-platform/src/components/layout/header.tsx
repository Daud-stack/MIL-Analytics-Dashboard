"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { useFilterStore } from "@/store/filter";
import { useSidebarStore } from "@/store/sidebar";
import { useSession, signOut } from "next-auth/react";
import { useTheme } from "@/components/theme-provider";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Menu, Sun, Moon, LogOut, Settings, Search } from "lucide-react";
import { CommandPalette } from "@/components/layout/command-palette";
import { NotificationBell } from "@/components/layout/notification-bell";
import Link from "next/link";

const MONTHS = [
  "Full Year",
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export function Header() {
  const { year, month, compareYear, isOnline, setYear, setMonth, setCompareYear } =
    useFilterStore();
  const { toggleSidebar } = useSidebarStore();
  const { data: session } = useSession();
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  const userName = session?.user?.name || session?.user?.email || "User";
  const userInitials = userName
    .split(" ")
    .map((n: string) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) || "U";

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/80 dark:border-slate-800/80 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md shadow-xs transition-colors duration-200">
      <div className="flex flex-wrap items-center justify-between px-3 py-2 sm:px-6 gap-2">
        {/* Left Section (Sidebar Toggle & Global Date Filters) */}
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap min-w-0">
          <button
            onClick={toggleSidebar}
            aria-label="Toggle sidebar menu"
            className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 md:hidden transition-colors shrink-0"
          >
            <Menu className="h-5 w-5" />
          </button>

          {/* Year Selector */}
          <select
            value={year}
            onChange={(e) => setYear(parseInt(e.target.value))}
            className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800/80 px-2.5 py-1 text-xs font-semibold text-slate-900 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors appearance-none cursor-pointer focus:outline-none focus:ring-1 focus:ring-teal-500"
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>

          {/* Month Selector */}
          <select
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800/80 px-2.5 py-1 text-xs font-semibold text-slate-900 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors appearance-none cursor-pointer focus:outline-none focus:ring-1 focus:ring-teal-500"
          >
            {MONTHS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>

          {/* Compare Year Selector */}
          <select
            value={compareYear ?? ""}
            onChange={(e) => setCompareYear(e.target.value ? parseInt(e.target.value) : undefined)}
            className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800/80 px-2.5 py-1 text-xs font-semibold text-slate-900 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors appearance-none cursor-pointer focus:outline-none focus:ring-1 focus:ring-teal-500 hidden sm:inline-block"
          >
            <option value="">Compare: None</option>
            {years.map((y) => (
              <option key={y} value={y}>
                Compare: {y}
              </option>
            ))}
          </select>
        </div>

        {/* Right Section (Status, Theme, Notifications, Avatar) */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0 ml-auto">
          {/* Online Status Dot */}
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-xs font-medium text-slate-600 dark:text-slate-300">
            <span
              className={cn(
                "h-2 w-2 rounded-full",
                isOnline ? "bg-emerald-500 animate-pulse" : "bg-slate-400"
              )}
            />
            <span className="hidden md:inline text-[11px] font-semibold">{isOnline ? "Live" : "Offline"}</span>
          </div>

          {/* Theme Toggle */}
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            className="h-8 w-8 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
          >
            {isDark ? (
              <Sun className="h-4 w-4 text-amber-400" />
            ) : (
              <Moon className="h-4 w-4 text-slate-600" />
            )}
          </Button>

          {/* Notification Bell */}
          <NotificationBell />

          {/* Global Search Button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }))}
            className="h-8 w-8 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hidden sm:flex"
            title="Search (Cmd+K)"
          >
            <Search className="h-4 w-4" />
          </Button>

          {/* User Avatar */}
          <DropdownMenu>
            <DropdownMenuTrigger className="flex h-8 w-8 items-center justify-center rounded-full bg-teal-600 text-white hover:bg-teal-700 transition-colors text-xs font-bold shadow-xs">
              {userInitials}
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-52">
              <DropdownMenuItem disabled className="text-xs font-medium text-slate-500 border-b border-slate-100 dark:border-slate-800 pb-2 mb-1">
                {userName}
              </DropdownMenuItem>
              <Link href="/settings">
                <DropdownMenuItem className="flex items-center gap-2 cursor-pointer text-xs font-medium">
                  <Settings className="h-4 w-4 text-slate-400" />
                  <span>Settings</span>
                </DropdownMenuItem>
              </Link>
              <Link href="/audit">
                <DropdownMenuItem className="flex items-center gap-2 cursor-pointer text-xs font-medium">
                  <Search className="h-4 w-4 text-slate-400" />
                  <span>Audit Trail</span>
                </DropdownMenuItem>
              </Link>
              <DropdownMenuItem
                onClick={() => signOut({ callbackUrl: "/login" })}
                className="flex items-center gap-2 cursor-pointer text-xs font-medium text-rose-600 hover:text-rose-700 dark:text-rose-400"
              >
                <LogOut className="h-4 w-4" />
                <span>Logout</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <CommandPalette />
    </header>
  );
}
