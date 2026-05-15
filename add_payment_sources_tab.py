#!/usr/bin/env python3
# Add Payment Sources & Channels tab with all payments analysis

new_tab_content = '''
# =========================================================
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
        st.warning(f"⚠️ Error loading payments data: {e}")

'''

# Read the current file
with open('dashboard_app.py', 'r', encoding='utf-8', errors='ignore') as f:
    content = f.read()

# Find tab7 and insert tab8 before it
old_line = "# =========================================================\n# TAB 7 – REPORTS & EXPORT"
new_line = new_tab_content.strip() + "\n\n# =========================================================\n# TAB 7 – REPORTS & EXPORT"

content = content.replace(old_line, new_line)

# Update the tabs definition
old_tabs = '''tab1, tab2, tab3, tab4, tab5, tab6, tab7 = st.tabs([
    "📊 Executive Summary",
    "🚑 Admissions",
    "💰 Finance",
    "🏛️ Ward Performance",
    "📨 Submissions",
    "👤 Patient Metrics",
    "📤 Reports & Export"
])'''

new_tabs = '''tab1, tab2, tab3, tab4, tab5, tab6, tab7, tab8 = st.tabs([
    "📊 Executive Summary",
    "🚑 Admissions",
    "💰 Finance",
    "🏛️ Ward Performance",
    "📨 Submissions",
    "👤 Patient Metrics",
    "💳 Payment Sources",
    "📤 Reports & Export"
])'''

content = content.replace(old_tabs, new_tabs)

# Update tab7 to tab8
old_tab7 = "with tab7:"
new_tab7 = "with tab8:"
# Only replace the last occurrence (the reports & export one)
idx = content.rfind(old_tab7)
if idx > 0:
    content = content[:idx] + new_tab7 + content[idx + len(old_tab7):]

with open('dashboard_app.py', 'w', encoding='utf-8') as f:
    f.write(content)

print("✅ Added Payment Sources & Channels tab (Tab 7)")
