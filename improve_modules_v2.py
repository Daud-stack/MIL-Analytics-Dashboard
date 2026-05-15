#!/usr/bin/env python3
"""Improve all modules with better error handling and logging"""

import os

# INGESTION MODULE
ingestion_code = '''import pandas as pd
import os
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class IngestionEngine:
    """Handles data ingestion from raw CSV files with smart header detection."""
    
    def __init__(self, raw_dir="data_reservoir/raw", processed_dir="data_reservoir/processed"):
        self.raw_dir = raw_dir
        self.processed_dir = processed_dir
        os.makedirs(self.processed_dir, exist_ok=True)
        logger.info(f"IngestionEngine ready: raw={raw_dir}")

    def _smart_read(self, file_path, keyword=None):
        """Smart CSV reader with encoding fallback."""
        encodings = ['utf-8', 'latin1', 'cp1252']
        
        for enc in encodings:
            try:
                with open(file_path, 'r', encoding=enc, errors='ignore') as f:
                    lines = [f.readline() for _ in range(25)]

                header_idx = 0
                if keyword:
                    for i, line in enumerate(lines):
                        if keyword.lower() in line.lower():
                            header_idx = i
                            break

                df = pd.read_csv(file_path, skiprows=header_idx, encoding=enc, 
                               on_bad_lines='skip', low_memory=False)
                df.columns = [str(c).strip() for c in df.columns]
                logger.info(f"Loaded {file_path}: {len(df)} rows")
                return df
            except Exception as e:
                logger.debug(f"Encoding {enc} failed: {e}")
                continue
        
        logger.error(f"Failed to load {file_path}")
        return None

    def unpivot_management_dashboard(self, file_name):
        """Convert management dashboard from wide to long format."""
        df = self._smart_read(os.path.join(self.raw_dir, file_name), keyword="DataSet")
        if df is not None:
            months = ['January', 'February', 'March', 'April', 'May', 'June',
                      'July', 'August', 'September', 'October', 'November', 'December']
            month_cols = [m for m in months if m in df.columns]
            if month_cols:
                df_long = df.melt(id_vars=['DataSet'], value_vars=month_cols,
                                 var_name='Month', value_name='Value')
                df_long.to_csv(os.path.join(self.processed_dir, "summary_master.csv"), index=False)
                return True
        return False

    def process_transactional(self, file_name, type_name):
        """Process transactional data."""
        keyword = "Episode Number" if any(x in file_name for x in ["Debtors", "Adm"]) else "Hospital"
        df = self._smart_read(os.path.join(self.raw_dir, file_name), keyword=keyword)

        if df is not None:
            for col in ['Episode Number', 'Episode Nu']:
                if col in df.columns:
                    df = df.rename(columns={col: 'episode_id'})
                    if 'episode_id' in df.columns:
                        df['episode_id'] = df['episode_id'].astype(str).str.strip().str.upper()
                    break
            df.to_csv(os.path.join(self.processed_dir, f"{type_name}_master.csv"), index=False)
            logger.info(f"Processed {type_name}: {len(df)} records")
            return True
        return False
'''

# JOINER MODULE
joiner_code = '''import pandas as pd
import os
import logging

logger = logging.getLogger(__name__)


class HolisticJoiner:
    """Joins multiple datasets using episode_id as key."""
    
    def __init__(self, processed_dir="data_reservoir/processed"):
        self.processed_dir = processed_dir

    def _safe_merge(self, master_df, join_df, on_key='episode_id', join_cols=None):
        """Safely merge with validation."""
        if join_df is None or join_df.empty:
            logger.warning(f"Skipping merge: join data empty")
            return master_df
        
        try:
            if join_cols:
                join_df = join_df[[on_key] + join_cols].drop_duplicates(on_key)
            result = master_df.merge(join_df, on=on_key, how='left')
            logger.info(f"Merged {len(join_df)} records")
            return result
        except Exception as e:
            logger.error(f"Merge failed: {e}")
            return master_df

    def create_master_record(self):
        """Create master record by joining all datasets."""
        age_path = os.path.join(self.processed_dir, "ageing_master.csv")
        pay_path = os.path.join(self.processed_dir, "payments_master.csv")
        adm_path = os.path.join(self.processed_dir, "admissions_master.csv")
        dur_path = os.path.join(self.processed_dir, "duration_master.csv")

        if not os.path.exists(age_path):
            logger.error(f"Base file missing: {age_path}")
            return None
        
        master = pd.read_csv(age_path, low_memory=False)

        # Join Admissions
        if os.path.exists(adm_path):
            df_adm = pd.read_csv(adm_path, low_memory=False)
            if 'Ward' in df_adm.columns:
                master = self._safe_merge(master, df_adm, join_cols=['Ward'])
                master['Ward'] = master['Ward'].fillna("Unknown Ward")

        # Join Payments
        if os.path.exists(pay_path):
            df_pay = pd.read_csv(pay_path, low_memory=False)
            pay_agg = df_pay.groupby('episode_id').agg({'Amount': 'sum', 'User': 'last'}).rename(
                columns={'Amount': 'Total_Paid', 'User': 'Last_Cashier'}).reset_index()
            master = self._safe_merge(master, pay_agg, 
                                     join_cols=['Total_Paid', 'Last_Cashier'])

        # Join Duration
        if os.path.exists(dur_path):
            df_dur = pd.read_csv(dur_path, low_memory=False)
            dur_agg = df_dur.groupby('episode_id').agg({'Duration (mins)': 'mean', 'User': 'first'}).rename(
                columns={'User': 'Adm_Staff'}).reset_index()
            master = self._safe_merge(master, dur_agg, 
                                     join_cols=['Duration (mins)', 'Adm_Staff'])

        output_path = os.path.join(self.processed_dir, "master_record.csv")
        master.to_csv(output_path, index=False)
        logger.info(f"Master record created: {len(master)} records")
        return output_path
'''

# ANALYTICS MODULE
analytics_code = '''import pandas as pd
import os
import logging

logger = logging.getLogger(__name__)


class PillarAnalytics:
    """Calculates financial metrics, aging, shifts, and collection rates."""
    
    def __init__(self, master_path):
        self.master_path = master_path

    def run_analysis(self):
        """Execute analytical transformations."""
        try:
            df = pd.read_csv(self.master_path, low_memory=False)
            logger.info(f"Analyzing {len(df)} records...")
            
            # Financial metrics
            df['Original Billed'] = pd.to_numeric(df['Original Billed'], errors='coerce').fillna(0)
            df['Total_Paid'] = pd.to_numeric(df['Total_Paid'], errors='coerce').fillna(0)
            df['Total_Paid_To_Date'] = df['Total_Paid']
            df['Collection_Gap'] = df['Original Billed'] - df['Total_Paid']
            
            # Interest loss (15% annual on stagnant debt)
            stagnant = (pd.to_numeric(df['120 Days'], errors='coerce').fillna(0) +
                       pd.to_numeric(df['150+ Days'], errors='coerce').fillna(0))
            df['Monthly_Interest_Loss'] = stagnant * (0.15 / 12)

            # People metrics
            df['Has_Auth'] = df['Medical Aid Number'].notnull().astype(int)

            # Shifts
            if 'Admission Time Start' in df.columns:
                try:
                    df['Admission Time Start'] = pd.to_datetime(
                        df['Admission Time Start'], format='%H:%M:%S', errors='coerce')
                    df['Hour'] = df['Admission Time Start'].dt.hour
                    df['Shift'] = df['Hour'].apply(
                        lambda x: "Night" if x < 6 or x > 22 
                        else ("Morning" if x < 14 else "Afternoon"))
                except:
                    df['Shift'] = 'Unknown'

            # Save output
            df.to_csv("data_reservoir/processed/final_intelligence_master.csv", index=False)
            
            logger.info(f"Analysis complete: {len(df)} episodes processed")
            return df
            
        except Exception as e:
            logger.error(f"Analysis failed: {e}")
            raise
'''

# Write all modules
with open('modules/ingestion.py', 'w', encoding='utf-8') as f:
    f.write(ingestion_code)

with open('modules/joiner.py', 'w', encoding='utf-8') as f:
    f.write(joiner_code)

with open('modules/analytics.py', 'w', encoding='utf-8') as f:
    f.write(analytics_code)

print("OK Improved all module files:")
print("   - Better error handling")
print("   - Added logging throughout")
print("   - Cleaner code structure")
print("   - Safer data operations")
