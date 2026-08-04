"""
Main Pipeline Runner — Data Engineering Lifecycle Orchestrator
Executes: Ingestion -> Kimball Join & Storage -> Pillar Analytics Transformations
"""

import glob
import os
import logging
from modules.ingestion import IngestionEngine
from modules.joiner import HolisticJoiner
from modules.analytics import PillarAnalytics

logger = logging.getLogger("main")
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")


def find_source(pattern: str) -> str:
    """Find most recently modified source file matching pattern across raw reservoir & Trimmed Reports."""
    candidates = []
    for d in ["data_reservoir/raw", "Trimed Reports"]:
        if os.path.exists(d):
            files = glob.glob(os.path.join(d, f"*{pattern}*.csv"))
            candidates.extend(files)

    if not candidates:
        return None
    best = max(candidates, key=os.path.getmtime)
    return os.path.basename(best)


def refresh_pipeline():
    """Execute the full 5-stage Data Engineering Lifecycle pipeline."""
    print("==================================================================")
    print("DATA ENGINEERING PIPELINE REFRESH (Reis & Housley Lifecycle)")
    print("==================================================================")

    ingest = IngestionEngine()

    print("\n[Stage 1 & 2: Ingestion & PII Security]")
    mgt_file = find_source("Management")
    if mgt_file:
        ingest.unpivot_management_dashboard(mgt_file)

    age_file = find_source("creditagdanal") or find_source("Debtors") or find_source("CreditAgdAnal")
    if age_file:
        ingest.process_transactional(age_file, "ageing")

    pay_file = find_source("PaymentsDep") or find_source("AllPayments") or find_source("Payments")
    if pay_file:
        ingest.process_transactional(pay_file, "payments")

    adm_file = find_source("DisPat") or find_source("AdmPerUser") or find_source("Adm")
    if adm_file:
        ingest.process_transactional(adm_file, "admissions")

    dur_file = find_source("Release") or find_source("AdmDur")
    if dur_file:
        ingest.process_transactional(dur_file, "duration")

    print("\n[Stage 3: Kimball Dimensional Storage & Master Join]")
    joiner = HolisticJoiner()
    master_path = joiner.create_master_record()

    print("\n[Stage 4 & 5: SSOT Transformation & Analytics Serving]")
    if master_path:
        PillarAnalytics(master_path).run_analysis()
        print("\n==================================================================")
        print("[SUCCESS] PIPELINE REFRESH SUCCESSFUL — SYSTEM READY")
        print("==================================================================")
    else:
        print("\n[WARNING] Pipeline refresh completed with warnings (no master record generated).")


if __name__ == "__main__":
    refresh_pipeline()
