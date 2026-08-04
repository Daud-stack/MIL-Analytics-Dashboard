"""Streamlit rendering components (theme, command center, summaries)."""

import streamlit as st
import pandas as pd
import numpy as np
import plotly.express as px
import plotly.graph_objects as go
from .helpers import display_limited_df
from .metrics import build_five_second_summary, generate_narrative_actions


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
