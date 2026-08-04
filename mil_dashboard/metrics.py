"""Pure metric/aggregation computations over the master dataframes."""

import os
import re
import streamlit as st
import pandas as pd
import numpy as np
from datetime import datetime
from .config import KEY_QUALITY_COLUMNS, MONTH_ORDER, REQUIRED_COLUMNS


def apply_time_window(labels, freq, window):
    if not labels:
        return labels
    if window == "YTD":
        return labels
    if window == "Last 12 Months":
        if freq == "M":
            return labels[-12:]
        return labels[-4:]
    if freq == "M":
        n = 6 if window == "Last 6 Months" else 3
        return labels[-n:]
    # Quarterly
    n = 2 if window == "Last 6 Months" else 1
    return labels[-n:]


def build_five_second_summary(live_finance, admissions_df, ds_bundle=None):
    total_billed = float(live_finance.get("Total Billed", 0)) if live_finance else 0
    total_collected = float(live_finance.get("Total Collected", 0)) if live_finance else 0
    collection_rate = float(live_finance.get("Collection Rate (%)", 0)) if live_finance else 0
    collection_gap = float(live_finance.get("Collection Gap", 0)) if live_finance else 0

    admission_total = int(admissions_df.sum().sum()) if admissions_df is not None and not admissions_df.empty else 0
    risk_cases = 0
    if ds_bundle and ds_bundle.get("episode_features") is not None and not ds_bundle["episode_features"].empty:
        ep = ds_bundle["episode_features"]
        if "risk_band" in ep.columns:
            risk_cases = int(ep["risk_band"].isin(["High", "Critical"]).sum())

    if collection_rate >= 85 and collection_gap <= max(1, total_billed * 0.12):
        headline = "Revenue health is stable; optimize high-risk cohorts for incremental gains."
        tone = "Stable"
    elif collection_rate < 75 or collection_gap > max(1, total_billed * 0.2):
        headline = "Revenue risk is elevated; prioritize leakage recovery and high-risk episodes."
        tone = "Critical"
    else:
        headline = "Performance is mixed; enforce targeted interventions by payer and ward."
        tone = "Watchlist"

    return {
        "headline": headline,
        "tone": tone,
        "kpis": {
            "Admissions": admission_total,
            "Collection Rate %": round(collection_rate, 1),
            "Collection Gap": collection_gap,
            "High/Critical Risk Episodes": risk_cases,
            "Total Collected": total_collected
        }
    }


def generate_narrative_actions(ds_bundle, live_finance, admissions_df, selected_hospital="All", selected_payer="All", start_date=None, end_date=None):
    actions = []
    scope = []
    if selected_hospital and selected_hospital != "All":
        scope.append(f"hospital={selected_hospital}")
    if selected_payer and selected_payer != "All":
        scope.append(f"payer={selected_payer}")
    if start_date and end_date:
        scope.append(f"period={start_date} to {end_date}")
    scope_text = ", ".join(scope) if scope else "all data"

    total_billed = float(live_finance.get("Total Billed", 0)) if live_finance else 0
    total_gap = float(live_finance.get("Collection Gap", 0)) if live_finance else 0
    collection_rate = float(live_finance.get("Collection Rate (%)", 0)) if live_finance else 0
    if total_billed > 0:
        gap_ratio = (total_gap / total_billed) * 100
    else:
        gap_ratio = 0

    if collection_rate < 80 or gap_ratio > 18:
        actions.append(
            f"Revenue recovery for {scope_text}: execute a 7-day gap closure sprint on top leakage accounts (gap ratio {gap_ratio:.1f}%)."
        )
    else:
        actions.append(
            f"Revenue optimization for {scope_text}: maintain recovery cadence and target payer-specific leakage reduction below 10%."
        )

    if ds_bundle:
        ep = ds_bundle.get("episode_features", pd.DataFrame())
        payer = ds_bundle.get("payer_leakage", pd.DataFrame())
        ward = ds_bundle.get("ward_risk", pd.DataFrame())
        readm = ds_bundle.get("readmission", {})

        if ep is not None and not ep.empty and "risk_band" in ep.columns:
            high_cases = int(ep["risk_band"].isin(["High", "Critical"]).sum())
            pct = (high_cases / len(ep)) * 100 if len(ep) else 0
            actions.append(
                f"Clinical-risk containment: route {high_cases:,} high/critical episodes ({pct:.1f}%) to joint clinical-finance review."
            )

        if payer is not None and not payer.empty:
            top = payer.iloc[0]
            actions.append(
                f"Payer action: renegotiate or audit {top['Medical Aid']} pathway (leakage {top['Leakage_%']:.1f}%, gap ${top['Gap']:,.0f})."
            )
        elif ward is not None and not ward.empty:
            topw = ward.iloc[0]
            actions.append(
                f"Ward action: deploy focused intervention in {topw['Ward']} (avg risk {topw['Avg_Risk']:.1f}, gap ${topw['Total_Gap']:,.0f})."
            )

        if readm and readm.get("summary", {}).get("high_risk_cases", 0) > 0:
            high_r = readm["summary"]["high_risk_cases"]
            actions.append(
                f"Post-discharge program: schedule 72-hour follow-up for {high_r:,} high readmission-risk cases."
            )

    if admissions_df is not None and not admissions_df.empty:
        total_adm = int(admissions_df.sum().sum())
        actions.append(
            f"Capacity planning: align staffing and bed allocation to current volume ({total_adm:,} admissions in selected scope)."
        )

    # Keep concise and prioritized
    return actions[:3]


def build_summary_metrics(live_finance, admissions_df, ward_data, cpt_metrics=None):
    rows = []
    if live_finance:
        rows.append({"Metric": "Total Billed", "Value": f"${live_finance.get('Total Billed', 0):,.0f}"})
        rows.append({"Metric": "Total Collected", "Value": f"${live_finance.get('Total Collected', 0):,.0f}"})
        rows.append({"Metric": "Collection Rate", "Value": f"{live_finance.get('Collection Rate (%)', 0):.1f}%"})
        rows.append({"Metric": "Collection Gap", "Value": f"${live_finance.get('Collection Gap', 0):,.0f}"})
    if admissions_df is not None and not admissions_df.empty:
        rows.append({"Metric": "Total Admissions", "Value": f"{admissions_df.sum().sum():,.0f}"})
    if ward_data is not None and not ward_data.empty:
        rows.append({"Metric": "Wards Tracked", "Value": f"{ward_data['Ward'].nunique()}"})
    if cpt_metrics:
        rows.append({"Metric": "CPT Episodes", "Value": f"{cpt_metrics.get('Unique Episodes', 0):,}"})
        rows.append({"Metric": "Avg LOS (days)", "Value": f"{cpt_metrics.get('Avg LOS (days)', 0)}"})
        rows.append({"Metric": "Avg Cost per Episode", "Value": f"${cpt_metrics.get('Avg Cost per Episode', 0):,.2f}"})
    return pd.DataFrame(rows)


def compute_quality_summary(df):
    if df is None or df.empty:
        return {"score": 0, "status": "CRITICAL", "issues": ["No data loaded"]}

    issues = []
    score = 100.0

    missing = [c for c in REQUIRED_COLUMNS if c not in df.columns]
    if missing:
        issues.append(f"Missing columns: {', '.join(missing)}")
        score -= 10 * len(missing)

    dup = safe_count_duplicates(df, "episode_id")
    if dup is not None and dup > 0:
        dup_rate = dup / max(len(df), 1)
        issues.append(f"Duplicate episode_id: {dup}")
        score -= min(20, dup_rate * 100)

    null_rates = []
    for col in KEY_QUALITY_COLUMNS:
        if col in df.columns:
            null_rates.append(df[col].isna().mean() * 100)
    if null_rates:
        avg_null = sum(null_rates) / len(null_rates)
        if avg_null > 0:
            issues.append(f"Avg null rate (key cols): {avg_null:.1f}%")
            score -= min(30, avg_null)

    neg_counts = []
    for col in ["Original Billed", "Total_Paid_To_Date", "Collection_Gap"]:
        if col in df.columns:
            neg_counts.append((pd.to_numeric(df[col], errors="coerce") < 0).sum())
    if neg_counts and sum(neg_counts) > 0:
        issues.append(f"Negative values (key cols): {int(sum(neg_counts))}")
        score -= min(20, (sum(neg_counts) / max(len(df), 1)) * 100)

    score = max(0, round(score, 1))
    status = "OK" if score >= 85 else ("WARNING" if score >= 70 else "CRITICAL")
    return {"score": score, "status": status, "issues": issues}


def compute_compliance_metrics(df):
    if df is None or df.empty:
        return {}
    out = {}
    if "Has_Auth" in df.columns:
        out["Auth Coverage %"] = round(df["Has_Auth"].fillna(0).mean() * 100, 1)
    if "Admission Date" in df.columns and "Submission Date" in df.columns:
        adm = pd.to_datetime(df["Admission Date"], errors="coerce", dayfirst=True)
        sub = pd.to_datetime(df["Submission Date"], errors="coerce", dayfirst=True)
        delta = (sub - adm).dt.days
        out["Avg Submission Delay (days)"] = round(delta.dropna().mean(), 1) if delta.notna().any() else None
    return out


def compute_risk_indicators(df):
    if df is None or df.empty:
        return {}
    out = {}
    gap = pd.to_numeric(df.get("Collection_Gap", 0), errors="coerce").fillna(0)
    aging = (
        pd.to_numeric(df.get("90 Days", 0), errors="coerce").fillna(0) +
        pd.to_numeric(df.get("120 Days", 0), errors="coerce").fillna(0) +
        pd.to_numeric(df.get("150+ Days", 0), errors="coerce").fillna(0)
    )
    out["High Risk Episodes"] = int(((aging > aging.quantile(0.9)) | (gap > gap.quantile(0.9))).sum()) if len(df) > 0 else 0
    out["Total At-Risk Amount"] = round(aging.sum(), 2)
    return out


def compute_operational_alerts(df, live_finance, target_collection_pct):
    if df is None or df.empty:
        return pd.DataFrame()

    alerts = []
    billed = resolve_billed_series(df)
    collected = resolve_collected_series(df)
    total_billed = float(billed.sum()) if billed is not None else 0.0
    total_collected = float(collected.sum()) if collected is not None else 0.0
    collection_rate = round((total_collected / total_billed) * 100, 1) if total_billed > 0 else 0.0

    if collection_rate < target_collection_pct:
        gap_vs_target = target_collection_pct - collection_rate
        alerts.append({
            "Priority": "High" if gap_vs_target >= 8 else "Medium",
            "Alert": "Collection rate below target",
            "Value": f"{collection_rate:.1f}% vs {target_collection_pct:.1f}%",
            "Action": "Prioritize high-gap wards and top payer leakage this week."
        })

    if total_billed > 0:
        aging_90 = float(safe_sum(df, "90 Days") + safe_sum(df, "120 Days") + safe_sum(df, "150+ Days"))
        aging_ratio = (aging_90 / total_billed) * 100
        if aging_ratio >= 20:
            alerts.append({
                "Priority": "High",
                "Alert": "High long-outstanding receivables",
                "Value": f"{aging_ratio:.1f}% of billed in 90+ day bucket",
                "Action": "Escalate payer follow-ups and settlement plans."
            })

    if "Medical Aid" in df.columns and billed is not None and collected is not None:
        payer_df = df.copy()
        payer_df["_billed"] = billed
        payer_df["_collected"] = collected
        payer = payer_df.groupby("Medical Aid", as_index=False).agg(
            billed=("_billed", "sum"),
            collected=("_collected", "sum")
        )
        payer["gap"] = payer["billed"] - payer["collected"]
        payer = payer.sort_values("gap", ascending=False)
        if not payer.empty and float(payer.iloc[0]["gap"]) > 0:
            alerts.append({
                "Priority": "Medium",
                "Alert": "Top payer leakage concentration",
                "Value": f"{payer.iloc[0]['Medical Aid']}: ${float(payer.iloc[0]['gap']):,.0f} gap",
                "Action": "Review denial pattern and claim aging for this payer."
            })

    if "Ward" in df.columns and billed is not None and collected is not None:
        ward_df = df.copy()
        ward_df["_billed"] = billed
        ward_df["_collected"] = collected
        ward = ward_df.groupby("Ward", as_index=False).agg(
            billed=("_billed", "sum"),
            collected=("_collected", "sum")
        )
        ward["collection_rate"] = np.where(ward["billed"] > 0, (ward["collected"] / ward["billed"]) * 100, 0.0)
        ward = ward.sort_values("collection_rate", ascending=True)
        if not ward.empty:
            worst = ward.iloc[0]
            alerts.append({
                "Priority": "Medium",
                "Alert": "Ward under-performing on collections",
                "Value": f"{worst['Ward']}: {float(worst['collection_rate']):.1f}%",
                "Action": "Audit documentation and billing turnaround for this ward."
            })

    quality = compute_quality_summary(df)
    if quality["score"] < 80:
        alerts.append({
            "Priority": "Medium",
            "Alert": "Data quality risk",
            "Value": f"Quality score {quality['score']:.1f} ({quality['status']})",
            "Action": "Resolve missing/duplicate key fields before board reporting."
        })

    if not alerts:
        alerts.append({
            "Priority": "Low",
            "Alert": "No critical operational alerts",
            "Value": "All monitored checks are within threshold.",
            "Action": "Maintain current operating cadence."
        })

    order = {"High": 0, "Medium": 1, "Low": 2}
    out = pd.DataFrame(alerts)
    out["_order"] = out["Priority"].map(order).fillna(9)
    return out.sort_values("_order").drop(columns=["_order"]).reset_index(drop=True)


def lookup_episode_matches(df, query_text, max_rows=25):
    if df is None or df.empty or not query_text:
        return pd.DataFrame()
    query = str(query_text).strip().lower()
    if not query:
        return pd.DataFrame()

    match_cols = [c for c in ["episode_id", "Episode Number", "Hospital Number", "ID Number", "Patient Name"] if c in df.columns]
    if not match_cols:
        return pd.DataFrame()

    mask = pd.Series(False, index=df.index)
    for col in match_cols:
        series = df[col].astype(str).str.lower()
        mask = mask | series.str.contains(query, na=False)

    if not mask.any():
        return pd.DataFrame()

    cols = [c for c in [
        "episode_id", "Patient Name", "Hospital", "Ward", "Medical Aid",
        "Original Billed", "Total_Paid_To_Date", "Collection_Gap",
        "Admission Date", "Discharge Date", "ID Number", "Hospital Number"
    ] if c in df.columns]
    return df.loc[mask, cols].head(max_rows).copy()


def compute_insurer_deductions(df):
    if df is None or df.empty or "Medical Aid" not in df.columns:
        return pd.DataFrame()
    billed = resolve_billed_series(df)
    collected = resolve_collected_series(df)
    tmp = df.copy()
    tmp["_billed"] = billed if billed is not None else 0
    tmp["_collected"] = collected if collected is not None else 0
    agg = tmp.groupby("Medical Aid", as_index=False).agg(
        Total_Billed=("_billed", "sum"),
        Total_Collected=("_collected", "sum")
    )
    agg["Gap"] = agg["Total_Billed"] - agg["Total_Collected"]
    agg["Gap_%"] = (agg["Gap"] / agg["Total_Billed"] * 100).replace([float("inf"), -float("inf")], 0).fillna(0).round(1)
    return agg.sort_values("Gap_%", ascending=False)


def compute_projections(admissions_df, payments_df):
    proj = {}
    if admissions_df is not None and not admissions_df.empty:
        months = [m for m in MONTH_ORDER if m in admissions_df.columns]
        if len(months) >= 3:
            last3 = admissions_df[months[-3:]].sum()
            proj["Next Month Admissions (avg last 3)"] = round(last3.mean(), 0)
    if payments_df is not None and not payments_df.empty and "Date" in payments_df.columns:
        p = payments_df.copy()
        p["Date"] = pd.to_datetime(p["Date"], errors="coerce", dayfirst=True)
        p = p[p["Date"].notna()]
        if not p.empty:
            p["_month"] = p["Date"].dt.to_period("M").astype(str)
            by_month = p.groupby("_month")["Amount"].sum().tail(3)
            if len(by_month) >= 1:
                proj["Next Month Collections (avg last 3)"] = round(by_month.mean(), 2)
    return proj


def get_numeric_series(df, col):
    if df is None or df.empty or col not in df.columns:
        return pd.Series([0] * (0 if df is None else len(df)))
    return pd.to_numeric(df[col], errors="coerce").fillna(0)


def compute_theatre_minutes(df):
    if df is None or df.empty:
        return pd.Series([0] * (0 if df is None else len(df)))
    minutes = get_numeric_series(df, "THT Minutes")
    if minutes.sum() == 0 and "Theatre Time In" in df.columns and "Theatre Time Out" in df.columns:
        start = pd.to_datetime(df["Theatre Time In"], errors="coerce")
        end = pd.to_datetime(df["Theatre Time Out"], errors="coerce")
        delta = (end - start).dt.total_seconds() / 60.0
        delta = delta.where(delta >= 0, delta + 1440)
        minutes = delta.fillna(0)
    return minutes


def compute_cpt_cost_components(df):
    if df is None or df.empty:
        return {}
    accom = get_numeric_series(df, "Total Accom")
    theatre = get_numeric_series(df, "THT Value")
    if "Total Stock" in df.columns:
        stock = get_numeric_series(df, "Total Stock")
    else:
        stock = (
            get_numeric_series(df, "Ward Stock Total") +
            get_numeric_series(df, "Pharmacy Stock") +
            get_numeric_series(df, "Prosthesis")
        )
    total = get_numeric_series(df, "Total")
    if total.sum() == 0:
        total = accom + theatre + stock + get_numeric_series(df, "Other")
    other = (total - accom - theatre - stock).clip(lower=0)
    return {
        "Accommodation": accom.sum(),
        "Theatre": theatre.sum(),
        "Stock/Pharmacy": stock.sum(),
        "Other": other.sum()
    }


def compute_cpt_metrics(df):
    if df is None or df.empty:
        return {}
    d = df.copy()
    if "episode_id" not in d.columns and "Episode" in d.columns:
        d["episode_id"] = d["Episode"].astype(str).str.split(":").str[0].str.strip().str.upper()

    los = get_numeric_series(d, "LOS (length of stay)")
    if los.sum() == 0:
        los = get_numeric_series(d, "Total Days")
    los = los[(los >= 0) & (los < 365)]

    total_value = get_numeric_series(d, "Total")
    if total_value.sum() == 0:
        total_value = (
            get_numeric_series(d, "Total Accom") +
            get_numeric_series(d, "THT Value") +
            get_numeric_series(d, "Total Stock") +
            get_numeric_series(d, "Other")
        )
    total_sum = total_value.sum()
    if total_sum == 0:
        components = compute_cpt_cost_components(d)
        total_sum = sum(components.values()) if components else 0

    theatre_minutes = compute_theatre_minutes(d)
    theatre_cases = int((theatre_minutes > 0).sum())
    total_theatre_minutes = theatre_minutes.sum()

    episode_count = d["episode_id"].nunique() if "episode_id" in d.columns else len(d)
    avg_cost = (total_sum / episode_count) if episode_count else 0

    metrics = {
        "CPT Records": len(d),
        "Unique Episodes": episode_count,
        "Total Cost": total_sum,
        "Avg Cost per Episode": round(avg_cost, 2),
        "Total Bed Days": round(los.sum(), 1) if not los.empty else 0,
        "Avg LOS (days)": round(los.mean(), 1) if not los.empty else None,
        "Theatre Cases": theatre_cases,
        "Total Theatre Minutes": round(total_theatre_minutes, 1),
        "Avg Theatre Minutes": round(total_theatre_minutes / theatre_cases, 1) if theatre_cases else None
    }
    return metrics


def build_cpt_top_tables(df):
    if df is None or df.empty:
        return {}
    d = df.copy()
    if "episode_id" not in d.columns and "Episode" in d.columns:
        d["episode_id"] = d["Episode"].astype(str).str.split(":").str[0].str.strip().str.upper()
    d["_total"] = get_numeric_series(d, "Total")
    if d["_total"].sum() == 0:
        d["_total"] = (
            get_numeric_series(d, "Total Accom") +
            get_numeric_series(d, "THT Value") +
            get_numeric_series(d, "Total Stock") +
            get_numeric_series(d, "Other")
        )

    tables = {}

    if "Primary CPT Code" in d.columns or "Primary CPT Description" in d.columns:
        d["Primary CPT Code"] = d.get("Primary CPT Code", "").astype(str).str.strip()
        d["Primary CPT Description"] = d.get("Primary CPT Description", "").astype(str).str.strip()
        d["CPT_Label"] = d["Primary CPT Code"].replace("nan", "").fillna("")
        d["CPT_Label"] = d["CPT_Label"].where(d["CPT_Label"] != "", d["Primary CPT Description"])
        top_cpt = d.groupby("CPT_Label", as_index=False).agg(
            Cases=("episode_id", "count"),
            Total_Cost=("_total", "sum")
        ).sort_values("Total_Cost", ascending=False)
        top_cpt = top_cpt[top_cpt["CPT_Label"].notna() & (top_cpt["CPT_Label"] != "")]
        tables["top_cpt"] = top_cpt.head(15)

    if "Primary ICD Code" in d.columns or "Primary ICD Description" in d.columns:
        d["Primary ICD Code"] = d.get("Primary ICD Code", "").astype(str).str.strip()
        d["Primary ICD Description"] = d.get("Primary ICD Description", "").astype(str).str.strip()
        d["ICD_Label"] = d["Primary ICD Code"].replace("nan", "").fillna("")
        d["ICD_Label"] = d["ICD_Label"].where(d["ICD_Label"] != "", d["Primary ICD Description"])
        top_icd = d.groupby("ICD_Label", as_index=False).agg(
            Cases=("episode_id", "count"),
            Total_Cost=("_total", "sum")
        ).sort_values("Cases", ascending=False)
        top_icd = top_icd[top_icd["ICD_Label"].notna() & (top_icd["ICD_Label"] != "")]
        tables["top_icd"] = top_icd.head(15)

    if "Doctor" in d.columns:
        top_doc = d.groupby("Doctor", as_index=False).agg(
            Cases=("episode_id", "count"),
            Total_Cost=("_total", "sum")
        ).sort_values("Total_Cost", ascending=False)
        tables["top_doctors"] = top_doc.head(15)

    if "Theatre Location" in d.columns:
        d["_theatre_minutes"] = compute_theatre_minutes(d)
        by_loc = d.groupby("Theatre Location", as_index=False).agg(
            Theatre_Cases=("episode_id", "count"),
            Total_Minutes=("_theatre_minutes", "sum"),
            Avg_Minutes=("_theatre_minutes", "mean")
        ).sort_values("Total_Minutes", ascending=False)
        tables["theatre_by_location"] = by_loc.head(15)

    day_cols = [c for c in d.columns if c.endswith(" Days") and c not in ["Total Days"]]
    if day_cols:
        day_totals = d[day_cols].apply(pd.to_numeric, errors="coerce").fillna(0).sum().reset_index()
        day_totals.columns = ["Ward_Type", "Total_Days"]
        day_totals = day_totals.sort_values("Total_Days", ascending=False)
        tables["ward_days"] = day_totals

    return tables


def compute_cpt_quality(df):
    if df is None or df.empty:
        return pd.DataFrame([{"Check": "CPT data loaded", "Result": "No data"}])
    checks = []
    required = ["Episode", "Adm Date", "Disch Date", "Primary ICD Code", "Primary CPT Code", "Total"]
    missing = [c for c in required if c not in df.columns]
    checks.append({"Check": "Missing key columns", "Result": ", ".join(missing) if missing else "OK"})
    if "Episode" in df.columns:
        dup = df["Episode"].duplicated().sum()
        checks.append({"Check": "Duplicate Episode", "Result": str(int(dup))})
    if "Total" in df.columns:
        null_rate = pd.to_numeric(df["Total"], errors="coerce").isna().mean() * 100
        checks.append({"Check": "Null rate: Total", "Result": f"{null_rate:.1f}%"})
    if "LOS (length of stay)" in df.columns:
        los = pd.to_numeric(df["LOS (length of stay)"], errors="coerce")
        neg = (los < 0).sum()
        checks.append({"Check": "Negative LOS", "Result": str(int(neg))})
    return pd.DataFrame(checks)


def normalize_master_schema(df):
    if df is None or df.empty:
        return pd.DataFrame()

    d = df.copy()

    if "episode_id" not in d.columns and "Episode" in d.columns:
        d["episode_id"] = d["Episode"].astype(str).str.split(":").str[0].str.strip().str.upper()
    elif "episode_id" in d.columns:
        d["episode_id"] = d["episode_id"].astype(str).str.strip().str.upper()

    if "Admission Date" not in d.columns and "Adm Date" in d.columns:
        d["Admission Date"] = d["Adm Date"]
    if "Discharge Date" not in d.columns and "Disch Date" in d.columns:
        d["Discharge Date"] = d["Disch Date"]

    for c in ["Admission Date", "Discharge Date", "Submission Date", "ChangeDate"]:
        if c in d.columns:
            d[c] = pd.to_datetime(d[c], errors="coerce", dayfirst=True)

    if "Original Billed" not in d.columns:
        if "Total Amount" in d.columns:
            d["Original Billed"] = d["Total Amount"]
        elif "Total" in d.columns:
            d["Original Billed"] = d["Total"]
        else:
            d["Original Billed"] = 0

    if "Total_Paid_To_Date" not in d.columns:
        if "Total_Paid" in d.columns:
            d["Total_Paid_To_Date"] = d["Total_Paid"]
        else:
            d["Total_Paid_To_Date"] = 0

    d["Original Billed"] = pd.to_numeric(d["Original Billed"], errors="coerce").fillna(0)
    d["Total_Paid_To_Date"] = pd.to_numeric(d["Total_Paid_To_Date"], errors="coerce").fillna(0)
    d["Collection_Gap"] = (d["Original Billed"] - d["Total_Paid_To_Date"]).round(2)

    return d


def apply_global_filters(df_full, cpt_df, payments_df, start_date=None, end_date=None, hospital=None, payer=None):
    dff = df_full.copy() if df_full is not None else pd.DataFrame()
    cptf = cpt_df.copy() if cpt_df is not None else pd.DataFrame()
    payf = payments_df.copy() if payments_df is not None else pd.DataFrame()

    if start_date and end_date:
        if not dff.empty:
            date_col = next((c for c in ["Admission Date", "Adm Date", "Discharge Date"] if c in dff.columns), None)
            if date_col:
                dt = pd.to_datetime(dff[date_col], errors="coerce", dayfirst=True)
                dff = dff[(dt >= pd.to_datetime(start_date)) & (dt <= pd.to_datetime(end_date))]
        if not cptf.empty:
            date_col = next((c for c in ["Adm Date", "Disch Date", "Theatre date"] if c in cptf.columns), None)
            if date_col:
                dt = pd.to_datetime(cptf[date_col], errors="coerce", dayfirst=True)
                cptf = cptf[(dt >= pd.to_datetime(start_date)) & (dt <= pd.to_datetime(end_date))]
        if not payf.empty and "Date" in payf.columns:
            dt = pd.to_datetime(payf["Date"], errors="coerce", dayfirst=True)
            payf = payf[(dt >= pd.to_datetime(start_date)) & (dt <= pd.to_datetime(end_date))]

    if hospital and hospital != "All":
        if not dff.empty and "Hospital" in dff.columns:
            dff = dff[dff["Hospital"].astype(str) == hospital]
        if not cptf.empty and "Hospital" in cptf.columns:
            cptf = cptf[cptf["Hospital"].astype(str) == hospital]
        if not payf.empty and "Hospital" in payf.columns:
            payf = payf[payf["Hospital"].astype(str) == hospital]

    if payer and payer != "All":
        if not dff.empty and "Medical Aid" in dff.columns:
            dff = dff[dff["Medical Aid"].astype(str) == payer]
        if not cptf.empty and "Medical Aid" in cptf.columns:
            cptf = cptf[cptf["Medical Aid"].astype(str) == payer]
        if not payf.empty and "Medical Aid" in payf.columns:
            payf = payf[payf["Medical Aid"].astype(str) == payer]

    return dff, cptf, payf


def standardize_column_name(name):
    cleaned = re.sub(r"[^0-9a-zA-Z]+", "_", str(name).strip().lower())
    cleaned = re.sub(r"_+", "_", cleaned).strip("_")
    return cleaned or "column"


def infer_column_roles(df):
    roles = []
    if df is None or df.empty:
        return pd.DataFrame(columns=["column", "dtype", "role", "missing_%", "unique"])

    sample_n = min(len(df), 5000)
    sampled = df.head(sample_n)

    for col in df.columns:
        series = sampled[col]
        dtype_name = str(df[col].dtype)
        missing_pct = round(df[col].isna().mean() * 100, 2)
        unique_count = int(df[col].nunique(dropna=True))
        role = "categorical"

        if pd.api.types.is_numeric_dtype(df[col]):
            role = "numeric"
        elif pd.api.types.is_datetime64_any_dtype(df[col]):
            role = "datetime"
        else:
            str_vals = series.astype(str).str.strip()
            parsed_dt = pd.to_datetime(str_vals, errors="coerce", dayfirst=True)
            dt_ratio = parsed_dt.notna().mean()
            if dt_ratio >= 0.7:
                role = "datetime"
            else:
                lowered = str_vals.str.lower()
                bool_ratio = lowered.isin(["true", "false", "yes", "no", "y", "n", "0", "1"]).mean()
                if bool_ratio >= 0.8:
                    role = "boolean-like"
                elif unique_count > max(50, int(sample_n * 0.4)):
                    role = "text"

        roles.append({
            "column": col,
            "dtype": dtype_name,
            "role": role,
            "missing_%": missing_pct,
            "unique": unique_count
        })

    return pd.DataFrame(roles)


def list_files_for_selector(folder, suffixes):
    if not os.path.exists(folder):
        return []
    out = []
    for name in os.listdir(folder):
        p = os.path.join(folder, name)
        if os.path.isfile(p) and any(name.lower().endswith(s) for s in suffixes):
            out.append(p.replace("\\", "/"))
    return sorted(out)


def clean_master_dataframe(df):
    if df is None or df.empty:
        return pd.DataFrame(), {"rows_before": 0, "rows_after": 0, "duplicates_removed": 0}

    d = df.copy()
    rows_before = len(d)

    if "episode_id" in d.columns:
        d["episode_id"] = d["episode_id"].astype(str).str.strip().str.upper()

    date_cols = ["Admission Date", "Discharge Date", "Submission Date", "ChangeDate"]
    for c in date_cols:
        if c in d.columns:
            d[c] = pd.to_datetime(d[c], errors="coerce", dayfirst=True)

    numeric_cols = [
        "Original Billed", "Total Amount", "Total_Paid", "Total_Paid_To_Date", "Collection_Gap",
        "Current", "30 Days", "60 Days", "90 Days", "120 Days", "150+ Days",
        "Monthly_Interest_Loss", "Duration (mins)"
    ]
    for c in numeric_cols:
        if c in d.columns:
            d[c] = pd.to_numeric(d[c], errors="coerce")

    if "Original Billed" not in d.columns and "Total Amount" in d.columns:
        d["Original Billed"] = d["Total Amount"]
    if "Total_Paid_To_Date" not in d.columns and "Total_Paid" in d.columns:
        d["Total_Paid_To_Date"] = d["Total_Paid"]

    d["Original Billed"] = pd.to_numeric(d.get("Original Billed", 0), errors="coerce").fillna(0).clip(lower=0)
    d["Total_Paid_To_Date"] = pd.to_numeric(d.get("Total_Paid_To_Date", 0), errors="coerce").fillna(0).clip(lower=0)
    d["Collection_Gap"] = (d["Original Billed"] - d["Total_Paid_To_Date"]).round(2)

    if "Monthly_Interest_Loss" in d.columns:
        d["Monthly_Interest_Loss"] = pd.to_numeric(d["Monthly_Interest_Loss"], errors="coerce").fillna(0).clip(lower=0)

    for c in ["Hospital", "Medical Aid", "Medical Aid Scheme", "Ward", "Patient Name"]:
        if c in d.columns:
            d[c] = d[c].astype(str).str.strip().replace({"": "Unknown", "nan": "Unknown"})

    duplicates_removed = 0
    if "episode_id" in d.columns:
        sort_cols = [c for c in ["Submission Date", "ChangeDate", "Admission Date"] if c in d.columns]
        if sort_cols:
            d = d.sort_values(sort_cols)
        before = len(d)
        d = d.drop_duplicates(subset=["episode_id"], keep="last")
        duplicates_removed = before - len(d)

    d = d.reset_index(drop=True)
    return d, {
        "rows_before": rows_before,
        "rows_after": len(d),
        "duplicates_removed": duplicates_removed
    }


def run_join_chain(dataset_store, base_name, chain_steps):
    if base_name not in dataset_store:
        return pd.DataFrame(), ["Base dataset not found."]

    current_df = dataset_store[base_name]["clean"].copy()
    notes = [f"Join chain base: {base_name}"]

    for i, step in enumerate(chain_steps, start=1):
        right_name = step.get("right_name")
        left_key = step.get("left_key")
        right_key = step.get("right_key")
        how = step.get("how", "inner")

        if right_name not in dataset_store:
            notes.append(f"Step {i}: skipped, right dataset not found ({right_name}).")
            continue
        right_df = dataset_store[right_name]["clean"]
        if left_key not in current_df.columns or right_key not in right_df.columns:
            notes.append(f"Step {i}: skipped, invalid keys ({left_key}, {right_key}).")
            continue

        before_rows = len(current_df)
        current_df = current_df.merge(
            right_df,
            left_on=left_key,
            right_on=right_key,
            how=how,
            suffixes=(f"_s{i}l", f"_s{i}r")
        )
        notes.append(
            f"Step {i}: {how.upper()} join with {right_name} on {left_key}={right_key} "
            f"({before_rows:,} -> {len(current_df):,} rows)"
        )

    return current_df, notes


def safe_sum(df, col):
    if df is None or df.empty or col not in df.columns:
        return 0
    return pd.to_numeric(df[col], errors="coerce").fillna(0).sum()


def resolve_billed_series(df):
    if df is None or df.empty:
        return None
    if "Original Billed" in df.columns:
        billed = pd.to_numeric(df["Original Billed"], errors="coerce").fillna(0)
    else:
        # Align with df's index — a fresh RangeIndex silently misaligns after filtering
        billed = pd.Series(0, index=df.index)
    if billed.sum() == 0 and "Total Amount" in df.columns:
        billed = pd.to_numeric(df["Total Amount"], errors="coerce").fillna(0)
    return billed


def resolve_collected_series(df):
    if df is None or df.empty:
        return None
    if "Total_Paid_To_Date" in df.columns:
        collected = pd.to_numeric(df["Total_Paid_To_Date"], errors="coerce").fillna(0)
    else:
        # Align with df's index — a fresh RangeIndex silently misaligns after filtering
        collected = pd.Series(0, index=df.index)
    if collected.sum() == 0 and "Total_Paid" in df.columns:
        collected = pd.to_numeric(df["Total_Paid"], errors="coerce").fillna(0)
    return collected


def aggregate_by_episode(df):
    if df is None or df.empty or "episode_id" not in df.columns:
        return df
    billed = resolve_billed_series(df)
    collected = resolve_collected_series(df)
    tmp = df.copy()
    if billed is not None:
        tmp["_billed"] = billed
    if collected is not None:
        tmp["_collected"] = collected
    agg_spec = {}
    if "_billed" in tmp.columns:
        agg_spec["_billed"] = "max"
    if "_collected" in tmp.columns:
        agg_spec["_collected"] = "max"
    if "Ward" in tmp.columns:
        agg_spec["Ward"] = "first"
    if not agg_spec:
        return tmp.drop_duplicates(subset=["episode_id"])
    agg = tmp.groupby("episode_id", as_index=False).agg(agg_spec)
    return agg


def safe_count_duplicates(df, col):
    if df is None or df.empty or col not in df.columns:
        return None
    return int(df[col].duplicated().sum())


def build_staff_metrics(adm_df, master_df):
    if adm_df is None or adm_df.empty or master_df is None or master_df.empty:
        return pd.DataFrame()
    df = adm_df.copy()
    df["episode_id"] = df["Episode Number"].astype(str).str.strip().str.upper()
    master = master_df.copy()
    if "episode_id" not in master.columns:
        return pd.DataFrame()
    master["episode_id"] = master["episode_id"].astype(str).str.strip().str.upper()
    billed = resolve_billed_series(master)
    collected = resolve_collected_series(master)
    master["_billed"] = billed if billed is not None else 0
    master["_collected"] = collected if collected is not None else 0

    merged = df.merge(master[["episode_id", "_billed", "_collected", "Hospital"]], on="episode_id", how="left")
    staff = merged.groupby("User", as_index=False).agg(
        Admissions=("episode_id", "count"),
        Total_Billed=("_billed", "sum"),
        Total_Collected=("_collected", "sum"),
        Avg_Billed=("_billed", "mean"),
        Avg_Collected=("_collected", "mean")
    )
    staff["Collection_Rate_%"] = (
        (staff["Total_Collected"] / staff["Total_Billed"] * 100)
        .replace([np.inf, -np.inf], 0)
        .fillna(0)
        .round(1)
    )
    staff = staff.sort_values("Admissions", ascending=False)
    return staff


def add_duration_metrics(staff_df, dur_df):
    if staff_df is None or staff_df.empty or dur_df is None or dur_df.empty:
        return staff_df
    if "User" not in dur_df.columns or "Duration (mins)" not in dur_df.columns:
        return staff_df
    d = dur_df.copy()
    d["Duration (mins)"] = pd.to_numeric(d["Duration (mins)"], errors="coerce")
    agg = d.groupby("User", as_index=False).agg(
        Avg_Duration_Min=("Duration (mins)", "mean"),
        Median_Duration_Min=("Duration (mins)", "median")
    )
    merged = staff_df.merge(agg, on="User", how="left")
    return merged


def add_hospital_breakdown(staff_df, adm_df):
    if staff_df is None or staff_df.empty or adm_df is None or adm_df.empty:
        return staff_df
    if "User" not in adm_df.columns:
        return staff_df
    # Use ward or name as proxy when hospital column not present
    if "Hospital" not in adm_df.columns:
        adm_df = adm_df.copy()
        adm_df["Hospital"] = "Unknown Hospital"
    top_hosp = (
        adm_df.groupby(["User", "Hospital"])
        .size()
        .reset_index(name="Admissions")
        .sort_values(["User", "Admissions"], ascending=[True, False])
    )
    top_hosp = top_hosp.drop_duplicates("User")[["User", "Hospital", "Admissions"]]
    top_hosp = top_hosp.rename(columns={"Admissions": "Top_Hospital_Admissions"})
    merged = staff_df.merge(top_hosp, on="User", how="left")
    merged = merged.rename(columns={"Hospital": "Top_Hospital"})
    return merged


def build_staff_trend(adm_df):
    if adm_df is None or adm_df.empty:
        return pd.DataFrame()
    if "Admission Date" not in adm_df.columns or "User" not in adm_df.columns:
        return pd.DataFrame()
    df = adm_df.copy()
    df["Admission Date"] = pd.to_datetime(df["Admission Date"], errors="coerce", dayfirst=True)
    df = df[df["Admission Date"].notna()]
    if df.empty:
        return pd.DataFrame()
    df["_month"] = df["Admission Date"].dt.to_period("M").astype(str)
    trend = df.groupby(["_month", "User"]).size().reset_index(name="Admissions")
    return trend


def build_payments_by_episode(payments_df):
    if payments_df is None or payments_df.empty:
        return pd.DataFrame()
    if "Episode Number" not in payments_df.columns or "Amount" not in payments_df.columns:
        return pd.DataFrame()
    tmp = payments_df.copy()
    tmp["episode_id"] = tmp["Episode Number"].astype(str).str.strip().str.upper()
    tmp["Amount"] = pd.to_numeric(tmp["Amount"], errors="coerce").fillna(0)
    agg = tmp.groupby("episode_id", as_index=False)["Amount"].sum()
    agg = agg.rename(columns={"Amount": "Total_Paid_To_Date_Calc"})
    return agg


def compute_data_quality(df):
    rows = []
    if df is None or df.empty:
        return pd.DataFrame([{"Check": "Data loaded", "Result": "No data"}])

    missing = [c for c in REQUIRED_COLUMNS if c not in df.columns]
    rows.append({
        "Check": "Missing required columns",
        "Result": ", ".join(missing) if missing else "OK"
    })

    dup = safe_count_duplicates(df, "episode_id")
    rows.append({
        "Check": "Duplicate episode_id",
        "Result": "episode_id not present" if dup is None else str(dup)
    })

    for col in KEY_QUALITY_COLUMNS:
        if col in df.columns:
            null_rate = df[col].isna().mean() * 100
            rows.append({
                "Check": f"Null rate: {col}",
                "Result": f"{null_rate:.1f}%"
            })
        else:
            rows.append({
                "Check": f"Null rate: {col}",
                "Result": "column missing"
            })

    for col in ["Original Billed", "Total_Paid_To_Date", "Collection_Gap"]:
        if col in df.columns:
            neg = (pd.to_numeric(df[col], errors="coerce") < 0).sum()
            rows.append({
                "Check": f"Negative values: {col}",
                "Result": str(int(neg))
            })

    return pd.DataFrame(rows)


def compute_latest_months_from_columns(columns):
    months = [m for m in MONTH_ORDER if m in columns]
    if len(months) < 2:
        return None, None
    return months[-1], months[-2]


def compute_admissions_deltas(admissions_df):
    if admissions_df is None or admissions_df.empty:
        return None

    last_month, prev_month = compute_latest_months_from_columns(admissions_df.columns)
    if not last_month or not prev_month:
        return None

    last_total = admissions_df[last_month].sum()
    prev_total = admissions_df[prev_month].sum()
    delta = last_total - prev_total
    pct = (delta / prev_total * 100) if prev_total > 0 else None

    return {
        "last_month": last_month,
        "prev_month": prev_month,
        "last_total": last_total,
        "prev_total": prev_total,
        "delta": delta,
        "delta_pct": pct
    }


def find_sections(sections, keywords):
    matches = []
    for name in sections.keys():
        low = name.lower()
        if any(k in low for k in keywords):
            matches.append(name)
    return matches


def compute_finance_monthly(df):
    if df is None or df.empty:
        return None

    date_cols = [
        "Admission Date", "Adm Date", "Date of Admission",
        "Discharge Date", "Payment Date", "Payment_Date", "Date"
    ]
    date_col = next((c for c in date_cols if c in df.columns), None)
    if not date_col:
        return None

    df = df.copy()
    df[date_col] = pd.to_datetime(df[date_col], errors="coerce", dayfirst=True)
    df = df[df[date_col].notna()]
    if df.empty:
        return None

    billed = resolve_billed_series(df)
    collected = resolve_collected_series(df)
    if billed is None or collected is None:
        return None

    df["_billed"] = billed
    df["_collected"] = collected
    df["_month"] = df[date_col].dt.to_period("M").astype(str)
    grouped = df.groupby("_month").agg(
        billed=("_billed", "sum"),
        collected=("_collected", "sum")
    ).reset_index()

    if len(grouped) < 2:
        return None

    grouped = grouped.sort_values("_month")
    last_row = grouped.iloc[-1]
    prev_row = grouped.iloc[-2]

    return {
        "last_month": last_row["_month"],
        "prev_month": prev_row["_month"],
        "billed_delta": last_row["billed"] - prev_row["billed"],
        "collected_delta": last_row["collected"] - prev_row["collected"]
    }


def compute_finance_monthly_trend(df, freq="M"):
    if df is None or df.empty:
        return None

    date_cols = [
        "Admission Date", "Adm Date", "Date of Admission",
        "Discharge Date", "Payment Date", "Payment_Date", "Date"
    ]
    date_col = next((c for c in date_cols if c in df.columns), None)
    if not date_col:
        return None

    df = df.copy()
    df[date_col] = pd.to_datetime(df[date_col], errors="coerce", dayfirst=True)
    df = df[df[date_col].notna()]
    if df.empty:
        return None

    billed = resolve_billed_series(df)
    collected = resolve_collected_series(df)
    if billed is None or collected is None:
        return None

    df["_billed"] = billed
    df["_collected"] = collected
    df["_period"] = df[date_col].dt.to_period(freq).astype(str)
    grouped = df.groupby("_period").agg(
        billed=("_billed", "sum"),
        collected=("_collected", "sum")
    ).reset_index().sort_values("_period")

    if grouped.empty:
        return None
    return grouped


def aggregate_admissions_trend(admissions_df, freq="M"):
    if admissions_df is None or admissions_df.empty:
        return None, None

    months = [m for m in MONTH_ORDER if m in admissions_df.columns]
    if not months:
        return None, None

    if freq == "M":
        return months, admissions_df[months]

    quarter_map = {m: f"Q{(i // 3) + 1}" for i, m in enumerate(MONTH_ORDER)}
    df_q = admissions_df[months].copy()
    df_q.columns = [quarter_map[m] for m in months]
    quarter_df = df_q.T.groupby(df_q.columns).sum().T
    quarter_order = ["Q1", "Q2", "Q3", "Q4"]
    labels = [q for q in quarter_order if q in quarter_df.columns]
    return labels, quarter_df[labels]


def compute_live_finance_from_df(df):
    """Recompute the headline finance metrics from an (already filtered) frame,
    so KPI tiles/alerts/summaries reflect the sidebar filters instead of the
    unfiltered master file."""
    if df is None or df.empty:
        return {
            "Total Billed": 0,
            "Total Collected": 0,
            "Collection Gap": 0,
            "Interest Loss": 0,
            "Collection Rate (%)": 0,
        }
    df_agg = aggregate_by_episode(df)
    base = df_agg if df_agg is not None else df
    billed_series = resolve_billed_series(base)
    collected_series = resolve_collected_series(base)
    total_billed = billed_series.sum() if billed_series is not None else 0
    total_collected = collected_series.sum() if collected_series is not None else 0
    collection_rate = round((total_collected / total_billed) * 100, 1) if total_billed > 0 else 0
    return {
        "Total Billed": total_billed,
        "Total Collected": total_collected,
        "Collection Gap": total_billed - total_collected,
        "Interest Loss": safe_sum(df, "Monthly_Interest_Loss"),
        "Collection Rate (%)": collection_rate,
    }


@st.cache_data(ttl=3600)
def get_ward_analysis(df):
    """
    Analyze ward-level performance metrics.
    Groups by Ward and calculates key metrics.
    """
    if df is None or df.empty or "Ward" not in df.columns:
        return pd.DataFrame()

    try:
        df_local = df.copy()
        billed_series = resolve_billed_series(df_local)
        collected_series = resolve_collected_series(df_local)
        if billed_series is not None:
            df_local["_billed"] = billed_series
        if collected_series is not None:
            df_local["_collected"] = collected_series

        ward_analysis = df_local.groupby("Ward", as_index=False).agg({
            "_billed": "sum",
            "_collected": "sum"
        })

        ward_analysis["Collection_Gap"] = ward_analysis["_billed"] - ward_analysis["_collected"]
        ward_analysis["Episode_Count"] = df_local.groupby("Ward").size().values
        ward_analysis["Collection_Rate_%"] = (
            (ward_analysis["_collected"] / ward_analysis["_billed"] * 100)
            .replace([np.inf, -np.inf], 0)
            .fillna(0)
            .round(1)
        )

        ward_analysis.columns = [
            "Ward", "Total_Billed", "Total_Collected",
            "Collection_Gap", "Episode_Count", "Collection_Rate_%"
        ]

        cr_mean = ward_analysis["Collection_Rate_%"].mean()
        cr_std = ward_analysis["Collection_Rate_%"].std() if len(ward_analysis) > 1 else 0
        gap_mean = ward_analysis["Collection_Gap"].mean()
        gap_std = ward_analysis["Collection_Gap"].std() if len(ward_analysis) > 1 else 0

        ward_analysis["CR_Outlier"] = (ward_analysis["Collection_Rate_%"] - cr_mean).abs() > (2 * cr_std)
        ward_analysis["Gap_Outlier"] = (ward_analysis["Collection_Gap"] - gap_mean).abs() > (2 * gap_std)
        ward_analysis["Outlier_Flag"] = ward_analysis[["CR_Outlier", "Gap_Outlier"]].any(axis=1)

        return ward_analysis
    except Exception as e:
        st.warning(f"Error analyzing ward data: {e}")
        return pd.DataFrame()
