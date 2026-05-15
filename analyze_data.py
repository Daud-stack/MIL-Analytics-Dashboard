#!/usr/bin/env python3
import pandas as pd
import os

print("=" * 70)
print("MASTER DATA ANALYSIS")
print("=" * 70)

master_path = "data_reservoir/processed/final_intelligence_master.csv"
if os.path.exists(master_path):
    df = pd.read_csv(master_path, nrows=1)
    print(f"\nTotal columns: {len(df.columns)}")
    print("\nAvailable columns:")
    for i, col in enumerate(df.columns, 1):
        print(f"  {i:2}. {col}")
    
    # Now load full data to get sample stats
    df_full = pd.read_csv(master_path, low_memory=False)
    print(f"\nDataset shape: {df_full.shape}")
    print(f"\nData types:")
    for col in df_full.columns:
        print(f"  {col}: {df_full[col].dtype}")
else:
    print(f"ERROR: Master file not found at {master_path}")
    print("\nTrying to run main.py first...")
    os.system("python main.py")
