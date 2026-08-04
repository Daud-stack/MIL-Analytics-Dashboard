/**
 * Authoritative Tariff Master Price Schedule — Mapped Per Billing Group
 * Source: Revenue assurance June 2026 -v1.xlsx & tariff-template-usd-billing-group.csv
 *
 * Mappings are specific to Billing Group (e.g., "USD RATE", "CIMAS USD", "ALLIANCE USD", "FIRST MUTUAL USD", "FBC HEALTH", "FLIMAS USD")
 */

export interface TariffItem {
  code: string;
  billingGroup: string;
  description: string;
  category: "Bed Fees" | "Maternity" | "ICU/HDU" | "Casualty & A&E" | "Theatre" | "Pharmacy" | "Consumables";
  approvedTariffUSD: number;
  effectiveFrom: string;
}

export const TARIFF_MASTER_LIST: TariffItem[] = [
  // 1. CIMAS USD Billing Group Tariffs & Exception Schedule
  { code: "2003", billingGroup: "CIMAS USD", description: "PRIVATE WARD", category: "Bed Fees", approvedTariffUSD: 300.00, effectiveFrom: "2026-01-01" },
  { code: "2013", billingGroup: "CIMAS USD", description: "SINGLE WARD", category: "Bed Fees", approvedTariffUSD: 260.00, effectiveFrom: "2026-01-01" },
  { code: "2024", billingGroup: "CIMAS USD", description: "TWO BED WARD", category: "Bed Fees", approvedTariffUSD: 140.00, effectiveFrom: "2026-01-01" },
  { code: "2034", billingGroup: "CIMAS USD", description: "GENERAL WARD 3-5 BEDS", category: "Bed Fees", approvedTariffUSD: 140.00, effectiveFrom: "2026-01-01" },
  { code: "2151", billingGroup: "CIMAS USD", description: "INTENSIVE CARE UNIT (ICU) BED", category: "ICU/HDU", approvedTariffUSD: 380.00, effectiveFrom: "2026-01-01" },
  { code: "2154", billingGroup: "CIMAS USD", description: "HIGH DEPENDENCY UNIT (HDU) BED", category: "ICU/HDU", approvedTariffUSD: 225.00, effectiveFrom: "2026-01-01" },
  { code: "33333", billingGroup: "CIMAS USD", description: "SURGICAL PACK KIT", category: "Theatre", approvedTariffUSD: 120.00, effectiveFrom: "2026-01-01" },

  // 2. FIRST MUTUAL USD Billing Group Tariffs
  { code: "04300", billingGroup: "FIRST MUTUAL USD", description: "WARD 1 NORTH BED FEE", category: "Bed Fees", approvedTariffUSD: 210.00, effectiveFrom: "2026-01-01" },
  { code: "2003", billingGroup: "FIRST MUTUAL USD", description: "PRIVATE WARD", category: "Bed Fees", approvedTariffUSD: 290.00, effectiveFrom: "2026-01-01" },

  // 3. ALLIANCE HEALTH USD Billing Group Tariffs
  { code: "04495", billingGroup: "ALLIANCE HEALTH", description: "IV CANNULA INSERTION", category: "Consumables", approvedTariffUSD: 25.00, effectiveFrom: "2026-01-01" },
  { code: "2003", billingGroup: "ALLIANCE HEALTH", description: "PRIVATE WARD", category: "Bed Fees", approvedTariffUSD: 310.00, effectiveFrom: "2026-01-01" },

  // 4. FBC HEALTH Billing Group Tariffs
  { code: "04315", billingGroup: "FBC HEALTH", description: "ICU NURSING ATTENDANCE", category: "ICU/HDU", approvedTariffUSD: 85.00, effectiveFrom: "2026-01-01" },

  // 5. FLIMAS USD Billing Group Tariffs
  { code: "99001", billingGroup: "FLIMAS USD", description: "UNPRICED EMERGENCY CONSUMABLE", category: "Consumables", approvedTariffUSD: 45.00, effectiveFrom: "2026-01-01" },

  // 6. BONVIE MEDICAL Billing Group Tariffs
  { code: "05012", billingGroup: "BONVIE MEDICAL", description: "ULTRASOUND ABDOMEN", category: "Theatre", approvedTariffUSD: 100.00, effectiveFrom: "2026-01-01" },

  // 7. General USD RATE Master Schedule Fallbacks
  { code: "2003", billingGroup: "USD RATE", description: "PRIVATE WARD", category: "Bed Fees", approvedTariffUSD: 300.00, effectiveFrom: "2026-01-01" },
  { code: "2013", billingGroup: "USD RATE", description: "SINGLE WARD", category: "Bed Fees", approvedTariffUSD: 260.00, effectiveFrom: "2026-01-01" },
  { code: "2024", billingGroup: "USD RATE", description: "TWO BED WARD", category: "Bed Fees", approvedTariffUSD: 140.00, effectiveFrom: "2026-01-01" },
  { code: "2034", billingGroup: "USD RATE", description: "GENERAL WARD 3-5 BEDS", category: "Bed Fees", approvedTariffUSD: 140.00, effectiveFrom: "2026-01-01" },
  { code: "2044", billingGroup: "USD RATE", description: "GENERAL WARD 6 OR MORE BEDS", category: "Bed Fees", approvedTariffUSD: 120.00, effectiveFrom: "2026-01-01" },
  { code: "2064", billingGroup: "USD RATE", description: "PAEDIATRIC WARD", category: "Bed Fees", approvedTariffUSD: 160.00, effectiveFrom: "2026-01-01" },
  { code: "2074", billingGroup: "USD RATE", description: "DAY SURGERY", category: "Bed Fees", approvedTariffUSD: 90.00, effectiveFrom: "2026-01-01" },
  { code: "2100", billingGroup: "USD RATE", description: "VACCINE ADMINISTRATION", category: "Maternity", approvedTariffUSD: 10.00, effectiveFrom: "2026-01-01" },
  { code: "2101", billingGroup: "USD RATE", description: "MATERNITY - SINGLE DEL", category: "Maternity", approvedTariffUSD: 170.00, effectiveFrom: "2026-01-01" },
  { code: "2151", billingGroup: "USD RATE", description: "INTENSIVE CARE UNIT (ICU) BED", category: "ICU/HDU", approvedTariffUSD: 380.00, effectiveFrom: "2026-01-01" },
  { code: "2154", billingGroup: "USD RATE", description: "HIGH DEPENDENCY UNIT (HDU) BED", category: "ICU/HDU", approvedTariffUSD: 225.00, effectiveFrom: "2026-01-01" },
  { code: "2201", billingGroup: "USD RATE", description: "A&E ATTEND+CONSULT (7AM-7PM)", category: "Casualty & A&E", approvedTariffUSD: 63.60, effectiveFrom: "2026-01-01" },
];

/**
 * Composite key lookup: `${billingGroup}:${code}`
 */
export function getTariffCompositeKey(billingGroup: string, code: string): string {
  return `${billingGroup.toUpperCase().trim()}:${code.toUpperCase().trim()}`;
}

export const TARIFF_GROUP_MAP = new Map<string, TariffItem>(
  TARIFF_MASTER_LIST.map((item) => [getTariffCompositeKey(item.billingGroup, item.code), item])
);

/**
 * Audit a single billing transaction against Tariff Master rates for a SPECIFIC Billing Group.
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
