"""
Pillar Analytics & Single Source of Truth (SSOT) Metrics Engine (Phase 4 & 5: Transformation & Serving)
Derived from: Fundamentals of Data Engineering (Reis & Housley)

Features:
- Single Source of Truth (SSOT) financial metrics (Collection Gap, Interest Loss, Collection Rate %)
- Automated Shift Derivation (Night: <6am/>10pm, Morning: 6am–2pm, Afternoon: 2pm–10pm)
- Categorical Memory Downcasting & High Performance Storage
- Data Quality Scorecard Computation
"""

import os
import logging
import pandas as pd
import numpy as np

logger = logging.getLogger("engine.analytics")


class PillarAnalytics:
    """Calculates Single Source of Truth (SSOT) healthcare metrics, aging, shifts, and quality scores."""

    def __init__(self, master_path: str):
        self.master_path = master_path

    def run_analysis(self) -> pd.DataFrame:
        """Execute analytical transformations and output final_intelligence_master.csv."""
        if not os.path.exists(self.master_path):
            logger.error(f"Analytics input master path not found: {self.master_path}")
            return None

        try:
            df = pd.read_csv(self.master_path, low_memory=False)
            logger.info(f"Running Pillar Analytics on {len(df):,} records...")

            # 1. Financial SSOT Calculations
            for col in ["Original Billed", "Total_Paid", "Total_Paid_To_Date", "Current", "30 Days", "60 Days", "90 Days", "120 Days", "150+ Days"]:
                if col in df.columns:
                    df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0)

            if "Original Billed" in df.columns:
                df["Total_Paid_To_Date"] = df["Total_Paid"] if "Total_Paid" in df.columns else 0
                df["Collection_Gap"] = df["Original Billed"] - df["Total_Paid_To_Date"]
                df["Collection_Rate_Pct"] = np.where(
                    df["Original Billed"] > 0,
                    (df["Total_Paid_To_Date"] / df["Original Billed"]) * 100,
                    0
                )

            # 2. Stagnant Debt Interest Loss (15% annual on 120+ days aging)
            stagnant_cols = [c for c in ["120 Days", "150+ Days"] if c in df.columns]
            if stagnant_cols:
                stagnant_sum = df[stagnant_cols].sum(axis=1)
                df["Monthly_Interest_Loss"] = stagnant_sum * (0.15 / 12)
            else:
                df["Monthly_Interest_Loss"] = 0.0

            # 3. People & Medical Aid Authorization Flag
            if "Medical Aid Name" in df.columns:
                df["Has_Auth"] = df["Medical Aid Name"].notnull().astype(int)
            else:
                df["Has_Auth"] = 0

            # 4. Shift Derivation
            if "Admission Time Start" in df.columns or "Adm Time" in df.columns:
                time_col = "Admission Time Start" if "Admission Time Start" in df.columns else "Adm Time"
                try:
                    time_series = pd.to_datetime(df[time_col], format="%H:%M:%S", errors="coerce")
                    hours = time_series.dt.hour
                    df["Hour"] = hours
                    df["Shift"] = np.where(
                        hours.isna(), "Unknown",
                        np.where((hours < 6) | (hours >= 22), "Night",
                        np.where(hours < 14, "Morning", "Afternoon"))
                    )
                except Exception as e:
                    logger.warning(f"Shift calculation warning: {e}")
                    df["Shift"] = "Unknown"

            # 5. Memory Optimization via Categoricals
            for col in ["Ward", "Shift", "Medical Aid Name", "Last_Cashier", "Adm_Staff"]:
                if col in df.columns:
                    df[col] = df[col].astype("category")

            # 6. Save Final Intelligence Master
            out_dir = os.path.dirname(self.master_path) or "data_reservoir/processed"
            out_path = os.path.join(out_dir, "final_intelligence_master.csv")
            df.to_csv(out_path, index=False)

            logger.info(f"Pillar Analytics complete: {len(df):,} records written to {out_path}")
            return df

        except Exception as e:
            logger.error(f"Pillar Analytics execution failed: {e}")
            raise
