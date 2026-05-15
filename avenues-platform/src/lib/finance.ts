import { DashboardMetrics } from '@/types';

export interface FinancialHealth {
  collectionEfficiency: number; // % of total available collected
  collectionRate: number;      // Cash vs Accrual %
  dso: number;                 // Days Sales Outstanding
  badDebtProvision: number;    // Calculated provision
  riskLevel: 'low' | 'medium' | 'high';
  trend: 'improving' | 'stable' | 'deteriorating';
}

export interface SchemeProfitability {
  name: string;
  revenue: number;
  collectionRate: number;
  rejectionRate: number;
  score: number; // 0-100
  category: 'Strategic' | 'Maintain' | 'Investigate' | 'Exit';
}

/**
 * Calculates treasury-level financial health metrics
 */
export function calculateFinancialHealth(metrics: DashboardMetrics | null): FinancialHealth | null {
  if (!metrics || !metrics.debtRecon || metrics.debtRecon.revenue.length < 1) return null;

  const dr = metrics.debtRecon;
  const n = dr.revenue.length;
  
  // Latest Month Data
  const revenue = dr.revenue[n - 1];
  const payments = dr.payments[n - 1];
  const opening = dr.brought[n - 1];
  const closing = dr.total[n - 1];
  
  // 1. Collection Efficiency (Zimbabwe Hospital Standard: how much of available was collected)
  const available = opening + revenue;
  const collectionEfficiency = available > 0 ? (payments / available) * 100 : 0;
  
  // 2. Collection Rate (Periodic Cash-to-Accrual)
  const collectionRate = revenue > 0 ? (payments / revenue) * 100 : 0;
  
  // 3. DSO (Days Sales Outstanding)
  // Formula: (Closing Debt / (Latest 3 Months Average Revenue)) * 30
  const avgRev = n >= 3 
    ? (dr.revenue.slice(-3).reduce((a, b) => a + b, 0) / 3)
    : revenue || 1;
  const dso = (closing / avgRev) * 30;
  
  // 4. Bad Debt Provisioning (Heuristic)
  // 5% of revenue + weighted factor of debt that hasn't moved
  const provision = (revenue * 0.05) + (closing > opening ? (closing - opening) * 0.2 : 0);
  
  // 5. Risk Assessment
  let riskLevel: 'low' | 'medium' | 'high' = 'low';
  if (dso > 60 || collectionRate < 80) riskLevel = 'high';
  else if (dso > 45 || collectionRate < 90) riskLevel = 'medium';
  
  // 6. Trend Analysis
  let trend: 'improving' | 'stable' | 'deteriorating' = 'stable';
  if (n > 1) {
    const prevRate = dr.revenue[n - 2] > 0 ? (dr.payments[n - 2] / dr.revenue[n - 2]) * 100 : 0;
    if (collectionRate > prevRate + 5) trend = 'improving';
    else if (collectionRate < prevRate - 5) trend = 'deteriorating';
  }

  return {
    collectionEfficiency,
    collectionRate,
    dso,
    badDebtProvision: provision,
    riskLevel,
    trend
  };
}

/**
 * Ranks Medical Aid Schemes by profitability/risk
 */
export function analyzeSchemeProfitability(metrics: DashboardMetrics, claims: any): SchemeProfitability[] {
  if (!claims || !claims.byScheme) return [];
  
  return Object.entries(claims.byScheme).map(([name, data]: [string, any]) => {
    const revenue = data.totalClaimed || 0;
    const approved = data.approved || 0;
    const rejected = data.rejected || 0;
    const submitted = data.submitted || 1;
    
    // Heuristic: for medical aids, collection rate is closely tied to approval rate
    const approvalRate = (approved / submitted) * 100;
    const rejectionRate = (rejected / submitted) * 100;
    
    // Score calculation (weighted)
    // 40% Volume, 40% Approval Rate, 20% Low Rejection
    const volumeScore = Math.min(revenue / 500000, 1) * 40; 
    const approvalScore = (approvalRate / 100) * 40;
    const safetyScore = (Math.max(0, 30 - rejectionRate) / 30) * 20;
    
    const score = volumeScore + approvalScore + safetyScore;
    
    let category: SchemeProfitability['category'] = 'Maintain';
    if (score > 80) category = 'Strategic';
    else if (rejectionRate > 20) category = 'Investigate';
    else if (score < 30) category = 'Exit';

    return {
      name,
      revenue,
      collectionRate: approvalRate, // estimated
      rejectionRate,
      score,
      category
    };
  }).sort((a, b) => b.score - a.score);
}
