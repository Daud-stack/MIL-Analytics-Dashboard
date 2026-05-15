# Avenues Clinic Intelligence Platform - Data Layer

Complete, production-ready data layer for the Next.js healthcare analytics application.

## What's Included

### Core Files (4 Files, 1,462 Lines)

1. **`src/types/index.ts`** (394 lines)
   - Comprehensive TypeScript type definitions
   - All data structures for dashboard, location, and claims
   - Store state interface
   - 32 exports (types, interfaces, constants)

2. **`src/store/index.ts`** (241 lines)
   - Zustand state management with persistence
   - Map-based multi-year data storage
   - 26+ selector and action hooks
   - SSR-safe implementation

3. **`src/lib/sample-data.ts`** (448 lines)
   - Realistic healthcare data generators
   - Seeded PRNG for reproducible hydration
   - Support for 20+ doctors, 15+ ICD codes, 15+ CPT codes
   - Multi-year generation (2024-2026)

4. **`src/lib/parsers.ts`** (379 lines)
   - CSV parsing for Dashboard, Location, and Claims files
   - Intelligent file type detection
   - Export functionality
   - 8 parser functions

### Documentation (2 Files)

1. **`DATA_LAYER_SUMMARY.md`** (12 KB)
   - Architecture and design decisions
   - Detailed type definitions
   - Usage patterns and examples
   - Data flow diagrams

2. **`QUICK_REFERENCE.md`** (8.5 KB)
   - Import patterns
   - 10 common implementation examples
   - TypeScript tips
   - Performance guidance

## Quick Start

### 1. Initialize Store with Sample Data

```typescript
'use client';

import { useEffect } from 'react';
import { useStore } from '@/store';
import { generateSampleData } from '@/lib/sample-data';

export function App() {
  useEffect(() => {
    const data = generateSampleData([2024, 2025, 2026]);
    const store = useStore.getState();
    data.forEach((yearData, year) => {
      store.addYearData(year, yearData);
    });
  }, []);

  return <Dashboard />;
}
```

### 2. Use Data in Components

```typescript
import { useDashboard, useMonthValue, useLocation, useClaims } from '@/store';

export function DashboardCards() {
  const dashboard = useDashboard();
  const location = useLocation();
  const claims = useClaims();

  const revenue = useMonthValue(dashboard?.monthRevenue);
  const episodes = useMonthValue(dashboard?.monthEpisodes);
  const approvalRate = ((claims?.approved || 0) / (claims?.submitted || 1)) * 100;

  return (
    <div>
      <Card title="Revenue" value={`$${(revenue / 1_000_000).toFixed(2)}M`} />
      <Card title="Episodes" value={episodes} />
      <Card title="Claims Approval" value={`${approvalRate.toFixed(1)}%`} />
    </div>
  );
}
```

### 3. Handle CSV Upload

```typescript
import { autoParseCSV } from '@/lib/parsers';
import { useAddYearData } from '@/store';

export function CSVUpload() {
  const addYearData = useAddYearData();

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const text = await file.text();
    const yearData = autoParseCSV(text);
    addYearData(yearData.year, yearData);
  };

  return <input type="file" accept=".csv" onChange={handleFile} />;
}
```

### 4. Implement Year/Month Selection

```typescript
import { useCurrentYear, useCurrentMonth, useSetYear, useSetMonth, MONTHS } from '@/store';

export function Controls() {
  const year = useCurrentYear();
  const month = useCurrentMonth();
  const setYear = useSetYear();
  const setMonth = useSetMonth();

  return (
    <div>
      <select value={year} onChange={(e) => setYear(+e.target.value)}>
        <option value={2024}>2024</option>
        <option value={2025}>2025</option>
        <option value={2026}>2026</option>
      </select>

      <select value={month} onChange={(e) => setMonth(+e.target.value)}>
        <option value={0}>Full Year</option>
        {MONTHS.map((m, i) => (
          <option key={i} value={i}>{m}</option>
        ))}
      </select>
    </div>
  );
}
```

## Data Structure

### DashboardMetrics (Hospital Operations)
- Total and monthly revenue (3M-4.5M per month)
- Admissions: casualty, day, inpatient, lab
- Theatre: cases, minutes, utilization
- Pharmacy: RX count, revenue
- Occupancy: midnight, by ward, by LOC
- Debt reconciliation
- Payment methods breakdown
- 40+ fields total

### LocationData (Point of Care)
- 20+ doctors with specialties
- 15+ ICD codes (diagnoses)
- 15+ CPT codes (procedures)
- 6 specialties
- 5 medical aids/insurance schemes
- 8 age groups
- Gender distribution
- Length of stay distribution

### ClaimsMetrics (Insurance Processing)
- Monthly claim volumes
- Approval rates (75-90%)
- Rejection reasons (7 categories)
- Claims by scheme
- Doctor-level tracking
- Processing times

## Key Features

### Healthcare Realism
- Real ICD-10 diagnosis codes
- Real CPT/HCPCS procedure codes
- Realistic admission types and ward structure
- Medical scheme breakdown
- Doctor specialties with realistic metrics

### Performance
- Selector hooks for granular subscriptions
- Zustand for minimal re-renders
- Seeded PRNG for consistent data
- Custom Map serialization
- SSR-safe implementation

### Type Safety
- Full TypeScript coverage
- No 'any' types
- Comprehensive JSDoc comments
- Proper null handling

### Flexibility
- Multi-year support (2024-2026)
- Month/year filtering
- Year comparison capability
- Auto-detect CSV types
- Export to CSV

## Data Statistics

- **Total Lines**: 1,462
- **Total Exports**: 71
- **Sample Data**:
  - Doctors: 20+
  - ICD Codes: 15+
  - CPT Codes: 15+
  - Specialties: 6
  - Medical Aids: 5
  - Wards: 6
  - Age Groups: 8
  - Years: 3 (2024-2026)

## Integration Checklist

- [ ] Review type definitions in `src/types/index.ts`
- [ ] Initialize store with `generateSampleData()` in root layout
- [ ] Connect dashboard cards to `useDashboard()` hook
- [ ] Connect location tables to `useLocation()` hook
- [ ] Connect claims cards to `useClaims()` hook
- [ ] Wire year selector to `useSetYear()` action
- [ ] Wire month selector to `useSetMonth()` action
- [ ] Implement CSV upload with `autoParseCSV()`
- [ ] Add export feature with `exportYearDataToCSV()`
- [ ] Style components and add theme support
- [ ] Test year-over-year comparison
- [ ] Deploy and monitor

## Documentation

For detailed information, see:
- **`DATA_LAYER_SUMMARY.md`** - Architecture, design decisions, and examples
- **`QUICK_REFERENCE.md`** - Developer guide with 10 common patterns

## Support

All code is fully typed with TypeScript. Use your IDE's intellisense for:
- Auto-complete on store hooks
- Type checking on data access
- Documentation on hover

## License

Part of Avenues Clinic Intelligence Platform
