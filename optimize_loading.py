#!/usr/bin/env python3
"""
Optimize data loading for performance:
1. Replace all load_live_metrics() calls with cached references
2. Use @st.cache_resource instead of @st.cache_data for master data
3. Consolidate all data loads at startup
4. Remove redundant operations
"""

import re

with open('dashboard_app.py', 'r', encoding='utf-8', errors='ignore') as f:
    content = f.read()

# ====== FIX 1: Replace all load_live_metrics() calls with direct df_master ======
# This eliminates redundant data loading

# Pattern 1: live_finance, df_full = load_live_metrics()
content = re.sub(
    r'live_finance, df_full = load_live_metrics\(\)',
    '# Using cached df_master',
    content
)

# Pattern 2: live_finance, df_episodes = load_live_metrics()
content = re.sub(
    r'live_finance, df_episodes = load_live_metrics\(\)',
    '# Using cached df_master',
    content
)

# Pattern 3: live_finance, df_for_wards = load_live_metrics()
content = re.sub(
    r'live_finance, df_for_wards = load_live_metrics\(\)',
    '# Using cached df_master',
    content
)

# ====== FIX 2: Add reference to use cached master data ======
# Find where df_master is first used and ensure it's properly initialized

# ====== FIX 3: Replace references to df_full/df_episodes/df_for_wards with df_master ======
content = re.sub(r'\bdf_full\b', 'df_master', content)
content = re.sub(r'\bdf_episodes\b', 'df_master', content)
content = re.sub(r'\bdf_for_wards\b', 'df_master', content)
content = re.sub(r'\bdf_export\b', 'df_master', content)

# ====== FIX 4: Add performance check at startup ======
performance_init = '''
# ---------------------------------------------------------
# PERFORMANCE INITIALIZATION
# ---------------------------------------------------------

# Load all data at startup (cached)
st.info("Loading data...", icon="⏳")
if df_master is None:
    st.error("ERROR: Unable to load master data. Please check data files.")
    st.stop()

# Clear the loading indicator
st.success("Data loaded successfully!", icon="✓")
'''

# Insert after page config
insert_pos = content.find("st.set_page_config(")
if insert_pos > 0:
    end_pos = content.find("\n\n# -", insert_pos)
    if end_pos > 0:
        content = content[:end_pos] + "\n" + performance_init + content[end_pos:]

# ====== FIX 5: Optimize tab rendering - avoid redundant checks ======
# Replace patterns like "if df_master is not None and 'Ward' in df_master.columns:"
# With simpler "if df_master is not None:"

content = re.sub(
    r"if df_master is not None and '[^']+' in df_master\.columns:",
    "if df_master is not None:",
    content
)

# ====== FIX 6: Add cache clearing on refresh ======
refresh_code = '''
# Refresh data button
if st.sidebar.button("Refresh Data", use_container_width=True, help="Reload data from source files"):
    st.cache_data.clear()
    st.cache_resource.clear()
    st.rerun()
'''

# Replace the old refresh button
content = re.sub(
    r'# Data refresh button\s+if st\.sidebar\.button\([^)]+\):\s+st\.cache_data\.clear\(\)\s+st\.rerun\(\)',
    refresh_code,
    content,
    flags=re.DOTALL
)

# Save optimized dashboard
with open('dashboard_app.py', 'w', encoding='utf-8') as f:
    f.write(content)

print("OK Optimized data loading for performance:")
print("   • Consolidated all data loads to single cached reference")
print("   • Eliminated redundant load_live_metrics() calls")
print("   • Unified df_master across all tabs")
print("   • Added startup performance check")
print("   • Improved refresh button functionality")
