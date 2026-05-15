'use client';

import React from 'react';
import { useSession } from 'next-auth/react';
import { ShieldAlert } from 'lucide-react';

interface RoleGuardProps {
  allowedRoles: string[];
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function RoleGuard({ allowedRoles, children, fallback }: RoleGuardProps) {
  const { data: session, status } = useSession();

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-teal-500 border-t-transparent" />
      </div>
    );
  }

  const userRole = (session?.user as { role?: string })?.role || 'VIEWER';

  if (!allowedRoles.includes(userRole)) {
    if (fallback) return <>{fallback}</>;

    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-red-200 bg-red-50 p-12 text-center">
        <ShieldAlert className="h-12 w-12 text-red-400 mb-4" />
        <h2 className="text-lg font-semibold text-red-900">Access Restricted</h2>
        <p className="mt-2 text-sm text-red-600 max-w-md">
          You need <strong>{allowedRoles.join(' or ')}</strong> privileges to access this page.
          Contact your administrator for access.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
