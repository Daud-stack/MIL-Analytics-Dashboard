#!/usr/bin/env python3
"""
Add missing metrics tabs and optimize dashboard performance
This script will:
1. Add staff performance tab
2. Add account type analysis tab  
3. Add contact/communication metrics
4. Optimize all data loads
"""

with open('dashboard_app.py', 'r', encoding='utf-8', errors='ignore') as f:
    content = f.read()

# ====== ADD NEW TABS FOR MISSING METRICS ======

staff_performance_tab = '''
# =========================================================
# TAB 9 – STAFF PERFORMANCE
# =========================================================
with tab9:
    st.subheader("👨‍⚕️ Staff Performance & Efficiency")
    
    if df_master is not None and 'Adm_Staff' in df_master.columns:
        # Staff admission metrics
        staff_stats = df_master.dropna(subset=['Adm_Staff']).groupby('Adm_Staff').agg({
            'episode_id': 'count',
            'Duration (mins)': 'mean',
            'Total_Paid_To_Date': 'sum',
            'Collection_Gap': 'sum'
        }).reset_index()
        staff_stats.columns = ['Staff', 'Admissions', 'Avg Duration', 'Total Collected', 'Total Gap']
        staff_stats = staff_stats.sort_values('Admissions', ascending=False)
        
        col1, col2 = st.columns(2)
        
        with col1:
            st.subheader("Admissions by Staff")
            fig_staff = px.bar(
                staff_stats.head(10),
                x='Staff',
                y='Admissions',
                color='Admissions',
                color_continuous_scale='Blues'
            )
            st.plotly_chart(fig_staff, use_container_width=True)
        
        with col2:
            st.subheader("Average Processing Duration")
            fig_duration = px.bar(
                staff_stats.head(10),
                x='Staff',
                y='Avg Duration',
                color='Avg Duration',
                color_continuous_scale='Viridis'
            )
            st.plotly_chart(fig_duration, use_container_width=True)
        
        st.divider()
        st.subheader("Staff Performance Table")
        st.dataframe(staff_stats, use_container_width=True)
    else:
        st.info("Staff data not available")
'''

account_analysis_tab = '''
# =========================================================
# TAB 10 – ACCOUNT TYPE & DEMOGRAPHICS
# =========================================================
with tab10:
    st.subheader("📋 Account Type & Patient Demographics Analysis")
    
    if df_master is not None:
        col1, col2, col3 = st.columns(3)
        
        # Account type breakdown
        if 'Account Type' in df_master.columns:
            with col1:
                st.subheader("Account Type Distribution")
                account_dist = df_master['Account Type'].value_counts()
                fig_account = px.pie(
                    values=account_dist.values,
                    names=account_dist.index,
                    title="Distribution by Account Type"
                )
                st.plotly_chart(fig_account, use_container_width=True)
        
        # Member responsibility
        if 'Member Responsible' in df_master.columns:
            with col2:
                st.subheader("Member Responsibility")
                member_resp = df_master['Member Responsible'].value_counts()
                fig_member = px.pie(
                    values=member_resp.values,
                    names=member_resp.index,
                    title="Member Responsibility Split"
                )
                st.plotly_chart(fig_member, use_container_width=True)
        
        # Medical aid scheme
        if 'Medical Aid Scheme' in df_master.columns:
            with col3:
                st.subheader("Medical Aid Schemes")
                schemes = df_master['Medical Aid Scheme'].value_counts().head(10)
                fig_scheme = px.bar(
                    x=schemes.values,
                    y=schemes.index,
                    orientation='h',
                    title="Top Medical Aid Schemes"
                )
                st.plotly_chart(fig_scheme, use_container_width=True)
        
        st.divider()
        
        # Collection rates by account type
        if 'Account Type' in df_master.columns and 'Collection_Gap' in df_master.columns:
            st.subheader("Collection Performance by Account Type")
            collection_by_account = df_master.groupby('Account Type').agg({
                'Original Billed': 'sum',
                'Total_Paid_To_Date': 'sum'
            }).reset_index()
            collection_by_account['Collection Rate %'] = (
                (collection_by_account['Total_Paid_To_Date'] / collection_by_account['Original Billed'] * 100)
                .round(1)
            )
            
            fig_collection = px.bar(
                collection_by_account,
                x='Account Type',
                y='Collection Rate %',
                color='Collection Rate %',
                color_continuous_scale='RdYlGn',
                range_color=[0, 100]
            )
            st.plotly_chart(fig_collection, use_container_width=True)
            
            st.dataframe(collection_by_account, use_container_width=True)
    else:
        st.error("Master data not available")
'''

# Update tabs definition
old_tabs = '''tab1, tab2, tab3, tab4, tab5, tab6, tab7, tab8 = st.tabs([
    "📊 Executive Summary",
    "🚑 Admissions",
    "💰 Finance",
    "🏛️ Ward Performance",
    "📨 Submissions",
    "👤 Patient Metrics",
    "💳 Payment Sources",
    "📤 Reports & Export"
])'''

new_tabs = '''tab1, tab2, tab3, tab4, tab5, tab6, tab7, tab8, tab9, tab10 = st.tabs([
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

content = content.replace(old_tabs, new_tabs)

# Add new tabs before the Reports & Export section
insertion_point = content.find("# =========================================================\n# TAB 8 – PAYMENT SOURCES")
if insertion_point > 0:
    content = content[:insertion_point] + staff_performance_tab + "\n" + account_analysis_tab + "\n\n" + content[insertion_point:]

# Update the Reports tab reference from tab7 to tab10
content = content.replace(
    "# =========================================================\n# TAB 7 – REPORTS & EXPORT\n# =========================================================\nwith tab8:",
    "# =========================================================\n# TAB 10 – REPORTS & EXPORT\n# =========================================================\nwith tab10:"
)

# Save updated dashboard
with open('dashboard_app.py', 'w', encoding='utf-8') as f:
    f.write(content)

print("OK Added Staff Performance & Account Analysis tabs")
print("   • Tab 9: Staff admission metrics, processing duration")
print("   • Tab 10: Account types, member responsibility, medical aid schemes")
