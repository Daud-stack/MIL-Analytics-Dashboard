#!/usr/bin/env python3
# Fix ward display columns to use actual column names

with open('dashboard_app.py', 'r', encoding='utf-8', errors='ignore') as f:
    content = f.read()

# Fix 1: Replace the display_cols line and formatting
old1 = """            display_cols = ['Ward', 'Cases', 'Billed', 'Collected', 'Collection_Rate_%', 'Med_Aid_%']
            ward_display = ward_data_filtered[display_cols].copy()
            
            # Format currency columns
            ward_display['Billed'] = ward_display['Billed'].apply(lambda x: f"${x:,.0f}")
            ward_display['Collected'] = ward_display['Collected'].apply(lambda x: f"${x:,.0f}")"""

new1 = """            # Format for display
            ward_display = ward_data_filtered.copy()
            ward_display['Total_Billed'] = ward_display['Total_Billed'].apply(lambda x: f"${x:,.0f}")
            ward_display['Total_Collected'] = ward_display['Total_Collected'].apply(lambda x: f"${x:,.0f}")
            ward_display['Collection_Gap'] = ward_display['Collection_Gap'].apply(lambda x: f"${x:,.0f}")
            
            # Select and rename columns for display
            display_cols = ['Ward', 'Episode_Count', 'Total_Billed', 'Total_Collected', 'Collection_Gap', 'Collection_Rate_%']
            ward_display = ward_display[display_cols].copy()
            ward_display.columns = ['Ward', 'Cases', 'Billed', 'Collected', 'Gap', 'Rate %']"""

if old1 in content:
    content = content.replace(old1, new1)
    print("✅ Fixed display columns")

# Fix 2: Replace scatter plot references
old2 = """            fig_scatter = px.scatter(
                ward_data_filtered,
                x='Cases',
                y='Collection_Rate_%',
                size='Billed',
                hover_data=['Ward', 'Collected'],"""

new2 = """            fig_scatter = px.scatter(
                ward_data_filtered,
                x='Episode_Count',
                y='Collection_Rate_%',
                size='Total_Billed',
                hover_data=['Ward', 'Total_Collected'],"""

if old2 in content:
    content = content.replace(old2, new2)
    print("✅ Fixed scatter plot")

with open('dashboard_app.py', 'w', encoding='utf-8') as f:
    f.write(content)

print("✅ All ward display fixes applied")
