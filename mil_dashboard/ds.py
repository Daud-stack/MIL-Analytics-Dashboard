"""Data-science layer: episode features, readmission model, anomaly tiles."""

import streamlit as st
import pandas as pd
import numpy as np
from .metrics import compute_theatre_minutes, get_numeric_series, normalize_master_schema


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


def _safe_pct_rank(series, ascending=True):
    s = pd.to_numeric(series, errors="coerce")
    if s.notna().sum() == 0:
        return pd.Series([0.0] * len(series), index=series.index if hasattr(series, "index") else None)
    return s.rank(pct=True, ascending=ascending).fillna(0) * 100


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

    def _num_col(frame, col, default=0.0):
        # ep.get(col, scalar) returns a bare scalar when the column is missing,
        # and pd.to_numeric(scalar).fillna(...) raises AttributeError - always
        # return an index-aligned Series instead.
        if col in frame.columns:
            return pd.to_numeric(frame[col], errors="coerce")
        return pd.Series(default, index=frame.index, dtype=float)

    ep["los_days"] = _num_col(ep, "cpt_los", np.nan)
    if "Admission Date" in ep.columns and "Discharge Date" in ep.columns:
        los_from_dates = (ep["Discharge Date"] - ep["Admission Date"]).dt.days
        ep["los_days"] = ep["los_days"].fillna(los_from_dates)
    ep["los_days"] = ep["los_days"].clip(lower=0, upper=365)

    ep["episode_cost"] = _num_col(ep, "cpt_total_cost", np.nan).fillna(ep["billed"])
    ep["aging_risk_amount"] = (
        _num_col(ep, "90 Days").fillna(0) +
        _num_col(ep, "120 Days").fillna(0) +
        _num_col(ep, "150+ Days").fillna(0)
    )
    ep["gap_ratio_pct"] = np.where(ep["billed"] > 0, (ep["gap"] / ep["billed"]) * 100, 0)
    ep["theatre_minutes"] = _num_col(ep, "theatre_minutes").fillna(0)

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
    # Drop missing IDs BEFORE casting to str — otherwise NaN becomes the string
    # "nan" and all unidentified patients collapse into one pseudo-patient,
    # corrupting the readmission labels.
    d = d[d["ID Number"].notna()]
    d["ID Number"] = d["ID Number"].astype(str).str.strip()
    d = d[~d["ID Number"].str.lower().isin(["", "nan", "none"])]
    d["Admission Date"] = pd.to_datetime(d["Admission Date"], errors="coerce", dayfirst=True)
    d["Discharge Date"] = pd.to_datetime(d["Discharge Date"], errors="coerce", dayfirst=True)
    d = d[d["Admission Date"].notna() & d["Discharge Date"].notna()]
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


@st.cache_data(ttl=1800, show_spinner="Computing data science bundle...")
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
