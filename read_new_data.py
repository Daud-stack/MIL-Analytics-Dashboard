import pandas as pd
import os
import glob

def summarize_excel(file_path):
    print(f"\n--- Excel File: {file_path} ---")
    try:
        xls = pd.ExcelFile(file_path)
        print(f"Sheets: {xls.sheet_names}")
        for sheet in xls.sheet_names:
            df = pd.read_excel(xls, sheet_name=sheet)
            print(f"Sheet: {sheet} | Rows: {len(df)} | Columns: {list(df.columns)}")
    except Exception as e:
        print(f"Error reading {file_path}: {e}")

def summarize_csvs(folder_path):
    print(f"\n--- CSV Files in {folder_path} ---")
    files = glob.glob(os.path.join(folder_path, "*.csv"))
    for file in files:
        try:
            df = pd.read_csv(file, nrows=5)
            print(f"File: {os.path.basename(file)} | Columns: {list(df.columns)}")
        except Exception as e:
            try:
                # Try reading with different encoding or separator if it's a messy CSV
                df = pd.read_csv(file, nrows=5, sep=None, engine='python')
                print(f"File: {os.path.basename(file)} | Columns: {list(df.columns)}")
            except Exception as e2:
                print(f"Error reading {os.path.basename(file)}: {e2}")

if __name__ == "__main__":
    summarize_excel("Dashboard KPIs 2026 (1).xlsx")
    summarize_csvs("Trimed Reports")
