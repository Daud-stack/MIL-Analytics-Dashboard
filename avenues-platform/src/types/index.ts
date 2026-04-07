export const MONTHS = [
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

export const BENCHMARKS = {
  revenueGrowth: 15,
  episodeGrowth: 10,
  theatreUtilization: 75,
  occupancyRate: 80,
  admissionRate: 100,
  pharmacyMargin: 35,
};

export const COLOR_PALETTE = {
  navy: "#0d1f3c",
  teal: "#00b8a0",
  amber: "#f59e0b",
  rose: "#e11d48",
  violet: "#7c3aed",
  gray50: "#f9fafb",
  gray100: "#f3f4f6",
  gray200: "#e5e7eb",
  gray300: "#d1d5db",
  gray400: "#9ca3af",
  gray500: "#6b7280",
  gray600: "#4b5563",
  gray700: "#374151",
  gray800: "#1f2937",
  gray900: "#111827",
};

// Dashboard & Metrics Types - Enhanced
export interface DashboardMetrics {
  year: number;
  totalRevenue: number;
  monthRevenue: number[];
  monthEpisodes: number[];
  admCasualty: number[];
  admDay: number[];
  admInpatient: number[];
  admLab: number[];
  theatreCases: number[];
  theatreMinutes: number[];
  theatreUtil: number[];
  theatrePctOcc: number[];
  pharmacyRx: number[];
  pharmacyRev: number[];
  occupancyBeds: number[];
  patientDays: Record<string, number[]>;
  pctOccWard: Record<string, number[]>;
  patDaysWard: Record<string, number[]>;
  patDaysLOC: Record<string, number[]>;
  occMidnight: number[];
  revLocation: Record<string, number[]>;
  admPerWard: Record<string, number[]>;
  debtRecon: {
    brought: number[];
    revenue: number[];
    payments: number[];
    sundries: number[];
    total: number[];
  };
  casToInpatient: number[];
  epsFinalised: number[];
  dischNotFinalised: number[];
  revPerPatDay: number[];
  gpEthical: number[];
  gpSurgical: number[];
  payments: {
    deposits: number[];
    individual: number[];
    medAid: number[];
    batched: number[];
  };
}

// Location Data Types - Enhanced
export interface LocationData {
  year: number;
  episodes: number;
  monthEpisodes: number[];
  monthRevenue: number[];
  totalRevenue: number;
  doctors: DoctorMetric[];
  icdCodes: Record<string, { count: number; desc: string }>;
  cptCodes: Record<string, { count: number; desc: string }>;
  genders: Record<string, number>;
  ageGroups: Record<string, number>;
  medAids: Record<string, number>;
  specialties: Record<string, number>;
  los: Record<string, number>; // length of stay distribution
  rawRows: Record<string, unknown>[];
}

export interface DoctorMetric {
  name: string;
  specialty: string;
  episodes: number;
  revenue: number;
  avgLOS: number;
  patients: number;
}

// Claims Data Types - Enhanced
export interface ClaimsMetrics {
  year: number;
  totalClaims: number;
  totalClaimed: number;
  submitted: number;
  received: number;
  rejected: number;
  approved: number;
  pending: number;
  byScheme: Record<string, ClaimSchemeData>;
  byStatus: Record<string, number>;
  byMonth: Record<number, number>;
  byDoctor: Record<string, { claims: number; approved: number; amount: number }>;
  totalClaims_monthly: number[];
  approvedClaims_monthly: number[];
  rejectedClaims_monthly: number[];
  pendingClaims_monthly: number[];
  claimAmounts_monthly: number[];
  rejectionReasons: Record<string, number>;
}

export interface ClaimSchemeData {
  totalClaimed: number;
  submitted: number;
  received: number;
  rejected: number;
  approved: number;
  pending: number;
}

// Year data aggregation
export interface YearData {
  year: number;
  dash: DashboardMetrics | null;
  dashboard: DashboardMetrics | null; // alias for consistency
  loc: LocationData | null;
  location: LocationData | null; // alias for consistency
  apac: ClaimsMetrics | null;
  claims: ClaimsMetrics | null; // alias for consistency
}

// User & Auth Types
export interface User {
  id: string;
  email: string;
  name?: string;
  role: "ADMIN" | "ANALYST" | "VIEWER";
  createdAt: Date;
  updatedAt: Date;
}

export interface SessionUser {
  id: string;
  email: string;
  name?: string;
  role: "ADMIN" | "ANALYST" | "VIEWER";
}

// Filter & View State
export interface FilterState {
  years: number[];
  months: number[];
  doctors?: string[];
  locations?: string[];
  specialties?: string[];
  schemes?: string[];
  searchText?: string;
}

export interface ChartConfig {
  title: string;
  description?: string;
  type: "line" | "bar" | "area" | "pie" | "gauge" | "stat";
  dataKey?: string;
  color?: string;
  showLegend?: boolean;
  showTooltip?: boolean;
  showGrid?: boolean;
  responsive?: boolean;
}

export interface StatResult {
  label: string;
  value: number | string;
  change?: number;
  changeType?: "increase" | "decrease" | "neutral";
  unit?: string;
  formatting?: "currency" | "number" | "percent";
}

export interface InsightCard {
  id: string;
  title: string;
  metric: string;
  value: number | string;
  change: number;
  changeType: "increase" | "decrease" | "neutral";
  trend?: "up" | "down" | "flat";
  insight: string;
  dataType: "dashboard" | "location" | "claims";
}

export interface BenchmarkTarget {
  label: string;
  value: number;
  target: number;
  status: "on_track" | "warning" | "critical";
  variance: number;
}

export interface DrillLevel {
  level: "organization" | "location" | "department" | "doctor" | "claim";
  displayName: string;
  dataKey: string;
}

// Data Upload Types
export interface DataUploadFile {
  id: string;
  fileName: string;
  fileType: "DASHBOARD" | "LOCATION" | "CLAIMS";
  year: number;
  month?: number;
  status: "PROCESSING" | "COMPLETE" | "ERROR";
  uploadedBy: string;
  orgId: string;
  createdAt: Date;
}

// API Response Types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
}

// Chart Data Types
export interface ChartDataPoint {
  label: string;
  value: number;
  formatted?: string;
  color?: string;
  meta?: Record<string, unknown>;
}

export type ChartPrimitive = string | number | null | undefined;
export type ChartRecord = Record<string, ChartPrimitive>;

export interface ChartTooltipEntry<TPayload extends ChartRecord = ChartRecord> {
  color?: string;
  name?: string;
  value?: ChartPrimitive;
  dataKey?: string | number;
  payload?: TPayload;
}

export interface ChartTooltipProps<TPayload extends ChartRecord = ChartRecord> {
  active?: boolean;
  label?: string | number;
  payload?: ChartTooltipEntry<TPayload>[];
}

export interface TimeSeriesData {
  month: string;
  value: number;
  comparison?: number;
  trend?: number;
}

export interface ComparisonData {
  category: string;
  current: number;
  previous: number;
  benchmark?: number;
  change: number;
}

// Report Types
export interface ReportConfig {
  title: string;
  description?: string;
  metrics: string[];
  dateRange: {
    start: Date;
    end: Date;
  };
  filters?: FilterState;
  exportFormat?: "pdf" | "xlsx" | "csv";
}

export interface ReportData {
  id: string;
  title: string;
  generatedAt: Date;
  generatedBy: string;
  data: Record<string, unknown>;
  charts: ChartConfig[];
}

// Error Types
export class AppError extends Error {
  constructor(
    public code: string,
    public statusCode: number,
    message: string
  ) {
    super(message);
    this.name = "AppError";
  }
}

// Theme Types
export type Theme = "light" | "dark";

export interface ThemeConfig {
  mode: Theme;
  colors: typeof COLOR_PALETTE;
  spacing: Record<string, string>;
  borderRadius: Record<string, string>;
}

// Notification Types
export interface Notification {
  id: string;
  type: "success" | "error" | "warning" | "info";
  message: string;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

// Data Quality Types
export interface DataQualityIssue {
  severity: 'error' | 'warning' | 'info';
  field: string;
  message: string;
  affectedRows: number;
}

export interface DataQualityReport {
  totalRows: number;
  duplicates: number;
  missingValues: Record<string, number>;
  outliers: Record<string, number[]>;
  score: number; // 0-100
  issues: DataQualityIssue[];
}

// Benchmark Targets
export interface BenchmarkTargets {
  admissions: number;
  occupancy: number; // percentage
  theatreCases: number;
  pharmacyRx: number;
  totalRevenue: number;
  collectionRate: number; // percentage
}

// Store State Type (for Zustand)
export interface StoreState {
  // Data
  years: Map<number, YearData>;
  currentYear: number;
  currentMonth: number;
  compareYears: number[];

  // UI State
  activePage: string;
  theme: Theme;
  sidebarOpen: boolean;
  filters: FilterState;

  // Actions
  setYear: (year: number) => void;
  setMonth: (month: number) => void;
  addYearData: (year: number, data: YearData) => void;
  removeYear: (year: number) => void;
  toggleCompare: (year: number) => void;
  clearCompare: () => void;
  setTheme: (theme: Theme) => void;
  toggleSidebar: () => void;
  setFilters: (filters: FilterState) => void;
  reset: () => void;
}
