# =========================================================
# HOSPITAL INTELLIGENCE - EXECUTIVE DASHBOARD
# =========================================================

import os
import re
import json
import streamlit as st
import pandas as pd
import numpy as np
import plotly.express as px
import plotly.graph_objects as go
from io import BytesIO
from datetime import datetime
import csv

# ---------------------------------------------------------
# PAGE CONFIG
# ---------------------------------------------------------
st.set_page_config(
    page_title="Hospital Intelligence Dashboard",
    layout="wide",
    initial_sidebar_state="expanded",
    menu_items={"About": "Hospital Intelligence Platform v1.0"}
)

# ---------------------------------------------------------
# BUSINESS TARGETS & CONSTANTS
# ---------------------------------------------------------
target_collection = 90  # Target collection rate (%)

MONTH_ORDER = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
]

REQUIRED_COLUMNS = [
    "Original Billed",
    "Total_Paid_To_Date",
    "Collection_Gap",
    "Ward",
]

KEY_QUALITY_COLUMNS = [
    "Original Billed",
    "Total_Paid_To_Date",
    "Collection_Gap",
    "Monthly_Interest_Loss",
]

CPT_STATS_PATH = "data_reservoir/raw/20260120CPTStatisticsLOC.csv"
UNIVERSAL_SESSION_STORE_PATH = "data_reservoir/processed/universal_session_store.json"
DATA_REGISTRY_PATH = "data_reservoir/processed/app_dataset_registry.json"
DEFAULT_DATA_REGISTRY = {
    "master": "data_reservoir/processed/final_intelligence_master.csv",
    "management": "data_reservoir/raw/20260126RptManagementDashboard.csv",
    "payments": "data_reservoir/raw/20260129RptAllPayments_AvenuesClinic.csv",
    "admissions_user": "data_reservoir/raw/20260129RptAdmPerUser.csv",
    "admissions_duration": "data_reservoir/raw/20260129RptAdmDurPerUser.csv",
    "cpt": "data_reservoir/raw/20260120CPTStatisticsLOC.csv"
}

# ---------------------------------------------------------
# HELPER FUNCTIONS
# ---------------------------------------------------------

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


def style_ward_table(df):
    if df is None or df.empty:
        return df
    try:
        import matplotlib  # noqa: F401
        return (
            df.style
            .background_gradient(subset=["Collection_Rate_%"], cmap="RdYlGn")
            .background_gradient(subset=["Collection_Gap"], cmap="Reds")
        )
    except Exception:
        return df


def compute_anomaly_tiles(df_full, ward_data):
    if df_full is None or df_full.empty:
        return None

    tiles = {}
    if "Collection_Gap" in df_full.columns:
        gap_idx = pd.to_numeric(df_full["Collection_Gap"], errors="coerce").idxmax()
        if pd.notna(gap_idx):
            row = df_full.loc[gap_idx]
            tiles["Largest Gap"] = f"${pd.to_numeric(row.get('Collection_Gap', 0), errors='coerce'):,.0f}"
    if ward_data is not None and not ward_data.empty and "Collection_Rate_%" in ward_data.columns:
        worst = ward_data.nsmallest(1, "Collection_Rate_%")
        if not worst.empty:
            tiles["Lowest Ward CR"] = f"{worst.iloc[0]['Collection_Rate_%']:.1f}%"
    if "Monthly_Interest_Loss" in df_full.columns:
        loss_idx = pd.to_numeric(df_full["Monthly_Interest_Loss"], errors="coerce").idxmax()
        if pd.notna(loss_idx):
            row = df_full.loc[loss_idx]
            tiles["Max Interest Loss"] = f"${pd.to_numeric(row.get('Monthly_Interest_Loss', 0), errors='coerce'):,.0f}"
    return tiles


def get_file_age_hours(path):
    if not os.path.exists(path):
        return None
    return (datetime.now() - datetime.fromtimestamp(os.path.getmtime(path))).total_seconds() / 3600.0


def inject_dashboard_theme():
    st.markdown(
        """
        <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&family=Outfit:wght@300;500;700&display=swap');
        
        html, body, [class*="css"] {
            font-family: 'Inter', sans-serif;
        }
        
        .main {
            background-color: #0f172a;
            color: #f8fafc;
        }
        
        .block-container {
            padding-top: 2rem;
            padding-bottom: 2rem;
            max-width: 95%;
        }
        
        h1, h2, h3 {
            font-family: 'Outfit', sans-serif;
            color: #f1f5f9;
        }
        
        /* Modern KPI Cards */
        [data-testid="stMetricValue"] {
            font-family: 'Outfit', sans-serif;
            font-weight: 700;
            font-size: 2.2rem !important;
            color: #38bdf8 !important;
        }
        
        [data-testid="stMetricLabel"] {
            font-size: 0.9rem !important;
            font-weight: 500 !important;
            color: #94a3b8 !important;
            text-transform: uppercase;
            letter-spacing: 0.05em;
        }

        .kpi-band {
            background: linear-gradient(135deg, rgba(30, 41, 59, 0.7) 0%, rgba(15, 23, 42, 0.8) 100%);
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255,255,255,0.08);
            border-radius: 16px;
            padding: 20px 24px;
            margin-bottom: 20px;
            box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.3);
        }
        
        .kpi-band h3 {
            margin: 0;
            color: #f8fafc;
            font-size: 24px;
            font-weight: 700;
            background: linear-gradient(90deg, #38bdf8, #818cf8);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }
        
        .kpi-band p {
            margin: 8px 0 0 0;
            color: #cbd5e1;
            font-size: 15px;
            line-height: 1.5;
        }
        
        .section-note {
            border-left: 5px solid #38bdf8;
            background: rgba(56, 189, 248, 0.05);
            padding: 12px 16px;
            border-radius: 8px;
            margin-bottom: 15px;
            font-size: 0.95rem;
            color: #e2e8f0;
        }
        
        /* Sidebar Styling */
        [data-testid="stSidebar"] {
            background-color: #1e293b;
            border-right: 1px solid rgba(255,255,255,0.05);
        }
        
        [data-testid="stSidebar"] .stRadio > label {
            color: #f1f5f9;
            font-weight: 600;
        }
        
        /* Tab Styling */
        .stTabs [data-baseweb="tab-list"] {
            gap: 8px;
            background-color: transparent;
        }
        
        .stTabs [data-baseweb="tab"] {
            height: 45px;
            white-space: pre-wrap;
            background-color: rgba(255,255,255,0.03);
            border-radius: 8px 8px 0px 0px;
            padding: 10px 20px;
            color: #94a3b8;
        }
        
        .stTabs [aria-selected="true"] {
            background-color: rgba(56, 189, 248, 0.1) !important;
            color: #38bdf8 !important;
            border-bottom: 2px solid #38bdf8 !important;
        }
        
        /* Interactive help icon */
        .help-icon {
            color: #64748b;
            cursor: help;
            margin-left: 4px;
            font-size: 0.8rem;
        }
        
        /* Custom Button Styling */
        .stButton > button {
            border-radius: 8px;
            font-weight: 600;
            transition: all 0.2s ease;
        }
        
        .stButton > button:hover {
            transform: translateY(-1px);
            box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        }
        </style>
        """,
        unsafe_allow_html=True
    )


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


def render_five_second_summary(summary):
    if not summary:
        return
    st.markdown(
        f"""
        <div class="kpi-band">
            <h3>5-Second View: {summary.get("tone", "n/a")}</h3>
            <p>{summary.get("headline", "")}</p>
        </div>
        """,
        unsafe_allow_html=True
    )
    k = summary.get("kpis", {})
    c1, c2, c3, c4 = st.columns(4)
    c1.metric("Admissions", f"{k.get('Admissions', 0):,}")
    c2.metric("Collection Rate", f"{k.get('Collection Rate %', 0):.1f}%")
    c3.metric("Collection Gap", f"${k.get('Collection Gap', 0):,.0f}")
    c4.metric("High/Critical Risk", f"{k.get('High/Critical Risk Episodes', 0):,}")


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


def render_command_center(live_finance, admissions_df, ds_bundle, table_limit, selected_hospital="All", selected_payer="All", start_date=None, end_date=None):
    st.subheader("Command Center")
    st.markdown('<div class="section-note">Single-screen operational picture: revenue health, risk concentration, and immediate actions.</div>', unsafe_allow_html=True)

    summary = build_five_second_summary(live_finance, admissions_df, ds_bundle)
    render_five_second_summary(summary)

    if not ds_bundle:
        st.warning("Data Science bundle is unavailable for Command Center visuals.")
        return

    ep = ds_bundle.get("episode_features", pd.DataFrame())
    ward_risk = ds_bundle.get("ward_risk", pd.DataFrame())
    payer = ds_bundle.get("payer_leakage", pd.DataFrame())
    trend = ds_bundle.get("trend", pd.DataFrame())

    v1, v2 = st.columns(2)
    with v1:
        if ep is not None and not ep.empty and "risk_band" in ep.columns:
            rb = ep["risk_band"].fillna("Unknown").value_counts().reset_index()
            rb.columns = ["Risk Band", "Cases"]
            fig_rb = px.pie(
                rb,
                names="Risk Band",
                values="Cases",
                title="Risk Mix",
                hole=0.45
            )
            st.plotly_chart(fig_rb, use_container_width=True)
    with v2:
        if trend is not None and not trend.empty:
            fig_tr = go.Figure()
            fig_tr.add_trace(go.Scatter(x=trend["period"], y=trend["Episodes"], mode="lines+markers", name="Episodes"))
            fig_tr.add_trace(go.Scatter(x=trend["period"], y=trend["Total_Gap"], mode="lines+markers", name="Total Gap"))
            fig_tr.update_layout(title="Trend: Episodes vs Gap", hovermode="x unified", height=330)
            st.plotly_chart(fig_tr, use_container_width=True)

    v3, v4 = st.columns(2)
    with v3:
        if payer is not None and not payer.empty:
            fig_p = px.bar(
                payer.head(10),
                x="Medical Aid",
                y="Leakage_%",
                color="Gap",
                title="Top 10 Payer Leakage",
                color_continuous_scale="Oranges"
            )
            st.plotly_chart(fig_p, use_container_width=True)
    with v4:
        if ward_risk is not None and not ward_risk.empty:
            fig_w = px.bar(
                ward_risk.head(10),
                x="Ward",
                y="Avg_Risk",
                color="Total_Gap",
                title="Top 10 Ward Risk",
                color_continuous_scale="Reds"
            )
            st.plotly_chart(fig_w, use_container_width=True)

    st.subheader("Narrative Insights")
    actions = generate_narrative_actions(
        ds_bundle, live_finance, admissions_df,
        selected_hospital=selected_hospital,
        selected_payer=selected_payer,
        start_date=start_date,
        end_date=end_date
    )
    for i, a in enumerate(actions, start=1):
        st.write(f"{i}. {a}")

    if ep is not None and not ep.empty:
        preview_cols = [c for c in ["episode_id", "Patient Name", "Medical Aid", "Ward", "risk_score", "risk_band", "gap"] if c in ep.columns]
        st.subheader("Priority Episodes")
        display_limited_df(ep.sort_values("risk_score", ascending=False)[preview_cols], "Priority episodes", limit=table_limit)


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


def display_limited_df(df, label, limit=200):
    if df is None or df.empty:
        return
    if not st.session_state.get("show_tables", True):
        st.caption(f"{label}: {len(df):,} rows (table rendering is disabled in sidebar)")
        return
    if "table_limit" in st.session_state:
        limit = st.session_state["table_limit"]
    if len(df) > limit:
        st.caption(f"{label}: showing first {limit} of {len(df)} rows")
        st.dataframe(df.head(limit), use_container_width=True)
    else:
        st.dataframe(df, use_container_width=True)


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


def compute_alos_readmission(df):
    if df is None or df.empty:
        return {}
    out = {}
    if "Admission Date" in df.columns and "Discharge Date" in df.columns:
        adm = pd.to_datetime(df["Admission Date"], errors="coerce", dayfirst=True)
        dis = pd.to_datetime(df["Discharge Date"], errors="coerce", dayfirst=True)
        los = (dis - adm).dt.days
        los = los[(los >= 0) & (los < 365)]
        out["ALOS (days)"] = round(los.mean(), 1) if los.notna().any() else None
    # Readmission within 30 days using ID Number
    if "ID Number" in df.columns and "Admission Date" in df.columns and "Discharge Date" in df.columns:
        d = df.copy()
        d["Admission Date"] = pd.to_datetime(d["Admission Date"], errors="coerce", dayfirst=True)
        d["Discharge Date"] = pd.to_datetime(d["Discharge Date"], errors="coerce", dayfirst=True)
        d = d[d["ID Number"].notna()]
        d = d.sort_values(["ID Number", "Admission Date"])
        d["prev_discharge"] = d.groupby("ID Number")["Discharge Date"].shift(1)
        d["days_since_prev"] = (d["Admission Date"] - d["prev_discharge"]).dt.days
        readmit = d[(d["days_since_prev"] >= 0) & (d["days_since_prev"] <= 30)]
        total_patients = d["ID Number"].nunique()
        out["Readmission 30d %"] = round((readmit["ID Number"].nunique() / total_patients) * 100, 1) if total_patients else None
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
        except Exception:
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


def _safe_pct_rank(series, ascending=True):
    s = pd.to_numeric(series, errors="coerce")
    if s.notna().sum() == 0:
        return pd.Series([0.0] * len(series), index=series.index if hasattr(series, "index") else None)
    return s.rank(pct=True, ascending=ascending).fillna(0) * 100


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


def prepare_episode_feature_frame(df_full, cpt_df):
    if df_full is None or df_full.empty:
        return pd.DataFrame()

    master = normalize_master_schema(df_full)
    if "episode_id" not in master.columns:
        return pd.DataFrame()

    for col in ["Admission Date", "Discharge Date", "Submission Date"]:
        if col in master.columns:
            master[col] = pd.to_datetime(master[col], errors="coerce", dayfirst=True)

    keep_master = [
        "episode_id", "Hospital", "Medical Aid", "Ward", "Patient Name",
        "Admission Date", "Discharge Date", "Original Billed", "Total Amount",
        "Total_Paid_To_Date", "Collection_Gap", "Current", "30 Days", "60 Days",
        "90 Days", "120 Days", "150+ Days", "Monthly_Interest_Loss"
    ]
    keep_master = [c for c in keep_master if c in master.columns]
    master = master[keep_master].copy()

    if "Original Billed" not in master.columns and "Total Amount" in master.columns:
        master["Original Billed"] = pd.to_numeric(master["Total Amount"], errors="coerce").fillna(0)
    if "Total_Paid_To_Date" not in master.columns:
        master["Total_Paid_To_Date"] = 0
    if "Collection_Gap" not in master.columns:
        master["Collection_Gap"] = (
            pd.to_numeric(master.get("Original Billed", 0), errors="coerce").fillna(0) -
            pd.to_numeric(master.get("Total_Paid_To_Date", 0), errors="coerce").fillna(0)
        )

    # Prevent many-to-many explosions downstream: keep one record per episode.
    sort_cols = [c for c in ["Submission Date", "ChangeDate", "Admission Date", "Discharge Date"] if c in master.columns]
    if sort_cols:
        master = master.sort_values(sort_cols)
    master = master.drop_duplicates(subset=["episode_id"], keep="last")

    cpt_agg = pd.DataFrame()
    if cpt_df is not None and not cpt_df.empty and "episode_id" in cpt_df.columns:
        c = cpt_df.copy()
        c["episode_id"] = c["episode_id"].astype(str).str.strip().str.upper()
        c["_total_cost"] = get_numeric_series(c, "Total")
        if c["_total_cost"].sum() == 0:
            c["_total_cost"] = (
                get_numeric_series(c, "Total Accom") +
                get_numeric_series(c, "THT Value") +
                get_numeric_series(c, "Total Stock") +
                get_numeric_series(c, "Other")
            )
        c["_los"] = get_numeric_series(c, "LOS (length of stay)")
        if c["_los"].sum() == 0:
            c["_los"] = get_numeric_series(c, "Total Days")
        c["_theatre_mins"] = compute_theatre_minutes(c)
        cpt_agg = c.groupby("episode_id", as_index=False).agg(
            cpt_total_cost=("_total_cost", "sum"),
            cpt_los=("_los", "max"),
            theatre_minutes=("_theatre_mins", "sum"),
            Doctor=("Doctor", "first") if "Doctor" in c.columns else ("episode_id", "first"),
            Primary_ICD=("Primary ICD Code", "first") if "Primary ICD Code" in c.columns else ("episode_id", "first"),
            Primary_CPT=("Primary CPT Code", "first") if "Primary CPT Code" in c.columns else ("episode_id", "first"),
            Theatre_Location=("Theatre Location", "first") if "Theatre Location" in c.columns else ("episode_id", "first")
        )

    ep = master.copy()
    if not cpt_agg.empty:
        ep = ep.merge(cpt_agg, on="episode_id", how="left")
    else:
        ep["cpt_total_cost"] = np.nan
        ep["cpt_los"] = np.nan
        ep["theatre_minutes"] = np.nan

    billed = pd.to_numeric(ep.get("Original Billed", ep.get("Total Amount", 0)), errors="coerce").fillna(0)
    collected = pd.to_numeric(ep.get("Total_Paid_To_Date", 0), errors="coerce").fillna(0)
    gap = pd.to_numeric(ep.get("Collection_Gap", billed - collected), errors="coerce").fillna(0)
    ep["billed"] = billed
    ep["collected"] = collected
    ep["gap"] = gap
    ep["collection_rate_pct"] = np.where(billed > 0, (collected / billed) * 100, 0)

    ep["los_days"] = pd.to_numeric(ep.get("cpt_los", np.nan), errors="coerce")
    if "Admission Date" in ep.columns and "Discharge Date" in ep.columns:
        los_from_dates = (ep["Discharge Date"] - ep["Admission Date"]).dt.days
        ep["los_days"] = ep["los_days"].fillna(los_from_dates)
    ep["los_days"] = ep["los_days"].clip(lower=0, upper=365)

    ep["episode_cost"] = pd.to_numeric(ep.get("cpt_total_cost", np.nan), errors="coerce").fillna(ep["billed"])
    ep["aging_risk_amount"] = (
        pd.to_numeric(ep.get("90 Days", 0), errors="coerce").fillna(0) +
        pd.to_numeric(ep.get("120 Days", 0), errors="coerce").fillna(0) +
        pd.to_numeric(ep.get("150+ Days", 0), errors="coerce").fillna(0)
    )
    ep["gap_ratio_pct"] = np.where(ep["billed"] > 0, (ep["gap"] / ep["billed"]) * 100, 0)
    ep["theatre_minutes"] = pd.to_numeric(ep.get("theatre_minutes", 0), errors="coerce").fillna(0)

    return ep


def _sigmoid(x):
    return 1 / (1 + np.exp(-np.clip(x, -35, 35)))


def _train_logistic_gd(X, y, lr=0.05, epochs=1200, reg=1e-4):
    if X.size == 0:
        return np.array([])
    w = np.zeros(X.shape[1])
    for _ in range(epochs):
        p = _sigmoid(X @ w)
        grad = (X.T @ (p - y)) / len(y)
        grad += reg * np.r_[0, w[1:]]
        w -= lr * grad
    return w


def _roc_auc(y_true, y_score):
    y_true = np.asarray(y_true).astype(int)
    y_score = np.asarray(y_score).astype(float)
    if len(np.unique(y_true)) < 2:
        return None
    order = np.argsort(y_score)
    y = y_true[order]
    n_pos = y.sum()
    n_neg = len(y) - n_pos
    if n_pos == 0 or n_neg == 0:
        return None
    ranks = np.arange(1, len(y) + 1)
    pos_ranks_sum = ranks[y == 1].sum()
    auc = (pos_ranks_sum - (n_pos * (n_pos + 1) / 2)) / (n_pos * n_neg)
    return float(round(auc, 3))


def compute_readmission_risk_model(df_full, ep):
    if df_full is None or df_full.empty or ep is None or ep.empty:
        return {}
    if "episode_id" not in df_full.columns or "ID Number" not in df_full.columns:
        return {}
    if "Admission Date" not in df_full.columns or "Discharge Date" not in df_full.columns:
        return {}

    d = df_full.copy()
    d["episode_id"] = d["episode_id"].astype(str).str.strip().str.upper()
    d["ID Number"] = d["ID Number"].astype(str).str.strip()
    d["Admission Date"] = pd.to_datetime(d["Admission Date"], errors="coerce", dayfirst=True)
    d["Discharge Date"] = pd.to_datetime(d["Discharge Date"], errors="coerce", dayfirst=True)
    d = d[d["ID Number"].notna() & d["Admission Date"].notna() & d["Discharge Date"].notna()]
    if d.empty:
        return {}

    d = d.sort_values(["ID Number", "Admission Date"])
    d = d.drop_duplicates(subset=["episode_id"], keep="last")
    d["next_admission"] = d.groupby("ID Number")["Admission Date"].shift(-1)
    d["days_to_next"] = (d["next_admission"] - d["Discharge Date"]).dt.days
    d["readmit_30d"] = ((d["days_to_next"] >= 0) & (d["days_to_next"] <= 30)).astype(int)

    horizon = d["Admission Date"].max() - pd.Timedelta(days=30)
    d = d[d["Discharge Date"] <= horizon]
    if d.empty:
        return {}

    feat = ep.copy()
    feat["episode_id"] = feat["episode_id"].astype(str).str.strip().str.upper()
    feat = feat.drop_duplicates(subset=["episode_id"], keep="last")
    model_df = d.merge(
        feat[[
            "episode_id", "gap", "gap_ratio_pct", "los_days",
            "episode_cost", "aging_risk_amount", "collection_rate_pct"
        ]],
        on="episode_id",
        how="left"
    )
    model_df = model_df.drop_duplicates(subset=["episode_id"])
    if len(model_df) > 500000:
        model_df = model_df.sort_values("Admission Date").tail(500000).copy()

    features = ["gap", "gap_ratio_pct", "los_days", "episode_cost", "aging_risk_amount", "collection_rate_pct"]
    for c in features:
        model_df[c] = pd.to_numeric(model_df[c], errors="coerce")
        model_df[c] = model_df[c].fillna(model_df[c].median() if model_df[c].notna().any() else 0)
    model_df = model_df[model_df["readmit_30d"].isin([0, 1])]
    if len(model_df) < 200:
        return {}

    split_date = model_df["Admission Date"].quantile(0.8)
    train = model_df[model_df["Admission Date"] <= split_date].copy()
    test = model_df[model_df["Admission Date"] > split_date].copy()
    if train.empty or test.empty:
        return {}
    if train["readmit_30d"].nunique() < 2:
        return {}

    mu = train[features].mean()
    sigma = train[features].std().replace(0, 1)
    X_train = ((train[features] - mu) / sigma).values
    X_test = ((test[features] - mu) / sigma).values
    X_all = ((model_df[features] - mu) / sigma).values

    X_train = np.c_[np.ones(len(X_train)), X_train]
    X_test = np.c_[np.ones(len(X_test)), X_test]
    X_all = np.c_[np.ones(len(X_all)), X_all]

    y_train = train["readmit_30d"].values.astype(float)
    y_test = test["readmit_30d"].values.astype(float)
    y_all = model_df["readmit_30d"].values.astype(float)

    w = _train_logistic_gd(X_train, y_train)
    if w.size == 0:
        return {}

    p_test = _sigmoid(X_test @ w)
    p_all = _sigmoid(X_all @ w)
    auc = _roc_auc(y_test, p_test)

    model_df["readmit_prob_30d"] = p_all
    high_threshold = max(0.35, float(model_df["readmit_prob_30d"].quantile(0.8)))
    model_df["readmit_risk_band"] = pd.cut(
        model_df["readmit_prob_30d"],
        bins=[-0.01, 0.15, high_threshold, 1.01],
        labels=["Low", "Medium", "High"]
    ).astype(str)

    dec = model_df.copy()
    dec["decile"] = pd.qcut(dec["readmit_prob_30d"].rank(method="first"), 10, labels=False, duplicates="drop") + 1
    calibration = dec.groupby("decile", as_index=False).agg(
        predicted=("readmit_prob_30d", "mean"),
        actual=("readmit_30d", "mean"),
        cases=("episode_id", "count")
    ).sort_values("decile")

    top = model_df.sort_values("readmit_prob_30d", ascending=False).head(100).copy()

    summary = {
        "train_rows": int(len(train)),
        "test_rows": int(len(test)),
        "modeled_rows": int(len(model_df)),
        "test_auc": auc,
        "observed_readmit_rate_pct": round(float(y_all.mean() * 100), 2),
        "predicted_readmit_rate_pct": round(float(model_df["readmit_prob_30d"].mean() * 100), 2),
        "high_risk_cases": int((model_df["readmit_risk_band"] == "High").sum())
    }

    episode_scores = model_df[["episode_id", "readmit_prob_30d", "readmit_risk_band"]].copy()
    return {
        "summary": summary,
        "coefficients": pd.DataFrame({"feature": ["intercept"] + features, "weight": w}),
        "calibration": calibration,
        "top_risk": top,
        "episode_scores": episode_scores
    }


def compute_root_cause_decomposition(ep):
    if ep is None or ep.empty:
        return {"drivers": pd.DataFrame()}

    base = ep.copy()
    base["gap"] = pd.to_numeric(base.get("gap", 0), errors="coerce").fillna(0)
    base["gap_ratio_pct"] = pd.to_numeric(base.get("gap_ratio_pct", 0), errors="coerce").fillna(0)
    base["los_days"] = pd.to_numeric(base.get("los_days", 0), errors="coerce").fillna(0)
    base["collection_rate_pct"] = pd.to_numeric(base.get("collection_rate_pct", 0), errors="coerce").fillna(0)
    base["risk_score"] = pd.to_numeric(base.get("risk_score", 0), errors="coerce").fillna(0)

    overall = {
        "risk": base["risk_score"].mean(),
        "gap_ratio": base["gap_ratio_pct"].mean(),
        "los": base["los_days"].mean(),
        "collection": base["collection_rate_pct"].mean()
    }

    dims = [d for d in ["Ward", "Doctor", "Medical Aid", "Primary_ICD", "Theatre_Location"] if d in base.columns]
    rows = []
    for dim in dims:
        tmp = base[base[dim].notna() & (base[dim].astype(str).str.strip() != "")].copy()
        if tmp.empty:
            continue
        grp = tmp.groupby(dim, as_index=False).agg(
            episodes=("episode_id", "count"),
            risk_mean=("risk_score", "mean"),
            gap_ratio_mean=("gap_ratio_pct", "mean"),
            los_mean=("los_days", "mean"),
            collection_mean=("collection_rate_pct", "mean"),
            gap_sum=("gap", "sum")
        )
        grp = grp[grp["episodes"] >= 5]
        if grp.empty:
            continue

        grp["delta_risk"] = grp["risk_mean"] - overall["risk"]
        grp["delta_gap_ratio"] = grp["gap_ratio_mean"] - overall["gap_ratio"]
        grp["delta_los"] = grp["los_mean"] - overall["los"]
        grp["delta_collection"] = overall["collection"] - grp["collection_mean"]

        impact = (
            _safe_pct_rank(grp["delta_risk"], ascending=True) * 0.35 +
            _safe_pct_rank(grp["delta_gap_ratio"], ascending=True) * 0.30 +
            _safe_pct_rank(grp["delta_los"], ascending=True) * 0.20 +
            _safe_pct_rank(grp["delta_collection"], ascending=True) * 0.15
        )
        grp["impact_score"] = impact.round(1)

        def _driver_type(r):
            if r["delta_gap_ratio"] > 0 and r["gap_sum"] > 0:
                return "Financial Leakage"
            if r["delta_los"] > 0:
                return "Operational Delay"
            if r["delta_collection"] > 0:
                return "Collection Weakness"
            return "Mixed"

        grp["driver_type"] = grp.apply(_driver_type, axis=1)
        grp["dimension"] = dim
        grp = grp.rename(columns={dim: "segment"})
        rows.append(grp)

    if not rows:
        return {"drivers": pd.DataFrame()}

    drivers = pd.concat(rows, ignore_index=True)
    drivers = drivers.sort_values(["impact_score", "gap_sum", "episodes"], ascending=[False, False, False])
    return {"drivers": drivers}


def compute_hospital_ds_bundle(df_full, cpt_df, payments_df=None):
    ep = prepare_episode_feature_frame(df_full, cpt_df)
    if ep.empty:
        return {}

    ep["risk_gap"] = _safe_pct_rank(ep["gap"].clip(lower=0), ascending=True)
    ep["risk_los"] = _safe_pct_rank(ep["los_days"], ascending=True)
    ep["risk_cost"] = _safe_pct_rank(ep["episode_cost"], ascending=True)
    ep["risk_aging"] = _safe_pct_rank(ep["aging_risk_amount"], ascending=True)
    ep["risk_score"] = (
        ep["risk_gap"] * 0.35 +
        ep["risk_los"] * 0.25 +
        ep["risk_cost"] * 0.20 +
        ep["risk_aging"] * 0.20
    ).round(1)
    ep["risk_band"] = pd.cut(
        ep["risk_score"],
        bins=[-1, 50, 75, 90, 101],
        labels=["Low", "Medium", "High", "Critical"]
    ).astype(str)

    high_risk = ep.sort_values("risk_score", ascending=False).head(100)

    ward_risk = pd.DataFrame()
    if "Ward" in ep.columns:
        ward_risk = ep.groupby("Ward", as_index=False).agg(
            Episodes=("episode_id", "count"),
            Avg_Risk=("risk_score", "mean"),
            Total_Gap=("gap", "sum"),
            Avg_LOS=("los_days", "mean"),
            Total_Cost=("episode_cost", "sum")
        ).sort_values("Avg_Risk", ascending=False)

    payer = pd.DataFrame()
    if "Medical Aid" in ep.columns:
        payer = ep.groupby("Medical Aid", as_index=False).agg(
            Episodes=("episode_id", "count"),
            Billed=("billed", "sum"),
            Collected=("collected", "sum"),
            Gap=("gap", "sum"),
            Avg_Risk=("risk_score", "mean"),
            Avg_LOS=("los_days", "mean")
        )
        payer["Collection_Rate_%"] = np.where(payer["Billed"] > 0, (payer["Collected"] / payer["Billed"]) * 100, 0).round(1)
        payer["Leakage_%"] = np.where(payer["Billed"] > 0, (payer["Gap"] / payer["Billed"]) * 100, 0).round(1)
        payer = payer.sort_values(["Leakage_%", "Gap"], ascending=False)

    cohort = pd.DataFrame()
    if "Admission Date" in ep.columns:
        c = ep[ep["Admission Date"].notna()].copy()
        if not c.empty:
            c["cohort_month"] = c["Admission Date"].dt.to_period("M").astype(str)
            cohort = c.groupby("cohort_month", as_index=False).agg(
                Episodes=("episode_id", "count"),
                Avg_Risk=("risk_score", "mean"),
                Avg_LOS=("los_days", "mean"),
                Avg_Cost=("episode_cost", "mean"),
                Total_Gap=("gap", "sum")
            ).sort_values("cohort_month")

    doctor = pd.DataFrame()
    if "Doctor" in ep.columns:
        d = ep[ep["Doctor"].notna() & (ep["Doctor"].astype(str).str.strip() != "")].copy()
        if not d.empty:
            doctor = d.groupby("Doctor", as_index=False).agg(**{
                "Cases": ("episode_id", "count"),
                "Avg_LOS": ("los_days", "mean"),
                "Avg_Cost": ("episode_cost", "mean"),
                "Avg_Risk": ("risk_score", "mean"),
                "Collection_Rate_%": ("collection_rate_pct", "mean")
            })
            los_good = _safe_pct_rank(doctor["Avg_LOS"], ascending=False)
            cost_good = _safe_pct_rank(doctor["Avg_Cost"], ascending=False)
            cr_good = _safe_pct_rank(doctor["Collection_Rate_%"], ascending=True)
            doctor["Efficiency_Index"] = (los_good * 0.4 + cost_good * 0.3 + cr_good * 0.3).round(1)
            doctor = doctor.sort_values("Efficiency_Index", ascending=False)

    proj = {}
    trend = pd.DataFrame()
    if "Admission Date" in ep.columns:
        t = ep[ep["Admission Date"].notna()].copy()
        if not t.empty:
            t["period"] = t["Admission Date"].dt.to_period("M").astype(str)
            trend = t.groupby("period", as_index=False).agg(
                Episodes=("episode_id", "count"),
                Total_Cost=("episode_cost", "sum"),
                Total_Gap=("gap", "sum")
            ).sort_values("period")
            if len(trend) >= 3:
                x = np.arange(len(trend))
                for metric in ["Episodes", "Total_Cost", "Total_Gap"]:
                    y = trend[metric].astype(float).values
                    slope, intercept = np.polyfit(x, y, 1)
                    proj[f"Next_{metric}"] = max(0, round(intercept + slope * len(trend), 2))

    if payments_df is not None and not payments_df.empty and "Date" in payments_df.columns and "Amount" in payments_df.columns:
        p = payments_df.copy()
        p["Date"] = pd.to_datetime(p["Date"], errors="coerce", dayfirst=True)
        p = p[p["Date"].notna()]
        if not p.empty:
            p["period"] = p["Date"].dt.to_period("M").astype(str)
            p_trend = p.groupby("period", as_index=False)["Amount"].sum().sort_values("period")
            if len(p_trend) >= 3:
                x = np.arange(len(p_trend))
                y = p_trend["Amount"].astype(float).values
                slope, intercept = np.polyfit(x, y, 1)
                proj["Next_Collections"] = max(0, round(intercept + slope * len(p_trend), 2))

    readmission = compute_readmission_risk_model(df_full, ep)
    if readmission and "episode_scores" in readmission and not readmission["episode_scores"].empty:
        ep = ep.merge(
            readmission["episode_scores"][["episode_id", "readmit_prob_30d", "readmit_risk_band"]],
            on="episode_id",
            how="left"
        )

    root_cause = compute_root_cause_decomposition(ep)

    recommendations = []
    critical_count = int((ep["risk_band"] == "Critical").sum())
    high_count = int((ep["risk_band"].isin(["High", "Critical"])).sum())
    if len(ep) > 0:
        recommendations.append(
            f"Prioritize {high_count:,} high-risk episodes ({(high_count / len(ep)) * 100:.1f}% of active episodes) for immediate case management."
        )
    if not payer.empty:
        worst = payer.iloc[0]
        recommendations.append(
            f"Review payer leakage for {worst['Medical Aid']}: {worst['Leakage_%']:.1f}% leakage on ${worst['Billed']:,.0f} billed."
        )
    if not ward_risk.empty:
        w = ward_risk.iloc[0]
        recommendations.append(
            f"Deploy ward-level recovery sprint in {w['Ward']} (avg risk {w['Avg_Risk']:.1f}, gap ${w['Total_Gap']:,.0f})."
        )
    if not doctor.empty:
        low_doc = doctor.sort_values("Efficiency_Index", ascending=True).head(1).iloc[0]
        recommendations.append(
            f"Target clinical process coaching for {low_doc['Doctor']} (efficiency index {low_doc['Efficiency_Index']:.1f})."
        )
    if critical_count > 0:
        recommendations.append(
            "Create a 72-hour escalation queue for Critical-risk episodes combining billing recovery and discharge planning checks."
        )
    if readmission and readmission.get("summary", {}).get("high_risk_cases", 0) > 0:
        recommendations.append(
            f"Flag {readmission['summary']['high_risk_cases']:,} episodes with elevated 30-day readmission risk for post-discharge follow-up."
        )
    if root_cause.get("drivers") is not None and not root_cause["drivers"].empty:
        top_driver = root_cause["drivers"].iloc[0]
        recommendations.append(
            f"Top root cause driver: {top_driver['dimension']}={top_driver['segment']} "
            f"(impact {top_driver['impact_score']:.1f}, financial gap ${top_driver['gap_sum']:,.0f})."
        )

    return {
        "episode_features": ep,
        "high_risk": high_risk,
        "ward_risk": ward_risk,
        "payer_leakage": payer,
        "cohort": cohort,
        "doctor_efficiency": doctor,
        "trend": trend,
        "projections": proj,
        "recommendations": recommendations,
        "readmission": readmission,
        "root_cause": root_cause
    }


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


def render_recommended_chart(df, recommendation, key_prefix="rec"):
    if df is None or df.empty or not recommendation:
        return

    kind = recommendation.get("kind")

    if kind == "histogram":
        fig = px.histogram(df, x=recommendation["x"], nbins=40, title=recommendation["title"])
        st.plotly_chart(fig, use_container_width=True, key=f"{key_prefix}_hist")
    elif kind == "category_count":
        col = recommendation["x"]
        top = df[col].astype(str).fillna("Unknown").value_counts().head(20).reset_index()
        top.columns = [col, "Count"]
        fig = px.bar(top, x=col, y="Count", title=recommendation["title"])
        st.plotly_chart(fig, use_container_width=True, key=f"{key_prefix}_cat")
    elif kind == "scatter":
        fig = px.scatter(df, x=recommendation["x"], y=recommendation["y"], title=recommendation["title"], opacity=0.6)
        st.plotly_chart(fig, use_container_width=True, key=f"{key_prefix}_scatter")
    elif kind == "correlation_heatmap":
        num_cols = df.select_dtypes(include=[np.number]).columns.tolist()
        if len(num_cols) >= 2:
            corr_df = df[num_cols].corr(numeric_only=True)
            fig = px.imshow(corr_df, text_auto=".2f", zmin=-1, zmax=1, color_continuous_scale="RdBu", title=recommendation["title"])
            st.plotly_chart(fig, use_container_width=True, key=f"{key_prefix}_corr")
    elif kind == "time_trend":
        x_col = recommendation["x"]
        y_col = recommendation["y"]
        tmp = df[[x_col, y_col]].dropna().copy()
        if not tmp.empty:
            tmp["_period"] = tmp[x_col].dt.to_period("M").dt.to_timestamp()
            agg = tmp.groupby("_period", as_index=False)[y_col].sum().sort_values("_period")
            fig = px.line(agg, x="_period", y=y_col, markers=True, title=recommendation["title"])
            st.plotly_chart(fig, use_container_width=True, key=f"{key_prefix}_ts")
    elif kind == "box_by_category":
        fig = px.box(df, x=recommendation["x"], y=recommendation["y"], title=recommendation["title"])
        st.plotly_chart(fig, use_container_width=True, key=f"{key_prefix}_box")


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


def list_files_for_selector(folder, suffixes):
    if not os.path.exists(folder):
        return []
    out = []
    for name in os.listdir(folder):
        p = os.path.join(folder, name)
        if os.path.isfile(p) and any(name.lower().endswith(s) for s in suffixes):
            out.append(p.replace("\\", "/"))
    return sorted(out)


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
        save_universal_session_store(saved_sessions)
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
        billed = pd.Series([0] * len(df))
    if billed.sum() == 0 and "Total Amount" in df.columns:
        billed = pd.to_numeric(df["Total Amount"], errors="coerce").fillna(0)
    return billed


def resolve_collected_series(df):
    if df is None or df.empty:
        return None
    if "Total_Paid_To_Date" in df.columns:
        collected = pd.to_numeric(df["Total_Paid_To_Date"], errors="coerce").fillna(0)
    else:
        collected = pd.Series([0] * len(df))
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
    agg = tmp.groupby("episode_id", as_index=False).agg({
        "_billed": "max" if "_billed" in tmp.columns else "first",
        "_collected": "max" if "_collected" in tmp.columns else "first",
        "Ward": "first"
    })
    return agg


def safe_count_duplicates(df, col):
    if df is None or df.empty or col not in df.columns:
        return None
    return int(df[col].duplicated().sum())


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

        # Normalize common columns
        for col in ["Amount", "Date", "Episode Number", "User", "Payment Type", "Description", "Medical Aid"]:
            if col in df.columns:
                df[col] = df[col]

        if "Amount" in df.columns:
            df["Amount"] = pd.to_numeric(df["Amount"], errors="coerce").fillna(0)
        if "Date" in df.columns:
            df["Date"] = pd.to_datetime(df["Date"], errors="coerce", dayfirst=True)

        return df
    except Exception:
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
        # Normalize column names
        rename_map = {
            "Admission Date": "Admission Date",
            "Episode Number": "Episode Number",
            "User": "User",
            "Ward": "Ward",
            "Name": "Name"
        }
        df = df.rename(columns=rename_map)
        keep_cols = [c for c in ["User", "Admission Date", "Episode Number", "Ward", "Name"] if c in df.columns]
        df = df[keep_cols]
        df = df[df["User"].notna()]
        return df
    except Exception:
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
        df = df[df["User"].notna()]
        return df
    except Exception:
        return pd.DataFrame()


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
    staff["Collection_Rate_%"] = (staff["Total_Collected"] / staff["Total_Billed"] * 100).fillna(0).round(1)
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


@st.cache_data(ttl=3600)
def load_management_sections(data_path):
    full_path = data_path if os.path.exists(data_path) else f"data_reservoir/raw/{data_path}"
    if not os.path.exists(full_path):
        return {}

    try:
        df = pd.read_csv(full_path, skiprows=2, low_memory=False, encoding="latin1")
    except Exception:
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
    df[date_col] = pd.to_datetime(df[date_col], errors="coerce")
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
    df[date_col] = pd.to_datetime(df[date_col], errors="coerce")
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

# ---------------------------------------------------------
# DATA LOADER FUNCTIONS (WITH CACHING)
# ---------------------------------------------------------

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
def load_finance_summary(master_path, payments_path, load_payments=True):
    """
    Load finance summary from the final intelligence master data.
    Returns key financial metrics for the dashboard.
    """
    if os.path.exists(master_path):
        try:
            df, _ = read_csv_resilient(master_path)
            df = normalize_master_schema(df)

            if load_payments:
                payments_df = load_payments_data(payments_path)
                payments_agg = build_payments_by_episode(payments_df)
                if not payments_agg.empty and "episode_id" in df.columns:
                    df = df.copy()
                    df["episode_id"] = df["episode_id"].astype(str).str.strip().str.upper()
                    df = df.merge(payments_agg, on="episode_id", how="left")
                    df["Total_Paid_To_Date_Calc"] = df["Total_Paid_To_Date_Calc"].fillna(0)
                    df["Total_Paid_To_Date"] = df[["Total_Paid_To_Date", "Total_Paid_To_Date_Calc"]].max(axis=1)

            total_billed = resolve_billed_series(df).sum() if resolve_billed_series(df) is not None else 0
            total_collected = resolve_collected_series(df).sum() if resolve_collected_series(df) is not None else 0
            collection_gap = total_billed - total_collected
            collection_rate = round((total_collected / total_billed) * 100, 1) if total_billed > 0 else 0

            return {
                "Total Billed": total_billed,
                "Total Collected": total_collected,
                "Collection Gap": collection_gap,
                "Collection Rate (%)": collection_rate
            }
        except Exception as e:
            st.warning(f"Error loading finance data: {e}")
    return {
        "Total Billed": 0,
        "Total Collected": 0,
        "Collection Gap": 0,
        "Collection Rate (%)": 0
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


@st.cache_data(ttl=3600)
def get_data_bundle(source_paths, load_heavy=False, load_cpt=False):
    management_path = source_paths.get("management", DEFAULT_DATA_REGISTRY["management"])
    master_path = source_paths.get("master", DEFAULT_DATA_REGISTRY["master"])
    payments_path = source_paths.get("payments", DEFAULT_DATA_REGISTRY["payments"])
    cpt_path = source_paths.get("cpt", DEFAULT_DATA_REGISTRY["cpt"])

    admissions_df = load_admissions_summary(management_path)
    finance_metrics = load_finance_summary(master_path, payments_path, load_payments=load_heavy)
    live_finance, df_full = load_live_metrics(master_path, payments_path, load_payments=load_heavy)
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

# ---------------------------------------------------------
# TABS
# ---------------------------------------------------------


# ---------------------------------------------------------
# SIDEBAR CONTROLS
# ---------------------------------------------------------

st.sidebar.title("🏥 Intelligence Hub")

# --- SECTION 1: DATA OPERATIONS ---
with st.sidebar.expander("🔄 Data Operations", expanded=True):
    if st.button("Refresh Dashboard", use_container_width=True, help="Clear cache and reload data from sources"):
        st.cache_data.clear()
        st.rerun()
    
    st.divider()
    
    upload_options = {
        "Main dataset (master)": "master",
        "Management report": "management",
        "Payments file": "payments",
        "Admissions per user": "admissions_user",
        "Admissions duration": "admissions_duration",
        "CPT statistics file": "cpt"
    }
    upload_target_label = st.selectbox("Target dataset", list(upload_options.keys()))
    upload_target_key = upload_options[upload_target_label]
    uploaded_core_file = st.file_uploader(
        "Upload CSV/TXT",
        type=["csv", "txt"],
        key="core_dataset_uploader"
    )
    if st.button("Upload & Set Active", use_container_width=True):
        ok, msg, updated_registry = upload_new_data_into_app(uploaded_core_file, upload_target_key, source_paths)
        if ok:
            source_paths = updated_registry
            st.cache_data.clear()
            st.sidebar.success(msg)
            st.rerun()
        else:
            st.sidebar.error(msg)

# --- SECTION 2: NAVIGATION ---
st.sidebar.subheader("📍 Navigation")
active_tab = st.sidebar.radio(
    "Select Module",
    ["Command Center", "Universal Analytics", "Executive Summary", "Admissions", "Finance", "Ward Performance", "Clinical / CPT", "Data Science Lab", "Data Quality", "Reports & Export"],
    index=0,
    label_visibility="collapsed"
)

# --- SECTION 3: ANALYSIS FILTERS ---
if active_tab != "Universal Analytics":
    with st.sidebar.expander("🔍 Analysis Filters", expanded=True):
        st.subheader("Global Filters")
        start_date = None
        end_date = None
        if df_full is not None and not df_full.empty:
            date_col = next((c for c in ["Admission Date", "Discharge Date"] if c in df_full.columns), None)
            if date_col:
                dt = pd.to_datetime(df_full[date_col], errors="coerce", dayfirst=True).dropna()
                if not dt.empty:
                    dmin, dmax = dt.min().date(), dt.max().date()
                    dflt = st.date_input("Date range", (dmin, dmax))
                    if isinstance(dflt, tuple) and len(dflt) == 2:
                        start_date, end_date = dflt[0], dflt[1]

        hospital_opts = ["All"]
        if df_full is not None and not df_full.empty and "Hospital" in df_full.columns:
            hospital_opts += sorted([h for h in df_full["Hospital"].dropna().astype(str).unique().tolist() if h.strip()])
        selected_hospital = st.selectbox("Hospital filter", hospital_opts, index=0)

        payer_opts = ["All"]
        if df_full is not None and not df_full.empty and "Medical Aid" in df_full.columns:
            payer_opts += sorted([p for p in df_full["Medical Aid"].dropna().astype(str).unique().tolist() if p.strip()])
        selected_payer = st.selectbox("Payer filter", payer_opts, index=0)
        
        st.divider()
        
        trend_granularity = st.selectbox(
            "Trend Granularity",
            ["Monthly", "Quarterly"],
            index=0,
            help="Group charts by Month or Quarter"
        )
        trend_freq_code = "M" if trend_granularity == "Monthly" else "Q"

        time_window = st.selectbox(
            "Time Window",
            ["YTD", "Last 12 Months", "Last 6 Months", "Last 3 Months"],
            index=0,
            help="Filter analysis to recent months"
        )
        effective_window = time_window

    with st.sidebar.expander("🛠️ Advanced Settings", expanded=False):
        lite_mode = st.checkbox(
            "Lite Mode (faster)",
            value=True,
            help="Skips heavy charts/tables for faster loading"
        )
        heavy_mode = st.checkbox(
            "Load heavy analytics",
            value=False,
            help="Enable expensive cross-tab analytics (may be slow)"
        )
        
        target_collection = st.number_input(
            "Target Collection (%)",
            min_value=0.0,
            max_value=100.0,
            value=float(target_collection),
            step=1.0,
            help="Adjust collection target benchmark"
        )

        table_limit = st.slider(
            "Max table rows",
            min_value=25,
            max_value=500,
            value=100,
            step=25
        )
        st.session_state["table_limit"] = table_limit
        
        show_tables = st.checkbox(
            "Render detailed tables",
            value=False
        )
        st.session_state["show_tables"] = show_tables

    # Pre-loading and Calculations (after filter selection)
    need_cpt_load = active_tab in ["Executive Summary", "Clinical / CPT", "Command Center", "Data Science Lab", "Reports & Export"]
    bundle = get_data_bundle(source_paths, load_heavy=heavy_mode, load_cpt=need_cpt_load)

    admissions_df = bundle["admissions_df"]
    finance_metrics = bundle["finance_metrics"]
    live_finance = bundle["live_finance"]
    df_full = bundle["df_full"]
    df_full_unfiltered = df_full.copy() if df_full is not None else pd.DataFrame()
    ward_data = bundle["ward_data"]
    data_quality = bundle["data_quality"]
    admissions_delta = bundle["admissions_delta"]
    finance_delta = bundle["finance_delta"]
    sections = bundle["sections"]
    payments_df = bundle["payments_df"]
    payments_df_unfiltered = payments_df.copy() if payments_df is not None else pd.DataFrame()
    last_updated = bundle["last_updated"]
    cpt_df = bundle["cpt_df"]
    cpt_df_unfiltered = cpt_df.copy() if cpt_df is not None else pd.DataFrame()
    cpt_metrics = bundle["cpt_metrics"]
    cpt_quality = bundle["cpt_quality"]

    # Filter Application
    df_full, cpt_df, payments_df = apply_global_filters(
        df_full, cpt_df, payments_df,
        start_date=start_date, end_date=end_date,
        hospital=selected_hospital, payer=selected_payer
    )

    # Sidebar Metrics
    st.sidebar.divider()
    st.sidebar.subheader("🚀 Quick Stats")
    qcol1, qcol2 = st.sidebar.columns(2)
    qcol1.metric("Collection", f"{live_finance.get('Collection Rate (%)', 0):.1f}%")
    quality_summary = compute_quality_summary(df_full)
    qcol2.metric("Quality", f"{quality_summary['score']:.0f}")

else:
    st.sidebar.caption("Universal mode active.")
    quick_lookup_query = ""


# ---------------------------------------------------------
# HEADER
# ---------------------------------------------------------

inject_dashboard_theme()
ds_preview_bundle = {}
ds_preview_note = ""
if active_tab in ["Command Center", "Data Science Lab"]:
    ds_build_error = None
    if df_full is not None and not df_full.empty:
        try:
            ds_preview_bundle = compute_hospital_ds_bundle(df_full, cpt_df, payments_df)
        except Exception as e:
            ds_build_error = str(e)
            ds_preview_bundle = {}

    if not ds_preview_bundle and df_full_unfiltered is not None and not df_full_unfiltered.empty:
        try:
            ds_preview_bundle = compute_hospital_ds_bundle(df_full_unfiltered, cpt_df_unfiltered, payments_df_unfiltered)
            if ds_preview_bundle:
                ds_preview_note = "Command Center visuals are using unfiltered data because the active filters produced no DS features."
        except Exception as e:
            ds_build_error = str(e)
            ds_preview_bundle = {}

    if not ds_preview_bundle and ds_build_error:
        ds_preview_note = f"Data Science build error: {ds_build_error}"

col_title, col_date = st.columns([3, 1])
with col_title:
    st.title("Universal Data Analytics & Hospital Intelligence")
with col_date:
    st.caption(f"{datetime.now().strftime('%B %d, %Y')}")

if active_tab == "Universal Analytics":
    st.caption("Universal Data Analytics Workspace")
else:
    st.caption(f"Executive Overview - Source: {reporting_label}")

st.caption(
    f"Last updated: master {last_updated['master']} | management {last_updated['management']} | CPT {last_updated['cpt']}"
)

if active_tab != "Universal Analytics":
    five_sec = build_five_second_summary(live_finance, admissions_df, ds_preview_bundle)
    render_five_second_summary(five_sec)

if active_tab != "Universal Analytics":
    master_age = get_file_age_hours(source_paths.get("master", DEFAULT_DATA_REGISTRY["master"]))
    if master_age is not None and master_age > 48:
        st.warning("Data freshness alert: master dataset is older than 48 hours.")

if active_tab != "Universal Analytics" and quick_lookup_query and df_full is not None and not df_full.empty:
    st.subheader("Quick Patient / Episode Lookup")
    lookup_df = lookup_episode_matches(df_full, quick_lookup_query, max_rows=25)
    if lookup_df.empty:
        st.caption("No matching records found for current filters.")
    else:
        st.caption(f"Found {len(lookup_df)} matching records (limited to 25).")
        st.dataframe(lookup_df, use_container_width=True)

# =========================================================
# TAB 0 - COMMAND CENTER
# =========================================================
if active_tab == "Command Center":
    if ds_preview_note:
        st.info(ds_preview_note)
    alerts_df = compute_operational_alerts(df_full, live_finance, target_collection)
    if not alerts_df.empty:
        st.subheader("Operational Alerts")
        st.dataframe(alerts_df, use_container_width=True)
    render_command_center(
        live_finance=live_finance,
        admissions_df=admissions_df,
        ds_bundle=ds_preview_bundle,
        table_limit=table_limit,
        selected_hospital=selected_hospital,
        selected_payer=selected_payer,
        start_date=start_date,
        end_date=end_date
    )

# =========================================================
# TAB 1 - UNIVERSAL ANALYTICS
# =========================================================
if active_tab == "Universal Analytics":
    render_universal_analytics_tab(table_limit=table_limit)

# =========================================================
# TAB 2 - EXECUTIVE SUMMARY
# =========================================================
if active_tab == "Executive Summary":
    st.markdown(
        """
        <div class="kpi-band">
            <h3>👋 Welcome to your Intelligence Hub</h3>
            <p>Use the <b>Command Center</b> for real-time risk alerts, or dive into <b>Finance</b> for revenue leakage analysis. 
            All metrics below are dynamically updated based on your sidebar filters.</p>
        </div>
        """,
        unsafe_allow_html=True
    )
    if not admissions_df.empty:
        total_admissions = admissions_df.sum().sum()
        casualty_total = admissions_df.loc["CASUALTY PATIENT"].sum() if "CASUALTY PATIENT" in admissions_df.index else 0
        day_total = admissions_df.loc["DAY PATIENT"].sum() if "DAY PATIENT" in admissions_df.index else 0
        inpatient_total = admissions_df.loc["IN-PATIENT"].sum() if "IN-PATIENT" in admissions_df.index else 0

        col1, col2, col3, col4 = st.columns(4)

        if admissions_delta:
            delta_label = f"{admissions_delta['delta']:+,.0f} vs {admissions_delta['prev_month']}"
        else:
            delta_label = None

        col1.metric("Total Admissions", f"{total_admissions:,}", delta=delta_label,
                    help="Total unique patient admissions recorded in the selected period.")
        col2.metric("Casualty Patients", f"{casualty_total:,}", help="Emergency and trauma unit admissions requiring immediate care.")
        col3.metric("Day Patients", f"{day_total:,}", help="Patients admitted and discharged within the same 24-hour cycle.")
        col4.metric("Inpatients", f"{inpatient_total:,}", help="Patients admitted for overnight or long-term hospital stay.")

        st.divider()

        if admissions_delta:
            st.subheader("Latest Month Admissions")
            cols = st.columns(2)
            cols[0].metric(
                f"{admissions_delta['last_month']} Total",
                f"{admissions_delta['last_total']:,.0f}",
                delta=f"{admissions_delta['delta']:+,.0f}"
            )
            if admissions_delta["delta_pct"] is not None:
                cols[1].metric(
                    "Month over Month",
                    f"{admissions_delta['delta_pct']:+.1f}%",
                    delta=f"{admissions_delta['delta']:+,.0f}"
                )
            else:
                cols[1].metric("Month over Month", "n/a")

        anomaly_tiles = compute_anomaly_tiles(df_full, ward_data)
        if anomaly_tiles:
            st.subheader("Top Anomalies")
            cols = st.columns(len(anomaly_tiles))
            for i, (label, value) in enumerate(anomaly_tiles.items()):
                cols[i].metric(label, value)

        if cpt_metrics:
            st.subheader("Clinical Operations Snapshot (CPT)")
            col_a, col_b, col_c, col_d = st.columns(4)
            col_a.metric("CPT Episodes", f"{cpt_metrics.get('Unique Episodes', 0):,}", 
                        help="Unique clinical episodes matched with CPT billing codes.")
            col_b.metric("Avg LOS (days)", f"{cpt_metrics.get('Avg LOS (days)')}", 
                        help="Average Length of Stay across all matching episodes.")
            col_c.metric("Avg Cost per Episode", f"${cpt_metrics.get('Avg Cost per Episode', 0):,.2f}", 
                        help="Mean financial cost (billing) per clinical episode.")
            col_d.metric("Theatre Cases", f"{cpt_metrics.get('Theatre Cases', 0):,}", 
                        help="Total number of episodes involving operating theatre utilization.")

            if not lite_mode and heavy_mode:
                components = compute_cpt_cost_components(cpt_df)
                if components:
                    comp_df = pd.DataFrame({
                        "Category": list(components.keys()),
                        "Value": list(components.values())
                    })
                    fig_comp = px.pie(
                        comp_df,
                        names="Category",
                        values="Value",
                        title="CPT Cost Mix"
                    )
                    st.plotly_chart(fig_comp, use_container_width=True)

        if heavy_mode:
            st.subheader("CEO Metrics Snapshot")
            col_a, col_b, col_c = st.columns(3)
            compliance = compute_compliance_metrics(df_full)
            alos = compute_alos_readmission(df_full)
            risk = compute_risk_indicators(df_full)
            projections = compute_projections(admissions_df, payments_df)

            if compliance:
                col_a.metric("Auth Coverage %", f"{compliance.get('Auth Coverage %', 0)}")
                if compliance.get("Avg Submission Delay (days)") is not None:
                    col_a.metric("Avg Submission Delay (days)", f"{compliance.get('Avg Submission Delay (days)')}")
            if alos:
                if alos.get("ALOS (days)") is not None:
                    col_b.metric("ALOS (days)", f"{alos.get('ALOS (days)')}")
                if alos.get("Readmission 30d %") is not None:
                    col_b.metric("Readmission 30d %", f"{alos.get('Readmission 30d %')}")
            if risk:
                col_c.metric("High Risk Episodes", f"{risk.get('High Risk Episodes', 0)}")
                col_c.metric("Total At-Risk Amount", f"{risk.get('Total At-Risk Amount', 0):,.2f}")
            if projections:
                st.caption("Projections (simple averages)")
                for k, v in projections.items():
                    st.write(f"{k}: {v}")

    if sections and not lite_mode and heavy_mode:
        st.subheader("Management Dashboard Sections")
        section_names = sorted(sections.keys())
        pick = st.selectbox("Preview Section", section_names, index=0)
        sec_df = sections.get(pick, pd.DataFrame())
        if not sec_df.empty:
            month_cols = [m for m in MONTH_ORDER if m in sec_df.columns]
            totals = sec_df[month_cols].sum()
            fig_sec = go.Figure()
            fig_sec.add_trace(go.Scatter(
                x=month_cols,
                y=totals.values,
                mode="lines+markers",
                name="Total"
            ))
            fig_sec.update_layout(height=300, hovermode="x unified")
            st.plotly_chart(fig_sec, use_container_width=True)
            display_limited_df(sec_df, "Section preview", limit=100)

        trend_labels, trend_df = aggregate_admissions_trend(admissions_df, freq=trend_freq_code)
        if trend_labels and trend_df is not None:
            trend_labels = apply_time_window(trend_labels, trend_freq_code, effective_window)
            trend_df = trend_df[trend_labels]
            st.subheader(f"{trend_granularity} Admissions Trend")
            totals = trend_df.sum()

            fig_trend = go.Figure()
            fig_trend.add_trace(go.Scatter(
                x=trend_labels,
                y=totals.values,
                mode="lines+markers",
                line=dict(color="#3b82f6", width=3),
                fill="tozeroy",
                fillcolor="rgba(59, 130, 246, 0.2)"
            ))
            fig_trend.update_layout(height=300, margin=dict(l=0, r=0, t=0, b=0), showlegend=False)
            st.plotly_chart(fig_trend, use_container_width=True)
        else:
            st.caption("Admissions trend unavailable: missing month columns.")
    else:
        st.warning("No admissions data available")

    st.divider()
    st.subheader("Data Quality Summary")
    st.dataframe(data_quality, use_container_width=True)

# =========================================================
# TAB 2 - ADMISSIONS ANALYSIS
# =========================================================
if active_tab == "Admissions":
    if not admissions_df.empty:
        st.subheader("Admissions Distribution")

        admission_mix = admissions_df.sum(axis=1).reset_index()
        admission_mix.columns = ["Admission_Type", "Total"]
        admission_mix["Percentage"] = (admission_mix["Total"] / admission_mix["Total"].sum() * 100).round(1)

        col_pie, col_table = st.columns([2, 1])

        with col_pie:
            fig_mix = px.pie(
                admission_mix,
                names="Admission_Type",
                values="Total",
                hole=0.4,
                title="Admissions Mix by Type"
            )
            st.plotly_chart(fig_mix, use_container_width=True)

        with col_table:
            st.dataframe(admission_mix[["Admission_Type", "Percentage"]], use_container_width=True)

        st.divider()

        trend_labels, trend_df = aggregate_admissions_trend(
            admissions_df,
            freq=trend_freq_code
        )
        if trend_labels and trend_df is not None:
            trend_labels = apply_time_window(trend_labels, trend_freq_code, effective_window)
            trend_df = trend_df[trend_labels]
            st.subheader(f"{trend_granularity} Admissions by Type")

            fig_monthly = go.Figure()
            for admission_type in trend_df.index:
                fig_monthly.add_trace(go.Scatter(
                    x=trend_labels,
                    y=trend_df.loc[admission_type],
                    mode="lines",
                    name=admission_type,
                    stackgroup="one"
                ))
            fig_monthly.update_layout(height=400, hovermode="x unified")
            st.plotly_chart(fig_monthly, use_container_width=True)
        else:
            st.caption("Admissions by type unavailable: missing month columns.")

        st.subheader("Detailed Admissions Table")
        display_limited_df(admissions_df, "Admissions table", limit=table_limit)
    else:
        st.warning("No admissions data available")

    if sections and not lite_mode and heavy_mode:
        extra_sections = find_sections(sections, ["admission", "laboratory", "lab"])
        if extra_sections:
            st.subheader("Additional Admissions-Related Sections")
            for name in extra_sections:
                sec_df = sections.get(name, pd.DataFrame())
                if sec_df.empty:
                    continue
                st.caption(name)
                display_limited_df(sec_df, name, limit=100)

    # Admissions per user + staff metrics
    if heavy_mode:
        adm_user_df = load_admissions_per_user(source_paths.get("admissions_user", DEFAULT_DATA_REGISTRY["admissions_user"]))
        dur_df = load_admissions_duration(source_paths.get("admissions_duration", DEFAULT_DATA_REGISTRY["admissions_duration"]))
        staff_metrics = build_staff_metrics(adm_user_df, df_full)
        staff_metrics = add_duration_metrics(staff_metrics, dur_df)
        staff_metrics = add_hospital_breakdown(staff_metrics, adm_user_df)
    else:
        staff_metrics = pd.DataFrame()
    if not staff_metrics.empty:
        st.info("💡 **Pro-Tip:** High admission counts with low collection rates may indicate an onboarding bottleneck or medical aid verification issues at the point of entry.")
        st.subheader("Admissions per User (Cross-Referenced)")
        user_filter = st.selectbox(
            "Filter Staff (optional)",
            ["All"] + staff_metrics["User"].dropna().unique().tolist(),
            index=0
        )
        staff_view = staff_metrics if user_filter == "All" else staff_metrics[staff_metrics["User"] == user_filter]
        display_limited_df(staff_view, "Staff metrics", limit=200)
        if not lite_mode and heavy_mode:
            top_staff = staff_metrics.head(10) if user_filter == "All" else staff_view
            fig_staff = px.bar(
                top_staff,
                x="User",
                y="Admissions",
                color="Collection_Rate_%",
                title="Top 10 Users by Admissions",
                color_continuous_scale="RdYlGn",
                range_color=[0, 100]
            )
            st.plotly_chart(fig_staff, use_container_width=True)

        if "Avg_Duration_Min" in staff_metrics.columns and not lite_mode and heavy_mode:
            st.subheader("Average Admission Duration by User")
            fig_dur = px.bar(
                staff_metrics.head(10) if user_filter == "All" else staff_view,
                x="User",
                y="Avg_Duration_Min",
                color="Avg_Duration_Min",
                color_continuous_scale="Viridis"
            )
            st.plotly_chart(fig_dur, use_container_width=True)

        trend_df = build_staff_trend(adm_user_df)
        if not trend_df.empty and not lite_mode and heavy_mode:
            st.subheader("Monthly Admissions per User (Top 5)")
            top_users = staff_metrics.head(5)["User"].tolist()
            trend_df = trend_df[trend_df["User"].isin(top_users)]
            fig_trend = px.line(
                trend_df,
                x="_month",
                y="Admissions",
                color="User",
                markers=True
            )
            st.plotly_chart(fig_trend, use_container_width=True)

        if st.button("Download Staff Performance (Excel)"):
            output = BytesIO()
            with pd.ExcelWriter(output, engine="openpyxl") as writer:
                staff_metrics.to_excel(writer, sheet_name="Staff Performance", index=False)
            output.seek(0)
            st.download_button(
                label="Download Staff Performance",
                data=output.getvalue(),
                file_name=f"Staff_Performance_{datetime.now().strftime('%Y%m%d')}.xlsx",
                mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            )

# =========================================================
# TAB 3 - FINANCE
# =========================================================
if active_tab == "Finance":
    if live_finance:
        col1, col2, col3, col4 = st.columns(4)

        collection_vs_target = live_finance.get("Collection Rate (%)", 0) - target_collection
        delta_color = "normal" if collection_vs_target >= 0 else "inverse"

        billed_delta = None
        collected_delta = None
        if finance_delta:
            billed_delta = f"{finance_delta['billed_delta']:+,.0f}"
            collected_delta = f"{finance_delta['collected_delta']:+,.0f}"

        col1.metric(
            "Total Billed",
            f"${live_finance.get('Total Billed', 0):,.2f}",
            delta=billed_delta,
            help="Gross billing amount generated from all episodes in the selected scope."
        )
        col2.metric(
            "Total Collected",
            f"${live_finance.get('Total Collected', 0):,.2f}",
            delta=collected_delta,
            help="Total actual payments recovered to date (Cash + Medical Aid)."
        )
        col3.metric(
            "Collection Gap",
            f"${live_finance.get('Collection Gap', 0):,.2f}",
            help="The 'Revenue Leakage' — the difference between billed and collected amounts."
        )
        col4.metric(
            "Collection Rate vs Target",
            f"{collection_vs_target:+.1f}%",
            delta_color=delta_color,
            help=f"Performance benchmark. Target is set to {target_collection}% in settings."
        )

        if not finance_delta:
            st.caption("Finance deltas are unavailable because no usable date column was found in the master dataset.")

        st.divider()

        if payments_df.empty:
            st.info("Payments dataset could not be loaded; collection figures may be incomplete.")

        if df_full is not None and not df_full.empty:
            trend_df = compute_finance_monthly_trend(df_full, freq=trend_freq_code)
            if trend_df is not None and not trend_df.empty:
                trend_labels = apply_time_window(trend_df["_period"].tolist(), trend_freq_code, effective_window)
                trend_df = trend_df[trend_df["_period"].isin(trend_labels)]
                st.subheader(f"{trend_granularity} Finance Trend")
                fig_trend = go.Figure()
                fig_trend.add_trace(go.Scatter(
                    x=trend_df["_period"],
                    y=trend_df["billed"],
                    mode="lines+markers",
                    name="Billed"
                ))
                fig_trend.add_trace(go.Scatter(
                    x=trend_df["_period"],
                    y=trend_df["collected"],
                    mode="lines+markers",
                    name="Collected"
                ))
                fig_trend.update_layout(height=350, hovermode="x unified")
                st.plotly_chart(fig_trend, use_container_width=True)
            else:
                st.caption("Trend unavailable: no usable date column in master data.")

        st.divider()

        col_gauge, col_aging = st.columns(2)

        with col_gauge:
            fig_gauge = go.Figure(go.Indicator(
                mode="gauge+number+delta",
                value=live_finance.get("Collection Rate (%)", 0),
                domain={"x": [0, 1], "y": [0, 1]},
                title={"text": "Collection Performance"},
                delta={"reference": target_collection},
                gauge={
                    "axis": {"range": [0, 100]},
                    "bar": {"color": "darkblue"},
                    "steps": [
                        {"range": [0, 60], "color": "lightcoral"},
                        {"range": [60, 80], "color": "lightyellow"},
                        {"range": [80, 100], "color": "lightgreen"}
                    ],
                    "threshold": {
                        "line": {"color": "red", "width": 4},
                        "thickness": 0.75,
                        "value": target_collection
                    }
                }
            ))
            fig_gauge.update_layout(height=400)
            st.plotly_chart(fig_gauge, use_container_width=True)

        with col_aging:
            if df_full is not None and not df_full.empty:
                aging_data = pd.DataFrame({
                    "Age Bucket": ["Current", "30 Days", "60 Days", "90 Days", "120+ Days"],
                    "Amount": [
                        safe_sum(df_full, "Current"),
                        safe_sum(df_full, "30 Days"),
                        safe_sum(df_full, "60 Days"),
                        safe_sum(df_full, "90 Days"),
                        safe_sum(df_full, "120 Days") + safe_sum(df_full, "150+ Days")
                    ]
                })

                fig_aging = px.bar(
                    aging_data,
                    x="Age Bucket",
                    y="Amount",
                    color="Age Bucket",
                    title="Receivables Aging Analysis",
                    color_discrete_sequence=["green", "yellow", "orange", "red", "darkred"]
                )
                st.plotly_chart(fig_aging, use_container_width=True)

        if not payments_df.empty and "Medical Aid" in payments_df.columns and not lite_mode and heavy_mode:
            st.subheader("Collections by Medical Aid")
            ma = payments_df.copy()
            ma["Medical Aid"] = ma["Medical Aid"].fillna("Unknown")
            ma_summary = ma.groupby("Medical Aid", as_index=False).agg(
                Total_Collected=("Amount", "sum"),
                Transactions=("Amount", "count"),
                Avg_Amount=("Amount", "mean")
            ).sort_values("Total_Collected", ascending=False)
            fig_ma = px.bar(
                ma_summary.head(15),
                x="Medical Aid",
                y="Total_Collected",
                color="Total_Collected",
                title="Top Medical Aids by Collections",
                color_continuous_scale="Blues"
            )
            st.plotly_chart(fig_ma, use_container_width=True)
            display_limited_df(ma_summary, "Medical Aid summary", limit=200)

        if heavy_mode:
            st.subheader("Insurer Deductions Pattern")
            ded = compute_insurer_deductions(df_full)
            if not ded.empty:
                st.dataframe(ded.head(20), use_container_width=True)
                fig_ded = px.bar(
                    ded.head(15),
                    x="Medical Aid",
                    y="Gap_%",
                    color="Gap_%",
                    title="Top Insurers by Gap %",
                    color_continuous_scale="Reds"
                )
                st.plotly_chart(fig_ded, use_container_width=True)

        if sections and not lite_mode and heavy_mode:
            finance_sections = find_sections(sections, ["revenue", "collection", "debt", "ageing", "aging", "cash", "payment"])
            if finance_sections:
                st.subheader("Finance Sections from Management Dashboard")
                for name in finance_sections:
                    sec_df = sections.get(name, pd.DataFrame())
                    if sec_df.empty:
                        continue
                    st.caption(name)
                    display_limited_df(sec_df, name, limit=100)

# =========================================================
# TAB 4 - WARD PERFORMANCE
# =========================================================
if active_tab == "Ward Performance":
    if df_full is not None and not df_full.empty and "Ward" in df_full.columns:
        st.subheader("Ward Performance Analytics")

        if not ward_data.empty:
            if selected_ward != "All":
                ward_data_filtered = ward_data[ward_data["Ward"] == selected_ward]
            else:
                ward_data_filtered = ward_data

            st.subheader("High Risk Wards (Low Collection / High Gap)")
            col_low, col_gap = st.columns(2)
            with col_low:
                low_cr = ward_data_filtered.nsmallest(5, "Collection_Rate_%")
                st.caption("Lowest Collection Rate")
                st.dataframe(low_cr[["Ward", "Collection_Rate_%", "Collection_Gap"]], use_container_width=True)
            with col_gap:
                high_gap = ward_data_filtered.nlargest(5, "Collection_Gap")
                st.caption("Highest Collection Gap")
                st.dataframe(high_gap[["Ward", "Collection_Rate_%", "Collection_Gap"]], use_container_width=True)

            st.subheader("Top 5 Wards by Collection Rate")

            top_wards = ward_data_filtered.nlargest(5, "Collection_Rate_%")

            fig_wards = px.bar(
                top_wards,
                x="Ward",
                y="Collection_Rate_%",
                color="Collection_Rate_%",
                text="Collection_Rate_%",
                title="Ward Collection Performance",
                color_continuous_scale="RdYlGn",
                range_color=[0, 100]
            )
            st.plotly_chart(fig_wards, use_container_width=True)

            outliers = ward_data_filtered[ward_data_filtered["Outlier_Flag"]]
            if not outliers.empty:
                st.subheader("Outlier Wards")
                display_limited_df(outliers[[
                    "Ward", "Collection_Rate_%", "Collection_Gap", "Outlier_Flag"
                ]], "Outlier wards", limit=table_limit)

            st.subheader("Ward Summary Table")
            display_limited_df(style_ward_table(ward_data_filtered), "Ward summary", limit=200)

            if st.button("Download Filtered Ward Summary (Excel)"):
                output = BytesIO()
                with pd.ExcelWriter(output, engine="openpyxl") as writer:
                    ward_data_filtered.to_excel(writer, sheet_name="Ward Summary", index=False)
                output.seek(0)
                st.download_button(
                    label="Download Filtered Ward Summary",
                    data=output.getvalue(),
                    file_name=f"Ward_Summary_Filtered_{datetime.now().strftime('%Y%m%d')}.xlsx",
                    mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                )
    else:
        st.info("Ward data not available or Ward column missing")

    if sections and not lite_mode and heavy_mode:
        ward_sections = find_sections(sections, ["ward", "in-patient", "inpatient"])
        if ward_sections:
            st.subheader("Ward-Related Sections from Management Dashboard")
            for name in ward_sections:
                sec_df = sections.get(name, pd.DataFrame())
                if sec_df.empty:
                    continue
                st.caption(name)
                display_limited_df(sec_df, name, limit=100)

# =========================================================
# TAB 5 - CLINICAL / CPT
# =========================================================
if active_tab == "Clinical / CPT":
    if cpt_df is not None and not cpt_df.empty:
        st.subheader("CPT Case Mix Overview")

        if cpt_metrics:
            col1, col2, col3, col4 = st.columns(4)
            col1.metric("CPT Episodes", f"{cpt_metrics.get('Unique Episodes', 0):,}")
            col2.metric("Total Cost", f"${cpt_metrics.get('Total Cost', 0):,.2f}")
            col3.metric("Avg LOS (days)", f"{cpt_metrics.get('Avg LOS (days)')}")
            col4.metric("Total Theatre Minutes", f"{cpt_metrics.get('Total Theatre Minutes', 0):,.0f}")

        tables = build_cpt_top_tables(cpt_df)

        if not lite_mode and "top_cpt" in tables and not tables["top_cpt"].empty:
            st.subheader("Top CPT Codes by Total Cost")
            fig_cpt = px.bar(
                tables["top_cpt"],
                x="CPT_Label",
                y="Total_Cost",
                color="Total_Cost",
                title="Top CPT Codes",
                color_continuous_scale="Blues"
            )
            st.plotly_chart(fig_cpt, use_container_width=True)
            display_limited_df(tables["top_cpt"], "Top CPT codes", limit=table_limit)

        if not lite_mode and "top_icd" in tables and not tables["top_icd"].empty:
            st.subheader("Top ICD Codes by Volume")
            fig_icd = px.bar(
                tables["top_icd"],
                x="ICD_Label",
                y="Cases",
                color="Cases",
                title="Top ICD Codes",
                color_continuous_scale="Greens"
            )
            st.plotly_chart(fig_icd, use_container_width=True)
            display_limited_df(tables["top_icd"], "Top ICD codes", limit=table_limit)

        if not lite_mode and "top_doctors" in tables and not tables["top_doctors"].empty:
            st.subheader("Top Doctors by Total Cost")
            fig_doc = px.bar(
                tables["top_doctors"],
                x="Doctor",
                y="Total_Cost",
                color="Total_Cost",
                title="Top Doctors",
                color_continuous_scale="Oranges"
            )
            st.plotly_chart(fig_doc, use_container_width=True)
            display_limited_df(tables["top_doctors"], "Top doctors", limit=table_limit)

        if "theatre_by_location" in tables and not tables["theatre_by_location"].empty:
            st.subheader("Theatre Utilization by Location")
            fig_loc = px.bar(
                tables["theatre_by_location"],
                x="Theatre Location",
                y="Total_Minutes",
                color="Total_Minutes",
                title="Theatre Minutes by Location",
                color_continuous_scale="Purples"
            )
            st.plotly_chart(fig_loc, use_container_width=True)
            display_limited_df(tables["theatre_by_location"], "Theatre utilization", limit=table_limit)

        if "ward_days" in tables and not tables["ward_days"].empty:
            st.subheader("Ward Day Mix")
            fig_days = px.bar(
                tables["ward_days"],
                x="Ward_Type",
                y="Total_Days",
                color="Total_Days",
                title="Ward Days by Category",
                color_continuous_scale="Tealgrn"
            )
            st.plotly_chart(fig_days, use_container_width=True)
            display_limited_df(tables["ward_days"], "Ward day totals", limit=table_limit)

        st.subheader("CPT Data Quality")
        display_limited_df(cpt_quality, "CPT data quality", limit=table_limit)
        if heavy_mode:
            with st.expander("Preview CPT Raw Data (First 100 Rows)"):
                st.dataframe(cpt_df.head(100), use_container_width=True)
    else:
        st.warning("CPT statistics dataset not available.")

# =========================================================
# TAB 6 - DATA SCIENCE LAB
# =========================================================
if active_tab == "Data Science Lab":
    st.subheader("Hospital Data Science Lab")
    if df_full is None or df_full.empty:
        st.warning("Master finance dataset is not available.")
    else:
        ds = compute_hospital_ds_bundle(df_full, cpt_df, payments_df)
        if not ds:
            st.warning("Could not build data science features from available datasets.")
        else:
            ep = ds["episode_features"]
            high_risk = ds["high_risk"]
            ward_risk = ds["ward_risk"]
            payer = ds["payer_leakage"]
            cohort = ds["cohort"]
            doctor = ds["doctor_efficiency"]
            trend = ds["trend"]
            proj = ds["projections"]
            readmission = ds.get("readmission", {})
            root_cause = ds.get("root_cause", {})

            critical_cases = int((ep["risk_band"] == "Critical").sum()) if "risk_band" in ep.columns else 0
            high_cases = int(ep["risk_band"].isin(["High", "Critical"]).sum()) if "risk_band" in ep.columns else 0
            total_gap = float(pd.to_numeric(ep.get("gap", 0), errors="coerce").fillna(0).sum())
            avg_risk = float(pd.to_numeric(ep.get("risk_score", 0), errors="coerce").fillna(0).mean()) if len(ep) else 0

            k1, k2, k3, k4 = st.columns(4)
            k1.metric("Episodes Modeled", f"{len(ep):,}")
            k2.metric("High/Critical Risk", f"{high_cases:,}", delta=f"{critical_cases:,} critical")
            k3.metric("Total Gap at Risk", f"${total_gap:,.0f}")
            k4.metric("Average Risk Score", f"{avg_risk:.1f}")

            if proj:
                st.subheader("Forward Projections (Trend-based)")
                p1, p2, p3, p4 = st.columns(4)
                p1.metric("Next Episodes", f"{proj.get('Next_Episodes', 0):,.0f}")
                p2.metric("Next Cost", f"${proj.get('Next_Total_Cost', 0):,.0f}")
                p3.metric("Next Gap", f"${proj.get('Next_Total_Gap', 0):,.0f}")
                if "Next_Collections" in proj:
                    p4.metric("Next Collections", f"${proj.get('Next_Collections', 0):,.0f}")

            if readmission:
                st.subheader("Readmission Risk Model (30-day)")
                rs = readmission.get("summary", {})
                r1, r2, r3, r4 = st.columns(4)
                r1.metric("Modeled Episodes", f"{rs.get('modeled_rows', 0):,}")
                r2.metric("Observed Readmit %", f"{rs.get('observed_readmit_rate_pct', 0):.2f}%")
                r3.metric("Predicted Readmit %", f"{rs.get('predicted_readmit_rate_pct', 0):.2f}%")
                r4.metric("Test AUC", f"{rs.get('test_auc', 'n/a')}")

                cal = readmission.get("calibration", pd.DataFrame())
                if cal is not None and not cal.empty:
                    fig_cal = go.Figure()
                    fig_cal.add_trace(go.Scatter(x=cal["decile"], y=cal["predicted"], mode="lines+markers", name="Predicted"))
                    fig_cal.add_trace(go.Scatter(x=cal["decile"], y=cal["actual"], mode="lines+markers", name="Actual"))
                    fig_cal.update_layout(title="Readmission Calibration by Risk Decile", xaxis_title="Decile", yaxis_title="Rate")
                    st.plotly_chart(fig_cal, use_container_width=True)

                top_readmit = readmission.get("top_risk", pd.DataFrame())
                if top_readmit is not None and not top_readmit.empty:
                    cols = [c for c in [
                        "episode_id", "ID Number", "Admission Date", "Discharge Date",
                        "readmit_prob_30d", "readmit_risk_band", "gap", "los_days", "episode_cost"
                    ] if c in top_readmit.columns]
                    st.caption("Top Episodes by Predicted Readmission Risk")
                    display_limited_df(top_readmit[cols], "Readmission risk episodes", limit=table_limit)

            st.subheader("Top High-Risk Episodes")
            risk_cols = [c for c in [
                "episode_id", "Patient Name", "Medical Aid", "Ward", "Doctor",
                "risk_score", "risk_band", "gap", "los_days", "episode_cost", "aging_risk_amount"
            ] if c in high_risk.columns]
            display_limited_df(high_risk[risk_cols], "High-risk episodes", limit=table_limit)

            ch1, ch2 = st.columns(2)
            with ch1:
                if not ward_risk.empty:
                    st.subheader("Ward Risk Heatmap")
                    fig_wr = px.bar(
                        ward_risk.head(15),
                        x="Ward",
                        y="Avg_Risk",
                        color="Total_Gap",
                        title="Top Wards by Average Risk",
                        color_continuous_scale="Reds"
                    )
                    st.plotly_chart(fig_wr, use_container_width=True)
            with ch2:
                if not payer.empty:
                    st.subheader("Payer Leakage")
                    fig_pay = px.bar(
                        payer.head(15),
                        x="Medical Aid",
                        y="Leakage_%",
                        color="Gap",
                        title="Top Payers by Leakage %",
                        color_continuous_scale="Oranges"
                    )
                    st.plotly_chart(fig_pay, use_container_width=True)

            st.markdown('<div class="section-note">Advanced Visual Diagnostics: dot plot, heatmap, and flow analysis for fast root-cause interpretation.</div>', unsafe_allow_html=True)
            a1, a2 = st.columns(2)
            with a1:
                if not payer.empty:
                    dot_df = payer.head(20).copy()
                    fig_dot = px.scatter(
                        dot_df,
                        x="Leakage_%",
                        y="Medical Aid",
                        size="Gap",
                        color="Avg_Risk",
                        title="Payer Leakage Dot Plot (size = gap, color = risk)",
                        color_continuous_scale="Turbo"
                    )
                    st.plotly_chart(fig_dot, use_container_width=True)
            with a2:
                if "Ward" in ep.columns and "risk_band" in ep.columns:
                    hm = ep.copy()
                    hm["risk_band"] = hm["risk_band"].fillna("Unknown")
                    hm["Ward"] = hm["Ward"].fillna("Unknown")
                    hm_tbl = hm.groupby(["Ward", "risk_band"]).size().reset_index(name="count")
                    if not hm_tbl.empty:
                        fig_hm = px.density_heatmap(
                            hm_tbl,
                            x="risk_band",
                            y="Ward",
                            z="count",
                            histfunc="sum",
                            title="Ward vs Risk Band Heatmap"
                        )
                        st.plotly_chart(fig_hm, use_container_width=True)

            if "Medical Aid" in ep.columns and "Ward" in ep.columns and "risk_band" in ep.columns:
                sank = ep.copy()
                sank["Medical Aid"] = sank["Medical Aid"].fillna("Unknown").astype(str)
                sank["Ward"] = sank["Ward"].fillna("Unknown").astype(str)
                sank["risk_band"] = sank["risk_band"].fillna("Unknown").astype(str)
                top_payers = sank["Medical Aid"].value_counts().head(8).index.tolist()
                top_wards = sank["Ward"].value_counts().head(8).index.tolist()
                sank = sank[sank["Medical Aid"].isin(top_payers) & sank["Ward"].isin(top_wards)]
                l1 = sank.groupby(["Medical Aid", "Ward"], as_index=False).size().rename(columns={"size": "value"})
                l2 = sank.groupby(["Ward", "risk_band"], as_index=False).size().rename(columns={"size": "value"})
                nodes = sorted(set(l1["Medical Aid"]).union(set(l1["Ward"])).union(set(l2["risk_band"])))
                node_idx = {n: i for i, n in enumerate(nodes)}
                source = [node_idx[s] for s in l1["Medical Aid"].tolist()] + [node_idx[s] for s in l2["Ward"].tolist()]
                target = [node_idx[t] for t in l1["Ward"].tolist()] + [node_idx[t] for t in l2["risk_band"].tolist()]
                value = l1["value"].tolist() + l2["value"].tolist()
                if value:
                    fig_sankey = go.Figure(data=[go.Sankey(
                        node=dict(label=nodes, pad=12, thickness=14),
                        link=dict(source=source, target=target, value=value)
                    )])
                    fig_sankey.update_layout(title_text="Flow: Payer -> Ward -> Risk Band", height=450)
                    st.plotly_chart(fig_sankey, use_container_width=True)

            if not cohort.empty:
                st.subheader("Cohort Trend")
                ct1, ct2 = st.columns(2)
                with ct1:
                    fig_coh_risk = px.line(
                        cohort,
                        x="cohort_month",
                        y="Avg_Risk",
                        markers=True,
                        title="Average Risk by Admission Cohort"
                    )
                    st.plotly_chart(fig_coh_risk, use_container_width=True)
                with ct2:
                    fig_coh_gap = px.bar(
                        cohort,
                        x="cohort_month",
                        y="Total_Gap",
                        title="Total Gap by Admission Cohort",
                        color="Total_Gap",
                        color_continuous_scale="Reds"
                    )
                    st.plotly_chart(fig_coh_gap, use_container_width=True)

            if not doctor.empty:
                st.subheader("Doctor Efficiency Frontier")
                fig_doc_eff = px.scatter(
                    doctor[doctor["Cases"] >= 5] if "Cases" in doctor.columns else doctor,
                    x="Avg_LOS",
                    y="Avg_Cost",
                    size="Cases",
                    color="Efficiency_Index",
                    hover_name="Doctor",
                    title="Lower LOS + Lower Cost + Higher Collection = Better Efficiency",
                    color_continuous_scale="Viridis"
                )
                st.plotly_chart(fig_doc_eff, use_container_width=True)
                display_limited_df(doctor.head(20), "Doctor efficiency", limit=table_limit)

            drivers = root_cause.get("drivers", pd.DataFrame()) if isinstance(root_cause, dict) else pd.DataFrame()
            if drivers is not None and not drivers.empty:
                st.subheader("Root-Cause Decomposition")
                dims = sorted(drivers["dimension"].dropna().unique().tolist())
                pick_dim = st.selectbox("Driver dimension", dims, index=0)
                drv = drivers[drivers["dimension"] == pick_dim].copy().head(20)
                fig_drv = px.bar(
                    drv,
                    x="segment",
                    y="impact_score",
                    color="gap_sum",
                    title=f"Top Drivers by Impact Score ({pick_dim})",
                    color_continuous_scale="Reds"
                )
                st.plotly_chart(fig_drv, use_container_width=True)
                display_limited_df(
                    drv[[
                        "segment", "episodes", "impact_score", "driver_type",
                        "risk_mean", "gap_ratio_mean", "los_mean", "collection_mean", "gap_sum"
                    ]],
                    "Root cause drivers",
                    limit=table_limit
                )

            if not trend.empty:
                st.subheader("Episode-Level Trend")
                fig_tr = go.Figure()
                fig_tr.add_trace(go.Scatter(x=trend["period"], y=trend["Episodes"], mode="lines+markers", name="Episodes"))
                fig_tr.add_trace(go.Scatter(x=trend["period"], y=trend["Total_Gap"], mode="lines+markers", name="Total Gap"))
                fig_tr.update_layout(height=360, hovermode="x unified")
                st.plotly_chart(fig_tr, use_container_width=True)

            st.subheader("Actionable Recommendations")
            for rec in ds.get("recommendations", []):
                st.write(f"- {rec}")

            if st.button("Download Data Science Pack (Excel)"):
                output = BytesIO()
                with pd.ExcelWriter(output, engine="openpyxl") as writer:
                    ep.to_excel(writer, sheet_name="Episode Features", index=False)
                    high_risk.to_excel(writer, sheet_name="High Risk", index=False)
                    if not ward_risk.empty:
                        ward_risk.to_excel(writer, sheet_name="Ward Risk", index=False)
                    if not payer.empty:
                        payer.to_excel(writer, sheet_name="Payer Leakage", index=False)
                    if not cohort.empty:
                        cohort.to_excel(writer, sheet_name="Cohort", index=False)
                    if not doctor.empty:
                        doctor.to_excel(writer, sheet_name="Doctor Efficiency", index=False)
                    if not trend.empty:
                        trend.to_excel(writer, sheet_name="Trend", index=False)
                    if readmission:
                        if readmission.get("top_risk") is not None and not readmission["top_risk"].empty:
                            readmission["top_risk"].to_excel(writer, sheet_name="Readmit Top Risk", index=False)
                        if readmission.get("calibration") is not None and not readmission["calibration"].empty:
                            readmission["calibration"].to_excel(writer, sheet_name="Readmit Calibration", index=False)
                        if readmission.get("coefficients") is not None and not readmission["coefficients"].empty:
                            readmission["coefficients"].to_excel(writer, sheet_name="Readmit Coeff", index=False)
                    if drivers is not None and not drivers.empty:
                        drivers.to_excel(writer, sheet_name="Root Cause Drivers", index=False)
                output.seek(0)
                st.download_button(
                    label="Download DS Pack",
                    data=output.getvalue(),
                    file_name=f"Hospital_DS_Pack_{datetime.now().strftime('%Y%m%d')}.xlsx",
                    mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                )

# =========================================================
# TAB 7 - DATA QUALITY
# =========================================================
if active_tab == "Data Quality":
    st.subheader("Data Quality")
    quality_summary = compute_quality_summary(df_full)
    cols = st.columns(2)
    cols[0].metric("Quality Score", f"{quality_summary['score']:.1f}")
    cols[1].metric("Status", quality_summary["status"])
    if quality_summary["issues"]:
        st.caption("Issues: " + " | ".join(quality_summary["issues"][:3]))
    display_limited_df(data_quality, "Data quality table", limit=table_limit)

    if df_full is not None and not df_full.empty and heavy_mode:
        with st.expander("Preview Raw Data (First 100 Rows)"):
            st.dataframe(df_full.head(100), use_container_width=True)

        null_rates = []
        for col in ["Original Billed", "Total_Paid_To_Date", "Collection_Gap", "Monthly_Interest_Loss"]:
            if col in df_full.columns:
                null_rates.append({"Column": col, "Null %": df_full[col].isna().mean() * 100})
        if null_rates:
            df_nulls = pd.DataFrame(null_rates)
            fig_nulls = px.bar(df_nulls, x="Column", y="Null %", title="Null Rates by Column")
            st.plotly_chart(fig_nulls, use_container_width=True)

        neg_counts = []
        for col in ["Original Billed", "Total_Paid_To_Date", "Collection_Gap"]:
            if col in df_full.columns:
                neg_counts.append({"Column": col, "Negative Count": int((pd.to_numeric(df_full[col], errors="coerce") < 0).sum())})
        if neg_counts:
            df_negs = pd.DataFrame(neg_counts)
            fig_negs = px.bar(df_negs, x="Column", y="Negative Count", title="Negative Values by Column")
            st.plotly_chart(fig_negs, use_container_width=True)

        if "Original Billed" in df_full.columns and df_full["Original Billed"].sum() == 0 and "Total Amount" in df_full.columns:
            st.info("Original Billed is zero for all records. Using Total Amount as billed value for KPIs and ward metrics.")

    if sections:
        st.subheader("Section Coverage")
        st.caption(f"Sections detected: {len(sections)}")
        st.write(", ".join(sorted(sections.keys())))

# =========================================================
# TAB 8 - REPORTS & EXPORT
# =========================================================
if active_tab == "Reports & Export":
    st.subheader("Export Data")

    if st.button("Download Finance Report (Excel)"):
        if df_full is not None and not df_full.empty:
            output = BytesIO()
            with pd.ExcelWriter(output, engine="openpyxl") as writer:
                df_full.to_excel(writer, sheet_name="Finance Data", index=False)
            output.seek(0)
            st.download_button(
                label="Download Excel File",
                data=output.getvalue(),
                file_name=f"Hospital_Intelligence_Report_{datetime.now().strftime('%Y%m%d')}.xlsx",
                mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            )

    if st.button("Download Executive Pack (Excel)"):
        if df_full is not None and not df_full.empty:
            output = BytesIO()
            with pd.ExcelWriter(output, engine="openpyxl") as writer:
                summary = build_summary_metrics(live_finance, admissions_df, ward_data, cpt_metrics)
                if summary is not None and not summary.empty:
                    summary.to_excel(writer, sheet_name="Executive Summary", index=False)
                df_full.to_excel(writer, sheet_name="Finance Data", index=False)
                if ward_data is not None and not ward_data.empty:
                    ward_data.to_excel(writer, sheet_name="Ward Summary", index=False)
                if data_quality is not None and not data_quality.empty:
                    data_quality.to_excel(writer, sheet_name="Data Quality", index=False)
                if cpt_metrics:
                    cpt_summary = pd.DataFrame([
                        {"Metric": k, "Value": v} for k, v in cpt_metrics.items()
                    ])
                    cpt_summary.to_excel(writer, sheet_name="CPT KPIs", index=False)
                if cpt_df is not None and not cpt_df.empty:
                    cpt_df.to_excel(writer, sheet_name="CPT Stats", index=False)
                payments_df = load_payments_data(source_paths.get("payments", DEFAULT_DATA_REGISTRY["payments"]))
                if not payments_df.empty and "Medical Aid" in payments_df.columns:
                    ma = payments_df.copy()
                    ma["Medical Aid"] = ma["Medical Aid"].fillna("Unknown")
                    ma_summary = ma.groupby("Medical Aid", as_index=False).agg(
                        Total_Collected=("Amount", "sum"),
                        Transactions=("Amount", "count"),
                        Avg_Amount=("Amount", "mean")
                    ).sort_values("Total_Collected", ascending=False)
                    ma_summary.to_excel(writer, sheet_name="Collections by Aid", index=False)
                if sections:
                    for name, sec_df in sections.items():
                        sheet = name[:31]
                        sec_df.to_excel(writer, sheet_name=sheet, index=False)
            output.seek(0)
            st.download_button(
                label="Download Executive Pack",
                data=output.getvalue(),
                file_name=f"Executive_Pack_{datetime.now().strftime('%Y%m%d')}.xlsx",
                mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            )

    if st.button("Download Ward Summary (Excel)"):
        if ward_data is not None and not ward_data.empty:
            output = BytesIO()
            with pd.ExcelWriter(output, engine="openpyxl") as writer:
                ward_data.to_excel(writer, sheet_name="Ward Summary", index=False)
            output.seek(0)
            st.download_button(
                label="Download Ward Summary",
                data=output.getvalue(),
                file_name=f"Ward_Summary_{datetime.now().strftime('%Y%m%d')}.xlsx",
                mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            )

    if st.button("Download Data Quality Report (Excel)"):
        if data_quality is not None and not data_quality.empty:
            output = BytesIO()
            with pd.ExcelWriter(output, engine="openpyxl") as writer:
                data_quality.to_excel(writer, sheet_name="Data Quality", index=False)
            output.seek(0)
            st.download_button(
                label="Download Data Quality",
                data=output.getvalue(),
                file_name=f"Data_Quality_{datetime.now().strftime('%Y%m%d')}.xlsx",
                mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            )
