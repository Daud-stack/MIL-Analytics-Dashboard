import pandas as pd

# Read all payments with different approaches
print("=== Checking All Payments Dataset ===\n")

# Try reading as is
try:
    pay_df = pd.read_csv('data_reservoir/raw/20260129RptAllPayments_AvenuesClinic.csv')
    print(f"Shape: {pay_df.shape}")
    print(f"Columns: {list(pay_df.columns)}")
    print(f"\nFirst 5 rows:")
    print(pay_df.head())
except Exception as e:
    print(f"Error: {e}")

# Try with different parameters
print("\n\n=== Trying with different parameters ===")
try:
    pay_df = pd.read_csv('data_reservoir/raw/20260129RptAllPayments_AvenuesClinic.csv', skiprows=1, header=None)
    print(f"Shape: {pay_df.shape}")
    print(f"\nFirst 10 rows:")
    print(pay_df.head(10))
except Exception as e:
    print(f"Error: {e}")
