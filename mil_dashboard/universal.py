"""Universal Analytics workspace: ad-hoc dataset loading, profiling, insights and its render function."""

import os
import re
import json
import csv
import streamlit as st
import pandas as pd
import numpy as np
import plotly.express as px
from io import BytesIO
from datetime import datetime
from .config import DEFAULT_DATA_REGISTRY, UNIVERSAL_SESSION_STORE_PATH
from .helpers import display_limited_df
from .metrics import infer_column_roles, run_join_chain, standardize_column_name
from .loaders import save_data_registry
from .ui import render_recommended_chart


def load_universal_dataset(uploaded_file, sep_override=None):
    if uploaded_file is None:
        return pd.DataFrame(), "No file uploaded"

    name = uploaded_file.name
    ext = os.path.splitext(name)[1].lower()
    raw = uploaded_file.getvalue()
    bio = BytesIO(raw)

    try:
        if ext in [".csv", ".txt", ".tsv"]:
            if sep_override:
                df = pd.read_csv(
                    bio,
                    sep=sep_override,
                    encoding="latin1",
                    engine="python",
                    on_bad_lines="skip"
                )
            elif ext == ".tsv":
                df = pd.read_csv(
                    bio,
                    sep="\t",
                    encoding="latin1",
                    engine="python",
                    on_bad_lines="skip"
                )
            else:
                def _read_with_header_guess(blob):
                    blob.seek(0)
                    lines = blob.getvalue().decode("latin1", errors="ignore").splitlines()
                    best_idx = 0
                    best_score = -1
                    for i, line in enumerate(lines[:50]):
                        if not line.strip():
                            continue
                        comma_score = line.count(",")
                        keyword_score = 0
                        low = line.lower()
                        for k in ["date", "amount", "description", "number", "name", "id", "episode", "user", "type"]:
                            if k in low:
                                keyword_score += 1
                        score = comma_score * 2 + keyword_score
                        if score > best_score:
                            best_score = score
                            best_idx = i
                    blob.seek(0)
                    return pd.read_csv(
                        blob,
                        skiprows=best_idx,
                        sep=",",
                        encoding="latin1",
                        engine="python",
                        on_bad_lines="skip"
                    )

                try:
                    df = pd.read_csv(
                        bio,
                        sep=None,
                        engine="python",
                        encoding="latin1",
                        on_bad_lines="skip"
                    )
                    if len(df.columns) <= 1:
                        df = _read_with_header_guess(bio)
                except Exception:
                    df = _read_with_header_guess(bio)
        elif ext in [".xlsx", ".xls"]:
            df = pd.read_excel(bio)
        elif ext == ".json":
            try:
                df = pd.read_json(bio)
            except Exception:
                bio.seek(0)
                df = pd.read_json(bio, lines=True)
        elif ext == ".parquet":
            df = pd.read_parquet(bio)
        else:
            return pd.DataFrame(), f"Unsupported file type: {ext}"
    except Exception as e:
        return pd.DataFrame(), f"Failed to load file: {e}"

    df.columns = [str(c).strip() for c in df.columns]
    return df, None


def auto_clean_universal_df(
    df,
    standardize_cols=True,
    strip_strings=True,
    parse_dates=True,
    parse_numeric=True,
    drop_duplicate_rows=True,
    missing_strategy="None",
    outlier_iqr_cap=False
):
    if df is None or df.empty:
        return pd.DataFrame(), {"rows_before": 0, "rows_after": 0, "notes": ["No data"]}

    cleaned = df.copy()
    notes = []
    rows_before = len(cleaned)

    if strip_strings:
        obj_cols = cleaned.select_dtypes(include=["object"]).columns.tolist()
        for col in obj_cols:
            cleaned[col] = cleaned[col].astype(str).str.strip()
            cleaned[col] = cleaned[col].replace({"": np.nan, "nan": np.nan, "None": np.nan})
        notes.append("Trimmed whitespace in text columns")

    if standardize_cols:
        new_cols = []
        seen = {}
        for c in cleaned.columns:
            base = standardize_column_name(c)
            idx = seen.get(base, 0)
            seen[base] = idx + 1
            new_cols.append(base if idx == 0 else f"{base}_{idx}")
        cleaned.columns = new_cols
        notes.append("Standardized column names")

    if parse_numeric:
        obj_cols = cleaned.select_dtypes(include=["object"]).columns.tolist()
        for col in obj_cols:
            s = cleaned[col].astype(str).str.replace(",", "", regex=False)
            s = s.str.replace("$", "", regex=False).str.replace("%", "", regex=False)
            num = pd.to_numeric(s, errors="coerce")
            if num.notna().mean() >= 0.8 and num.notna().sum() >= 5:
                cleaned[col] = num
        notes.append("Auto-parsed numeric-like columns")

    if parse_dates:
        obj_cols = cleaned.select_dtypes(include=["object"]).columns.tolist()
        for col in obj_cols:
            dt = pd.to_datetime(cleaned[col], errors="coerce", dayfirst=True)
            if dt.notna().mean() >= 0.7 and dt.notna().sum() >= 5:
                cleaned[col] = dt
        notes.append("Auto-parsed datetime-like columns")

    if drop_duplicate_rows:
        before = len(cleaned)
        cleaned = cleaned.drop_duplicates()
        removed = before - len(cleaned)
        notes.append(f"Removed duplicate rows: {removed}")

    if missing_strategy != "None":
        for col in cleaned.columns:
            if cleaned[col].isna().sum() == 0:
                continue
            if pd.api.types.is_numeric_dtype(cleaned[col]):
                if missing_strategy == "Median":
                    cleaned[col] = cleaned[col].fillna(cleaned[col].median())
                elif missing_strategy == "Mean":
                    cleaned[col] = cleaned[col].fillna(cleaned[col].mean())
                elif missing_strategy == "Zero":
                    cleaned[col] = cleaned[col].fillna(0)
                elif missing_strategy == "Forward Fill":
                    cleaned[col] = cleaned[col].ffill()
            else:
                if missing_strategy in ["Mode", "Forward Fill"]:
                    if missing_strategy == "Mode":
                        mode_vals = cleaned[col].mode(dropna=True)
                        fill_val = mode_vals.iloc[0] if not mode_vals.empty else "Unknown"
                        cleaned[col] = cleaned[col].fillna(fill_val)
                    else:
                        cleaned[col] = cleaned[col].ffill()
                elif missing_strategy == "Zero":
                    cleaned[col] = cleaned[col].fillna("0")
        notes.append(f"Applied missing value strategy: {missing_strategy}")

    if outlier_iqr_cap:
        num_cols = cleaned.select_dtypes(include=[np.number]).columns.tolist()
        clipped_cols = 0
        for col in num_cols:
            q1 = cleaned[col].quantile(0.25)
            q3 = cleaned[col].quantile(0.75)
            iqr = q3 - q1
            if pd.isna(iqr) or iqr == 0:
                continue
            low = q1 - 1.5 * iqr
            high = q3 + 1.5 * iqr
            cleaned[col] = cleaned[col].clip(low, high)
            clipped_cols += 1
        notes.append(f"IQR outlier cap applied on {clipped_cols} numeric columns")

    return cleaned, {
        "rows_before": rows_before,
        "rows_after": len(cleaned),
        "notes": notes
    }


def universal_profile(df):
    if df is None or df.empty:
        return {}
    mem_mb = round(df.memory_usage(deep=True).sum() / (1024 * 1024), 2)
    missing_cells = int(df.isna().sum().sum())
    total_cells = int(df.shape[0] * df.shape[1]) if df.shape[0] and df.shape[1] else 0
    missing_pct = round((missing_cells / total_cells) * 100, 2) if total_cells else 0
    duplicates = int(df.duplicated().sum())
    numeric_cols = len(df.select_dtypes(include=[np.number]).columns)
    datetime_cols = len(df.select_dtypes(include=["datetime64[ns]", "datetime64[ns, UTC]"]).columns)
    cat_cols = df.shape[1] - numeric_cols - datetime_cols
    return {
        "rows": int(df.shape[0]),
        "columns": int(df.shape[1]),
        "memory_mb": mem_mb,
        "missing_cells": missing_cells,
        "missing_pct": missing_pct,
        "duplicates": duplicates,
        "numeric_cols": numeric_cols,
        "datetime_cols": datetime_cols,
        "categorical_cols": cat_cols
    }


def universal_insights(df):
    if df is None or df.empty:
        return []

    insights = []
    prof = universal_profile(df)
    insights.append(f"Dataset size: {prof['rows']:,} rows x {prof['columns']:,} columns")
    insights.append(f"Missing data: {prof['missing_pct']:.2f}% of all cells")
    insights.append(f"Duplicate rows: {prof['duplicates']:,}")

    missing_by_col = df.isna().mean().sort_values(ascending=False)
    high_missing = missing_by_col[missing_by_col > 0.3]
    if not high_missing.empty:
        top = ", ".join([f"{k} ({v * 100:.1f}%)" for k, v in high_missing.head(5).items()])
        insights.append(f"High-missing columns: {top}")

    num_df = df.select_dtypes(include=[np.number])
    if num_df.shape[1] >= 2:
        corr = num_df.corr(numeric_only=True).abs()
        upper = corr.where(np.triu(np.ones(corr.shape), k=1).astype(bool))
        max_pair = upper.stack().sort_values(ascending=False).head(1)
        if not max_pair.empty:
            (c1, c2), corr_val = max_pair.index[0], max_pair.iloc[0]
            insights.append(f"Strongest numeric relationship: {c1} vs {c2} (|corr|={corr_val:.2f})")

    return insights


def recommend_universal_charts(df, max_items=6):
    if df is None or df.empty:
        return []

    recs = []
    num_cols = df.select_dtypes(include=[np.number]).columns.tolist()
    dt_cols = df.select_dtypes(include=["datetime64[ns]", "datetime64[ns, UTC]"]).columns.tolist()
    cat_cols = [c for c in df.columns if c not in num_cols and c not in dt_cols]

    if num_cols:
        variances = df[num_cols].var(numeric_only=True).sort_values(ascending=False)
        top_num = variances.index[0] if not variances.empty else num_cols[0]
        recs.append({
            "title": f"Distribution of {top_num}",
            "kind": "histogram",
            "x": top_num,
            "reason": "Highest spread numeric field is useful for baseline distribution checks."
        })

    if cat_cols:
        small_card = []
        for col in cat_cols:
            uniq = df[col].nunique(dropna=True)
            if 2 <= uniq <= 30:
                small_card.append((col, uniq))
        target_cat = sorted(small_card, key=lambda x: x[1])[0][0] if small_card else cat_cols[0]
        recs.append({
            "title": f"Top Categories in {target_cat}",
            "kind": "category_count",
            "x": target_cat,
            "reason": "Category distribution highlights concentration and imbalance."
        })

    if len(num_cols) >= 2:
        corr = df[num_cols].corr(numeric_only=True).abs()
        upper = corr.where(np.triu(np.ones(corr.shape), k=1).astype(bool))
        pair = upper.stack().sort_values(ascending=False).head(1)
        if not pair.empty:
            (x_col, y_col), corr_val = pair.index[0], pair.iloc[0]
            recs.append({
                "title": f"Relationship: {x_col} vs {y_col}",
                "kind": "scatter",
                "x": x_col,
                "y": y_col,
                "reason": f"Strongest numeric pair (|corr|={corr_val:.2f}) is a high-value relationship check."
            })
        recs.append({
            "title": "Correlation Matrix",
            "kind": "correlation_heatmap",
            "reason": "Shows full linear relationship structure across numeric features."
        })

    if dt_cols and num_cols:
        recs.append({
            "title": f"Time Trend of {num_cols[0]}",
            "kind": "time_trend",
            "x": dt_cols[0],
            "y": num_cols[0],
            "reason": "Trend analysis detects growth patterns, seasonality, and change points."
        })

    if cat_cols and num_cols:
        low_card_cat = None
        for c in cat_cols:
            if 2 <= df[c].nunique(dropna=True) <= 20:
                low_card_cat = c
                break
        if low_card_cat:
            recs.append({
                "title": f"Spread of {num_cols[0]} by {low_card_cat}",
                "kind": "box_by_category",
                "x": low_card_cat,
                "y": num_cols[0],
                "reason": "Compares numeric spread across groups and surfaces segment outliers."
            })

    return recs[:max_items]


def build_narrative_summary(df, dataset_name="dataset"):
    if df is None or df.empty:
        return "No data available for narrative summary."

    profile = universal_profile(df)
    insights = universal_insights(df)
    lines = [
        f"Summary for `{dataset_name}`:",
        f"- Shape: {profile['rows']:,} rows x {profile['columns']:,} columns",
        f"- Missing cells: {profile['missing_pct']:.2f}%",
        f"- Duplicate rows: {profile['duplicates']:,}",
        f"- Type mix: {profile['numeric_cols']} numeric, {profile['datetime_cols']} datetime, {profile['categorical_cols']} categorical/text"
    ]

    num_cols = df.select_dtypes(include=[np.number]).columns.tolist()
    if num_cols:
        desc = df[num_cols].describe().T
        top_std = desc.sort_values("std", ascending=False).head(3).index.tolist() if "std" in desc.columns else []
        if top_std:
            lines.append(f"- Highest variance numeric columns: {', '.join(top_std)}")

    if insights:
        lines.append("- Key observations:")
        for item in insights[:4]:
            lines.append(f"  - {item}")

    return "\n".join(lines)


def load_universal_session_store():
    if not os.path.exists(UNIVERSAL_SESSION_STORE_PATH):
        return {}
    try:
        with open(UNIVERSAL_SESSION_STORE_PATH, "r", encoding="utf-8") as f:
            data = json.load(f)
            return data if isinstance(data, dict) else {}
    except Exception:
        return {}


def save_universal_session_store(store):
    try:
        os.makedirs(os.path.dirname(UNIVERSAL_SESSION_STORE_PATH), exist_ok=True)
        with open(UNIVERSAL_SESSION_STORE_PATH, "w", encoding="utf-8") as f:
            json.dump(store, f, indent=2)
        return True, "Session store saved."
    except Exception as e:
        return False, f"Failed to save session store: {e}"


def upload_new_data_into_app(uploaded_file, dataset_key, registry):
    if uploaded_file is None:
        return False, "No file selected for upload.", registry

    valid_keys = set(DEFAULT_DATA_REGISTRY.keys())
    if dataset_key not in valid_keys:
        return False, f"Unsupported dataset type: {dataset_key}", registry

    if dataset_key == "master":
        preview_df, preview_err = load_universal_dataset(uploaded_file)
        if preview_err:
            return False, f"Could not inspect uploaded file: {preview_err}", registry
        cols = set(preview_df.columns)
        has_episode = ("episode_id" in cols) or ("Episode" in cols)
        has_billed = any(c in cols for c in ["Original Billed", "Total Amount", "Total"])
        if not (has_episode and has_billed):
            return False, (
                "File does not match expected main/master schema. "
                "Expected episode id and billed columns (episode_id or Episode, and Original Billed/Total Amount/Total)."
            ), registry

    original_name = uploaded_file.name or "uploaded_file"
    base_name = os.path.basename(original_name)
    safe_name = re.sub(r"[^0-9a-zA-Z._-]+", "_", base_name)
    stem, ext = os.path.splitext(safe_name)
    if not stem:
        stem = "uploaded_dataset"

    target_folder = "data_reservoir/processed" if dataset_key == "master" else "data_reservoir/raw"
    stamped_name = f"{datetime.now().strftime('%Y%m%d_%H%M%S')}_{stem}{ext}"
    target_path = os.path.join(target_folder, stamped_name).replace("\\", "/")

    try:
        os.makedirs(target_folder, exist_ok=True)
        with open(target_path, "wb") as f:
            f.write(uploaded_file.getvalue())
    except Exception as e:
        return False, f"Failed to save uploaded file: {e}", registry

    updated_registry = registry.copy()
    updated_registry[dataset_key] = target_path
    ok, msg = save_data_registry(updated_registry)
    if not ok:
        return False, msg, registry

    return True, f"Uploaded and registered: {target_path}", updated_registry


def render_universal_analytics_tab(table_limit=100):
    def _safe_index(options, value, default=0):
        if value in options:
            return options.index(value)
        return default if options else 0

    if "ua_saved_sessions" not in st.session_state:
        st.session_state["ua_saved_sessions"] = load_universal_session_store()
    if "ua_prefill_config" not in st.session_state:
        st.session_state["ua_prefill_config"] = st.session_state["ua_saved_sessions"].get("__last__", {})

    prefill = st.session_state.get("ua_prefill_config", {})

    st.markdown(
        """
        <style>
        .ua-hero {
            background: linear-gradient(135deg, #0d1b2a 0%, #1b263b 40%, #415a77 100%);
            border-radius: 14px;
            padding: 16px 20px;
            border: 1px solid rgba(255,255,255,0.15);
            margin-bottom: 10px;
        }
        .ua-title {
            color: #f1f5f9;
            font-size: 26px;
            font-weight: 700;
            margin: 0;
        }
        .ua-sub {
            color: #cbd5e1;
            margin-top: 6px;
            font-size: 14px;
        }
        </style>
        <div class="ua-hero">
            <p class="ua-title">Universal Analytics Studio</p>
            <p class="ua-sub">Ingest, clean, profile, and analyze mixed datasets with adaptive workflows.</p>
        </div>
        """,
        unsafe_allow_html=True
    )

    saved_sessions = st.session_state["ua_saved_sessions"]
    session_names = sorted([k for k in saved_sessions.keys() if k != "__last__"])
    st.subheader("Session Manager")
    sm1, sm2, sm3, sm4 = st.columns([2, 1, 1, 1])
    selected_saved = sm1.selectbox(
        "Saved sessions",
        ["(none)"] + session_names,
        index=0
    )
    save_name = sm2.text_input("Save as", value=prefill.get("session_name", ""))
    if sm3.button("Load Session", use_container_width=True):
        if selected_saved != "(none)" and selected_saved in saved_sessions:
            st.session_state["ua_prefill_config"] = saved_sessions[selected_saved]
            st.rerun()
    if sm4.button("Delete Session", use_container_width=True):
        if selected_saved != "(none)" and selected_saved in saved_sessions:
            del saved_sessions[selected_saved]
            ok, msg = save_universal_session_store(saved_sessions)
            st.session_state["ua_saved_sessions"] = saved_sessions
            st.info(msg if ok else msg)
            st.rerun()

    c1, c2, c3 = st.columns([2, 1, 1])
    with c1:
        uploaded_files = st.file_uploader(
            "Upload one or more datasets",
            type=["csv", "tsv", "txt", "xlsx", "xls", "json", "parquet"],
            accept_multiple_files=True
        )
    with c2:
        sep_options = ["Auto", ",", ";", "\\t", "|"]
        sep_choice = st.selectbox(
            "Delimiter",
            sep_options,
            index=_safe_index(sep_options, prefill.get("sep_choice", "Auto"), default=0)
        )
    with c3:
        sample_rows = st.number_input(
            "Chart sample rows",
            min_value=5000,
            max_value=500000,
            value=int(prefill.get("sample_rows", 100000)),
            step=5000
        )

    st.subheader("Auto-Clean Controls")
    cc1, cc2, cc3, cc4 = st.columns(4)
    standardize_cols = cc1.checkbox("Standardize columns", value=bool(prefill.get("standardize_cols", True)))
    parse_numeric = cc2.checkbox("Parse numeric-like text", value=bool(prefill.get("parse_numeric", True)))
    parse_dates = cc3.checkbox("Parse datetime-like text", value=bool(prefill.get("parse_dates", True)))
    drop_dups = cc4.checkbox("Drop duplicate rows", value=bool(prefill.get("drop_dups", True)))

    cc5, cc6 = st.columns(2)
    missing_options = ["None", "Mode", "Median", "Mean", "Zero", "Forward Fill"]
    missing_strategy = cc5.selectbox(
        "Missing value strategy",
        missing_options,
        index=_safe_index(missing_options, prefill.get("missing_strategy", "None"), default=0)
    )
    cap_outliers = cc6.checkbox("IQR outlier capping (numeric)", value=bool(prefill.get("cap_outliers", False)))

    if uploaded_files:
        sep_override = "\t" if sep_choice == "\\t" else (None if sep_choice == "Auto" else sep_choice)
        dataset_store = {}
        profile_rows = []
        load_errors = []
        for f in uploaded_files:
            raw_df, err = load_universal_dataset(f, sep_override=sep_override)
            if err:
                load_errors.append(f"{f.name}: {err}")
                continue
            clean_df, clean_meta = auto_clean_universal_df(
                raw_df,
                standardize_cols=standardize_cols,
                strip_strings=True,
                parse_dates=parse_dates,
                parse_numeric=parse_numeric,
                drop_duplicate_rows=drop_dups,
                missing_strategy=missing_strategy,
                outlier_iqr_cap=cap_outliers
            )
            dataset_store[f.name] = {
                "raw": raw_df,
                "clean": clean_df,
                "meta": clean_meta,
                "profile": universal_profile(clean_df)
            }
            profile_rows.append({
                "dataset": f.name,
                "rows": dataset_store[f.name]["profile"]["rows"],
                "columns": dataset_store[f.name]["profile"]["columns"],
                "missing_%": dataset_store[f.name]["profile"]["missing_pct"],
                "duplicates": dataset_store[f.name]["profile"]["duplicates"]
            })

        if load_errors:
            st.warning("Some files failed to load:")
            for e in load_errors:
                st.write(f"- {e}")
        if not dataset_store:
            st.error("No dataset could be loaded with the current settings.")
            return

        st.subheader("Dataset Catalog")
        catalog_df = pd.DataFrame(profile_rows).sort_values(["rows", "columns"], ascending=False)
        display_limited_df(catalog_df, "Loaded datasets", limit=table_limit)

        mode_col1, mode_col2 = st.columns([1, 2])
        analysis_modes = ["Single dataset", "Combine datasets"]
        analysis_mode = mode_col1.selectbox(
            "Analysis mode",
            analysis_modes,
            index=_safe_index(analysis_modes, prefill.get("analysis_mode", "Single dataset"), default=0)
        )

        selected_name = None
        selected_df = None
        selected_raw = None
        selected_meta = {"notes": []}
        combine_type = "None"
        union_names = []
        left_name, right_name, left_key, right_key, join_how = "", "", "", "", "inner"
        chain_base = ""
        chain_steps = []

        if analysis_mode == "Single dataset":
            names = list(dataset_store.keys())
            selected_name = mode_col2.selectbox(
                "Choose dataset",
                names,
                index=_safe_index(names, prefill.get("selected_name"), default=0)
            )
            selected_df = dataset_store[selected_name]["clean"]
            selected_raw = dataset_store[selected_name]["raw"]
            selected_meta = dataset_store[selected_name]["meta"]
        else:
            combine_options = ["Append/Union", "Pair Join", "Join Chain (3+ datasets)"]
            combine_type = mode_col2.selectbox(
                "Combine method",
                combine_options,
                index=_safe_index(combine_options, prefill.get("combine_type", "Append/Union"), default=0)
            )
            names = list(dataset_store.keys())
            if combine_type == "Append/Union":
                default_union = prefill.get("union_names", names[:min(2, len(names))])
                default_union = [n for n in default_union if n in names]
                union_names = st.multiselect("Datasets to append", names, default=default_union)
                if len(union_names) < 2:
                    st.info("Select at least 2 datasets for append/union.")
                    return
                common_cols = set(dataset_store[union_names[0]]["clean"].columns)
                for n in union_names[1:]:
                    common_cols &= set(dataset_store[n]["clean"].columns)
                common_cols = sorted(list(common_cols))
                if not common_cols:
                    st.error("No common columns found across selected datasets.")
                    return
                parts = []
                for n in union_names:
                    part = dataset_store[n]["clean"][common_cols].copy()
                    part["_source_dataset"] = n
                    parts.append(part)
                selected_df = pd.concat(parts, ignore_index=True)
                selected_raw = selected_df.copy()
                selected_name = "union_result"
                selected_meta = {"notes": [f"Unioned {len(union_names)} datasets on {len(common_cols)} common columns"]}
            elif combine_type == "Pair Join":
                if len(names) < 2:
                    st.info("Upload at least 2 datasets to perform a join.")
                    return
                j1, j2, j3, j4 = st.columns(4)
                left_name = j1.selectbox(
                    "Left dataset",
                    names,
                    index=_safe_index(names, prefill.get("left_name"), default=0)
                )
                right_name_candidates = [n for n in names if n != left_name]
                right_name = j2.selectbox(
                    "Right dataset",
                    right_name_candidates,
                    index=_safe_index(right_name_candidates, prefill.get("right_name"), default=0)
                )
                left_df = dataset_store[left_name]["clean"]
                right_df = dataset_store[right_name]["clean"]
                left_key = j3.selectbox(
                    "Left key",
                    left_df.columns.tolist(),
                    index=_safe_index(left_df.columns.tolist(), prefill.get("left_key"), default=0)
                )
                right_key = j4.selectbox(
                    "Right key",
                    right_df.columns.tolist(),
                    index=_safe_index(right_df.columns.tolist(), prefill.get("right_key"), default=0)
                )
                join_types = ["inner", "left", "right", "outer"]
                join_how = st.selectbox(
                    "Join type",
                    join_types,
                    index=_safe_index(join_types, prefill.get("join_how", "inner"), default=0)
                )
                selected_df = left_df.merge(
                    right_df,
                    left_on=left_key,
                    right_on=right_key,
                    how=join_how,
                    suffixes=("_left", "_right")
                )
                selected_raw = selected_df.copy()
                selected_name = f"join_{left_name}_{right_name}"
                selected_meta = {"notes": [f"{join_how.upper()} join: {left_name}.{left_key} = {right_name}.{right_key}"]}
            else:
                if len(names) < 3:
                    st.info("Upload at least 3 datasets for a join chain.")
                    return
                chain_base = st.selectbox(
                    "Base dataset",
                    names,
                    index=_safe_index(names, prefill.get("chain_base"), default=0)
                )
                max_steps = min(6, len(names) - 1)
                default_steps = int(prefill.get("chain_steps_count", min(2, max_steps)))
                default_steps = max(2, min(max_steps, default_steps)) if max_steps >= 2 else 1
                chain_steps_count = st.number_input(
                    "Join steps",
                    min_value=2 if max_steps >= 2 else 1,
                    max_value=max_steps,
                    value=default_steps,
                    step=1
                )
                prefill_chain = prefill.get("chain_steps", [])
                preview_df = dataset_store[chain_base]["clean"].head(0).copy()
                used = {chain_base}
                for i in range(int(chain_steps_count)):
                    step_prefill = prefill_chain[i] if i < len(prefill_chain) else {}
                    c_a, c_b, c_c, c_d = st.columns(4)
                    right_options = [n for n in names if n not in used]
                    if not right_options:
                        break
                    right_name_step = c_a.selectbox(
                        f"Step {i+1} right dataset",
                        right_options,
                        index=_safe_index(right_options, step_prefill.get("right_name"), default=0),
                        key=f"ua_chain_right_{i}"
                    )
                    right_df = dataset_store[right_name_step]["clean"]
                    left_cols = preview_df.columns.tolist()
                    if not left_cols:
                        left_cols = dataset_store[chain_base]["clean"].columns.tolist()
                    left_key_step = c_b.selectbox(
                        f"Step {i+1} left key",
                        left_cols,
                        index=_safe_index(left_cols, step_prefill.get("left_key"), default=0),
                        key=f"ua_chain_left_key_{i}"
                    )
                    right_key_step = c_c.selectbox(
                        f"Step {i+1} right key",
                        right_df.columns.tolist(),
                        index=_safe_index(right_df.columns.tolist(), step_prefill.get("right_key"), default=0),
                        key=f"ua_chain_right_key_{i}"
                    )
                    join_types = ["inner", "left", "right", "outer"]
                    how_step = c_d.selectbox(
                        f"Step {i+1} join type",
                        join_types,
                        index=_safe_index(join_types, step_prefill.get("how", "inner"), default=0),
                        key=f"ua_chain_how_{i}"
                    )
                    chain_steps.append({
                        "right_name": right_name_step,
                        "left_key": left_key_step,
                        "right_key": right_key_step,
                        "how": how_step
                    })
                    used.add(right_name_step)
                    preview_df = preview_df.merge(
                        right_df.head(0),
                        left_on=left_key_step,
                        right_on=right_key_step,
                        how=how_step,
                        suffixes=(f"_s{i+1}l", f"_s{i+1}r")
                    )
                selected_df, chain_notes = run_join_chain(dataset_store, chain_base, chain_steps)
                selected_raw = selected_df.copy()
                selected_name = f"join_chain_{chain_base}"
                selected_meta = {"notes": chain_notes}

        st.subheader("Profile")
        p_raw = universal_profile(selected_raw)
        p_clean = universal_profile(selected_df)
        m1, m2, m3, m4 = st.columns(4)
        m1.metric("Rows", f"{p_clean.get('rows', 0):,}", delta=f"{p_clean.get('rows', 0) - p_raw.get('rows', 0):+,.0f}")
        m2.metric("Columns", f"{p_clean.get('columns', 0):,}")
        m3.metric("Missing %", f"{p_clean.get('missing_pct', 0):.2f}%")
        m4.metric("Duplicates", f"{p_clean.get('duplicates', 0):,}", delta=f"{p_clean.get('duplicates', 0) - p_raw.get('duplicates', 0):+,.0f}")

        with st.expander("Cleaning / Combine log", expanded=False):
            for note in selected_meta.get("notes", []):
                st.write(f"- {note}")

        role_df = infer_column_roles(selected_df)
        st.subheader("Schema Map")
        display_limited_df(role_df, "Inferred schema", limit=table_limit)

        st.subheader("Insights")
        for insight in universal_insights(selected_df):
            st.write(f"- {insight}")

        analysis_df = selected_df
        if len(analysis_df) > sample_rows:
            analysis_df = analysis_df.sample(sample_rows, random_state=42)
            st.caption(f"Charts are sampled to {sample_rows:,} rows for performance.")

        num_cols = analysis_df.select_dtypes(include=[np.number]).columns.tolist()
        dt_cols = analysis_df.select_dtypes(include=["datetime64[ns]", "datetime64[ns, UTC]"]).columns.tolist()
        cat_cols = [c for c in analysis_df.columns if c not in num_cols and c not in dt_cols]

        st.subheader("Recommended Charts")
        recommendations = recommend_universal_charts(analysis_df, max_items=6)
        rec_idx = 0
        if recommendations:
            rec_titles = [f"{i+1}. {r['title']}" for i, r in enumerate(recommendations)]
            rec_default = int(prefill.get("rec_idx", 0))
            rec_default = rec_default if 0 <= rec_default < len(rec_titles) else 0
            pick = st.selectbox("Recommended view", rec_titles, index=rec_default)
            rec_idx = rec_titles.index(pick)
            chosen = recommendations[rec_idx]
            st.caption(f"Why this view: {chosen['reason']}")
            render_recommended_chart(analysis_df, chosen, key_prefix=f"rec_{rec_idx}")
        else:
            st.caption("No chart recommendations available for this dataset shape.")

        st.subheader("Adaptive Analysis")
        a1, a2 = st.columns(2)
        with a1:
            num_options = ["None"] + num_cols
            selected_num = st.selectbox(
                "Numeric column",
                num_options,
                index=_safe_index(num_options, prefill.get("selected_num", "None"), default=0)
            )
        with a2:
            cat_options = ["None"] + cat_cols
            selected_cat = st.selectbox(
                "Categorical/Text column",
                cat_options,
                index=_safe_index(cat_options, prefill.get("selected_cat", "None"), default=0)
            )

        if selected_num != "None":
            h1, h2 = st.columns(2)
            with h1:
                fig_hist = px.histogram(analysis_df, x=selected_num, nbins=40, title=f"Distribution: {selected_num}")
                st.plotly_chart(fig_hist, use_container_width=True)
            with h2:
                fig_box = px.box(analysis_df, y=selected_num, title=f"Outliers: {selected_num}")
                st.plotly_chart(fig_box, use_container_width=True)

        if selected_cat != "None":
            cat_count = (
                analysis_df[selected_cat]
                .astype(str)
                .fillna("Unknown")
                .value_counts()
                .head(20)
                .reset_index()
            )
            cat_count.columns = [selected_cat, "Count"]
            fig_cat = px.bar(cat_count, x=selected_cat, y="Count", title=f"Top Categories: {selected_cat}")
            st.plotly_chart(fig_cat, use_container_width=True)

        if len(num_cols) >= 2:
            corr_df = analysis_df[num_cols].corr(numeric_only=True)
            fig_corr = px.imshow(
                corr_df,
                text_auto=".2f",
                color_continuous_scale="RdBu",
                title="Numeric Correlation Matrix",
                zmin=-1,
                zmax=1
            )
            st.plotly_chart(fig_corr, use_container_width=True)

        if dt_cols and num_cols:
            t1, t2, t3 = st.columns(3)
            dt_col = t1.selectbox("Time column", dt_cols, index=_safe_index(dt_cols, prefill.get("dt_col"), default=0))
            ts_num_col = t2.selectbox("Measure", num_cols, index=_safe_index(num_cols, prefill.get("ts_num_col"), default=0))
            freq_options = ["D", "W", "M", "Q"]
            freq = t3.selectbox("Frequency", freq_options, index=_safe_index(freq_options, prefill.get("freq", "M"), default=2))
            ts_df = analysis_df[[dt_col, ts_num_col]].dropna().copy()
            ts_df["_period"] = ts_df[dt_col].dt.to_period(freq).dt.to_timestamp()
            ts_agg = ts_df.groupby("_period", as_index=False)[ts_num_col].sum().sort_values("_period")
            fig_ts = px.line(ts_agg, x="_period", y=ts_num_col, markers=True, title=f"Time Trend: {ts_num_col}")
            st.plotly_chart(fig_ts, use_container_width=True)

        st.subheader("Narrative Summary")
        if "ua_narrative" not in st.session_state:
            st.session_state["ua_narrative"] = prefill.get("narrative", "")
        if st.button("Generate Narrative Summary", use_container_width=False):
            st.session_state["ua_narrative"] = build_narrative_summary(selected_df, dataset_name=selected_name)
        st.text_area("Narrative output", value=st.session_state["ua_narrative"], height=220)

        current_config = {
            "session_name": save_name,
            "sep_choice": sep_choice,
            "sample_rows": int(sample_rows),
            "standardize_cols": bool(standardize_cols),
            "parse_numeric": bool(parse_numeric),
            "parse_dates": bool(parse_dates),
            "drop_dups": bool(drop_dups),
            "missing_strategy": missing_strategy,
            "cap_outliers": bool(cap_outliers),
            "analysis_mode": analysis_mode,
            "selected_name": selected_name,
            "combine_type": combine_type,
            "union_names": union_names,
            "left_name": left_name,
            "right_name": right_name,
            "left_key": left_key,
            "right_key": right_key,
            "join_how": join_how,
            "chain_base": chain_base,
            "chain_steps_count": len(chain_steps),
            "chain_steps": chain_steps,
            "selected_num": selected_num,
            "selected_cat": selected_cat,
            "rec_idx": int(rec_idx),
            "dt_col": dt_col if dt_cols and num_cols else None,
            "ts_num_col": ts_num_col if dt_cols and num_cols else None,
            "freq": freq if dt_cols and num_cols else "M",
            "narrative": st.session_state["ua_narrative"],
            "updated_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        }

        saved_sessions["__last__"] = current_config
        # Only touch disk when the configuration actually changed - previously
        # this wrote the JSON store on EVERY rerun.
        _cfg_cmp = {k: v for k, v in current_config.items() if k != "updated_at"}
        if _cfg_cmp != st.session_state.get("ua_last_saved_config"):
            save_universal_session_store(saved_sessions)
            st.session_state["ua_last_saved_config"] = _cfg_cmp
        st.session_state["ua_saved_sessions"] = saved_sessions

        ps1, ps2 = st.columns([2, 1])
        if ps2.button("Save Session", use_container_width=True):
            final_name = save_name.strip() if save_name else f"session_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
            saved_sessions[final_name] = current_config
            ok, msg = save_universal_session_store(saved_sessions)
            st.session_state["ua_saved_sessions"] = saved_sessions
            if ok:
                st.success(f"Saved session: {final_name}")
            else:
                st.error(msg)
            st.session_state["ua_prefill_config"] = current_config

        st.subheader("Data Preview")
        display_limited_df(selected_df, "Analysis dataset", limit=table_limit)

        csv_out = selected_df.to_csv(index=False).encode("utf-8")
        st.download_button(
            label="Download Analysis Data (CSV)",
            data=csv_out,
            file_name=f"analysis_{selected_name}.csv",
            mime="text/csv"
        )
    else:
        st.info("Upload one or more datasets to start universal profiling, joins, and analysis.")
