'use client';

import React, { useState } from 'react';
import { useSession } from 'next-auth/react';
import { Settings, User, Shield, Bell, Building2, Save, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function SettingsPage() {
  const { data: session } = useSession();
  const [activeTab, setActiveTab] = useState('profile');
  const [saved, setSaved] = useState(false);

  const [name, setName] = useState(session?.user?.name || '');
  const [email] = useState(session?.user?.email || '');
  const userRole = (session?.user as { role?: string })?.role || 'VIEWER';
  const orgName = session?.user?.orgName || 'Assigned organization';
  const orgId = session?.user?.orgId || 'Not assigned';

  const [notifUploads, setNotifUploads] = useState(true);
  const [notifAlerts, setNotifAlerts] = useState(true);
  const [notifClaims, setNotifClaims] = useState(false);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const tabs = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'security', label: 'Security', icon: Shield },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'organization', label: 'Organization', icon: Building2 },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 flex items-center gap-2">
          <Settings className="h-6 w-6 text-teal-600" />
          Settings
        </h1>
        <p className="mt-1 text-sm text-gray-500">Manage your account, security, and preferences</p>
      </div>

      <div className="flex gap-6">
        {/* Sidebar Tabs */}
        <div className="w-52 shrink-0">
          <nav className="space-y-1">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition ${
                    activeTab === tab.id
                      ? 'bg-teal-50 text-teal-700 border border-teal-200'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Content */}
        <div className="flex-1 rounded-xl border border-gray-200 bg-white shadow-sm p-6">
          {activeTab === 'profile' && (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold text-gray-900">Profile Information</h2>
              <div className="space-y-4 max-w-md">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                  <input
                    type="email"
                    value={email}
                    disabled
                    className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-500 cursor-not-allowed"
                  />
                  <p className="text-xs text-gray-400 mt-1">Email cannot be changed</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-teal-50 text-teal-700 text-sm font-semibold border border-teal-200">
                    <Shield className="h-3.5 w-3.5" />
                    {userRole}
                  </div>
                </div>
                <Button onClick={handleSave} className="gap-2">
                  {saved ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
                  {saved ? 'Saved!' : 'Save Changes'}
                </Button>
              </div>
            </div>
          )}

          {activeTab === 'security' && (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold text-gray-900">Security</h2>
              <div className="space-y-4 max-w-md">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Current Password</label>
                  <input
                    type="password"
                    placeholder="••••••••"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
                  <input
                    type="password"
                    placeholder="••••••••"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Confirm New Password</label>
                  <input
                    type="password"
                    placeholder="••••••••"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
                <Button onClick={handleSave} className="gap-2">
                  <Shield className="h-4 w-4" />
                  Update Password
                </Button>
              </div>
            </div>
          )}

          {activeTab === 'notifications' && (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold text-gray-900">Notification Preferences</h2>
              <div className="space-y-4">
                {[
                  { label: 'Upload Confirmations', desc: 'Notify when CSV files are successfully processed', value: notifUploads, setter: setNotifUploads },
                  { label: 'Capacity Alerts', desc: 'Warn when ward occupancy exceeds thresholds', value: notifAlerts, setter: setNotifAlerts },
                  { label: 'Claims Rejections', desc: 'Alert when claims rejection rate spikes above average', value: notifClaims, setter: setNotifClaims },
                ].map((pref) => (
                  <div
                    key={pref.label}
                    className="flex items-center justify-between p-4 rounded-lg border border-gray-200 hover:border-teal-200 transition"
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-900">{pref.label}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{pref.desc}</p>
                    </div>
                    <button
                      onClick={() => pref.setter(!pref.value)}
                      className={`relative inline-flex h-6 w-11 rounded-full transition-colors ${
                        pref.value ? 'bg-teal-600' : 'bg-gray-200'
                      }`}
                    >
                      <span
                        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform mt-0.5 ${
                          pref.value ? 'translate-x-5.5 ml-0.5' : 'translate-x-0.5'
                        }`}
                      />
                    </button>
                  </div>
                ))}
                <Button onClick={handleSave} className="gap-2 mt-4">
                  <Save className="h-4 w-4" />
                  Save Preferences
                </Button>
              </div>
            </div>
          )}

          {activeTab === 'organization' && (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold text-gray-900">Organization</h2>
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-6">
                <div className="flex items-center gap-4">
                  <div className="h-14 w-14 rounded-xl bg-teal-100 flex items-center justify-center">
                    <Building2 className="h-7 w-7 text-teal-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">{orgName}</h3>
                    <p className="text-sm text-gray-500">Organization linked to your signed-in account</p>
                  </div>
                </div>
                <div className="mt-6 grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-500">Organization ID</p>
                    <p className="text-sm font-mono text-gray-700 mt-0.5">{orgId}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Role</p>
                    <p className="text-sm font-mono text-gray-700 mt-0.5">{userRole}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Signed-in Email</p>
                    <p className="text-sm font-mono text-gray-700 mt-0.5">{email || 'Unavailable'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Webhook URL</p>
                    <p className="text-sm font-mono text-gray-700 mt-0.5">/api/webhooks/pas</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
