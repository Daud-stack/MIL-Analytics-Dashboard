import pandas as pd

# Check main processed dataset
main_df = pd.read_csv('data_reservoir/processed/final_intelligence_master.csv', nrows=0)
print("=== Main Dataset Columns ===")
print(list(main_df.columns))
print(f"Total columns: {len(main_df.columns)}\n")

# Check submissions data
subs_df = pd.read_csv('data_reservoir/raw/20260123RptSubmissions.csv', nrows=0)
print("=== Submissions Dataset Columns ===")
print(list(subs_df.columns))
print(f"Total columns: {len(subs_df.columns)}\n")

# Check all payments
pay_df = pd.read_csv('data_reservoir/raw/20260129RptAllPayments_AvenuesClinic.csv', nrows=0)
print("=== All Payments Dataset Columns ===")
print(list(pay_df.columns))
print(f"Total columns: {len(pay_df.columns)}")
