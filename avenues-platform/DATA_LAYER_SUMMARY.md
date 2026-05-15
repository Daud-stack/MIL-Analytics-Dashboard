# Avenues Clinic Intelligence Platform - Data Layer Implementation

## Overview

A comprehensive data layer for the Next.js healthcare analytics application has been implemented with realistic data generation, CSV parsing, and state management using Zustand.

## Files Modified/Created

### 1. `/src/types/index.ts` (394 lines)
**Comprehensive TypeScript interfaces** for all data structures:

#### Dashboard Data (RptManagementDashboard.csv)
```typescript
export interface DashboardMetrics {
  year: number;
  totalRevenue: number;
  monthRevenue: number[]; // 12 months
  monthEpisodes: number[];
  admissions: casualty, day, inpatient, lab
  theatre: cases, minutes, utilization
  pharmacy: rx count, revenue
  occupancy: midnight, by ward, by LOC
  debt reconciliation with brought, revenue, payments, sundries
  payments: deposits, individual, medAid, batched
  // + 20+ more fields for comprehensive metrics
}
```

#### Location/LOC Data (CPTStatisticsLOC.csv)
```typescript
export interface LocationData {
  year: number;
  episodes: number;
  totalRevenue: number;
  doctors: DoctorMetric[]; // 20+ doctors with specialty, episodes, revenue, LOS
  icdCodes: Record<string, {count: number; desc: string}>; // 15+ ICD codes
  cptCodes: Record<string, {count: number; desc: string}>; // 15+ CPT codes
  specialties: Record<string, number>; // 6 specialties
  medAids: Record<string, number>; // 5+ medical aids
  ageGroups: Record<string, number>; // 8 age groups
  genders: Record<string, number>;
  los: Record<string, number>; // length of stay distribution
}
```

#### Claims Data (APAC/EDI CSV)
```typescript
export interface ClaimsMetrics {
  year: number;
  totalClaims: number;
  approved/rejected/pending claims and amounts
  byScheme: Record<string, {submitted, approved, rejected, amount}>;
  byDoctor: Record<string, {claims, approved, amount}>;
  rejectionReasons: Record<string, number>; // 7 categories
}
```

#### Year Container
```typescript
export interface YearData {
  year: number;
  dash/dashboard: DashboardMetrics | null;
  loc/location: LocationData | null;
  apac/claims: ClaimsMetrics | null;
}
```

**Additional types:**
- `BenchmarkTargets` - Target metrics for performance tracking
- `DataQualityReport` - Data validation and quality metrics
- `StoreState` - Full Zustand store interface
- All types include proper documentation and comments

### 2. `/src/store/index.ts` (241 lines)
**Zustand store with persistence** and comprehensive helper functions:

#### Core Features:
- Map<number, YearData> for multi-year data storage
- Persist middleware with custom serialization for Map
- Full state management (currentYear, currentMonth, compareYears, theme, sidebar)

#### Data Actions:
```typescript
addYearData(year, data)      // Add year's data
removeYear(year)             // Remove year from store
setYear(year)                // Set current year
setMonth(month)              // Set current month (0 for full year)
toggleCompare(year)          // Toggle year comparison
clearCompare()               // Clear comparison years
```

#### UI Actions:
```typescript
setTheme(theme)              // Light/dark theme toggle
toggleSidebar()              // Sidebar collapse/expand
setFilters(filters)          // Set filter state
reset()                      // Reset to initial state
```

#### Selector Hooks (Performance Optimized):
```typescript
useYears()                   // Get all year data
useCurrentYear()             // Get current year
useCurrentMonth()            // Get current month
useCompareYears()            // Get comparison years
useTheme()                   // Get theme
useSidebarOpen()             // Get sidebar state
useFilters()                 // Get filters

// Convenience selectors
useDashboard()               // Get dashboard for current year
useLocation()                // Get location for current year
useClaims()                  // Get claims for current year
useCurrentYearData()         // Get all data for current year

// Helper selectors
useMonthValue(arr?)          // Get single month or yearly sum
useMonthData(arr?)           // Get month slice or full array
useMonthLabels(abbreviated)  // Get month labels
```

#### Action Hooks:
```typescript
useSetYear()
useSetMonth()
useAddYearData()
useRemoveYear()
useToggleCompare()
useClearCompare()
useSetTheme()
useToggleSidebar()
useSetFilters()
useResetStore()
```

### 3. `/src/lib/sample-data.ts` (448 lines)
**Realistic data generation** with seeded PRNG for reproducibility:

#### Generators:
```typescript
generateSampleDashboardMetrics(year: number): DashboardMetrics
generateSampleLocationData(year: number): LocationData
generateSampleClaimsData(year: number): ClaimsMetrics
generateSampleYearData(year: number): YearData
generateSampleData(years: number[]): Map<number, YearData>
```

#### Features:
- **Seeded PRNG (mulberry32)**: Ensures identical data generation across server/client
- **20+ doctors** with realistic specialties and metrics
- **15+ ICD codes** with descriptions (I10, E11, M79.3, J44.9, etc.)
- **15+ CPT codes** with descriptions (99213, 93000, 71046, etc.)
- **6 specialties**: Cardiology, Orthopedics, Neurology, General Surgery, Pediatrics, Oncology
- **6 wards**: ICU, General Ward, Maternity, Pediatric, Surgical, Medical
- **5 locations of care**: Main Hospital, North Clinic, South Clinic, East Clinic, West Center
- **5 medical aids**: Government Insurance, Private Insurance A/B, Corporate Plan, Self Pay
- **8 age groups**: 0-10, 11-20, 21-30, 31-40, 41-50, 51-60, 61-70, 71+
- **Internally consistent data**: Revenue sums match, episode counts are realistic
- **Multi-year support**: Generate for 2024, 2025, 2026 (enables year-over-year comparisons)

#### Sample Data Ranges:
- Monthly revenue: 3M-4.5M (healthcare facility)
- Monthly episodes: 900-1200
- Theatre cases: 60-100 per month
- Occupancy rates: 65-95%
- Pharmacy RX: 1500-2000 per month
- Claims approval rate: 75-90%
- Average processing time: 8-20 days

### 4. `/src/lib/parsers.ts` (379 lines)
**CSV parsing and export** utilities:

#### File Type Detection:
```typescript
detectFileType(headers, firstRow): 'dashboard' | 'location' | 'claims' | 'unknown'
```
- Uses keyword matching on headers and content
- Smart detection for ambiguous files

#### Parsing Functions:
```typescript
parseDashboardCSV(csvText: string): YearData
parseLocationCSV(csvText: string): YearData
parseClaimsCSV(csvText: string): YearData
autoParseCSV(csvText: string): YearData  // Auto-detect and parse
```

#### Utility Functions:
```typescript
detectYear(csvText: string): number      // Extract year from CSV
normalizeColumnName(name: string): string // Normalize for matching
```

#### Export Functions:
```typescript
exportToCSV(data: Record<string, unknown>[], filename: string): string
exportYearDataToCSV(yearData: YearData): Record<string, string>
```

#### Detection Keywords:
- **Dashboard**: revenue, admission, theatre, pharmacy, occupancy, casualty, ward, bed
- **Location**: doctor, specialty, clinic, icd, cpt, medical aid, age group, los
- **Claims**: claim, approved, rejected, pending, scheme, rejection, edi, apac

## Architecture Highlights

### 1. Type Safety
- Fully typed with TypeScript interfaces
- No `any` types except for raw data operations
- Comprehensive JSDoc comments

### 2. Performance
- Selector hooks for granular subscriptions
- Zustand for minimal re-renders
- Seeded PRNG avoids hydration mismatches
- Custom serialization for Map data type

### 3. Flexibility
- Support for multiple years simultaneously
- Auto-detection of CSV file types
- Flexible month/year filtering
- Year-over-year comparison support

### 4. Data Consistency
- All monthly arrays are exactly 12 elements
- Revenue sums are mathematically consistent
- LOS (length of stay) distributions are realistic
- Medical aid percentages sum appropriately

### 5. Realistic Healthcare Metrics
- ICD-10 codes with real diagnoses
- CPT/HCPCS codes with real procedures
- Medical specialties with realistic episode counts
- Admission types (casualty, day, inpatient, lab)
- Theatre metrics (cases, minutes, utilization)
- Pharmacy metrics (RX count, revenue)
- Payment methods (deposits, individual, medAid, batched)

## Usage Examples

### Initialize Store with Sample Data
```typescript
import { useStore } from '@/store';
import { generateSampleData } from '@/lib/sample-data';

// In your app initialization
const store = useStore();
const sampleData = generateSampleData([2024, 2025, 2026]);
sampleData.forEach((data, year) => {
  store.getState().addYearData(year, data);
});
store.getState().setYear(2026);
```

### Use Dashboard Metrics
```typescript
import { useDashboard, useMonthValue, useCurrentMonth } from '@/store';

function DashboardCard() {
  const dashboard = useDashboard();
  const month = useCurrentMonth();

  const monthlyRevenue = useMonthValue(dashboard?.monthRevenue);
  const monthlyEpisodes = useMonthValue(dashboard?.monthEpisodes);

  return <div>Revenue: ${monthlyRevenue}</div>;
}
```

### Parse CSV File
```typescript
import { autoParseCSV } from '@/lib/parsers';
import { useStore } from '@/store';

function handleFileUpload(csvText: string) {
  const yearData = autoParseCSV(csvText);
  useStore.getState().addYearData(yearData.year, yearData);
}
```

### Year Comparison
```typescript
import { useCompareYears, useYears } from '@/store';

function ComparisonChart() {
  const years = useYears();
  const compareYears = useCompareYears();

  const currentData = years.get(2026);
  const previousData = years.get(2025);

  return <Chart current={currentData} previous={previousData} />;
}
```

## Data Flow

```
CSV File Upload
    ↓
detectFileType() ─ auto-detect format
    ↓
parseDashboardCSV() / parseLocationCSV() / parseClaimsCSV()
    ↓
YearData object
    ↓
useStore.addYearData()
    ↓
Zustand store (persisted to localStorage)
    ↓
React components via selectors (useDashboard, useLocation, etc.)
```

## Key Design Decisions

1. **YearData as container**: Allows components to access all data types for a year with minimal re-renders

2. **Seeded PRNG**: Ensures deterministic data generation - same seed always produces same data, enabling consistent hydration

3. **Map<number, YearData>**: Enables efficient multi-year storage without array iteration

4. **Selector hooks**: Granular subscriptions prevent unnecessary component re-renders

5. **Dual naming**: Both `dashboard`/`dash`, `location`/`loc`, `claims`/`apac` for backward compatibility

6. **Month/Year flexibility**: `currentMonth = 0` means full year, `1-11` means specific month

7. **Keyword-based parsing**: Robust CSV detection without rigid schema requirements

## Files Stats

| File | Lines | Purpose |
|------|-------|---------|
| `src/types/index.ts` | 394 | Type definitions |
| `src/store/index.ts` | 241 | State management |
| `src/lib/sample-data.ts` | 448 | Data generation |
| `src/lib/parsers.ts` | 379 | CSV utilities |
| **Total** | **1462** | **Complete data layer** |

## Next Steps

1. Connect to React components that consume the store
2. Add data validation and quality reporting
3. Implement export functionality to CSV/Excel
4. Add data caching layer for performance
5. Create data migration utilities for schema changes
6. Add real database integration
