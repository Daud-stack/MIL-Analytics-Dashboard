"""Constants, paths and shared logger for the MIL dashboard."""

import json
import csv
import logging

logger = logging.getLogger("dashboard")


target_collection = 90  # Target collection rate (%)


MONTH_ORDER = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
]


REQUIRED_COLUMNS = [
    "Original Billed",
    "Total_Paid_To_Date",
    "Collection_Gap",
    "Ward",
]


KEY_QUALITY_COLUMNS = [
    "Original Billed",
    "Total_Paid_To_Date",
    "Collection_Gap",
    "Monthly_Interest_Loss",
]


CPT_STATS_PATH = "data_reservoir/raw/20260120CPTStatisticsLOC.csv"


UNIVERSAL_SESSION_STORE_PATH = "data_reservoir/processed/universal_session_store.json"


DATA_REGISTRY_PATH = "data_reservoir/processed/app_dataset_registry.json"


DEFAULT_DATA_REGISTRY = {
    "master": "data_reservoir/processed/final_intelligence_master.csv",
    "management": "data_reservoir/raw/20260126RptManagementDashboard.csv",
    "payments": "data_reservoir/raw/20260129RptAllPayments_AvenuesClinic.csv",
    "admissions_user": "data_reservoir/raw/20260129RptAdmPerUser.csv",
    "admissions_duration": "data_reservoir/raw/20260129RptAdmDurPerUser.csv",
    "cpt": "data_reservoir/raw/20260120CPTStatisticsLOC.csv"
}
