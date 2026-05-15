#!/usr/bin/env python3
# Fix Collection_Rate_% references after column rename

with open('dashboard_app.py', 'r', encoding='utf-8', errors='ignore') as f:
    content = f.read()

# Fix 1: Sort by new column name
old1 = "st.dataframe(ward_display.sort_values('Collection_Rate_%', ascending=False),"
new1 = "st.dataframe(ward_display.sort_values('Rate %', ascending=False),"

if old1 in content:
    content = content.replace(old1, new1)
    print("✅ Fixed sort_values to use 'Rate %'")

# Fix 2: Scatter plot uses ward_data_filtered, which has original columns, so that's okay
# But let's make sure there are no other references to 'Collection_Rate_%' in the display section

with open('dashboard_app.py', 'w', encoding='utf-8') as f:
    f.write(content)

print("✅ All Collection_Rate_% fixes applied")
