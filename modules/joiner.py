import pandas as pd
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
