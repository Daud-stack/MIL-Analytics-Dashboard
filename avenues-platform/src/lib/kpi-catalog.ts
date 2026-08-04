/**
 * Authoritative Centralized KPI Catalog & Governance Metadata Repository
 * Defines business formulas, source reports, refresh rates, validation rules,
 * targets, thresholds, and data lineage for all platform metrics.
 */

export interface KPIMetadata {
  id: string;
  name: string;
  module: string;
  businessDefinition: string;
  formula: string;
  sourceReport: string;
  refreshFrequency: "Daily" | "Real-Time (Watcher)" | "Monthly";
  owner: "Chief Medical Officer" | "Chief Financial Officer" | "Revenue Assurance Manager" | "Pharmacy Manager" | "Lab Director";
  targetValue: string;
  warningThreshold: string;
  criticalThreshold: string;
  validationLogic: string;
  dataLineage: string[];
}

export const CENTRAL_KPI_CATALOG: KPIMetadata[] = [
  {
    id: "kpi-rev-total",
    name: "Total Billed Revenue",
    module: "Executive Dashboard / Revenue Center",
    businessDefinition: "Sum of all billed clinical, surgical, ward bed, pharmacy, and diagnostic services across all hospital cost centers.",
    formula: "SUM(FactEpisodes.billed_amount) + SUM(PharmacySales.total) + SUM(CasualtyFees.amount)",
    sourceReport: "20260714RptMonIncRevCen_AvenuesClinic.csv",
    refreshFrequency: "Real-Time (Watcher)",
    owner: "Chief Financial Officer",
    targetValue: "$8,000,000.00 / month",
    warningThreshold: "< $7,200,000.00",
    criticalThreshold: "< $6,500,000.00",
    validationLogic: "Reconciled daily against cashier POS receipts and bank deposits.",
    dataLineage: ["Trimed Reports/20260714RptMonIncRevCen", "IngestionEngine", "fact_episodes.csv", "Executive Revenue Card"],
  },
  {
    id: "kpi-dnfb-value",
    name: "Discharges Not Finalised (DNFB) Revenue",
    module: "Accounts not finalized (DNFB) / Revenue Assurance",
    businessDefinition: "Unreleased revenue locked in patient discharge accounts where medical billing is pending final cashier release statement.",
    formula: "SUM(DischargedEpisodes.unreleased_amount) WHERE statement_released = FALSE",
    sourceReport: "20260714RptManagementDashboard.csv",
    refreshFrequency: "Daily",
    owner: "Revenue Assurance Manager",
    targetValue: "< $2,000,000.00",
    warningThreshold: "> $5,000,000.00",
    criticalThreshold: "> $8,000,000.00",
    validationLogic: "Cross-checked with discharge register and bed release timestamps.",
    dataLineage: ["Trimed Reports/20260714RptManagementDashboard", "IngestionEngine", "fact_episodes.csv", "DNFB Alert Banner"],
  },
  {
    id: "kpi-occ-rate",
    name: "Ward Occupancy Rate (%)",
    module: "Executive Dashboard / MD Dashboard / Occupancy",
    businessDefinition: "Percentage of total licensed hospital beds occupied by inpatients at midnight census.",
    formula: "(MidnightInpatientCount / TotalLicensedBeds) * 100",
    sourceReport: "20260714RptManagementDashboard.csv (Occupancy section)",
    refreshFrequency: "Daily",
    owner: "Chief Medical Officer",
    targetValue: "70.0%",
    warningThreshold: "< 60.0% or > 85.0%",
    criticalThreshold: "< 50.0% or > 95.0%",
    validationLogic: "Cross-verified daily with Ward Bed Register census.",
    dataLineage: ["Trimed Reports/20260714RptManagementDashboard", "IngestionEngine", "dim_wards.csv", "Occupancy Card"],
  },
  {
    id: "kpi-theatre-util",
    name: "Theatre Utilisation Rate (%)",
    module: "MD Dashboard / Revenue Center / Theatre",
    businessDefinition: "Ratio of total surgical procedure minutes utilized to total available operating theatre hours.",
    formula: "(TotalSurgicalProcedureMinutes / TotalAvailableTheatreMinutes) * 100",
    sourceReport: "20260714RptManagementDashboard.csv (Theatre section)",
    refreshFrequency: "Daily",
    owner: "Chief Medical Officer",
    targetValue: "75.0%",
    warningThreshold: "< 65.0%",
    criticalThreshold: "< 55.0%",
    validationLogic: "Compared with Anaesthetist & Surgical logbooks.",
    dataLineage: ["Trimed Reports/20260714RptManagementDashboard", "IngestionEngine", "theatre_master.csv", "Theatre Utilisation Card"],
  },
  {
    id: "kpi-casualty-conv",
    name: "Casualty to Inpatient Conversion Rate (%)",
    module: "MD Dashboard / Admissions / Casualty",
    businessDefinition: "Percentage of emergency casualty patients admitted into inpatient wards for acute care.",
    formula: "(CasualtyPatientsAdmittedToInpatient / TotalCasualtyAttendances) * 100",
    sourceReport: "20260714RptAdmStats.csv & 20260714RptManagementDashboard.csv",
    refreshFrequency: "Daily",
    owner: "Chief Medical Officer",
    targetValue: "15.0%",
    warningThreshold: "< 10.0% or > 25.0%",
    criticalThreshold: "< 5.0% or > 35.0%",
    validationLogic: "Tracked via transition from C-number (casualty) to A-number (inpatient).",
    dataLineage: ["Trimed Reports/20260714RptAdmStats", "IngestionEngine", "dim_patients.csv", "Casualty Card"],
  },
  {
    id: "kpi-capture-delay",
    name: "Average Billing Capture Delay",
    module: "Detailed Billing / Revenue Assurance",
    businessDefinition: "Average elapsed time in days between service delivery timestamp and cashier billing entry.",
    formula: "AVG(DATEDIFF(day, service_timestamp, billing_entry_timestamp))",
    sourceReport: "20260804RptUserBillingDet.csv",
    refreshFrequency: "Real-Time (Watcher)",
    owner: "Revenue Assurance Manager",
    targetValue: "< 2.0 Days",
    warningThreshold: "> 5.0 Days",
    criticalThreshold: "> 10.0 Days",
    validationLogic: "Audit log comparison between clinical order entry and cashier timestamp.",
    dataLineage: ["Trimed Reports/20260804RptUserBillingDet", "IngestionEngine", "user_billing_master.csv", "Capture Delay Card"],
  },
  {
    id: "kpi-stagnant-debt",
    name: "Stagnant Debt (150+ Days)",
    module: "Full Age Analysis / Debtors",
    businessDefinition: "Total unpaid medical accounts receivable outstanding past 150 days from billing date.",
    formula: "SUM(OutstandingBalance) WHERE days_aged > 150",
    sourceReport: "20260718rptcreditagdanal.csv",
    refreshFrequency: "Daily",
    owner: "Chief Financial Officer",
    targetValue: "< $1,000,000.00",
    warningThreshold: "> $3,000,000.00",
    criticalThreshold: "> $5,000,000.00",
    validationLogic: "15% annual opportunity interest loss calculated on stagnant balance.",
    dataLineage: ["Trimed Reports/20260718rptcreditagdanal", "IngestionEngine", "debtors_master.csv", "Stagnant Debt Card"],
  },
  {
    id: "kpi-stock-valuation",
    name: "Total Inventory Valuation",
    module: "Stock Valuation / Management Accounts MANAC",
    businessDefinition: "Combined monetary value of pharmaceutical, surgical, and medical inventory held across all hospital stores.",
    formula: "SUM(StockQuantity * UnitCostPrice) across Main Stores, Mezzanine & CSSD",
    sourceReport: "20260715RptStockValMonthHis.csv",
    refreshFrequency: "Monthly",
    owner: "Pharmacy Manager",
    targetValue: "$1,500,000.00",
    warningThreshold: "> $2,200,000.00 or < $1,000,000.00",
    criticalThreshold: "> $3,000,000.00 or < $700,000.00",
    validationLogic: "Physical stock take counts reconciled monthly against perpetual inventory.",
    dataLineage: ["Trimed Reports/20260715RptStockValMonthHis", "IngestionEngine", "stock_master.csv", "Stock Valuation Card"],
  },
];
