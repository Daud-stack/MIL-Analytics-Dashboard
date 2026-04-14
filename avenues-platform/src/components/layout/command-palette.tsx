'use client';

import React, { useEffect, useState } from 'react';
import { Command } from 'cmdk';
import { useRouter } from 'next/navigation';
import { Search, LayoutDashboard, FileText, Activity, Users, DollarSign, BrainCircuit, Syringe } from 'lucide-react';

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };

    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  const runCommand = (command: () => void) => {
    setOpen(false);
    command();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-start justify-center pt-[15vh] px-4 animate-in fade-in duration-200">
      <div 
        className="fixed inset-0"
        onClick={() => setOpen(false)}
      />
      <div className="w-full max-w-xl bg-white dark:bg-slate-900 rounded-xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800 z-50 animate-in zoom-in-95 duration-200">
        <Command>
          <div className="flex items-center border-b border-slate-200 dark:border-slate-800 px-4">
            <Search className="h-5 w-5 text-slate-400 mr-2" />
            <Command.Input 
              autoFocus
              className="flex-1 h-14 bg-transparent border-none focus:outline-none text-slate-900 dark:text-white placeholder-slate-400 text-lg"
              placeholder="Search reports, metrics, or views..." 
            />
            <div className="text-xs text-slate-400 font-mono bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">
              ESC
            </div>
          </div>
          
          <Command.List className="max-h-[300px] overflow-y-auto p-2">
            <Command.Empty className="py-6 text-center text-sm text-slate-500">
              No results found.
            </Command.Empty>

            <Command.Group heading="Views" className="text-xs font-semibold text-slate-500 px-2 mb-2 mt-2">
              <Command.Item 
                onSelect={() => runCommand(() => router.push('/dashboard'))}
                className="flex items-center px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md cursor-pointer text-slate-900 dark:text-gray-100 aria-selected:bg-slate-100 dark:aria-selected:bg-slate-800"
              >
                <LayoutDashboard className="h-4 w-4 mr-3 text-emerald-500" />
                Executive Summary
              </Command.Item>
              <Command.Item 
                onSelect={() => runCommand(() => router.push('/admissions'))}
                className="flex items-center px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md cursor-pointer text-slate-900 dark:text-gray-100 aria-selected:bg-slate-100 dark:aria-selected:bg-slate-800"
              >
                <Activity className="h-4 w-4 mr-3 text-blue-500" />
                Admissions & Capacity
              </Command.Item>
              <Command.Item 
                onSelect={() => runCommand(() => router.push('/revenue'))}
                className="flex items-center px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md cursor-pointer text-slate-900 dark:text-gray-100 aria-selected:bg-slate-100 dark:aria-selected:bg-slate-800"
              >
                <DollarSign className="h-4 w-4 mr-3 text-amber-500" />
                Financial Revenue
              </Command.Item>
              <Command.Item 
                onSelect={() => runCommand(() => router.push('/claims'))}
                className="flex items-center px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md cursor-pointer text-slate-900 dark:text-gray-100 aria-selected:bg-slate-100 dark:aria-selected:bg-slate-800"
              >
                <FileText className="h-4 w-4 mr-3 text-purple-500" />
                Medical Aid Claims (APAC)
              </Command.Item>
              <Command.Item 
                onSelect={() => runCommand(() => router.push('/pharmacy'))}
                className="flex items-center px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md cursor-pointer text-slate-900 dark:text-gray-100 aria-selected:bg-slate-100 dark:aria-selected:bg-slate-800"
              >
                <Syringe className="h-4 w-4 mr-3 text-pink-500" />
                Pharmacy Dispensing
              </Command.Item>
            </Command.Group>

            <Command.Group heading="Data Tools" className="text-xs font-semibold text-slate-500 px-2 mb-2 mt-4">
              <Command.Item 
                onSelect={() => runCommand(() => router.push('/forecast'))}
                className="flex items-center px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md cursor-pointer text-slate-900 dark:text-gray-100 aria-selected:bg-slate-100 dark:aria-selected:bg-slate-800"
              >
                <BrainCircuit className="h-4 w-4 mr-3 text-indigo-500" />
                Machine Learning Forecasts
              </Command.Item>
              <Command.Item 
                onSelect={() => runCommand(() => router.push('/patients'))}
                className="flex items-center px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md cursor-pointer text-slate-900 dark:text-gray-100 aria-selected:bg-slate-100 dark:aria-selected:bg-slate-800"
              >
                <Users className="h-4 w-4 mr-3 text-teal-500" />
                Patient Demographics
              </Command.Item>
            </Command.Group>
          </Command.List>
        </Command>
      </div>
    </div>
  );
}
