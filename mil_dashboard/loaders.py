"""File IO: header detection, resilient CSV loading, the data registry and the cached data bundle."""

import os
import json
import streamlit as st
import pandas as pd
from datetime import datetime
from .config import CPT_STATS_PATH, DATA_REGISTRY_PATH, DEFAULT_DATA_REGISTRY, MONTH_ORDER, logger
from .metrics import (
    aggregate_by_episode,
    build_payments_by_episode,
    clean_master_dataframe,
    compute_admissions_deltas,
    compute_finance_monthly,
    normalize_master_schema,
    resolve_billed_series,
    resolve_collected_series,
    safe_sum,
)


def get_file_age_hours(path):
    if not os.path.exists(path):
        return None
    return (datetime.now() - datetime.fromtimestamp(os.path.getmtime(path))).total_seconds() / 3600.0


@st.cache_data(ttl=3600)
def load_cpt_statistics(cpt_path=None):
    path = cpt_path or CPT_STATS_PATH
    if not os.path.exists(path):
        return pd.DataFrame()
    try:
        df = pd.read_csv(path, low_memory=False, encoding="latin1")
    except Exception:
        try:
            df = pd.read_csv(path, low_memory=False, encoding="utf-8")
        except Exception as e:
            logger.warning("Failed to load CPT statistics %s: %s", path, e)
            st.warning(f"CPT statistics file could not be parsed: {e}")
            return pd.DataFrame()

    df.columns = [str(c).strip() for c in df.columns]
    if "Co-Morbidity Description" not in df.columns and " Co-Morbidity Description" in df.columns:
        df = df.rename(columns={" Co-Morbidity Description": "Co-Morbidity Description"})

    if "Episode" in df.columns:
        df["episode_id"] = df["Episode"].astype(str).str.split(":").str[0].str.strip().str.upper()

    for col in ["Adm Date", "Disch Date", "Theatre date"]:
        if col in df.columns:
            df[col] = pd.to_datetime(df[col], errors="coerce", dayfirst=True)

    return df


def load_data_registry():
    if not os.path.exists(DATA_REGISTRY_PATH):
        return DEFAULT_DATA_REGISTRY.copy()
    try:
        with open(DATA_REGISTRY_PATH, "r", encoding="utf-8") as f:
            data = json.load(f)
        out = DEFAULT_DATA_REGISTRY.copy()
        if isinstance(data, dict):
            out.update({k: v for k, v in data.items() if isinstance(v, str)})
        return out
    except Exception:
        return DEFAULT_DATA_REGISTRY.copy()


def save_data_registry(registry):
    try:
        os.makedirs(os.path.dirname(DATA_REGISTRY_PATH), exist_ok=True)
        with open(DATA_REGISTRY_PATH, "w", encoding="utf-8") as f:
            json.dump(registry, f, indent=2)
        return True, "Data registry saved."
    except Exception as e:
        return False, f"Failed to save data registry: {e}"


def read_csv_resilient(path, **kwargs):
    read_kwargs = {"low_memory": False}
    read_kwargs.update(kwargs)
    encodings = ["utf-8", "utf-8-sig", "cp1252", "latin1"]
    last_error = None

    for enc in encodings:
        try:
            return pd.read_csv(path, encoding=enc, **read_kwargs), enc
        except UnicodeDecodeError as e:
            last_error = e
        except Exception as e:
            if "codec can't decode" in str(e).lower():
                last_error = e
            else:
                raise

    if last_error:
        raise last_error
    raise ValueError(f"Failed to read CSV file: {path}")


def create_new_main_dataset(input_path, output_path):
    if not os.path.exists(input_path):
        return False, f"Input file not found: {input_path}", {}
    try:
        raw, _ = read_csv_resilient(input_path)
        cleaned, report = clean_master_dataframe(raw)
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        cleaned.to_csv(output_path, index=False)
        return True, f"New main dataset created: {output_path}", report
    except Exception as e:
        return False, f"Failed to create new main dataset: {e}", {}


def get_file_mtime(path):
    if not os.path.exists(path):
        return "Unknown"
    return datetime.fromtimestamp(os.path.getmtime(path)).strftime("%Y-%m-%d %H:%M")


def detect_payments_header_row(file_path, max_lines=50):
    if not os.path.exists(file_path):
        return None
    keywords = ["Payment Type", "Amount", "Episode", "Date", "User", "Description"]
    best_idx = None
    best_score = -1
    with open(file_path, "r", encoding="latin1", errors="ignore") as f:
        for i in range(max_lines):
            line = f.readline()
            if not line:
                break
            score = sum(1 for k in keywords if k.lower() in line.lower())
            if score > best_score:
                best_score = score
                best_idx = i
    return best_idx


@st.cache_data(ttl=3600)
def load_payments_data(file_path=None):
    file_path = file_path or DEFAULT_DATA_REGISTRY["payments"]
    if not os.path.exists(file_path):
        return pd.DataFrame()

    header_row = detect_payments_header_row(file_path)
    if header_row is None:
        return pd.DataFrame()

    try:
        df = pd.read_csv(
            file_path,
            skiprows=header_row,
            on_bad_lines="skip",
            engine="python",
            encoding="latin1"
        )
        df.columns = [str(c).strip() for c in df.columns]

        if "Amount" in df.columns:
            df["Amount"] = pd.to_numeric(df["Amount"], errors="coerce").fillna(0)
        if "Date" in df.columns:
            df["Date"] = pd.to_datetime(df["Date"], errors="coerce", dayfirst=True)

        return df
    except Exception as e:
        logger.warning("Failed to load payments file %s: %s", file_path, e)
        st.warning(f"Payments file could not be parsed ({os.path.basename(str(file_path))}): {e}")
        return pd.DataFrame()


def detect_adm_per_user_header(file_path, max_lines=20):
    if not os.path.exists(file_path):
        return None
    keywords = ["User", "Admission Date", "Episode Number", "Ward", "Name"]
    best_idx = None
    best_score = -1
    with open(file_path, "r", encoding="latin1", errors="ignore") as f:
        for i in range(max_lines):
            line = f.readline()
            if not line:
                break
            score = sum(1 for k in keywords if k.lower() in line.lower())
            if score > best_score:
                best_score = score
                best_idx = i
    return best_idx


@st.cache_data(ttl=3600)
def load_admissions_per_user(file_path=None):
    file_path = file_path or DEFAULT_DATA_REGISTRY["admissions_user"]
    if not os.path.exists(file_path):
        return pd.DataFrame()
    header_row = detect_adm_per_user_header(file_path)
    if header_row is None:
        return pd.DataFrame()
    try:
        df = pd.read_csv(
            file_path,
            skiprows=header_row,
            on_bad_lines="skip",
            engine="python",
            encoding="latin1"
        )
        df.columns = [str(c).strip() for c in df.columns]
        keep_cols = [c for c in ["User", "Admission Date", "Episode Number", "Ward", "Name"] if c in df.columns]
        df = df[keep_cols]
        if "User" in df.columns:
            df = df[df["User"].notna()]
        return df
    except Exception as e:
        logger.warning("Failed to load admissions-per-user file %s: %s", file_path, e)
        st.warning(f"Admissions-per-user file could not be parsed: {e}")
        return pd.DataFrame()


def detect_adm_dur_header(file_path, max_lines=20):
    if not os.path.exists(file_path):
        return None
    keywords = ["Hospital", "Duration", "Episode Number", "Admission Date", "Admission Time", "User", "Procedure Type"]
    best_idx = None
    best_score = -1
    with open(file_path, "r", encoding="latin1", errors="ignore") as f:
        for i in range(max_lines):
            line = f.readline()
            if not line:
                break
            score = sum(1 for k in keywords if k.lower() in line.lower())
            if score > best_score:
                best_score = score
                best_idx = i
    return best_idx


@st.cache_data(ttl=3600)
def load_admissions_duration(file_path=None):
    file_path = file_path or DEFAULT_DATA_REGISTRY["admissions_duration"]
    if not os.path.exists(file_path):
        return pd.DataFrame()
    header_row = detect_adm_dur_header(file_path)
    if header_row is None:
        return pd.DataFrame()
    try:
        df = pd.read_csv(
            file_path,
            skiprows=header_row,
            on_bad_lines="skip",
            engine="python",
            encoding="latin1"
        )
        df.columns = [str(c).strip() for c in df.columns]
        keep_cols = [c for c in ["Hospital", "Duration (mins)", "Episode Number", "Admission Date", "Admission Time Start", "Admission Time Close", "User", "Procedure Type"] if c in df.columns]
        df = df[keep_cols]
        if "User" in df.columns:
            df = df[df["User"].notna()]
        return df
    except Exception as e:
        logger.warning("Failed to load admissions-duration file %s: %s", file_path, e)
        st.warning(f"Admissions-duration file could not be parsed: {e}")
        return pd.DataFrame()


@st.cache_data(ttl=3600)
def load_management_sections(data_path):
    full_path = data_path if os.path.exists(data_path) else f"data_reservoir/raw/{data_path}"
    if not os.path.exists(full_path):
        return {}

    try:
        df = pd.read_csv(full_path, skiprows=2, low_memory=False, encoding="latin1")
    except Exception as e:
        logger.warning("Failed to load management report %s: %s", full_path, e)
        st.warning(f"Management report could not be parsed: {e}")
        return {}

    df.columns = [str(c).strip() for c in df.columns]
    if "DataSet" not in df.columns:
        return {}

    month_cols = [m for m in MONTH_ORDER if m in df.columns]
    sections = {}
    current_section = None
    buffer_rows = []

    for _, row in df.iterrows():
        label = str(row.get("DataSet", "")).strip()
        is_header = label and all(pd.isna(row.get(m)) for m in month_cols)

        if is_header:
            if current_section and buffer_rows:
                section_df = pd.DataFrame(buffer_rows)
                section_df = section_df[["DataSet"] + month_cols + (["Total"] if "Total" in df.columns else [])]
                sections[current_section] = section_df
            current_section = label
            buffer_rows = []
            continue

        if current_section:
            buffer_rows.append(row)

    if current_section and buffer_rows:
        section_df = pd.DataFrame(buffer_rows)
        section_df = section_df[["DataSet"] + month_cols + (["Total"] if "Total" in df.columns else [])]
        sections[current_section] = section_df

    return sections


@st.cache_data(ttl=3600)
def load_live_metrics(master_path, payments_path, load_payments=True):
    """
    Derives real-time metrics from the transactional reservoir
    linked by Episode Number.
    """
    df = pd.DataFrame()
    if os.path.exists(master_path):
        try:
            df, _ = read_csv_resilient(master_path)
            df = normalize_master_schema(df)
        except Exception as e:
            st.warning(f"Error loading live metrics master data: {e}")
            df = pd.DataFrame()

    payments_df = pd.DataFrame()
    if load_payments:
        payments_df = load_payments_data(payments_path)
        payments_agg = build_payments_by_episode(payments_df)
        if not payments_agg.empty and "episode_id" in df.columns:
            df = df.copy()
            df["episode_id"] = df["episode_id"].astype(str).str.strip().str.upper()
            df = df.merge(payments_agg, on="episode_id", how="left")
            df["Total_Paid_To_Date_Calc"] = df["Total_Paid_To_Date_Calc"].fillna(0)
            df["Total_Paid_To_Date"] = df[["Total_Paid_To_Date", "Total_Paid_To_Date_Calc"]].max(axis=1)

    df_agg = aggregate_by_episode(df)

    billed_series = resolve_billed_series(df_agg if df_agg is not None else df)
    collected_series = resolve_collected_series(df_agg if df_agg is not None else df)

    total_billed = billed_series.sum() if billed_series is not None else 0
    total_collected = collected_series.sum() if collected_series is not None else 0
    if load_payments and total_collected == 0 and not payments_df.empty and "Amount" in payments_df.columns:
        total_collected = payments_df["Amount"].sum()

    collection_rate = round((total_collected / total_billed) * 100, 1) if total_billed > 0 else 0
    collection_gap = total_billed - total_collected

    metrics = {
        "Total Billed": total_billed,
        "Total Collected": total_collected,
        "Collection Gap": collection_gap,
        "Interest Loss": safe_sum(df, "Monthly_Interest_Loss"),
        "Collection Rate (%)": collection_rate
    }
    return metrics, df


@st.cache_data(ttl=3600)
def load_admissions_summary(data_path):
    """
    Load admissions summary from the management dashboard.
    Handles the specific format of the management report file.
    """
    full_path = data_path if os.path.exists(data_path) else f"data_reservoir/raw/{data_path}"
    if os.path.exists(full_path):
        try:
            df, _ = read_csv_resilient(full_path, skiprows=2)
            if df is None or df.empty:
                return pd.DataFrame()

            first_col = df.columns[0]
            month_cols = [m for m in MONTH_ORDER if m in df.columns]
            if not month_cols:
                return pd.DataFrame()

            labels = (
                df[first_col]
                .fillna("")
                .astype(str)
                .str.strip()
                .str.upper()
            )
            admission_types = ["CASUALTY PATIENT", "DAY PATIENT", "IN-PATIENT"]

            picked = df[labels.isin(admission_types)].copy()
            if picked.empty:
                return pd.DataFrame()

            picked["_atype"] = labels[labels.isin(admission_types)]
            picked = picked.drop_duplicates(subset=["_atype"], keep="first")
            picked = picked.set_index("_atype")[month_cols]
            picked = picked.reindex([t for t in admission_types if t in picked.index])

            for col in month_cols:
                picked[col] = pd.to_numeric(picked[col], errors="coerce").fillna(0)

            return picked
        except Exception as e:
            st.warning(f"Error loading admissions data: {e}")
            return pd.DataFrame()
    return pd.DataFrame()


@st.cache_data(ttl=3600)
def get_data_bundle(source_paths, load_heavy=False, load_cpt=False):
    management_path = source_paths.get("management", DEFAULT_DATA_REGISTRY["management"])
    master_path = source_paths.get("master", DEFAULT_DATA_REGISTRY["master"])
    payments_path = source_paths.get("payments", DEFAULT_DATA_REGISTRY["payments"])
    cpt_path = source_paths.get("cpt", DEFAULT_DATA_REGISTRY["cpt"])

    admissions_df = load_admissions_summary(management_path)
    live_finance, df_full = load_live_metrics(master_path, payments_path, load_payments=load_heavy)
    # finance_metrics was previously a second full reload of the same master
    # file computing the same four numbers - derive it from live_finance
    # instead: one load, one source of truth.
    finance_metrics = {
        k: live_finance.get(k, 0)
        for k in ("Total Billed", "Total Collected", "Collection Gap", "Collection Rate (%)")
    }
    admissions_delta = compute_admissions_deltas(admissions_df)
    finance_delta = compute_finance_monthly(df_full)
    sections = load_management_sections(management_path) if load_heavy else {}
    payments_df = load_payments_data(payments_path) if load_heavy else pd.DataFrame()
    cpt_df = load_cpt_statistics(cpt_path) if load_cpt else pd.DataFrame()
    # Expensive tab-specific outputs are computed lazily after filters.
    ward_data = pd.DataFrame()
    data_quality = pd.DataFrame()
    cpt_metrics = {}
    cpt_quality = pd.DataFrame()

    last_updated = {
        "master": get_file_mtime(master_path),
        "management": get_file_mtime(management_path),
        "cpt": get_file_mtime(cpt_path)
    }

    return {
        "admissions_df": admissions_df,
        "finance_metrics": finance_metrics,
        "live_finance": live_finance,
        "df_full": df_full,
        "ward_data": ward_data,
        "data_quality": data_quality,
        "admissions_delta": admissions_delta,
        "finance_delta": finance_delta,
        "sections": sections,
        "payments_df": payments_df,
        "cpt_df": cpt_df,
        "cpt_metrics": cpt_metrics,
        "cpt_quality": cpt_quality,
        "last_updated": last_updated
    }
