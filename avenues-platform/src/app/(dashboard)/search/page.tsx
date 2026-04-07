'use client';

import React, { useState, useMemo } from 'react';
import { Search, User, Database, Building2, Hospital, X, TrendingUp, Clock, AlertCircle } from 'lucide-react';
import { useDashboard, useLocation, useClaims } from '@/store';

interface SearchResult {
  id: string;
  name?: string;
  code?: string;
  specialty?: string;
  episodes: number;
  revenue?: number;
  description?: string;
}

interface SearchResults {
  doctors: SearchResult[];
  icd: SearchResult[];
  cpt: SearchResult[];
  specialties: SearchResult[];
}

export default function SearchPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('All');
  const [recentList, setRecentList] = useState<string[]>([]);

  const dashboardData = useDashboard();
  const locationData = useLocation();
  const claimsData = useClaims();

  const isDataLoaded = dashboardData || locationData || claimsData;

  const filters = ['All', 'Doctors', 'ICD Codes', 'CPT Codes', 'Specialties'];

  const searchResults = useMemo<SearchResults>(() => {
    if (!searchQuery.trim() || !isDataLoaded) {
      return { doctors: [], icd: [], cpt: [], specialties: [] };
    }

    const query = searchQuery.toLowerCase();
    const results: SearchResults = { doctors: [], icd: [], cpt: [], specialties: [] };

    // Search location data for doctors
    if (locationData?.doctors) {
      results.doctors = locationData.doctors
        .filter((d) =>
          d.name.toLowerCase().includes(query) || d.specialty.toLowerCase().includes(query)
        )
        .map((d, idx) => ({
          id: `doc-${idx}`,
          name: d.name,
          specialty: d.specialty,
          episodes: d.episodes,
          revenue: d.revenue,
        }));
    }

    // Search location data for ICD codes
    if (locationData?.icdCodes) {
      results.icd = Object.entries(locationData.icdCodes)
        .filter(([code, data]) =>
          code.toLowerCase().includes(query) || data.desc.toLowerCase().includes(query)
        )
        .map(([code, data]) => ({
          id: `icd-${code}`,
          code,
          name: data.desc,
          episodes: data.count,
        }));
    }

    // Search location data for CPT codes
    if (locationData?.cptCodes) {
      results.cpt = Object.entries(locationData.cptCodes)
        .filter(([code, data]) =>
          code.toLowerCase().includes(query) || data.desc.toLowerCase().includes(query)
        )
        .map(([code, data]) => ({
          id: `cpt-${code}`,
          code,
          name: data.desc,
          episodes: data.count,
        }));
    }

    // Search location data for specialties
    if (locationData?.specialties) {
      results.specialties = Object.entries(locationData.specialties)
        .filter(([specialty]) => specialty.toLowerCase().includes(query))
        .map(([specialty, count]) => ({
          id: `spec-${specialty}`,
          name: specialty,
          episodes: count,
        }));
    }

    return results;
  }, [searchQuery, locationData, isDataLoaded]);

  const filteredResults = useMemo<SearchResults>(() => {
    const allResults: SearchResults = { doctors: [], icd: [], cpt: [], specialties: [] };

    if (selectedFilter === 'All' || selectedFilter === 'Doctors') {
      allResults.doctors = searchResults.doctors;
    }
    if (selectedFilter === 'All' || selectedFilter === 'ICD Codes') {
      allResults.icd = searchResults.icd;
    }
    if (selectedFilter === 'All' || selectedFilter === 'CPT Codes') {
      allResults.cpt = searchResults.cpt;
    }
    if (selectedFilter === 'All' || selectedFilter === 'Specialties') {
      allResults.specialties = searchResults.specialties;
    }

    return allResults;
  }, [searchResults, selectedFilter]);

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    if (query.trim() && !recentList.includes(query)) {
      setRecentList([query, ...recentList.slice(0, 4)]);
    }
  };

  const totalResults =
    filteredResults.doctors.length +
    filteredResults.icd.length +
    filteredResults.cpt.length +
    filteredResults.specialties.length;

  const hasResults = totalResults > 0;
  const showRecent = !searchQuery.trim();

  if (!isDataLoaded) {
    return (
      <div className="space-y-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Universal Search</h1>
            <p className="mt-1 text-sm text-gray-600">Find doctors, diagnoses, and procedures</p>
          </div>
        </div>
        <div className="flex flex-col items-center justify-center rounded-xl border border-gray-200 bg-white p-12 text-center shadow-sm">
          <AlertCircle className="h-12 w-12 text-gray-300 mb-4" />
          <h2 className="text-lg font-semibold text-gray-900">No Data Loaded</h2>
          <p className="mt-2 text-sm text-gray-500 max-w-md">Upload CSV data to see analytics.</p>
          <a href="/upload" className="mt-4 text-sm font-medium text-teal-600 hover:text-teal-700">Go to Upload →</a>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Universal Search</h1>
        <p className="mt-1 text-sm text-gray-600">Find doctors, diagnoses, procedures, and specialties</p>
      </div>

      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-4 top-4 h-5 w-5 text-gray-400" />
        <input
          type="text"
          placeholder="Search by doctor name, diagnosis code, procedure, specialty..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-12 pr-4 py-3 rounded-xl border border-gray-200 text-base focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-100"
        />
      </div>

      {/* Filter Pills */}
      <div className="flex gap-2 flex-wrap">
        {filters.map((filter) => (
          <button
            key={filter}
            onClick={() => setSelectedFilter(filter)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
              selectedFilter === filter
                ? 'bg-teal-600 text-white shadow-sm'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {filter}
          </button>
        ))}
      </div>

      {/* Results Count */}
      {searchQuery && (
        <p className="text-sm text-gray-600">
          Found <span className="font-semibold text-gray-900">{totalResults}</span> result
          {totalResults !== 1 ? 's' : ''}
        </p>
      )}

      {/* Main Content */}
      <div className="grid gap-8 lg:grid-cols-3">
        {/* Results Section */}
        <div className="lg:col-span-2 space-y-6">
          {!searchQuery && (
            <div className="rounded-xl border border-gray-200 bg-white p-6 text-center">
              <Search className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-600">Start typing to search across the platform</p>
            </div>
          )}

          {searchQuery && !hasResults && (
            <div className="rounded-xl border border-gray-200 bg-white p-6 text-center">
              <Database className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-600">No results found for &quot;{searchQuery}&quot;</p>
              <p className="text-sm text-gray-500 mt-2">Try searching with different keywords</p>
            </div>
          )}

          {/* Doctors Results */}
          {filteredResults.doctors.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-3">Doctors ({filteredResults.doctors.length})</h2>
              <div className="space-y-3">
                {filteredResults.doctors.map((doctor) => (
                  <div
                    key={doctor.id}
                    className="rounded-lg border border-gray-200 bg-white p-4 hover:shadow-md hover:border-teal-300 transition cursor-pointer"
                  >
                    <div className="flex items-start gap-3">
                      <div className="bg-blue-50 p-2 rounded-lg flex-shrink-0">
                        <User className="h-5 w-5 text-blue-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-gray-900">{doctor.name}</h3>
                        <p className="text-sm text-gray-600">{doctor.specialty}</p>
                        <div className="flex gap-4 mt-2 text-xs text-gray-500">
                          <span className="flex items-center gap-1">
                            <TrendingUp className="h-3 w-3" /> {doctor.episodes} episodes
                          </span>
                          {doctor.revenue && (
                            <span className="flex items-center gap-1">
                              <span className="font-medium">Rs {(doctor.revenue / 100000).toFixed(1)}L</span>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ICD Codes Results */}
          {filteredResults.icd.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-3">ICD Codes ({filteredResults.icd.length})</h2>
              <div className="space-y-3">
                {filteredResults.icd.map((icd) => (
                  <div
                    key={icd.id}
                    className="rounded-lg border border-gray-200 bg-white p-4 hover:shadow-md hover:border-teal-300 transition cursor-pointer"
                  >
                    <div className="flex items-start gap-3">
                      <div className="bg-green-50 p-2 rounded-lg flex-shrink-0">
                        <Database className="h-5 w-5 text-green-600" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono font-semibold text-gray-700 bg-gray-100 px-2 py-1 rounded">
                            {icd.code}
                          </span>
                          <h3 className="font-semibold text-gray-900">{icd.name}</h3>
                        </div>
                        <p className="text-xs text-gray-600 mt-1">
                          <TrendingUp className="h-3 w-3 inline mr-1" />
                          {icd.episodes} episodes
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* CPT Codes Results */}
          {filteredResults.cpt.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-3">CPT Codes ({filteredResults.cpt.length})</h2>
              <div className="space-y-3">
                {filteredResults.cpt.map((cpt) => (
                  <div
                    key={cpt.id}
                    className="rounded-lg border border-gray-200 bg-white p-4 hover:shadow-md hover:border-teal-300 transition cursor-pointer"
                  >
                    <div className="flex items-start gap-3">
                      <div className="bg-purple-50 p-2 rounded-lg flex-shrink-0">
                        <Database className="h-5 w-5 text-purple-600" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono font-semibold text-gray-700 bg-gray-100 px-2 py-1 rounded">
                            {cpt.code}
                          </span>
                          <h3 className="font-semibold text-gray-900">{cpt.name}</h3>
                        </div>
                        <p className="text-xs text-gray-600 mt-1">
                          <TrendingUp className="h-3 w-3 inline mr-1" />
                          {cpt.episodes} episodes
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Specialties Results */}
          {filteredResults.specialties.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-3">Specialties ({filteredResults.specialties.length})</h2>
              <div className="space-y-3">
                {filteredResults.specialties.map((specialty) => (
                  <div
                    key={specialty.id}
                    className="rounded-lg border border-gray-200 bg-white p-4 hover:shadow-md hover:border-teal-300 transition cursor-pointer"
                  >
                    <div className="flex items-start gap-3">
                      <div className="bg-orange-50 p-2 rounded-lg flex-shrink-0">
                        <Building2 className="h-5 w-5 text-orange-600" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900">{specialty.name}</h3>
                        <div className="flex gap-4 mt-1 text-xs text-gray-600">
                          <span>{specialty.episodes} episodes</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar - Recent Searches */}
        <div className="space-y-6">
          {/* Recent Searches */}
          {recentList.length > 0 && (
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <Clock className="h-4 w-4 text-gray-400" />
                Recent Searches
              </h3>
              <div className="space-y-2">
                {recentList.map((search, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSearch(search)}
                    className="w-full text-left px-3 py-2 rounded-lg hover:bg-gray-50 text-sm text-gray-700 font-medium transition"
                  >
                    {search}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Quick Suggestions */}
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Quick Links</h3>
            <div className="space-y-2">
              {['Top Doctors', 'Common Diagnoses', 'All Wards', 'Specialties'].map((item, idx) => (
                <button
                  key={idx}
                  className="w-full text-left px-3 py-2 rounded-lg hover:bg-teal-50 text-sm text-gray-700 font-medium transition hover:text-teal-700"
                >
                  {item}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
