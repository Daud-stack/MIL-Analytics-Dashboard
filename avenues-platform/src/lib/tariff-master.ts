/**
 * Authoritative Tariff Master Price Schedule
 * Source: Revenue assurance June 2026 -v1.xlsx (USD Billing Prices & CIMAS Exception Schedule)
 */

export interface TariffItem {
  code: string;
  description: string;
  category: "Bed Fees" | "Maternity" | "ICU/HDU" | "Casualty & A&E" | "Theatre" | "Pharmacy" | "Consumables";
  approvedTariffUSD: number;
  cimasExceptionUSD?: number;
  effectiveFrom: string;
}

export const TARIFF_MASTER_LIST: TariffItem[] = [
  { code: "2003", description: "PRIVATE WARD", category: "Bed Fees", approvedTariffUSD: 300.00, cimasExceptionUSD: 300.00, effectiveFrom: "2026-01-01" },
  { code: "2013", description: "SINGLE WARD", category: "Bed Fees", approvedTariffUSD: 260.00, cimasExceptionUSD: 260.00, effectiveFrom: "2026-01-01" },
  { code: "2024", description: "TWO BED WARD", category: "Bed Fees", approvedTariffUSD: 140.00, cimasExceptionUSD: 140.00, effectiveFrom: "2026-01-01" },
  { code: "2034", description: "GENERAL WARD 3-5 BEDS", category: "Bed Fees", approvedTariffUSD: 140.00, cimasExceptionUSD: 140.00, effectiveFrom: "2026-01-01" },
  { code: "2044", description: "GENERAL WARD 6 OR MORE BEDS", category: "Bed Fees", approvedTariffUSD: 120.00, cimasExceptionUSD: 120.00, effectiveFrom: "2026-01-01" },
  { code: "2064", description: "PAEDIATRIC WARD", category: "Bed Fees", approvedTariffUSD: 160.00, cimasExceptionUSD: 160.00, effectiveFrom: "2026-01-01" },
  { code: "2074", description: "DAY SURGERY", category: "Bed Fees", approvedTariffUSD: 90.00, cimasExceptionUSD: 90.00, effectiveFrom: "2026-01-01" },

  { code: "2100", description: "VACCINE ADMINISTRATION", category: "Maternity", approvedTariffUSD: 10.00, effectiveFrom: "2026-01-01" },
  { code: "2101", description: "MATERNITY - SINGLE DEL", category: "Maternity", approvedTariffUSD: 170.00, effectiveFrom: "2026-01-01" },
  { code: "2111", description: "MATERNITY - MULTI DEL (1ST BABY)", category: "Maternity", approvedTariffUSD: 170.00, effectiveFrom: "2026-01-01" },
  { code: "2116", description: "MATERNITY - DEL RM MULTI EA SUB", category: "Maternity", approvedTariffUSD: 90.00, effectiveFrom: "2026-01-01" },
  { code: "2120", description: "NEO - NATAL UNIT", category: "Maternity", approvedTariffUSD: 110.00, effectiveFrom: "2026-01-01" },
  { code: "2121", description: "NURSERY FEES", category: "Maternity", approvedTariffUSD: 30.00, effectiveFrom: "2026-01-01" },
  { code: "2131", description: "CIRCUMCISION", category: "Maternity", approvedTariffUSD: 33.92, effectiveFrom: "2026-01-01" },

  { code: "2151", description: "INTENSIVE CARE UNIT (ICU) BED", category: "ICU/HDU", approvedTariffUSD: 380.00, cimasExceptionUSD: 380.00, effectiveFrom: "2026-01-01" },
  { code: "2154", description: "HIGH DEPENDENCY UNIT (HDU) BED", category: "ICU/HDU", approvedTariffUSD: 225.00, cimasExceptionUSD: 225.00, effectiveFrom: "2026-01-01" },
  { code: "2157", description: "TOTAL PARENTAL NUTRITION", category: "ICU/HDU", approvedTariffUSD: 111.30, effectiveFrom: "2026-01-01" },

  { code: "2201", description: "A&E ATTEND+CONSULT (7AM-7PM)", category: "Casualty & A&E", approvedTariffUSD: 63.60, effectiveFrom: "2026-01-01" },
  { code: "2206", description: "A&E - ATTEND+CONSULT -> 15MIN", category: "Casualty & A&E", approvedTariffUSD: 76.32, effectiveFrom: "2026-01-01" },
  { code: "2211", description: "A&E - ATTEND+CONSULT 16 - 45MN", category: "Casualty & A&E", approvedTariffUSD: 93.28, effectiveFrom: "2026-01-01" },
  { code: "2216", description: "A&E ATTEND+CONSULT ->>45MN", category: "Casualty & A&E", approvedTariffUSD: 111.30, effectiveFrom: "2026-01-01" },

  { code: "33333", description: "SURGICAL PACK KIT", category: "Theatre", approvedTariffUSD: 120.00, effectiveFrom: "2026-01-01" },
  { code: "04300", description: "WARD 1 NORTH BED FEE", category: "Bed Fees", approvedTariffUSD: 210.00, effectiveFrom: "2026-01-01" },
  { code: "04495", description: "IV CANNULA INSERTION", category: "Consumables", approvedTariffUSD: 25.00, effectiveFrom: "2026-01-01" },
  { code: "04315", description: "ICU NURSING ATTENDANCE", category: "ICU/HDU", approvedTariffUSD: 85.00, effectiveFrom: "2026-01-01" },
  { code: "05012", description: "ULTRASOUND ABDOMEN", category: "Theatre", approvedTariffUSD: 100.00, effectiveFrom: "2026-01-01" },
  { code: "99001", description: "UNPRICED EMERGENCY CONSUMABLE", category: "Consumables", approvedTariffUSD: 45.00, effectiveFrom: "2026-01-01" },
];

/**
 * Fast Tariff Master Lookup Map keyed by Code
 */
export const TARIFF_MAP = new Map<string, TariffItem>(
  TARIFF_MASTER_LIST.map((item) => [item.code, item])
);

/**
 * Audit a single billing transaction against Tariff Master rates.
 */
export function auditBillingTransaction(
  itemCode: string,
  chargedAmount: number,
  quantity: number = 1
): {
  approvedTariff: number;
  deltaPerUnit: number;
  impact: number;
  type: "Overcharged" | "Undercharged" | "Unpriced" | "Compliant";
} {
  const master = TARIFF_MAP.get(itemCode);
  if (!master) {
    return {
      approvedTariff: 0.0,
      deltaPerUnit: -chargedAmount,
      impact: -chargedAmount * quantity,
      type: "Unpriced",
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
  };
}
