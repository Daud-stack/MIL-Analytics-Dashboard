"""
Trimmed Reports, Operational Intelligence & Billing Audit Module.
Optimized for high performance (fast parsing, memory reduction with categoricals, cached charts)
and modern web aesthetics (glassmorphism, vibrant dark mode, risk heatmaps).

Parses and visualizes operational datasets from 'Trimed Reports' directory:
- Billing & Tariff Audit (User Billing Details + Billing Group Tariffs)
- Cancellations & Refunds Analytics
- Discharge Release & Billing Bottlenecks
- Stock & Pharmacy Valuation / Gross Profit
- Operating Theatre Utilization
- Revenue Center Departmental Income
- Medical Aid Insurer Share & Turnover
"""

import os
import logging
import pandas as pd
import numpy as np
import plotly.express as px
import plotly.graph_objects as go
import streamlit as st
from .helpers import display_limited_df

logger = logging.getLogger("dashboard.trimmed_reports")


@st.cache_data(ttl=3600, show_spinner=False)
def load_all_trimmed_reports(folder_path="Trimed Reports"):
    """
    High-performance loader for trimmed reports.
    Applies column pruning, categorical conversions, and optimized numeric downcasting.
    """
    bundle = {}
    if not os.path.exists(folder_path):
        return bundle

    # 1. Billing Group / Tariff Report
    f_tariff = os.path.join(folder_path, "20260804RptBillingGroup (1).csv")
    if os.path.exists(f_tariff):
        try:
            df = pd.read_csv(f_tariff, encoding="latin1", on_bad_lines="skip", low_memory=False)
            df.columns = [str(c).strip() for c in df.columns]
            for col in ["Base Rate Before", "Base Rate After", "Unit Rate Before", "Unit Rate After"]:
                if col in df.columns:
                    df[col] = pd.to_numeric(df[col], errors="coerce", downcast="float").fillna(0)
            if "Base Rate Before" in df.columns and "Base Rate After" in df.columns:
                df["Base Rate Variance"] = df["Base Rate After"] - df["Base Rate Before"]
            if "Unit Rate Before" in df.columns and "Unit Rate After" in df.columns:
                df["Unit Rate Variance"] = df["Unit Rate After"] - df["Unit Rate Before"]
            for col in ["Code", "Description", "Tariff Code"]:
                if col in df.columns:
                    df[col] = df[col].astype("category")
            bundle["tariff_report"] = df
        except Exception as e:
            logger.warning(f"Error loading tariff report: {e}")

    # 2. User Billing Details (135k+ rows) - Full audit columns
    f_user_bill = os.path.join(folder_path, "20260804RptUserBillingDet.csv")
    if os.path.exists(f_user_bill):
        try:
            df = pd.read_csv(
                f_user_bill,
                encoding="latin1",
                on_bad_lines="skip",
                low_memory=False,
                usecols=[
                    "User", "Episode Number", "Item", "Description", "Transaction Type",
                    "Cancelled", "Financial Class", "Admission Class", "Capture Date",
                    "Transaction Date", "Diagnosis", "Billed Location", "Billed Amount", "Average Cost"
                ]
            )
            df.columns = [str(c).strip() for c in df.columns]
            for col in ["Billed Amount", "Average Cost"]:
                if col in df.columns:
                    df[col] = pd.to_numeric(df[col], errors="coerce", downcast="float").fillna(0)
            if "Billed Amount" in df.columns and "Average Cost" in df.columns:
                df["Margin"] = df["Billed Amount"] - df["Average Cost"]
            for col in ["User", "Transaction Type", "Cancelled", "Financial Class", "Admission Class", "Billed Location"]:
                if col in df.columns:
                    df[col] = df[col].astype("category")
            bundle["user_billing"] = df
        except Exception as e:
            logger.warning(f"Error loading user billing details: {e}")

    # 3. Cancellations (155k+ rows)
    f_cancel = os.path.join(folder_path, "20260714RptCancelAll.csv")
    if os.path.exists(f_cancel):
        try:
            df = pd.read_csv(
                f_cancel,
                encoding="utf-8",
                on_bad_lines="skip",
                low_memory=False,
                usecols=[
                    "Location", "Episode Number", "Cancellation Date", "Cancellation Amount",
                    "Cancellation Capturer", "Cancellation Reason", "Original Amount",
                    "Original Capture Date", "Transaction Type"
                ]
            )
            df.columns = [str(c).strip() for c in df.columns]
            for col in ["Cancellation Amount", "Original Amount"]:
                if col in df.columns:
                    df[col] = pd.to_numeric(df[col], errors="coerce", downcast="float").fillna(0)
            for col in ["Location", "Cancellation Reason", "Cancellation Capturer", "Transaction Type"]:
                if col in df.columns:
                    df[col] = df[col].astype("category")
            for col in ["Cancellation Date", "Original Capture Date"]:
                if col in df.columns:
                    df[col] = pd.to_datetime(df[col], errors="coerce", dayfirst=True)
            bundle["cancellations"] = df
        except Exception as e:
            logger.warning(f"Error loading cancellations: {e}")

    # 4. Discharge Release Bottlenecks
    f_release = os.path.join(folder_path, "20260714RptRelease.csv")
    if os.path.exists(f_release):
        try:
            df = pd.read_csv(f_release, encoding="latin1", on_bad_lines="skip", low_memory=False)
            df.columns = [str(c).strip() for c in df.columns]
            for col in ["Days Post Discharge", "Outstanding Amount"]:
                if col in df.columns:
                    df[col] = pd.to_numeric(df[col], errors="coerce", downcast="float").fillna(0)
            for col in ["Not Released Reason", "Medical Aid", "Discharge Location"]:
                if col in df.columns:
                    df[col] = df[col].astype("category")
            for col in ["Admission Date", "Discharge Date", "Finalized Date", "Statement Date"]:
                if col in df.columns:
                    df[col] = pd.to_datetime(df[col], errors="coerce", dayfirst=True)
            bundle["release"] = df
        except Exception as e:
            logger.warning(f"Error loading release: {e}")

    # 5. Discharged Patients
    f_dispat = os.path.join(folder_path, "20260714RptDisPat.csv")
    if os.path.exists(f_dispat):
        try:
            df = pd.read_csv(f_dispat, encoding="latin1", on_bad_lines="skip", low_memory=False)
            df.columns = [str(c).strip() for c in df.columns]
            for col in ["Hospital", "Ward", "Discharge Type"]:
                if col in df.columns:
                    df[col] = df[col].astype("category")
            if "Discharge Date" in df.columns:
                df["Discharge Date"] = pd.to_datetime(df["Discharge Date"], errors="coerce", dayfirst=True)
            bundle["discharged_patients"] = df
        except Exception as e:
            logger.warning(f"Error loading discharged patients: {e}")

    # 6. Stock Valuation & Inventory GP
    f_stock = os.path.join(folder_path, "20260715RptStockValMonthHis.csv")
    if os.path.exists(f_stock):
        try:
            df = pd.read_csv(f_stock, encoding="utf-8", on_bad_lines="skip", low_memory=False)
            df.columns = [str(c).strip() for c in df.columns]
            for col in ["Quantity", "Av Cost PU", "Total Value", "Retail Less Vat", "GP"]:
                if col in df.columns:
                    df[col] = pd.to_numeric(df[col], errors="coerce", downcast="float").fillna(0)
            for col in ["Location", "Transaction Type"]:
                if col in df.columns:
                    df[col] = df[col].astype("category")
            bundle["stock"] = df
        except Exception as e:
            logger.warning(f"Error loading stock valuation: {e}")

    # 7. Operating Theatre Usage
    f_theatre = os.path.join(folder_path, "20260714RptMtheUse_AvenuesClinic.csv")
    if os.path.exists(f_theatre):
        try:
            df = pd.read_csv(f_theatre, encoding="utf-8", on_bad_lines="skip", low_memory=False)
            df.columns = [str(c).strip() for c in df.columns]
            for col in ["Male(s)", "Female(s)", "Other", "Children Under 13", "Total Num Ops", "Total Time"]:
                if col in df.columns:
                    df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0)
            bundle["theatre"] = df
        except Exception as e:
            logger.warning(f"Error loading theatre usage: {e}")

    # 8. Revenue Centers Income
    f_rev = os.path.join(folder_path, "20260714RptMonIncRevCen_AvenuesClinic.csv")
    if os.path.exists(f_rev):
        try:
            df = pd.read_csv(f_rev, encoding="utf-8", on_bad_lines="skip", low_memory=False)
            df.columns = [str(c).strip() for c in df.columns]
            for col in ["Income", "Vat", "Total Income"]:
                if col in df.columns:
                    df[col] = pd.to_numeric(df[col], errors="coerce", downcast="float").fillna(0)
            bundle["revenue_centers"] = df
        except Exception as e:
            logger.warning(f"Error loading revenue centers: {e}")

    # 9. Medical Aid Income
    f_med = os.path.join(folder_path, "20260718rptMedIncome_AvenuesClinic.csv")
    if os.path.exists(f_med):
        try:
            df = pd.read_csv(f_med, encoding="utf-8", on_bad_lines="skip", low_memory=False)
            df.columns = [str(c).strip() for c in df.columns]
            for col in ["Turnover", "VAT", "Percentage", "Total Patients"]:
                if col in df.columns:
                    df[col] = pd.to_numeric(df[col], errors="coerce", downcast="float").fillna(0)
            bundle["medical_aid_income"] = df
        except Exception as e:
            logger.warning(f"Error loading medical aid income: {e}")

    return bundle


def _apply_dark_theme_layout(fig, title_text="", height=380):
    """Utility to enforce consistent Dark Slate & Glassmorphic Plotly Theme."""
    fig.update_layout(
        title=dict(text=title_text, font=dict(family="Outfit", size=18, color="#F8FAFC")),
        paper_bgcolor="rgba(0,0,0,0)",
        plot_bgcolor="rgba(15,23,42,0.6)",
        font=dict(family="Inter", color="#CBD5E1"),
        height=height,
        margin=dict(l=20, r=20, t=45, b=20),
        xaxis=dict(showgrid=True, gridcolor="rgba(255,255,255,0.06)", tickfont=dict(color="#94A3B8")),
        yaxis=dict(showgrid=True, gridcolor="rgba(255,255,255,0.06)", tickfont=dict(color="#94A3B8"))
    )
    return fig


def render_billing_audit_subtab(bundle):
    """Render the Billing Audit & Tariff Intelligence view."""
    st.subheader("💳 Billing Audit & Tariff Intelligence")
    df_ub = bundle.get("user_billing")
    df_tf = bundle.get("tariff_report")

    if df_ub is None or df_ub.empty:
        st.info("User billing dataset is not available.")
        return

    # Financial & Event KPIs
    tot_events = len(df_ub)
    tot_billed = df_ub["Billed Amount"].sum() if "Billed Amount" in df_ub.columns else 0
    tot_cost = df_ub["Average Cost"].sum() if "Average Cost" in df_ub.columns else 0
    tot_margin = tot_billed - tot_cost
    margin_pct = (tot_margin / tot_billed * 100) if tot_billed > 0 else 0
    zero_billed_cnt = (df_ub["Billed Amount"] == 0).sum() if "Billed Amount" in df_ub.columns else 0
    users_cnt = df_ub["User"].nunique() if "User" in df_ub.columns else 0

    k1, k2, k3, k4, k5 = st.columns(5)
    k1.metric("Total Billed Revenue", f"${tot_billed:,.2f}")
    k2.metric("Total Item Cost", f"${tot_cost:,.2f}")
    k3.metric("Gross Margin", f"${tot_margin:,.2f}", f"{margin_pct:.1f}%")
    k4.metric("Zero-Billed Items", f"{zero_billed_cnt:,}")
    k5.metric("Active Capturers", f"{users_cnt:,}")

    st.markdown("---")

    audit_tab1, audit_tab2, audit_tab3 = st.tabs([
        "👨‍💻 Capturer & Location Audit",
        "🏷️ Tariff Master & Rate Variances",
        "📄 Raw Billing Audit Log"
    ])

    with audit_tab1:
        c_left, c_right = st.columns(2)
        with c_left:
            if "User" in df_ub.columns and "Billed Amount" in df_ub.columns:
                user_rev = df_ub.groupby("User", observed=True).agg(
                    Billed=("Billed Amount", "sum"),
                    Cost=("Average Cost", "sum"),
                    Events=("Episode Number", "count")
                ).reset_index().sort_values("Billed", ascending=False).head(12)

                fig_urev = px.bar(
                    user_rev,
                    x="Billed",
                    y="User",
                    orientation="h",
                    color="Billed",
                    color_continuous_scale="Viridis",
                    hover_data=["Cost", "Events"]
                )
                fig_urev.update_layout(yaxis={'categoryorder':'total ascending'})
                _apply_dark_theme_layout(fig_urev, title_text="Top Capturers by Total Billed Revenue ($)", height=400)
                st.plotly_chart(fig_urev, use_container_width=True)

        with c_right:
            if "Billed Location" in df_ub.columns and "Billed Amount" in df_ub.columns:
                loc_rev = df_ub.groupby("Billed Location", observed=True).agg(
                    Billed=("Billed Amount", "sum"),
                    Cost=("Average Cost", "sum"),
                    Events=("Episode Number", "count")
                ).reset_index().sort_values("Billed", ascending=False).head(12)

                fig_lrev = px.bar(
                    loc_rev,
                    x="Billed Location",
                    y="Billed",
                    color="Cost",
                    color_continuous_scale="Purples",
                    hover_data=["Events"]
                )
                _apply_dark_theme_layout(fig_lrev, title_text="Top Billed Locations / Wards Revenue ($)", height=400)
                st.plotly_chart(fig_lrev, use_container_width=True)

        st.subheader("Financial & Admission Class Breakdown")
        fc_col1, fc_col2 = st.columns(2)
        with fc_col1:
            if "Financial Class" in df_ub.columns:
                fc_df = df_ub.groupby("Financial Class", observed=True).agg(
                    Revenue=("Billed Amount", "sum"),
                    Transactions=("Episode Number", "count")
                ).reset_index()
                fig_fc = px.pie(
                    fc_df,
                    values="Revenue",
                    names="Financial Class",
                    hole=0.45,
                    color_discrete_sequence=px.colors.qualitative.Dark24
                )
                _apply_dark_theme_layout(fig_fc, title_text="Revenue Distribution by Financial Class", height=350)
                st.plotly_chart(fig_fc, use_container_width=True)

        with fc_col2:
            if "Admission Class" in df_ub.columns:
                ac_df = df_ub.groupby("Admission Class", observed=True).agg(
                    Revenue=("Billed Amount", "sum"),
                    Transactions=("Episode Number", "count")
                ).reset_index()
                fig_ac = px.bar(
                    ac_df,
                    x="Admission Class",
                    y="Revenue",
                    color="Transactions",
                    color_continuous_scale="Blues"
                )
                _apply_dark_theme_layout(fig_ac, title_text="Revenue by Admission Class (Inpatient/Outpatient/Casualty)", height=350)
                st.plotly_chart(fig_ac, use_container_width=True)

    with audit_tab2:
        st.subheader("🏷️ Tariff Master Catalog & Base Rate Variances")
        if df_tf is not None and not df_tf.empty:
            t_cnt = len(df_tf)
            t_groups = df_tf["Code"].nunique() if "Code" in df_tf.columns else 0
            base_before_sum = df_tf["Base Rate Before"].sum() if "Base Rate Before" in df_tf.columns else 0
            base_after_sum = df_tf["Base Rate After"].sum() if "Base Rate After" in df_tf.columns else 0
            rate_delta = base_after_sum - base_before_sum

            t1, t2, t3, t4 = st.columns(4)
            t1.metric("Total Tariff Lines", f"{t_cnt:,}")
            t2.metric("Billing Groups", f"{t_groups}")
            t3.metric("Base Rate sum (Before)", f"${base_before_sum:,.2f}")
            t4.metric("Base Rate sum (After)", f"${base_after_sum:,.2f}", f"${rate_delta:+,.2f}")

            st.markdown("---")

            col_t1, col_t2 = st.columns(2)
            with col_t1:
                if "Code" in df_tf.columns and "Base Rate After" in df_tf.columns:
                    grp_summary = df_tf.groupby("Code", observed=True).agg(
                        Tariffs=("Tariff Code", "count"),
                        Base_Rate_Sum=("Base Rate After", "sum")
                    ).reset_index().sort_values("Base_Rate_Sum", ascending=False)

                    fig_grp = px.bar(
                        grp_summary,
                        x="Code",
                        y="Base_Rate_Sum",
                        color="Tariffs",
                        color_continuous_scale="Teal"
                    )
                    _apply_dark_theme_layout(fig_grp, title_text="Tariff Base Rate Sum by Billing Group Code", height=380)
                    st.plotly_chart(fig_grp, use_container_width=True)

            with col_t2:
                if "Base Rate Variance" in df_tf.columns and "Tariff Description" in df_tf.columns:
                    top_variances = df_tf.sort_values("Base Rate Variance", ascending=False).head(10)
                    fig_var = px.bar(
                        top_variances,
                        x="Base Rate Variance",
                        y="Tariff Description",
                        orientation="h",
                        color="Base Rate Variance",
                        color_continuous_scale="Greens"
                    )
                    fig_var.update_layout(yaxis={'categoryorder':'total ascending'})
                    _apply_dark_theme_layout(fig_var, title_text="Top Tariff Rate Adjustments / Increases ($)", height=380)
                    st.plotly_chart(fig_var, use_container_width=True)

            with st.expander("📄 View Full Tariff Master Table"):
                display_limited_df(df_tf, default_limit=100)
        else:
            st.info("Tariff report dataset is not available.")

    with audit_tab3:
        st.subheader("📄 Raw User Billing Transactions Audit")
        display_limited_df(df_ub, default_limit=100)


def render_trimmed_reports_tab(bundle):
    """Main render function for the Operational Intelligence & Trimmed Reports module."""
    st.markdown("""
        <div class="kpi-band">
            <h3>⚡ Operational Intelligence & Billing Audit Hub</h3>
            <p>High-performance analytics powered by operational report snapshots and tariff master catalogs. Optimized for instantaneous execution, revenue assurance, and interactive decision support.</p>
        </div>
    """, unsafe_allow_html=True)

    if not bundle:
        st.warning("No trimmed report files found in the 'Trimed Reports' directory.")
        return

    subtabs = st.tabs([
        "💳 Billing & Tariff Audit",
        "🛑 Cancellations & Risk",
        "⏱️ Release Bottlenecks",
        "📦 Inventory & Stock GP",
        "🩺 Operating Theatre",
        "🏢 Revenue Centers",
        "💳 Medical Aid Share"
    ])

    # ----------------------------------------------------
    # SUBTAB 1: BILLING & TARIFF AUDIT
    # ----------------------------------------------------
    with subtabs[0]:
        render_billing_audit_subtab(bundle)

    # ----------------------------------------------------
    # SUBTAB 2: CANCELLATIONS & RISK HEATMAP
    # ----------------------------------------------------
    with subtabs[1]:
        st.subheader("🛑 Cancellations & Financial Risk Heatmap")
        df_cancel = bundle.get("cancellations")
        if df_cancel is not None and not df_cancel.empty:
            tot_count = len(df_cancel)
            tot_cancel_amt = df_cancel["Cancellation Amount"].sum() if "Cancellation Amount" in df_cancel.columns else 0
            tot_orig_amt = df_cancel["Original Amount"].sum() if "Original Amount" in df_cancel.columns else 0
            loss_pct = (tot_cancel_amt / tot_orig_amt * 100) if tot_orig_amt > 0 else 0

            c1, c2, c3, c4 = st.columns(4)
            c1.metric("Cancellation Items", f"{tot_count:,}")
            c2.metric("Total Cancelled Amount", f"${tot_cancel_amt:,.2f}")
            c3.metric("Original Billed Amount", f"${tot_orig_amt:,.2f}")
            c4.metric("Cancellation Loss Ratio", f"{loss_pct:.1f}%")

            st.markdown("---")

            col_left, col_right = st.columns(2)
            with col_left:
                if "Cancellation Reason" in df_cancel.columns:
                    reasons = df_cancel.groupby("Cancellation Reason", observed=True).agg(
                        Count=("Episode Number", "count"),
                        Amount=("Cancellation Amount", "sum")
                    ).reset_index().sort_values("Amount", ascending=False).head(10)

                    fig_reasons = px.bar(
                        reasons,
                        x="Amount",
                        y="Cancellation Reason",
                        orientation="h",
                        color="Amount",
                        color_continuous_scale="Reds"
                    )
                    fig_reasons.update_layout(yaxis={'categoryorder':'total ascending'})
                    _apply_dark_theme_layout(fig_reasons, title_text="Top Cancellation Reasons by Financial Impact ($)", height=380)
                    st.plotly_chart(fig_reasons, use_container_width=True)

            with col_right:
                if "Cancellation Capturer" in df_cancel.columns:
                    capturers = df_cancel.groupby("Cancellation Capturer", observed=True).agg(
                        Count=("Episode Number", "count"),
                        Amount=("Cancellation Amount", "sum")
                    ).reset_index().sort_values("Amount", ascending=False).head(10)

                    fig_cap = px.bar(
                        capturers,
                        x="Cancellation Capturer",
                        y="Amount",
                        color="Count",
                        color_continuous_scale="Oranges"
                    )
                    _apply_dark_theme_layout(fig_cap, title_text="Top Capturers by Cancellation Value ($)", height=380)
                    st.plotly_chart(fig_cap, use_container_width=True)

            if "Location" in df_cancel.columns and "Cancellation Amount" in df_cancel.columns:
                st.subheader("🔥 Operational Risk Heatmap: Location Breakdown")
                loc_df = df_cancel.groupby("Location", observed=True).agg(
                    Items=("Episode Number", "count"),
                    Cancelled_Amount=("Cancellation Amount", "sum"),
                    Original_Amount=("Original Amount", "sum")
                ).reset_index().sort_values("Cancelled_Amount", ascending=False)
                
                fig_loc = px.pie(
                    loc_df.head(8),
                    values="Cancelled_Amount",
                    names="Location",
                    color_discrete_sequence=px.colors.sequential.RdBu,
                    hole=0.45
                )
                _apply_dark_theme_layout(fig_loc, title_text="Cancellation Share by Hospital Location / Ward", height=380)
                st.plotly_chart(fig_loc, use_container_width=True)

            with st.expander("📄 View Cancellation Transactions Table"):
                display_limited_df(df_cancel, default_limit=100)
        else:
            st.info("Cancellations dataset is not available.")

    # ----------------------------------------------------
    # SUBTAB 3: DISCHARGE & RELEASE BOTTLENECKS
    # ----------------------------------------------------
    with subtabs[2]:
        st.subheader("⏱️ Discharge & Final Billing Release Bottlenecks")
        df_release = bundle.get("release")
        if df_release is not None and not df_release.empty:
            avg_days = df_release["Days Post Discharge"].mean() if "Days Post Discharge" in df_release.columns else 0
            max_days = df_release["Days Post Discharge"].max() if "Days Post Discharge" in df_release.columns else 0
            tot_unreleased = len(df_release)
            tot_out_amt = df_release["Outstanding Amount"].sum() if "Outstanding Amount" in df_release.columns else 0

            m1, m2, m3, m4 = st.columns(4)
            m1.metric("Unreleased Episodes", f"{tot_unreleased:,}")
            m2.metric("Avg Days Post Discharge", f"{avg_days:.1f} days")
            m3.metric("Max Delay", f"{int(max_days)} days")
            m4.metric("Outstanding Delay Revenue", f"${tot_out_amt:,.2f}")

            st.markdown("---")

            col1, col2 = st.columns(2)
            with col1:
                if "Not Released Reason" in df_release.columns:
                    reasons = df_release.groupby("Not Released Reason", observed=True).agg(
                        Episodes=("Episode Number", "count"),
                        Outstanding=("Outstanding Amount", "sum")
                    ).reset_index().sort_values("Episodes", ascending=False)

                    fig_rel_reasons = px.bar(
                        reasons.head(10),
                        x="Episodes",
                        y="Not Released Reason",
                        orientation="h",
                        color="Outstanding",
                        color_continuous_scale="Purples"
                    )
                    fig_rel_reasons.update_layout(yaxis={'categoryorder':'total ascending'})
                    _apply_dark_theme_layout(fig_rel_reasons, title_text="Top Bottleneck Reasons Preventing Final Release", height=380)
                    st.plotly_chart(fig_rel_reasons, use_container_width=True)

            with col2:
                if "Days Post Discharge" in df_release.columns:
                    bins = [-1, 0, 3, 7, 14, 30, 999]
                    labels = ["0 Days", "1-3 Days", "4-7 Days", "8-14 Days", "15-30 Days", "30+ Days"]
                    df_release["Delay_Bucket"] = pd.cut(df_release["Days Post Discharge"], bins=bins, labels=labels)
                    delay_counts = df_release["Delay_Bucket"].value_counts().reset_index()
                    delay_counts.columns = ["Bucket", "Count"]
                    delay_counts = delay_counts.sort_values("Bucket")

                    fig_bins = px.bar(
                        delay_counts,
                        x="Bucket",
                        y="Count",
                        color="Count",
                        color_continuous_scale="Teal"
                    )
                    _apply_dark_theme_layout(fig_bins, title_text="Discharge Delay Bucket Distribution", height=380)
                    st.plotly_chart(fig_bins, use_container_width=True)

            with st.expander("📄 View Discharge Release Log"):
                display_limited_df(df_release, default_limit=100)
        else:
            st.info("Discharge release dataset is not available.")

    # ----------------------------------------------------
    # SUBTAB 4: STOCK & PHARMACY GP
    # ----------------------------------------------------
    with subtabs[3]:
        st.subheader("📦 Stock Valuation, Inventory & Gross Profit (GP)")
        df_stock = bundle.get("stock")
        if df_stock is not None and not df_stock.empty:
            tot_value = df_stock["Total Value"].sum() if "Total Value" in df_stock.columns else 0
            tot_retail = df_stock["Retail Less Vat"].sum() if "Retail Less Vat" in df_stock.columns else 0
            avg_gp = df_stock["GP"].mean() if "GP" in df_stock.columns else 0
            items_cnt = len(df_stock)

            s1, s2, s3, s4 = st.columns(4)
            s1.metric("Total Stock Items", f"{items_cnt:,}")
            s2.metric("Total Inventory Value (Cost)", f"${tot_value:,.2f}")
            s3.metric("Retail Value (Excl VAT)", f"${tot_retail:,.2f}")
            s4.metric("Average Margin / GP %", f"{avg_gp:.1f}%")

            st.markdown("---")

            sc1, sc2 = st.columns(2)
            with sc1:
                if "Location" in df_stock.columns and "Total Value" in df_stock.columns:
                    loc_val = df_stock.groupby("Location", observed=True).agg(
                        Total_Value=("Total Value", "sum"),
                        Avg_GP=("GP", "mean")
                    ).reset_index().sort_values("Total_Value", ascending=False)

                    fig_stock_loc = px.bar(
                        loc_val.head(10),
                        x="Location",
                        y="Total_Value",
                        color="Avg_GP",
                        color_continuous_scale="Greens"
                    )
                    _apply_dark_theme_layout(fig_stock_loc, title_text="Inventory Valuation by Store / Ward Location ($)", height=380)
                    st.plotly_chart(fig_stock_loc, use_container_width=True)

            with sc2:
                if "Description" in df_stock.columns and "Total Value" in df_stock.columns:
                    top_items = df_stock.sort_values("Total Value", ascending=False).head(10)
                    fig_items = px.bar(
                        top_items,
                        x="Total Value",
                        y="Description",
                        orientation="h",
                        color="GP",
                        color_continuous_scale="Viridis"
                    )
                    fig_items.update_layout(yaxis={'categoryorder':'total ascending'})
                    _apply_dark_theme_layout(fig_items, title_text="Top 10 Inventory Holdings by Total Cost ($)", height=380)
                    st.plotly_chart(fig_items, use_container_width=True)

            with st.expander("📄 View Stock Valuation Details"):
                display_limited_df(df_stock, default_limit=100)
        else:
            st.info("Stock valuation dataset is not available.")

    # ----------------------------------------------------
    # SUBTAB 5: OPERATING THEATRE EFFICIENCY
    # ----------------------------------------------------
    with subtabs[4]:
        st.subheader("🩺 Operating Theatre Utilization & Surgical Capacity")
        df_th = bundle.get("theatre")
        if df_th is not None and not df_th.empty:
            tot_ops = df_th["Total Num Ops"].sum() if "Total Num Ops" in df_th.columns else 0
            tot_hrs = df_th["Total Time"].sum() if "Total Time" in df_th.columns else 0
            males = df_th["Male(s)"].sum() if "Male(s)" in df_th.columns else 0
            females = df_th["Female(s)"].sum() if "Female(s)" in df_th.columns else 0
            kids = df_th["Children Under 13"].sum() if "Children Under 13" in df_th.columns else 0

            t1, t2, t3, t4 = st.columns(4)
            t1.metric("Total Operations", f"{int(tot_ops):,}")
            t2.metric("Total Theatre Hours", f"{tot_hrs:,.1f} hrs")
            t3.metric("Avg Duration / Op", f"{(tot_hrs / tot_ops * 60):.0f} mins" if tot_ops > 0 else "0 mins")
            t4.metric("Paediatric Ops (<13 yrs)", f"{int(kids):,}")

            st.markdown("---")

            tc1, tc2 = st.columns(2)
            with tc1:
                if "Time Period" in df_th.columns and "Total Num Ops" in df_th.columns:
                    fig_th_trend = px.line(
                        df_th,
                        x="Time Period",
                        y="Total Num Ops",
                        markers=True,
                        line_shape="spline"
                    )
                    _apply_dark_theme_layout(fig_th_trend, title_text="Monthly Theatre Operations Volume Trend", height=360)
                    st.plotly_chart(fig_th_trend, use_container_width=True)

            with tc2:
                demo_data = pd.DataFrame({
                    "Category": ["Male", "Female", "Children <13"],
                    "Count": [males, females, kids]
                })
                fig_demo = px.pie(
                    demo_data,
                    values="Count",
                    names="Category",
                    hole=0.45,
                    color_discrete_sequence=["#38BDF8", "#A855F7", "#F97316"]
                )
                _apply_dark_theme_layout(fig_demo, title_text="Surgical Patient Demographics Mix", height=360)
                st.plotly_chart(fig_demo, use_container_width=True)

            with st.expander("📄 View Monthly Theatre Usage Raw Data"):
                display_limited_df(df_th, default_limit=50)
        else:
            st.info("Theatre usage dataset is not available.")

    # ----------------------------------------------------
    # SUBTAB 6: REVENUE CENTERS & DEPTS
    # ----------------------------------------------------
    with subtabs[5]:
        st.subheader("🏢 Revenue Centers Departmental Income")
        df_rev = bundle.get("revenue_centers")
        if df_rev is not None and not df_rev.empty:
            tot_inc = df_rev["Income"].sum() if "Income" in df_rev.columns else 0
            tot_vat = df_rev["Vat"].sum() if "Vat" in df_rev.columns else 0
            tot_rev_centers = len(df_rev)

            r1, r2, r3 = st.columns(3)
            r1.metric("Active Revenue Centers", f"{tot_rev_centers}")
            r2.metric("Total Departmental Income", f"${tot_inc:,.2f}")
            r3.metric("Total VAT Collected", f"${tot_vat:,.2f}")

            st.markdown("---")

            if "Description" in df_rev.columns and "Income" in df_rev.columns:
                top_rev = df_rev.sort_values("Income", ascending=False).head(15)
                fig_rev = px.bar(
                    top_rev,
                    x="Income",
                    y="Description",
                    orientation="h",
                    color="Income",
                    color_continuous_scale="Blues"
                )
                fig_rev.update_layout(yaxis={'categoryorder':'total ascending'})
                _apply_dark_theme_layout(fig_rev, title_text="Top 15 Revenue Centers by Net Income ($)", height=450)
                st.plotly_chart(fig_rev, use_container_width=True)

            with st.expander("📄 View Full Revenue Centers Table"):
                display_limited_df(df_rev, default_limit=100)
        else:
            st.info("Revenue centers dataset is not available.")

    # ----------------------------------------------------
    # SUBTAB 7: MEDICAL AID PAYER SHARE
    # ----------------------------------------------------
    with subtabs[6]:
        st.subheader("💳 Medical Aid Payer Turnover & Patient Volume")
        df_med = bundle.get("medical_aid_income")
        if df_med is not None and not df_med.empty:
            tot_med_turn = df_med["Turnover"].sum() if "Turnover" in df_med.columns else 0
            tot_med_patients = df_med["Total Patients"].sum() if "Total Patients" in df_med.columns else 0
            avg_per_pat = (tot_med_turn / tot_med_patients) if tot_med_patients > 0 else 0

            p1, p2, p3 = st.columns(3)
            p1.metric("Total Medical Aid Turnover", f"${tot_med_turn:,.2f}")
            p2.metric("Total Insured Patients", f"{int(tot_med_patients):,}")
            p3.metric("Avg Turnover per Insured Patient", f"${avg_per_pat:,.2f}")

            st.markdown("---")

            p_col1, p_col2 = st.columns(2)
            with p_col1:
                if "Medical Aid" in df_med.columns and "Turnover" in df_med.columns:
                    top_payers = df_med.sort_values("Turnover", ascending=False).head(10)
                    fig_payers = px.pie(
                        top_payers,
                        values="Turnover",
                        names="Medical Aid",
                        hole=0.45
                    )
                    _apply_dark_theme_layout(fig_payers, title_text="Top Medical Aid Insurers by Revenue Share ($)", height=400)
                    st.plotly_chart(fig_payers, use_container_width=True)

            with p_col2:
                if "Medical Aid" in df_med.columns and "Total Patients" in df_med.columns:
                    top_pat_payers = df_med.sort_values("Total Patients", ascending=False).head(10)
                    fig_pat_payers = px.bar(
                        top_pat_payers,
                        x="Medical Aid",
                        y="Total Patients",
                        color="Total Patients",
                        color_continuous_scale="Purples"
                    )
                    _apply_dark_theme_layout(fig_pat_payers, title_text="Top Medical Aid Insurers by Patient Volume", height=400)
                    st.plotly_chart(fig_pat_payers, use_container_width=True)

            with st.expander("📄 View Medical Aid Income Detailed Breakdown"):
                display_limited_df(df_med, default_limit=100)
        else:
            st.info("Medical aid income dataset is not available.")
