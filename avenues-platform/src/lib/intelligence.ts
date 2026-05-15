import { DashboardMetrics } from '@/types';
import { linearForecast, calculateZScore } from './math-utils';
import { calculateFinancialHealth } from './finance';

export interface IntelligenceFinding {
  id: string;
  type: 'anomaly' | 'trend' | 'benchmark' | 'positive';
  severity: 'low' | 'medium' | 'high';
  title: string;
  description: string;
  metric: string;
  value: string | number;
  change?: number;
  link?: string;
}

/**
 * AI Intelligence Engine
 * Scans dashboard metrics for statistical anomalies, trend breaks, and performance outliers.
 */
export function generateAIInsights(dashboard: DashboardMetrics | null): IntelligenceFinding[] {
  if (!dashboard) return [];
  
  const findings: IntelligenceFinding[] = [];
  const now = new Date();
  const currentMonthIdx = now.getMonth();
  
  // 1. ANOMALY DETECTION (Z-Score)
  // Check Revenue for anomalies
  const revenueFindings = detectAnomalies(dashboard.monthRevenue || [], 'Revenue', 'currency');
  findings.push(...revenueFindings);
  
  // Check Admissions
  const adminFindings = detectAnomalies(dashboard.monthEpisodes || [], 'Admissions', 'number');
  findings.push(...adminFindings);

  // 2. TREND ANALYSIS
  // Check if current month is deviating from linear trend
  if (dashboard.monthRevenue && dashboard.monthRevenue.length >= 4) {
    const historical = dashboard.monthRevenue.slice(0, -1);
    const lastValue = dashboard.monthRevenue[dashboard.monthRevenue.length - 1];
    
    // Simple slope check
    const n = historical.length;
    const avg = historical.reduce((a, b) => a + b, 0) / n;
    
    if (lastValue > avg * 1.4) {
      findings.push({
        id: 'rev-surge',
        type: 'positive',
        severity: 'medium',
        title: 'Significant Revenue Growth',
        description: `Revenue in the latest month is 40%+ above the historical average.`,
        metric: 'Revenue',
        value: lastValue,
        change: ((lastValue - avg) / avg) * 100
      });
    }
  }

  // 3. THEATRE UTILIZATION ALERTS
  if (dashboard.theatreUtil) {
    const avgUtil = dashboard.theatreUtil.reduce((a, b) => a + b, 0) / dashboard.theatreUtil.length;
    const lastUtil = dashboard.theatreUtil[dashboard.theatreUtil.length - 1];
    
    if (lastUtil < 60) {
      findings.push({
        id: 'theatre-low',
        type: 'anomaly',
        severity: 'high',
        title: 'Critical Theatre Underutilization',
        description: `Theatre utilization dropped to ${lastUtil.toFixed(1)}%, well below the 75% target.`,
        metric: 'Theatre Util',
        value: `${lastUtil.toFixed(1)}%`,
        link: '/theatre'
      });
    }
  }

  // 5. TREASURY & LIQUIDITY ALERTS
  const finance = calculateFinancialHealth(dashboard);
  if (finance) {
    if (finance.collectionRate < 85) {
      findings.push({
        id: 'finance-collection-low',
        type: 'anomaly',
        severity: 'high',
        title: 'Liquidity Warning: Low Collection Rate',
        description: `Collections have dropped to ${finance.collectionRate.toFixed(1)}% of billed revenue. Potential cash flow risk.`,
        metric: 'Cash:Accrual',
        value: `${finance.collectionRate.toFixed(1)}%`,
        link: '/treasury'
      });
    }
    
    if (finance.dso > 60) {
      findings.push({
        id: 'finance-dso-high',
        type: 'trend',
        severity: 'medium',
        title: 'Elevated Debtor Cycle',
        description: `Days Sales Outstanding (DSO) has climbed to ${finance.dso.toFixed(0)} days, exceeding the 45-day benchmark.`,
        metric: 'DSO',
        value: `${finance.dso.toFixed(0)} Days`,
        link: '/treasury'
      });
    }
  }

  return findings.sort((a, b) => {
    const sevMap = { high: 0, medium: 1, low: 2 };
    return sevMap[a.severity] - sevMap[b.severity];
  });
}

/**
 * Detect statistical outliers using Z-Score method
 */
function detectAnomalies(data: number[], label: string, type: 'currency' | 'number'): IntelligenceFinding[] {
  if (data.length < 5) return []; // Need enough points for a mean/std
  
  const n = data.length;
  const mean = data.reduce((a, b) => a + b, 0) / n;
  const std = Math.sqrt(data.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / n) || 1;
  
  const outliers: IntelligenceFinding[] = [];
  
  data.forEach((val, i) => {
    const z = (val - mean) / std;
    if (Math.abs(z) > 2.5) {
      outliers.push({
        id: `anomaly-${label}-${i}`,
        type: 'anomaly',
        severity: Math.abs(z) > 3.5 ? 'high' : 'medium',
        title: `Statistical Outlier: ${label}`,
        description: `Data for month ${i + 1} is statistically significant (${z > 0 ? 'higher' : 'lower'} than expected) with a Z-score of ${z.toFixed(2)}.`,
        metric: label,
        value: type === 'currency' ? `$${(val / 1000).toFixed(0)}K` : val
      });
    }
  });
  
  return outliers;
}
