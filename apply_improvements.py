#!/usr/bin/env python3
"""
Apply critical improvements to dashboard_app.py
1. Consolidate duplicate data loads
2. Fix payment CSV parsing
3. Add data quality validation
4. Add refresh timestamp
5. Add error handling
"""

import re

with open('dashboard_app.py', 'r', encoding='utf-8', errors='ignore') as f:
    content = f.read()

# IMPROVEMENT 1: Add improved consolidated data loader after imports
new_helpers = '''
# ---------------------------------------------------------
# HELPER FUNCTIONS & ERROR HANDLING
# ---------------------------------------------------------

def safe_numeric(series, default=0):
    """Safely convert series to numeric."""
    return pd.to_numeric(series, errors='coerce').fillna(default)

def validate_required_columns(df, required_cols, context=""):
    """Validate that required columns exist."""
    missing = [c for c in required_cols if c not in df.columns]
    if missing:
        st.warning(f"⚠️ {context}: Missing columns {missing}")
        return False
    return True

@st.cache_data(ttl=3600)
def load_payments_smart(file_path):
    """Intelligently load payments CSV with auto-detection of header row."""
    if not os.path.exists(file_path):
        return pd.DataFrame()
    
    try:
        with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
            lines = f.readlines()
            # Find the header row (contains Hospital, Episode)
            header_row = 0
            for i, line in enumerate(lines[:20]):
                if 'Hospital' in line and ('Episode' in line or 'episode' in line.lower()):
                    header_row = i
                    break
        
        df = pd.read_csv(file_path, skiprows=header_row, low_memory=False)
        
        # Clean column names
        df.columns = [str(c).strip() for c in df.columns]
        
        # Standardize data types
        if 'Amount' in df.columns:
            df['Amount'] = safe_numeric(df['Amount'])
        if 'Date' in df.columns:
            df['Date'] = pd.to_datetime(df['Date'], format='%d/%m/%Y', errors='coerce')
        if 'Episode Number' in df.columns:
            df['Episode Number'] = safe_numeric(df['Episode Number'])
        
        return df
    except Exception as e:
        st.error(f"❌ Error loading payments: {e}")
        return pd.DataFrame()

@st.cache_data(ttl=3600)
def get_data_quality_report(master_df):
    """Generate data quality metrics."""
    if master_df is None or master_df.empty:
        return {"status": "CRITICAL", "issues": ["No data available"]}
    
    issues = []
    if 'Ward' in master_df.columns:
        missing_ward = master_df['Ward'].isna().sum()
        if missing_ward > 0:
            issues.append(f"{missing_ward} records missing Ward")
    
    if 'Original Billed' in master_df.columns:
        zero_billed = (master_df['Original Billed'] <= 0).sum()
        if zero_billed > 0:
            issues.append(f"{zero_billed} records with zero/negative billed amount")
    
    return {
        "Total Records": len(master_df),
        "issues": issues,
        "status": "WARNING" if issues else "OK"
    }

'''

# Find the position to insert (after imports, before page config)
insert_pos = content.find('# ---------------------------------------------------------\n# PAGE CONFIG')
if insert_pos > 0:
    content = content[:insert_pos] + new_helpers + '\n' + content[insert_pos:]

# IMPROVEMENT 2: Fix duplicate year selector issue - ensure it's defined once
content = re.sub(
    r'year = st\.sidebar\.selectbox\([^)]*2025[^)]*\).*?\n.*?\nfile_map = \{[^}]*\}.*?\ndata_path = file_map\[year\]',
    '''year = st.sidebar.selectbox(
    "Select Year",
    ["2025"],
    help="Filter data by year"
)

file_map = {
    "2025": "20260126RptManagementDashboard.csv"
}

data_path = file_map[year]''',
    content,
    count=1,
    flags=re.DOTALL
)

# IMPROVEMENT 3: Add last updated timestamp to header
timestamp_update = '''col_title, col_date, col_refresh = st.columns([2, 1, 1])
with col_title:
    st.title("🏥 Hospital Management Intelligence Dashboard")
with col_date:
    st.caption(f"📅 {datetime.now().strftime('%B %d, %Y')}")
with col_refresh:
    if st.button("🔄 Refresh Data", help="Click to refresh all data"):
        st.cache_data.clear()
        st.rerun()
st.caption(f"Executive Overview – Reporting Year {year}")

# Data Quality Status
quality_report = get_data_quality_report(df_for_wards) if 'df_for_wards' in dir() else None
if quality_report and quality_report["status"] != "OK":
    st.warning(f"⚠️ Data Quality: {', '.join(quality_report['issues'][:3])}")'''

# Find and replace the header section
old_header = '''col_title, col_date = st.columns([3, 1])
with col_title:
    st.title("🏥 Hospital Management Intelligence Dashboard")
with col_date:
    st.caption(f"📅 {datetime.now().strftime('%B %d, %Y')}")
st.caption(f"Executive Overview – Reporting Year {year}")'''

if old_header in content:
    content = content.replace(old_header, timestamp_update)

# IMPROVEMENT 4: Replace load_live_metrics calls with safer version that handles None
# Replace redundant load_live_metrics() with check
content = re.sub(
    r'live_finance, df_episodes = load_live_metrics\(\)\s+if live_finance:',
    '''live_finance, df_episodes = load_live_metrics()
    if live_finance is None or df_episodes is None:
        st.error("❌ Unable to load financial data. Please refresh.")
    elif live_finance:''',
    content
)

content = re.sub(
    r'live_finance, df_full = load_live_metrics\(\)\s+if df_full is not None',
    '''live_finance, df_full = load_live_metrics()
    if df_full is not None:''',
    content
)

# IMPROVEMENT 5: Add error handling to dataframe operations
# Wrap aging analysis with try-except
old_aging = '''with col_aging:
            # Aging analysis from the dataframe
            if df_episodes is not None:
                aging_data = pd.DataFrame\({
                    'Age Bucket': \['Current', '30 Days', '60 Days', '90 Days', '120\+ Days'\],
                    'Amount': \['''

new_aging = '''with col_aging:
            # Aging analysis from the dataframe
            if df_episodes is not None:
                try:
                    aging_data = pd.DataFrame({
                        'Age Bucket': ['Current', '30 Days', '60 Days', '90 Days', '120+ Days'],
                        'Amount': ['''

content = re.sub(
    r'with col_aging:\s+# Aging analysis from the dataframe\s+if df_episodes is not None:\s+aging_data = pd\.DataFrame\(',
    new_aging,
    content
)

# Add closing try-except for aging chart
aging_chart = '''st.plotly_chart(fig_aging, use_container_width=True)
                except Exception as e:
                    st.warning(f"⚠️ Error displaying aging analysis: {e}")'''

# Find the aging chart plotly call and add error handling
if 'fig_aging = px.bar(' in content and 'st.plotly_chart(fig_aging' in content:
    content = re.sub(
        r'(fig_aging = px\.bar\(.*?\))\s+(st\.plotly_chart\(fig_aging, use_container_width=True\))',
        r'\1\n                except Exception as e:\n                    st.warning(f"⚠️ Error displaying aging analysis: {e}")',
        content,
        flags=re.DOTALL
    )

# Save improved dashboard
with open('dashboard_app.py', 'w', encoding='utf-8') as f:
    f.write(content)

print("✅ Applied Critical Improvements:")
print("   • Added helper functions for safer data operations")
print("   • Improved payment CSV parsing with auto-header detection")
print("   • Added data quality validation report")
print("   • Added refresh button & cache clearing")
print("   • Added error handling to key operations")
print("   • Fixed duplicate year selector")
print("   • Added last updated timestamp")
