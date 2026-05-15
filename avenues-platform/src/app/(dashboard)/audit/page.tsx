'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Shield, Clock, Upload, LogIn, Download, Globe, Filter, AlertCircle } from 'lucide-react';
import { RoleGuard } from '@/components/auth/role-guard';

interface AuditEntry {
  id: string;
  action: string;
  category: string | null;
  details: string | null;
  userName: string | null;
  createdAt: string;
  ipAddress: string | null;
}

const actionIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  UPLOAD: Upload,
  LOGIN: LogIn,
  EXPORT: Download,
  WEBHOOK: Globe,
  DATA_WRITE: Shield,
};

const actionColors: Record<string, string> = {
  UPLOAD: 'bg-blue-100 text-blue-700',
  LOGIN: 'bg-green-100 text-green-700',
  EXPORT: 'bg-purple-100 text-purple-700',
  WEBHOOK: 'bg-amber-100 text-amber-700',
  DATA_WRITE: 'bg-teal-100 text-teal-700',
  SETTINGS_CHANGE: 'bg-slate-100 text-slate-700',
};

export default function AuditPage() {
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterAction, setFilterAction] = useState<string>('');

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const params = new URLSearchParams({ limit: '100' });
        if (filterAction) params.set('action', filterAction);
        const res = await fetch(`/api/audit?${params.toString()}`);
        if (res.ok) {
          const data = await res.json();
          setLogs(data.logs || []);
        }
      } catch (err) {
        console.error('Failed to fetch audit logs:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchLogs();
  }, [filterAction]);

  const actions = ['UPLOAD', 'LOGIN', 'EXPORT', 'DATA_WRITE', 'WEBHOOK', 'SETTINGS_CHANGE'];

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-ZA', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <RoleGuard allowedRoles={['ADMIN']}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 flex items-center gap-2">
              <Shield className="h-6 w-6 text-teal-600" />
              Audit Trail
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              Complete activity log for compliance and accountability
            </p>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Filter className="h-4 w-4" />
            Filter by action:
          </div>
          <button
            onClick={() => setFilterAction('')}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${
              !filterAction ? 'bg-teal-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            All
          </button>
          {actions.map((a) => (
            <button
              key={a}
              onClick={() => setFilterAction(a)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${
                filterAction === a ? 'bg-teal-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {a.replace('_', ' ')}
            </button>
          ))}
        </div>

        {/* Audit Table */}
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-teal-500 border-t-transparent" />
            </div>
          ) : logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
              <Clock className="h-10 w-10 mb-3 opacity-40" />
              <p className="text-sm font-medium">No audit entries yet</p>
              <p className="text-xs mt-1">Activity will be logged here as users interact with the platform</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-gray-900">Action</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-900">Details</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-900">User</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-900">Time</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-900">IP</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => {
                  const Icon = actionIcons[log.action] || Shield;
                  const color = actionColors[log.action] || 'bg-gray-100 text-gray-700';
                  return (
                    <tr key={log.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${color}`}>
                            <Icon className="h-3 w-3" />
                            {log.action.replace('_', ' ')}
                          </span>
                          {log.category && (
                            <span className="text-xs text-gray-400">{log.category}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-700 max-w-xs truncate">{log.details || '—'}</td>
                      <td className="px-4 py-3 text-gray-600 font-medium">{log.userName || 'System'}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">{formatDate(log.createdAt)}</td>
                      <td className="px-4 py-3 text-gray-400 text-xs font-mono">{log.ipAddress || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </RoleGuard>
  );
}
