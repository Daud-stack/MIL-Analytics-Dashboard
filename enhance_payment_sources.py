#!/usr/bin/env python3
# Enhanced Payment Sources tab with medical aid, cashier performance, episode analysis, and reconciliation

enhanced_tab_content = '''# =========================================================
# TAB 8 – PAYMENT SOURCES & CHANNELS (ENHANCED)
# =========================================================
with tab8:
    st.subheader("💳 Payment Sources & Collection Channels")
    
    # Load all payments data
    try:
        payments_df = pd.read_csv('data_reservoir/raw/20260129RptAllPayments_AvenuesClinic.csv', skiprows=3)
        
        if not payments_df.empty and 'Payment Type' in payments_df.columns:
            # Clean data
            payments_df['Amount'] = pd.to_numeric(payments_df['Amount'], errors='coerce')
            payments_df['Date'] = pd.to_datetime(payments_df['Date'], format='%d/%m/%Y', errors='coerce')
            payments_df['Episode Number'] = pd.to_numeric(payments_df['Episode Number'], errors='coerce')
            
            # Load master data for reconciliation
            master_path = "data_reservoir/processed/final_intelligence_master.csv"
            if os.path.exists(master_path):
                master_df = pd.read_csv(master_path, low_memory=False)
            else:
                master_df = None
            
            # Tab selector
            tab_payment_sources, tab_medical_aid, tab_cashiers, tab_episode_level, tab_reconciliation = st.tabs([
                "📊 Channel Analysis",
                "🏥 Medical Aid Performance",
                "👥 Cashier Performance",
                "📋 Episode Level",
                "🔍 Reconciliation"
            ])
            
            # ====== TAB 1: CHANNEL ANALYSIS ======
            with tab_payment_sources:
                col1, col2 = st.columns(2)
                
                # Payment type analysis
                with col1:
                    st.subheader("Collections by Payment Type")
                    payment_types = payments_df['Payment Type'].value_counts()
                    if not payment_types.empty:
                        fig_type = px.pie(
                            values=payment_types.values,
                            names=payment_types.index,
                            title="Payment Method Distribution"
                        )
                        st.plotly_chart(fig_type, use_container_width=True)
                
                # Payment description (collection source)
                with col2:
                    st.subheader("Collections by Source Type")
                    descriptions = payments_df['Description'].value_counts().head(10)
                    if not descriptions.empty:
                        fig_desc = px.bar(
                            x=descriptions.values,
                            y=descriptions.index,
                            orientation='h',
                            title="Top 10 Collection Sources"
                        )
                        st.plotly_chart(fig_desc, use_container_width=True)
                
                st.divider()
                
                # Amount by payment type
                st.subheader("Collection Amount by Payment Type")
                amount_by_type = payments_df.groupby('Payment Type')['Amount'].agg(['sum', 'count', 'mean']).reset_index()
                amount_by_type.columns = ['Payment Type', 'Total Amount', 'Transactions', 'Avg Amount']
                amount_by_type = amount_by_type.sort_values('Total Amount', ascending=False)
                
                fig_amount = px.bar(
                    amount_by_type,
                    x='Payment Type',
                    y='Total Amount',
                    title="Total Amount Collected by Payment Method",
                    labels={'Total Amount': 'Amount Collected ($)'},
                    color='Total Amount',
                    color_continuous_scale='Blues'
                )
                st.plotly_chart(fig_amount, use_container_width=True)
                
                # Display as table
                st.dataframe(amount_by_type, use_container_width=True, hide_index=True)
                
                st.divider()
                
                # Payment timeline
                st.subheader("Collections Over Time")
                daily_collections = payments_df.groupby(payments_df['Date'].dt.date)['Amount'].sum().reset_index()
                daily_collections.columns = ['Date', 'Amount']
                
                fig_timeline = px.line(
                    daily_collections,
                    x='Date',
                    y='Amount',
                    title="Daily Collections Trend",
                    markers=True,
                    labels={'Amount': 'Collections ($)'}
                )
                st.plotly_chart(fig_timeline, use_container_width=True)
                
                st.divider()
                
                # Summary metrics
                st.subheader("Collection Metrics")
                col1, col2, col3, col4 = st.columns(4)
                
                total_collected = payments_df['Amount'].sum()
                num_transactions = len(payments_df)
                avg_transaction = payments_df['Amount'].mean()
                payment_methods = payments_df['Payment Type'].nunique()
                
                col1.metric("Total Collections", f"${total_collected:,.0f}", help="Total amount collected")
                col2.metric("Transactions", f"{num_transactions:,}", help="Total number of payment transactions")
                col3.metric("Avg Transaction", f"${avg_transaction:,.0f}", help="Average collection per transaction")
                col4.metric("Payment Methods", payment_methods, help="Number of different payment types")
            
            # ====== TAB 2: MEDICAL AID PERFORMANCE ======
            with tab_medical_aid:
                st.subheader("Medical Aid Collections Performance")
                
                col1, col2 = st.columns(2)
                
                # Medical aid collection distribution
                with col1:
                    medical_aid_collections = payments_df.groupby('Medical Aid')['Amount'].sum().sort_values(ascending=False).head(10)
                    fig_ma_dist = px.pie(
                        values=medical_aid_collections.values,
                        names=medical_aid_collections.index,
                        title="Collections by Medical Aid (Top 10)"
                    )
                    st.plotly_chart(fig_ma_dist, use_container_width=True)
                
                # Medical aid transaction count
                with col2:
                    medical_aid_count = payments_df['Medical Aid'].value_counts().head(10)
                    fig_ma_count = px.bar(
                        x=medical_aid_count.values,
                        y=medical_aid_count.index,
                        orientation='h',
                        title="Transaction Count by Medical Aid",
                        labels={'x': 'Number of Transactions'}
                    )
                    st.plotly_chart(fig_ma_count, use_container_width=True)
                
                st.divider()
                
                # Medical aid performance table
                st.subheader("Medical Aid Performance Metrics")
                ma_performance = payments_df.groupby('Medical Aid')['Amount'].agg(['sum', 'count', 'mean']).reset_index()
                ma_performance.columns = ['Medical Aid', 'Total Collected', 'Transactions', 'Avg Amount']
                ma_performance = ma_performance.sort_values('Total Collected', ascending=False)
                
                st.dataframe(ma_performance, use_container_width=True, hide_index=True)
            
            # ====== TAB 3: CASHIER PERFORMANCE ======
            with tab_cashiers:
                st.subheader("Cashier Performance & Activity")
                
                col1, col2 = st.columns(2)
                
                # Collections by cashier
                with col1:
                    cashier_collections = payments_df.groupby('User')['Amount'].sum().sort_values(ascending=False)
                    fig_cashier_amt = px.bar(
                        x=cashier_collections.values,
                        y=cashier_collections.index,
                        orientation='h',
                        title="Collections by Cashier",
                        labels={'x': 'Amount Collected ($)'}
                    )
                    st.plotly_chart(fig_cashier_amt, use_container_width=True)
                
                # Transaction count by cashier
                with col2:
                    cashier_count = payments_df['User'].value_counts()
                    fig_cashier_count = px.bar(
                        x=cashier_count.values,
                        y=cashier_count.index,
                        orientation='h',
                        title="Transaction Count by Cashier",
                        labels={'x': 'Number of Transactions'},
                        color=cashier_count.values,
                        color_continuous_scale='Viridis'
                    )
                    st.plotly_chart(fig_cashier_count, use_container_width=True)
                
                st.divider()
                
                # Cashier performance table
                st.subheader("Cashier Performance Metrics")
                cashier_perf = payments_df.groupby('User')['Amount'].agg(['sum', 'count', 'mean', 'min', 'max']).reset_index()
                cashier_perf.columns = ['Cashier', 'Total Collected', 'Transactions', 'Avg Amount', 'Min Amount', 'Max Amount']
                cashier_perf = cashier_perf.sort_values('Total Collected', ascending=False)
                
                st.dataframe(cashier_perf, use_container_width=True, hide_index=True)
            
            # ====== TAB 4: EPISODE LEVEL ANALYSIS ======
            with tab_episode_level:
                st.subheader("Episode-Level Payment Analysis")
                
                # Filter by episode
                episodes_with_payments = payments_df['Episode Number'].dropna().unique()
                selected_episode = st.selectbox(
                    "Select Episode Number",
                    sorted(episodes_with_payments),
                    format_func=lambda x: f"Episode {int(x)}"
                )
                
                if selected_episode:
                    episode_payments = payments_df[payments_df['Episode Number'] == selected_episode]
                    
                    if not episode_payments.empty:
                        col1, col2, col3 = st.columns(3)
                        
                        ep_total = episode_payments['Amount'].sum()
                        ep_trans = len(episode_payments)
                        ep_methods = episode_payments['Payment Type'].nunique()
                        
                        col1.metric("Total Collected for Episode", f"${ep_total:,.0f}")
                        col2.metric("Payment Transactions", ep_trans)
                        col3.metric("Payment Methods Used", ep_methods)
                        
                        st.divider()
                        
                        # Payment breakdown for this episode
                        st.subheader("Payment Details for Episode")
                        episode_detail = episode_payments[['Date', 'Payment Type', 'Description', 'Amount', 'User', 'Medical Aid']].copy()
                        episode_detail['Amount'] = episode_detail['Amount'].apply(lambda x: f"${x:,.0f}" if pd.notna(x) else "")
                        st.dataframe(episode_detail, use_container_width=True, hide_index=True)
                        
                        # Compare with billed amount if master data available
                        if master_df is not None and 'episode_id' in master_df.columns:
                            master_episode = master_df[master_df['episode_id'] == selected_episode]
                            if not master_episode.empty:
                                st.divider()
                                st.subheader("Episode Billed vs Collected (Reconciliation)")
                                
                                col1, col2, col3 = st.columns(3)
                                
                                billed = master_episode['Original Billed'].sum() if 'Original Billed' in master_episode.columns else 0
                                collected = ep_total
                                gap = billed - collected
                                
                                col1.metric("Original Billed", f"${billed:,.0f}")
                                col2.metric("Total Collected", f"${collected:,.0f}")
                                col3.metric("Outstanding", f"${max(gap, 0):,.0f}")
                    else:
                        st.info("No payment records for selected episode")
            
            # ====== TAB 5: RECONCILIATION ======
            with tab_reconciliation:
                st.subheader("Payment Reconciliation Analysis")
                
                if master_df is not None:
                    # Merge payments with episodes
                    payments_agg = payments_df.groupby('Episode Number')['Amount'].sum().reset_index()
                    payments_agg.columns = ['episode_id', 'Payments_Recorded']
                    payments_agg['episode_id'] = pd.to_numeric(payments_agg['episode_id'], errors='coerce')
                    
                    # Merge with master
                    recon_df = master_df[['episode_id', 'Original Billed', 'Total_Paid_To_Date', 'Hospital']].merge(
                        payments_agg,
                        on='episode_id',
                        how='left'
                    )
                    recon_df['Payments_Recorded'] = recon_df['Payments_Recorded'].fillna(0)
                    recon_df['Outstanding'] = recon_df['Original Billed'] - recon_df['Payments_Recorded']
                    recon_df['Collection_Rate_%'] = ((recon_df['Payments_Recorded'] / recon_df['Original Billed']) * 100).round(1)
                    recon_df = recon_df[recon_df['Original Billed'] > 0]
                    
                    col1, col2, col3, col4 = st.columns(4)
                    
                    total_billed = recon_df['Original Billed'].sum()
                    total_payments = recon_df['Payments_Recorded'].sum()
                    reconciled_episodes = len(recon_df[recon_df['Outstanding'] <= 0])
                    outstanding_total = recon_df['Outstanding'].sum()
                    
                    col1.metric("Total Billed (All Episodes)", f"${total_billed:,.0f}")
                    col2.metric("Payments Recorded", f"${total_payments:,.0f}")
                    col3.metric("Fully Collected Episodes", reconciled_episodes)
                    col4.metric("Total Outstanding", f"${outstanding_total:,.0f}")
                    
                    st.divider()
                    
                    # Collection rate distribution
                    col1, col2 = st.columns(2)
                    
                    with col1:
                        st.subheader("Collection Rate Distribution")
                        fig_dist = px.histogram(
                            recon_df,
                            x='Collection_Rate_%',
                            nbins=20,
                            title="Collection Rate % Distribution",
                            labels={'Collection_Rate_%': 'Collection Rate (%)'}
                        )
                        st.plotly_chart(fig_dist, use_container_width=True)
                    
                    with col2:
                        st.subheader("Outstanding by Hospital")
                        outstand_by_hosp = recon_df.groupby('Hospital')['Outstanding'].sum().sort_values(ascending=False)
                        fig_hosp = px.bar(
                            x=outstand_by_hosp.values,
                            y=outstand_by_hosp.index,
                            orientation='h',
                            title="Outstanding Amount by Hospital",
                            labels={'x': 'Outstanding ($)'}
                        )
                        st.plotly_chart(fig_hosp, use_container_width=True)
                    
                    st.divider()
                    
                    # Reconciliation details table
                    st.subheader("Detailed Reconciliation Report")
                    display_recon = recon_df[['episode_id', 'Hospital', 'Original Billed', 'Payments_Recorded', 'Outstanding', 'Collection_Rate_%']].copy()
                    display_recon.columns = ['Episode', 'Hospital', 'Billed', 'Collected', 'Outstanding', 'Rate %']
                    display_recon = display_recon.sort_values('Outstanding', ascending=False)
                    
                    st.dataframe(display_recon, use_container_width=True, hide_index=True)
                else:
                    st.warning("⚠️ Master data not available for reconciliation")
            
        else:
            st.info("ℹ️ All payments data not available or invalid format")
    except Exception as e:
        st.warning(f"⚠️ Error loading payments data: {e}")
        import traceback
        st.text(traceback.format_exc())
'''

# Read current file
with open('dashboard_app.py', 'r', encoding='utf-8', errors='ignore') as f:
    content = f.read()

# Find and replace the old tab8 content
old_pattern = '''# =========================================================
# TAB 8 – PAYMENT SOURCES & CHANNELS
# =========================================================
with tab8:
    st.subheader("💳 Payment Sources & Collection Channels")
    
    # Load all payments data
    try:
        payments_df = pd.read_csv('data_reservoir/raw/20260129RptAllPayments_AvenuesClinic.csv', skiprows=3)
        
        if not payments_df.empty and 'Payment Type' in payments_df.columns:
            col1, col2 = st.columns(2)
            
            # Payment type analysis
            with col1:
                st.subheader("Collections by Payment Type")
                payment_types = payments_df['Payment Type'].value_counts()
                if not payment_types.empty:
                    fig_type = px.pie(
                        values=payment_types.values,
                        names=payment_types.index,
                        title="Payment Method Distribution"
                    )
                    st.plotly_chart(fig_type, use_container_width=True)
            
            # Payment description (collection source)
            with col2:
                st.subheader("Collections by Source")
                descriptions = payments_df['Description'].value_counts().head(10)
                if not descriptions.empty:
                    fig_desc = px.bar(
                        x=descriptions.values,
                        y=descriptions.index,
                        orientation='h',
                        title="Top 10 Collection Sources"
                    )
                    st.plotly_chart(fig_desc, use_container_width=True)
            
            st.divider()
            
            # Amount by payment type
            st.subheader("Collection Amount by Payment Type")
            payments_df['Amount'] = pd.to_numeric(payments_df['Amount'], errors='coerce')
            amount_by_type = payments_df.groupby('Payment Type')['Amount'].sum().reset_index().sort_values('Amount', ascending=False)
            
            fig_amount = px.bar(
                amount_by_type,
                x='Payment Type',
                y='Amount',
                title="Total Amount Collected by Payment Method",
                labels={'Amount': 'Amount Collected ($)'},
                color='Amount',
                color_continuous_scale='Blues'
            )
            st.plotly_chart(fig_amount, use_container_width=True)
            
            st.divider()
            
            # Payment timeline
            st.subheader("Collections Over Time")
            payments_df['Date'] = pd.to_datetime(payments_df['Date'], format='%d/%m/%Y', errors='coerce')
            daily_collections = payments_df.groupby(payments_df['Date'].dt.date)['Amount'].sum().reset_index()
            daily_collections.columns = ['Date', 'Amount']
            
            fig_timeline = px.line(
                daily_collections,
                x='Date',
                y='Amount',
                title="Daily Collections Trend",
                markers=True
            )
            st.plotly_chart(fig_timeline, use_container_width=True)
            
            st.divider()
            
            # Payment details table
            st.subheader("Recent Collections")
            recent_payments = payments_df[['Hospital', 'Episode Number', 'Payment Type', 'Description', 'Date', 'Amount', 'User']].head(20).copy()
            recent_payments['Amount'] = recent_payments['Amount'].apply(lambda x: f"${x:,.0f}" if pd.notna(x) else "")
            st.dataframe(recent_payments, use_container_width=True)
            
            # Summary metrics
            st.divider()
            st.subheader("Collection Metrics")
            col1, col2, col3, col4 = st.columns(4)
            
            total_collected = payments_df['Amount'].sum()
            num_transactions = len(payments_df)
            avg_transaction = payments_df['Amount'].mean()
            payment_methods = payments_df['Payment Type'].nunique()
            
            col1.metric("Total Collections", f"${total_collected:,.0f}", help="Total amount collected")
            col2.metric("Number of Transactions", f"{num_transactions:,}", help="Total number of payment transactions")
            col3.metric("Avg Transaction", f"${avg_transaction:,.0f}", help="Average collection per transaction")
            col4.metric("Payment Methods", payment_methods, help="Number of different payment types")
            
        else:
            st.info("ℹ️ All payments data not available or invalid format")
    except Exception as e:
        st.warning(f"⚠️ Error loading payments data: {e}")'''

content = content.replace(old_pattern, enhanced_tab_content)

# Write back
with open('dashboard_app.py', 'w', encoding='utf-8') as f:
    f.write(content)

print("✅ Enhanced Payment Sources tab with:")
print("   • 5 detailed sub-tabs (Channel, Medical Aid, Cashiers, Episode, Reconciliation)")
print("   • Medical Aid performance metrics")
print("   • Cashier performance & activity tracking")
print("   • Episode-level payment drilldown")
print("   • Full reconciliation analysis vs billed amounts")
