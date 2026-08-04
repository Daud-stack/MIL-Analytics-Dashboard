import pandas as pd
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
                    df['Hour'] = df['Admission Time Start'].apply(lambda x: x.hour if pd.notna(x) else None)
                    df['Shift'] = df['Hour'].apply(
                        lambda x: "Night" if pd.notna(x) and (x < 6 or x > 22)
                        else ("Morning" if pd.notna(x) and x < 14 else "Afternoon"))
                except Exception as e:
                    logger.warning(f"Shift derivation failed, defaulting to 'Unknown': {e}")
                    df['Shift'] = 'Unknown'

            # Save output alongside the master file it was derived from
            output_path = os.path.join(
                os.path.dirname(self.master_path) or "data_reservoir/processed",
                "final_intelligence_master.csv"
            )
            df.to_csv(output_path, index=False)
            
            logger.info(f"Analysis complete: {len(df)} episodes processed")
            return df
            
        except Exception as e:
            logger.error(f"Analysis failed: {e}")
            raise
