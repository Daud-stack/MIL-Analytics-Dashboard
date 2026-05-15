#!/usr/bin/env python3
# Add new Submissions and Patient Metrics tabs to dashboard

new_tabs_content = '''
# =========================================================
# TAB 6 – SUBMISSIONS ANALYSIS
# =========================================================
with tab6:
    live_finance, df_full = load_live_metrics()
    
    if df_full is not None and 'Submission Date' in df_full.columns:
        st.subheader("📨 Submissions Analysis")
        
        # Convert to datetime if needed
        df_full['Submission Date'] = pd.to_datetime(df_full['Submission Date'], errors='coerce')
        
        # Submissions by month
        submissions_by_month = df_full.groupby(df_full['Submission Date'].dt.to_period('M')).size()
        
        if not submissions_by_month.empty:
            fig_subs = px.bar(
                x=submissions_by_month.index.astype(str),
                y=submissions_by_month.values,
                title="Submissions by Month",
                labels={'x': 'Month', 'y': 'Count'}
            )
            st.plotly_chart(fig_subs, use_container_width=True)
            
            # Submissions metrics
            col1, col2, col3, col4 = st.columns(4)
            col1.metric("Total Submissions", len(df_full), help="Total records submitted")
            col2.metric("Avg Submission Amount", f"${df_full['Original Billed'].mean():,.0f}", help="Average billed amount per submission")
            col3.metric("Total Submitted", f"${df_full['Original Billed'].sum():,.0f}", help="Total amount submitted")
            col4.metric("Collected %", f"{(df_full['Total_Paid_To_Date'].sum() / df_full['Original Billed'].sum() * 100) if df_full['Original Billed'].sum() > 0 else 0:.1f}%")
            
            st.divider()
            
            # Recent submissions table
            st.subheader("Recent Submissions")
            recent = df_full[['Hospital', 'Medical Aid', 'Admission Date', 'Original Billed', 'Total_Paid_To_Date']].head(10).copy()
            recent['Original Billed'] = recent['Original Billed'].apply(lambda x: f"${x:,.0f}")
            recent['Total_Paid_To_Date'] = recent['Total_Paid_To_Date'].apply(lambda x: f"${x:,.0f}")
            st.dataframe(recent, use_container_width=True)
    else:
        st.info("ℹ️ Submission data not available")

# =========================================================
# TAB 7 – PATIENT METRICS
# =========================================================
with tab7:
    live_finance, df_full = load_live_metrics()
    
    if df_full is not None:
        st.subheader("👤 Patient & Account Metrics")
        
        col1, col2 = st.columns(2)
        
        # Patient responsibility analysis
        with col1:
            st.subheader("Member Responsibility")
            responsibility = df_full['Member Responsible'].value_counts()
            if not responsibility.empty:
                fig_resp = px.pie(
                    values=responsibility.values,
                    names=responsibility.index,
                    title="Patient Responsibility Distribution"
                )
                st.plotly_chart(fig_resp, use_container_width=True)
        
        # Secondary medical aid
        with col2:
            st.subheader("Secondary Medical Aid Usage")
            sec_aid = df_full['SecondaryMedicalAid'].notna().sum()
            primary_only = len(df_full) - sec_aid
            fig_sec = px.pie(
                values=[primary_only, sec_aid],
                names=['Primary Only', 'With Secondary Aid'],
                title="Primary vs Secondary Medical Aid"
            )
            st.plotly_chart(fig_sec, use_container_width=True)
        
        st.divider()
        
        # Account type analysis
        st.subheader("Account Type Distribution")
        account_types = df_full['Account Type'].value_counts()
        fig_account = px.bar(
            x=account_types.index,
            y=account_types.values,
            title="Records by Account Type",
            labels={'x': 'Account Type', 'y': 'Count'}
        )
        st.plotly_chart(fig_account, use_container_width=True)
        
        st.divider()
        
        # Hospital comparison
        st.subheader("Performance by Hospital")
        hospital_stats = df_full.groupby('Hospital').agg({
            'Original Billed': 'sum',
            'Total_Paid_To_Date': 'sum',
            'episode_id': 'count'
        }).reset_index()
        hospital_stats.columns = ['Hospital', 'Total Billed', 'Total Collected', 'Cases']
        hospital_stats['Collection Rate'] = (hospital_stats['Total Collected'] / hospital_stats['Total Billed'] * 100).round(1)
        
        fig_hospital = px.bar(
            hospital_stats,
            x='Hospital',
            y='Collection Rate',
            color='Collection Rate',
            title="Collection Rate by Hospital",
            color_continuous_scale='RdYlGn',
            range_color=[0, 100]
        )
        st.plotly_chart(fig_hospital, use_container_width=True)
        
        st.dataframe(hospital_stats, use_container_width=True)

'''

# Read the current file
with open('dashboard_app.py', 'r', encoding='utf-8', errors='ignore') as f:
    content = f.read()

# Find where to insert - right before tab5 (now tab7)
# Look for "with tab5:" and insert before it
insert_point = content.find("with tab5:")

if insert_point > 0:
    # Insert the new tabs before tab5
    new_content = content[:insert_point] + new_tabs_content + "\n# =========================================================\n# TAB 7 – REPORTS & EXPORT\n# =========================================================\n" + content[insert_point:].replace("with tab5:", "with tab7:")
    
    with open('dashboard_app.py', 'w', encoding='utf-8') as f:
        f.write(new_content)
    
    print("✅ Added Submissions and Patient Metrics tabs")
else:
    print("⚠️ Could not find insertion point")
