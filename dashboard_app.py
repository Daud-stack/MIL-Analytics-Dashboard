# =========================================================
# HOSPITAL INTELLIGENCE - EXECUTIVE DASHBOARD
# =========================================================

import os
import re
import json
import hmac
import logging
import streamlit as st
import pandas as pd
import numpy as np
import plotly.express as px
import plotly.graph_objects as go
from io import BytesIO
from datetime import datetime
import csv

# ── Split modules: the former in-file function library now lives in mil_dashboard/ ──
from mil_dashboard.config import DEFAULT_DATA_REGISTRY, MONTH_ORDER, target_collection
from mil_dashboard.helpers import display_limited_df, sanitize_sheet_name, style_ward_table
from mil_dashboard.metrics import (
    add_duration_metrics,
    add_hospital_breakdown,
    aggregate_admissions_trend,
    apply_global_filters,
    apply_time_window,
    build_cpt_top_tables,
    build_five_second_summary,
    build_staff_metrics,
    build_staff_trend,
    build_summary_metrics,
    compute_compliance_metrics,
    compute_cpt_cost_components,
    compute_cpt_metrics,
    compute_cpt_quality,
    compute_data_quality,
    compute_finance_monthly_trend,
    compute_insurer_deductions,
    compute_live_finance_from_df,
    compute_operational_alerts,
    compute_projections,
    compute_quality_summary,
    compute_risk_indicators,
    find_sections,
    get_ward_analysis,
    lookup_episode_matches,
    safe_sum,
)
from mil_dashboard.ds import compute_alos_readmission, compute_anomaly_tiles, compute_hospital_ds_bundle
from mil_dashboard.loaders import (
    get_data_bundle,
    get_file_age_hours,
    load_admissions_duration,
    load_admissions_per_user,
    load_data_registry,
    load_payments_data,
)
from mil_dashboard.ui import inject_dashboard_theme, render_command_center, render_five_second_summary
from mil_dashboard.universal import render_universal_analytics_tab, upload_new_data_into_app
from mil_dashboard.trimmed_reports import load_all_trimmed_reports, render_trimmed_reports_tab, render_billing_audit_subtab



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
# OPTIONAL ACCESS GATE
# ---------------------------------------------------------
# This dashboard displays patient-identifiable billing data (PHI). Set a
# password via the DASHBOARD_PASSWORD environment variable or in
# .streamlit/secrets.toml to require sign-in. If neither is set, the app
# runs open (as before) but shows a warning in the sidebar.


def _get_dashboard_password():
    pw = os.environ.get("DASHBOARD_PASSWORD")
    if pw:
        return pw
    try:
        return st.secrets.get("DASHBOARD_PASSWORD")
    except Exception:
        return None


_dashboard_pw = _get_dashboard_password()
if _dashboard_pw:
    if not st.session_state.get("_auth_ok"):
        st.title("🔒 Hospital Intelligence Dashboard")
        st.caption("This dashboard contains patient billing data. Please sign in.")
        _entered = st.text_input("Dashboard password", type="password", key="_pw_input")
        if _entered:
            if hmac.compare_digest(_entered, _dashboard_pw):
                st.session_state["_auth_ok"] = True
                st.rerun()
            else:
                st.error("Incorrect password.")
        st.stop()
else:
    st.sidebar.warning(
        "No access password configured - anyone who can reach this app can view "
        "patient data. Set DASHBOARD_PASSWORD to enable sign-in."
    )

# ---------------------------------------------------------
# BUSINESS TARGETS & CONSTANTS
# ---------------------------------------------------------


# ---------------------------------------------------------
# HELPER FUNCTIONS
# ---------------------------------------------------------


# ---------------------------------------------------------
# DATA LOADER FUNCTIONS (WITH CACHING)
# ---------------------------------------------------------


# ---------------------------------------------------------
# TABS
# ---------------------------------------------------------


# ---------------------------------------------------------
# SIDEBAR CONTROLS
# ---------------------------------------------------------

st.sidebar.title("🏥 Intelligence Hub")

# Resolve active data source paths (uploaded overrides or defaults).
# Must be defined before the upload controls and data loading below.
source_paths = load_data_registry()

# Sidebar search removed from UI; keep the variable so the lookup section stays inert.
quick_lookup_query = ""

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
    ["Command Center", "Universal Analytics", "Billing & Tariff Audit", "Trimmed Reports Intelligence", "Executive Summary", "Admissions", "Finance", "Ward Performance", "Clinical / CPT", "Data Science Lab", "Data Quality", "Reports & Export"],
    index=0,
    label_visibility="collapsed"
)

# --- SECTION 3: ANALYSIS FILTERS ---
if active_tab != "Universal Analytics":
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

    # Pre-loading and Calculations (must run BEFORE the filters below,
    # which derive their date/hospital/payer options from the loaded data)
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

    # Filter Application
    df_full, cpt_df, payments_df = apply_global_filters(
        df_full, cpt_df, payments_df,
        start_date=start_date, end_date=end_date,
        hospital=selected_hospital, payer=selected_payer
    )

    # Make the headline KPIs respect the sidebar filters: the loader metrics
    # are computed on the unfiltered master, so recompute from the filtered
    # frame whenever any filter is active.
    filters_active = bool(start_date or end_date) or selected_hospital != "All" or selected_payer != "All"
    if filters_active:
        live_finance = compute_live_finance_from_df(df_full)

    # Compute tab-specific analytics from the FILTERED data. These were
    # previously initialised empty in the bundle and never populated,
    # which left the Ward, Data Quality and CPT views permanently blank.
    if active_tab in ("Executive Summary", "Ward Performance", "Reports & Export"):
        ward_data = get_ward_analysis(df_full)
    if active_tab in ("Executive Summary", "Data Quality", "Reports & Export"):
        data_quality = compute_data_quality(df_full)
    if active_tab in ("Executive Summary", "Clinical / CPT", "Reports & Export") and cpt_df is not None and not cpt_df.empty:
        cpt_metrics = compute_cpt_metrics(cpt_df)
        cpt_quality = compute_cpt_quality(cpt_df)

    # Sidebar Metrics
    st.sidebar.divider()
    st.sidebar.subheader("🚀 Quick Stats")
    qcol1, qcol2 = st.sidebar.columns(2)
    qcol1.metric("Collection", f"{live_finance.get('Collection Rate (%)', 0):.1f}%")
    quality_summary = compute_quality_summary(df_full)
    qcol2.metric("Quality", f"{quality_summary['score']:.0f}")

else:
    st.sidebar.caption("Universal mode active.")
    # Defaults for variables normally produced by the data-load branch above,
    # so shared header code below doesn't hit NameError in Universal mode.
    table_limit = int(st.session_state.get("table_limit", 100))
    last_updated = {"master": "—", "management": "—", "cpt": "—"}


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
    reporting_label = os.path.basename(str(source_paths.get("master", ""))) or "master dataset"
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
# TAB 1.4 - BILLING & TARIFF AUDIT
# =========================================================
if active_tab == "Billing & Tariff Audit":
    trimmed_bundle = load_all_trimmed_reports("Trimed Reports")
    render_billing_audit_subtab(trimmed_bundle)

# =========================================================
# TAB 1.5 - TRIMMED REPORTS INTELLIGENCE
# =========================================================
if active_tab == "Trimmed Reports Intelligence":
    trimmed_bundle = load_all_trimmed_reports("Trimed Reports")
    render_trimmed_reports_tab(trimmed_bundle)

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

        if st.button("Prepare Staff Performance (Excel)"):
            output = BytesIO()
            with pd.ExcelWriter(output, engine="openpyxl") as writer:
                staff_metrics.to_excel(writer, sheet_name="Staff Performance", index=False)
            output.seek(0)
            st.session_state["export_staff_perf"] = output.getvalue()
        if st.session_state.get("export_staff_perf"):
            st.download_button(
                label="Download Staff Performance",
                data=st.session_state["export_staff_perf"],
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
            ward_options = ["All"] + sorted(ward_data["Ward"].dropna().astype(str).unique().tolist())
            selected_ward = st.selectbox("Ward filter", ward_options, index=0)
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
            # style_ward_table returns a pandas Styler — style AFTER limiting rows,
            # and hand the Styler straight to st.dataframe (display_limited_df
            # expects a plain DataFrame and would crash on a Styler).
            if len(ward_data_filtered) > 200:
                st.caption(f"Ward summary — showing first 200 of {len(ward_data_filtered)} rows.")
            st.dataframe(style_ward_table(ward_data_filtered.head(200)), use_container_width=True)

            ward_xlsx = BytesIO()
            with pd.ExcelWriter(ward_xlsx, engine="openpyxl") as writer:
                ward_data_filtered.to_excel(writer, sheet_name="Ward Summary", index=False)
            ward_xlsx.seek(0)
            st.download_button(
                label="Download Filtered Ward Summary (Excel)",
                data=ward_xlsx.getvalue(),
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
        # Reuse the bundle computed for the header/preview - recomputing here
        # doubled the (expensive) model training on every rerun.
        ds = ds_preview_bundle if ds_preview_bundle else compute_hospital_ds_bundle(df_full, cpt_df, payments_df)
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

            if st.button("Prepare Data Science Pack (Excel)"):
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
                st.session_state["export_ds_pack"] = output.getvalue()
            if st.session_state.get("export_ds_pack"):
                st.download_button(
                    label="Download DS Pack",
                    data=st.session_state["export_ds_pack"],
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

    if st.button("Prepare Finance Report (Excel)"):
        if df_full is not None and not df_full.empty:
            output = BytesIO()
            with pd.ExcelWriter(output, engine="openpyxl") as writer:
                df_full.to_excel(writer, sheet_name="Finance Data", index=False)
            output.seek(0)
            st.session_state["export_finance_report"] = output.getvalue()
        else:
            st.info("No data available to export.")
    if st.session_state.get("export_finance_report"):
        st.download_button(
            label="Download Finance Report",
            data=st.session_state["export_finance_report"],
            file_name=f"Hospital_Intelligence_Report_{datetime.now().strftime('%Y%m%d')}.xlsx",
            mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        )

    if st.button("Prepare Executive Pack (Excel)"):
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
                    # Sheet names must be <=31 chars, free of []:*?/\ and unique -
                    # raw section names crashed openpyxl or silently collided.
                    used_sheets = {
                        "Executive Summary", "Finance Data", "Ward Summary",
                        "Data Quality", "CPT KPIs", "CPT Stats", "Collections by Aid"
                    }
                    for name, sec_df in sections.items():
                        sec_df.to_excel(writer, sheet_name=sanitize_sheet_name(name, used_sheets), index=False)
            output.seek(0)
            st.session_state["export_exec_pack"] = output.getvalue()
        else:
            st.info("No data available to export.")
    if st.session_state.get("export_exec_pack"):
        st.download_button(
            label="Download Executive Pack",
            data=st.session_state["export_exec_pack"],
            file_name=f"Executive_Pack_{datetime.now().strftime('%Y%m%d')}.xlsx",
            mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        )

    if st.button("Prepare Ward Summary (Excel)"):
        if ward_data is not None and not ward_data.empty:
            output = BytesIO()
            with pd.ExcelWriter(output, engine="openpyxl") as writer:
                ward_data.to_excel(writer, sheet_name="Ward Summary", index=False)
            output.seek(0)
            st.session_state["export_ward_summary"] = output.getvalue()
        else:
            st.info("Ward data is empty for the current filters.")
    if st.session_state.get("export_ward_summary"):
        st.download_button(
            label="Download Ward Summary",
            data=st.session_state["export_ward_summary"],
            file_name=f"Ward_Summary_{datetime.now().strftime('%Y%m%d')}.xlsx",
            mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        )

    if st.button("Prepare Data Quality Report (Excel)"):
        if data_quality is not None and not data_quality.empty:
            output = BytesIO()
            with pd.ExcelWriter(output, engine="openpyxl") as writer:
                data_quality.to_excel(writer, sheet_name="Data Quality", index=False)
            output.seek(0)
            st.session_state["export_data_quality"] = output.getvalue()
        else:
            st.info("Data quality table is empty for the current filters.")
    if st.session_state.get("export_data_quality"):
        st.download_button(
            label="Download Data Quality",
            data=st.session_state["export_data_quality"],
            file_name=f"Data_Quality_{datetime.now().strftime('%Y%m%d')}.xlsx",
            mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        )
