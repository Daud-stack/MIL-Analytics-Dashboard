import BILLING_GROUP_TARIFFS_DATA from "./billing-group-tariffs.json";

export interface TariffItem {
  groupCode: string;
  billingGroup: string;
  code: string;
  description: string;
  baseRateBefore: number;
  baseRateAfter: number;
  unitRateBefore: number;
  unitRateAfter: number;
  approvedTariffUSD: number;
}

export const TARIFF_MASTER_LIST: TariffItem[] = BILLING_GROUP_TARIFFS_DATA as TariffItem[];

/**
 * Composite key lookup: `${billingGroup}:${code}` or `${groupCode}:${code}`
 */
export function getTariffCompositeKey(billingGroup: string, code: string): string {
  return `${billingGroup.toUpperCase().trim()}:${code.toUpperCase().trim()}`;
}

// Build Map for fast composite lookup
export const TARIFF_GROUP_MAP = new Map<string, TariffItem>();

TARIFF_MASTER_LIST.forEach((item) => {
  const keyByName = getTariffCompositeKey(item.billingGroup, item.code);
  const keyByCode = getTariffCompositeKey(item.groupCode, item.code);
  TARIFF_GROUP_MAP.set(keyByName, item);
  TARIFF_GROUP_MAP.set(keyByCode, item);
});

/**
 * Audit a single billing transaction against Tariff Master rates from 20260804RptBillingGroup (1).csv
 */
export function auditBillingTransaction(
  itemCode: string,
  chargedAmount: number,
  quantity: number = 1,
  billingGroup: string = "USD RATE"
): {
  approvedTariff: number;
  deltaPerUnit: number;
  impact: number;
  type: "Overcharged" | "Undercharged" | "Unpriced" | "Compliant";
  matchedGroup: string;
} {
  // 1. Try specific Billing Group lookup first
  let master = TARIFF_GROUP_MAP.get(getTariffCompositeKey(billingGroup, itemCode));

  // 2. Fallback to default "USD RATE" master schedule if no group-specific rate
  let matchedGroup = billingGroup;
  if (!master) {
    master = TARIFF_GROUP_MAP.get(getTariffCompositeKey("USD RATE", itemCode));
    matchedGroup = "USD RATE (Default)";
  }

  if (!master) {
    return {
      approvedTariff: 0.0,
      deltaPerUnit: -chargedAmount,
      impact: -chargedAmount * quantity,
      type: "Unpriced",
      matchedGroup: "None",
    };
  }

  const approvedTariff = master.approvedTariffUSD;
  const deltaPerUnit = chargedAmount - approvedTariff;
  const impact = deltaPerUnit * quantity;

  let type: "Overcharged" | "Undercharged" | "Unpriced" | "Compliant" = "Compliant";
  if (chargedAmount === 0) {
    type = "Unpriced";
  } else if (deltaPerUnit > 1.0) {
    type = "Overcharged";
  } else if (deltaPerUnit < -1.0) {
    type = "Undercharged";
  }

  return {
    approvedTariff,
    deltaPerUnit,
    impact,
    type,
    matchedGroup,
  };
}
