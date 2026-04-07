# Quick Reference - Data Layer Usage

## Import Patterns

### Types
```typescript
import {
  DashboardMetrics,
  LocationData,
  ClaimsMetrics,
  YearData,
  FilterState,
  StoreState,
  MONTHS,
} from '@/types';
```

### Store Hooks
```typescript
import {
  useStore,
  useDashboard,
  useLocation,
  useClaims,
  useCurrentYear,
  useCurrentMonth,
  useMonthValue,
  useCompareYears,
  useSetYear,
} from '@/store';
```

### Data Generation
```typescript
import {
  generateSampleData,
  generateSampleDashboardMetrics,
  generateSampleLocationData,
  generateSampleClaimsData,
} from '@/lib/sample-data';
```

### CSV Parsing
```typescript
import {
  detectFileType,
  autoParseCSV,
  parseDashboardCSV,
  parseLocationCSV,
  parseClaimsCSV,
  detectYear,
  exportToCSV,
  exportYearDataToCSV,
} from '@/lib/parsers';
```

## Common Patterns

### 1. Initialize Store with Demo Data
```typescript
'use client';

import { useEffect } from 'react';
import { useStore, useAddYearData } from '@/store';
import { generateSampleData } from '@/lib/sample-data';

export function DataInitializer() {
  const addYearData = useAddYearData();

  useEffect(() => {
    const data = generateSampleData([2024, 2025, 2026]);
    data.forEach((yearData, year) => {
      addYearData(year, yearData);
    });
  }, [addYearData]);

  return null;
}
```

### 2. Display Monthly Revenue
```typescript
'use client';

import { useDashboard, useMonthValue } from '@/store';

export function RevenueCard() {
  const dashboard = useDashboard();
  const revenue = useMonthValue(dashboard?.monthRevenue);

  return (
    <div className="card">
      <h3>Revenue</h3>
      <p>${(revenue / 1_000_000).toFixed(2)}M</p>
    </div>
  );
}
```

### 3. Year-over-Year Comparison
```typescript
'use client';

import { useYears, useCurrentYear } from '@/store';

export function YoYComparison() {
  const years = useYears();
  const currentYear = useCurrentYear();

  const current = years.get(currentYear);
  const previous = years.get(currentYear - 1);

  const currentRevenue = current?.dashboard?.totalRevenue || 0;
  const previousRevenue = previous?.dashboard?.totalRevenue || 0;
  const change = ((currentRevenue - previousRevenue) / previousRevenue) * 100;

  return <div>YoY Growth: {change.toFixed(1)}%</div>;
}
```

### 4. Handle CSV Upload
```typescript
'use client';

import { useRef } from 'react';
import { autoParseCSV } from '@/lib/parsers';
import { useAddYearData } from '@/store';

export function CSVUpload() {
  const inputRef = useRef<HTMLInputElement>(null);
  const addYearData = useAddYearData();

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const text = await file.text();
    const yearData = autoParseCSV(text);
    addYearData(yearData.year, yearData);
  };

  return (
    <input
      ref={inputRef}
      type="file"
      accept=".csv"
      onChange={handleFile}
    />
  );
}
```

### 5. Display Doctor Performance
```typescript
'use client';

import { useLocation } from '@/store';

export function DoctorsList() {
  const location = useLocation();

  return (
    <table>
      <thead>
        <tr>
          <th>Name</th>
          <th>Specialty</th>
          <th>Episodes</th>
          <th>Revenue</th>
        </tr>
      </thead>
      <tbody>
        {location?.doctors.map((doctor) => (
          <tr key={doctor.name}>
            <td>{doctor.name}</td>
            <td>{doctor.specialty}</td>
            <td>{doctor.episodes}</td>
            <td>${(doctor.revenue / 1000).toFixed(0)}K</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

### 6. Claims Analysis
```typescript
'use client';

import { useClaims } from '@/store';

export function ClaimsOverview() {
  const claims = useClaims();

  const approvalRate =
    ((claims?.approved || 0) / (claims?.submitted || 1)) * 100;

  return (
    <div>
      <p>Total Claims: {claims?.submitted}</p>
      <p>Approved: {claims?.approved}</p>
      <p>Approval Rate: {approvalRate.toFixed(1)}%</p>
      <p>Avg Processing: {claims?.avgProcessingDays} days</p>
    </div>
  );
}
```

### 7. Month Selector
```typescript
'use client';

import { useCurrentMonth, useSetMonth, MONTHS } from '@/store';

export function MonthSelector() {
  const currentMonth = useCurrentMonth();
  const setMonth = useSetMonth();

  return (
    <select value={currentMonth} onChange={(e) => setMonth(+e.target.value)}>
      <option value={0}>Full Year</option>
      {MONTHS.map((month, i) => (
        <option key={i} value={i}>
          {month}
        </option>
      ))}
    </select>
  );
}
```

### 8. Theme Toggle
```typescript
'use client';

import { useTheme, useSetTheme } from '@/store';

export function ThemeToggle() {
  const theme = useTheme();
  const setTheme = useSetTheme();

  return (
    <button
      onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
    >
      {theme === 'light' ? '🌙' : '☀️'}
    </button>
  );
}
```

### 9. Export Data to CSV
```typescript
'use client';

import { useCurrentYearData } from '@/store';
import { exportYearDataToCSV } from '@/lib/parsers';

export function ExportButton() {
  const yearData = useCurrentYearData();

  const handleExport = () => {
    if (!yearData) return;

    const csvFiles = exportYearDataToCSV(yearData);

    Object.entries(csvFiles).forEach(([filename, content]) => {
      const blob = new Blob([content], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    });
  };

  return <button onClick={handleExport}>Export Data</button>;
}
```

### 10. Doctor Comparison
```typescript
'use client';

import { useLocation } from '@/store';

export function DoctorComparison() {
  const location = useLocation();

  // Sort doctors by revenue
  const topDoctors = [...(location?.doctors || [])]
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);

  return (
    <div>
      <h3>Top 5 Doctors by Revenue</h3>
      {topDoctors.map((doctor, i) => (
        <div key={doctor.name}>
          <span>{i + 1}. {doctor.name}</span>
          <span>${(doctor.revenue / 1_000_000).toFixed(2)}M</span>
        </div>
      ))}
    </div>
  );
}
```

## Data Access Patterns

### Full Year Data
```typescript
const dashboard = useDashboard();
const totalRevenue = dashboard?.totalRevenue; // Sum of all months
```

### Single Month Data
```typescript
const dashboard = useDashboard();
const month = useCurrentMonth();
const monthRevenue = dashboard?.monthRevenue[month];
```

### Intelligent Month Access
```typescript
// Returns single month or yearly sum based on currentMonth state
const monthlyRevenue = useMonthValue(dashboard?.monthRevenue);
```

### All Comparison Years
```typescript
const compareYears = useCompareYears(); // [2024, 2025]
const years = useYears();

compareYears.forEach((year) => {
  const data = years.get(year);
  // Process comparison data
});
```

### Ward Data
```typescript
const dashboard = useDashboard();
const wardOccupancy = dashboard?.pctOccWard['ICU']?.[0]; // Jan occupancy
```

### Claims by Scheme
```typescript
const claims = useClaims();
const govtClaims = claims?.byScheme['Government Insurance'];
// { submitted, approved, rejected, amount }
```

## Store State Structure

```typescript
{
  // Data
  years: Map<number, YearData>,
  currentYear: number,
  currentMonth: number, // 0 = full year, 1-11 = specific month
  compareYears: number[],

  // UI
  activePage: string,
  theme: 'light' | 'dark',
  sidebarOpen: boolean,
  filters: {
    years: number[],
    months: number[],
  },

  // Actions...
}
```

## TypeScript Tips

### Type-safe year iteration
```typescript
const years = useYears();
const allData: YearData[] = Array.from(years.values());
```

### Type-safe doctor access
```typescript
const location = useLocation();
const firstDoctor: DoctorMetric = location?.doctors[0]!;
```

### Type-safe claims by doctor
```typescript
const claims = useClaims();
const drSmithClaims: { claims: number; approved: number; amount: number } | undefined
  = claims?.byDoctor['Dr. Smith'];
```

## Performance Tips

1. **Use specific selectors**: `useDashboard()` instead of `useStore()` to avoid unnecessary re-renders
2. **Memoize heavy computations**: Use `useMemo` when processing large arrays
3. **Batch state updates**: Use Zustand's batch API for multiple changes
4. **Lazy load CSV parsing**: Don't parse all files at once
5. **Cache filtered results**: Store computed results in the store if used frequently
