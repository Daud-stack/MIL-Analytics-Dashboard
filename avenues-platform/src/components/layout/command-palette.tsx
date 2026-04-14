'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { Command } from 'cmdk';
import { useRouter } from 'next/navigation';
import { Search, LayoutDashboard, FileText, Activity, Users, DollarSign, BrainCircuit, Syringe, Stethoscope, Hash, Settings, Shield } from 'lucide-react';
import { useStore } from '@/store';

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const years = useStore((state) => state.years);
  const currentYear = useStore((state) => state.currentYear);

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

  // Build searchable data items from store
  const dataItems = useMemo(() => {
    const data = years.get(currentYear);
    const items: { type: string; label: string; detail: string; action: () => void }[] = [];

    // Doctors
    if (data?.location?.doctors) {
      data.location.doctors.slice(0, 20).forEach((doc) => {
        items.push({
          type: 'Doctor',
          label: doc.name,
          detail: `${doc.specialty} • ${doc.episodes} episodes`,
          action: () => router.push('/doctors'),
        });
      });
    }

    // ICD Codes
    if (data?.location?.icdCodes) {
      Object.entries(data.location.icdCodes).slice(0, 15).forEach(([code, info]) => {
        items.push({
          type: 'ICD Code',
          label: `${code} — ${info.desc}`,
          detail: `${info.count} occurrences`,
          action: () => router.push('/diagnoses'),
        });
      });
    }

    // Specialties
    if (data?.location?.specialties) {
      Object.entries(data.location.specialties).slice(0, 10).forEach(([spec, count]) => {
        items.push({
          type: 'Specialty',
          label: spec,
          detail: `${count} episodes`,
          action: () => router.push('/search'),
        });
      });
    }

    // Claims schemes
    if (data?.claims?.byScheme) {
      Object.entries(data.claims.byScheme).slice(0, 10).forEach(([scheme, info]) => {
        items.push({
          type: 'Claim Scheme',
          label: scheme,
          detail: `${info.submitted} submitted, ${info.approved} approved`,
          action: () => router.push('/claims'),
        });
      });
    }

    return items;
  }, [years, currentYear, router]);

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
              placeholder="Search views, doctors, diagnoses..." 
            />
            <div className="text-xs text-slate-400 font-mono bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">
              ESC
            </div>
          </div>
          
          <Command.List className="max-h-[400px] overflow-y-auto p-2">
            <Command.Empty className="py-6 text-center text-sm text-slate-500">
              No results found.
            </Command.Empty>

            <Command.Group heading="Pages" className="text-xs font-semibold text-slate-500 px-2 mb-2 mt-2">
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
                Medical Aid Claims
              </Command.Item>
              <Command.Item 
                onSelect={() => runCommand(() => router.push('/pharmacy'))}
                className="flex items-center px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md cursor-pointer text-slate-900 dark:text-gray-100 aria-selected:bg-slate-100 dark:aria-selected:bg-slate-800"
              >
                <Syringe className="h-4 w-4 mr-3 text-pink-500" />
                Pharmacy Dispensing
              </Command.Item>
              <Command.Item 
                onSelect={() => runCommand(() => router.push('/forecast'))}
                className="flex items-center px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md cursor-pointer text-slate-900 dark:text-gray-100 aria-selected:bg-slate-100 dark:aria-selected:bg-slate-800"
              >
                <BrainCircuit className="h-4 w-4 mr-3 text-indigo-500" />
                ML Forecasts
              </Command.Item>
              <Command.Item 
                onSelect={() => runCommand(() => router.push('/settings'))}
                className="flex items-center px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md cursor-pointer text-slate-900 dark:text-gray-100 aria-selected:bg-slate-100 dark:aria-selected:bg-slate-800"
              >
                <Settings className="h-4 w-4 mr-3 text-slate-500" />
                Settings
              </Command.Item>
              <Command.Item 
                onSelect={() => runCommand(() => router.push('/audit'))}
                className="flex items-center px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md cursor-pointer text-slate-900 dark:text-gray-100 aria-selected:bg-slate-100 dark:aria-selected:bg-slate-800"
              >
                <Shield className="h-4 w-4 mr-3 text-slate-500" />
                Audit Trail
              </Command.Item>
            </Command.Group>

            {/* Dynamic Data Search */}
            {dataItems.length > 0 && (
              <Command.Group heading="Data" className="text-xs font-semibold text-slate-500 px-2 mb-2 mt-4">
                {dataItems.map((item, i) => (
                  <Command.Item
                    key={`data-${i}`}
                    value={`${item.type} ${item.label} ${item.detail}`}
                    onSelect={() => runCommand(item.action)}
                    className="flex items-center px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md cursor-pointer text-slate-900 dark:text-gray-100 aria-selected:bg-slate-100 dark:aria-selected:bg-slate-800"
                  >
                    {item.type === 'Doctor' && <Stethoscope className="h-4 w-4 mr-3 text-blue-400" />}
                    {item.type === 'ICD Code' && <Hash className="h-4 w-4 mr-3 text-green-400" />}
                    {item.type === 'Specialty' && <Users className="h-4 w-4 mr-3 text-orange-400" />}
                    {item.type === 'Claim Scheme' && <FileText className="h-4 w-4 mr-3 text-purple-400" />}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm truncate">{item.label}</div>
                      <div className="text-xs text-slate-400 truncate">{item.type} • {item.detail}</div>
                    </div>
                  </Command.Item>
                ))}
              </Command.Group>
            )}
          </Command.List>
        </Command>
      </div>
    </div>
  );
}
