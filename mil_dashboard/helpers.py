"""Small presentation helpers shared across tabs."""

import re
import streamlit as st


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


def sanitize_sheet_name(name, used=None):
    """Excel sheet names: max 31 chars, no []:*?/\\ characters, unique per book."""
    clean = re.sub(r"[\[\]:*?/\\]", "-", str(name)).strip() or "Sheet"
    clean = clean[:31]
    if used is not None:
        base = clean
        i = 2
        while clean in used:
            suffix = f"~{i}"
            clean = base[:31 - len(suffix)] + suffix
            i += 1
        used.add(clean)
    return clean
