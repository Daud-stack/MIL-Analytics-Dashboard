import pandas as pd
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
                    found = False
                    for i, line in enumerate(lines):
                        if keyword.lower() in line.lower():
                            header_idx = i
                            found = True
                            break
                    if not found:
                        # Falling back to row 0 can silently read report
                        # preamble as column headers - make that loud.
                        logger.warning(
                            "Header keyword '%s' not found in first 25 lines of %s; "
                            "reading from row 0 (columns may be wrong)",
                            keyword, file_path
                        )

                df = pd.read_csv(file_path, skiprows=header_idx, encoding=enc,
                               on_bad_lines='skip', low_memory=False)
                df.columns = [str(c).strip() for c in df.columns]
                logger.info(f"Loaded {file_path}: {len(df)} rows")
                return df
            except Exception as e:
                logger.warning(f"Encoding {enc} failed for {file_path}: {e}")
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
