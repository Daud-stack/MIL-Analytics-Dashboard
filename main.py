import glob
import os
from modules.ingestion import IngestionEngine
from modules.joiner import HolisticJoiner
from modules.analytics import PillarAnalytics


def find(p):
    files = glob.glob(f"data_reservoir/raw/*{p}*.csv")
    if not files:
        return None
    # Pick the most recently modified file, not an arbitrary glob-order one
    return os.path.basename(max(files, key=os.path.getmtime))


def refresh():
    ingest = IngestionEngine()
    print("🚀 Ingesting...")

    if find("Management"):
        ingest.unpivot_management_dashboard(find("Management"))
    if find("Debtors"):
        ingest.process_transactional(find("Debtors"), "ageing")
    if find("AllPayments"):
        ingest.process_transactional(find("AllPayments"), "payments")
    if find("AdmPerUser"):
        ingest.process_transactional(find("AdmPerUser"), "admissions")
    if find("AdmDur"):
        ingest.process_transactional(find("AdmDur"), "duration")

    print("🔗 Joining...")
    master_path = HolisticJoiner().create_master_record()

    print("📊 Analyzing...")
    if master_path:
        PillarAnalytics(master_path).run_analysis()
    print("✅ System Ready.")


if __name__ == "__main__":
    refresh()
