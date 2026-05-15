#!/usr/bin/env python3
"""
Optimize dashboard performance and add missing metrics
1. Cache all data at startup (single load)
2. Add missing metrics tabs
3. Reduce redundant operations
4. Add staff performance, cellphone contact, account type analysis
"""

import re

with open('dashboard_app.py', 'r', encoding='utf-8', errors='ignore') as f:
    content = f.read()

# ====== IMPROVEMENT 1: Add master data cache at module level ======
# Insert right after page config, before tab creation

cache_code = '''
# ---------------------------------------------------------
# GLOBAL DATA CACHE (loaded once at startup)
# ---------------------------------------------------------

@st.cache_resource(ttl=3600)
def get_cached_data():
    """Load all data once and cache globally to avoid redundant reads."""
    master_path = "data_reservoir/processed/final_intelligence_master.csv"
    adm_path = "data_reservoir/raw/20260126RptManagementDashboard.csv"
    pay_path = "data_reservoir/raw/20260129RptAllPayments_AvenuesClinic.csv"
    
    cache = {}
    
    try:
        if os.path.exists(master_path):
            cache['master_df'] = pd.read_csv(master_path, low_memory=False)
    except Exception as e:
        st.error(f"Error loading master data: {e}")
        cache['master_df'] = None
    
    try:
        if os.path.exists(adm_path):
            cache['admissions_df'] = pd.read_csv(adm_path, skiprows=2, low_memory=False)
            cache['admissions_df'] = cache['admissions_df'].set_index(cache['admissions_df'].columns[0])
    except Exception as e:
        cache['admissions_df'] = None
    
    try:
        if os.path.exists(pay_path):
            cache['payments_df'] = pd.read_csv(pay_path, skiprows=3, on_bad_lines='skip', engine='python', low_memory=False)
    except Exception as e:
        cache['payments_df'] = None
    
    return cache

# Get cached data once
GLOBAL_CACHE = get_cached_data()
df_master = GLOBAL_CACHE.get('master_df')
df_admissions = GLOBAL_CACHE.get('admissions_df')
df_payments = GLOBAL_CACHE.get('payments_df')
'''

# Find where to insert - after the page config
insert_marker = "st.set_page_config("
insert_pos = content.find(insert_marker)
if insert_pos > 0:
    # Find the end of this section
    end_pos = content.find("# ---------------------------------------------------------", insert_pos + 100)
    if end_pos > 0:
        content = content[:end_pos] + cache_code + "\n" + content[end_pos:]

# ====== IMPROVEMENT 2: Add new tabs for missing metrics ======
# Find the tabs definition and expand it
old_tabs_def = '''tab1, tab2, tab3, tab4, tab5, tab6, tab7, tab8 = st.tabs([
    "📊 Executive Summary",
    "🚑 Admissions",
    "💰 Finance",
    "🏛️ Ward Performance",
    "📨 Submissions",
    "👤 Patient Metrics",
    "💳 Payment Sources",
    "📤 Reports & Export"
])'''

new_tabs_def = '''tab1, tab2, tab3, tab4, tab5, tab6, tab7, tab8, tab9, tab10 = st.tabs([
    "📊 Executive Summary",
    "🚑 Admissions",
    "💰 Finance",
    "🏛️ Ward Performance",
    "📨 Submissions",
    "👤 Patient Metrics",
    "💳 Payment Sources",
    "👨‍⚕️ Staff Performance",
    "📋 Account Analysis",
    "📤 Reports & Export"
])'''

content = content.replace(old_tabs_def, new_tabs_def)

# ====== IMPROVEMENT 3: Replace old load_live_metrics() calls with cached data ======
content = re.sub(
    r'live_finance, df_.*? = load_live_metrics\(\)',
    '# Using cached data from startup',
    content
)

# Save the optimized file
with open('dashboard_app_optimized.py', 'w', encoding='utf-8') as f:
    f.write(content)

print("Created optimized dashboard structure")
print("Next: Add missing metric tabs (Staff Performance, Account Analysis)")
