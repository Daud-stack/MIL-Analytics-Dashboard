# Enhanced dashboard with submissions and metrics tabs

content = open('dashboard_app.py', 'r', encoding='utf-8', errors='ignore').read()

# Update tabs to include new ones
old_tabs = """tab1, tab2, tab3, tab4, tab5 = st.tabs([
    "📊 Executive Summary",
    "🚑 Admissions",
    "💰 Finance",
    "🏛️ Ward Performance",
    "📤 Reports & Export"
])"""

new_tabs = """tab1, tab2, tab3, tab4, tab5, tab6, tab7 = st.tabs([
    "📊 Executive Summary",
    "🚑 Admissions",
    "💰 Finance",
    "🏛️ Ward Performance",
    "📨 Submissions",
    "👤 Patient Metrics",
    "📤 Reports & Export"
])"""

content = content.replace(old_tabs, new_tabs)

open('dashboard_app.py', 'w', encoding='utf-8').write(content)
print("✅ Updated tabs to include Submissions and Patient Metrics")
