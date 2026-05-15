#!/usr/bin/env python3
# Fix all width='stretch' to use_container_width=True

content = open('dashboard_app.py', 'r', encoding='utf-8', errors='ignore').read()

# Replace for dataframe and plotly_chart calls
replacements = [
    ("st.dataframe(admission_mix[['Admission_Type', 'Percentage']], width='stretch')", 
     "st.dataframe(admission_mix[['Admission_Type', 'Percentage']], use_container_width=True)"),
    
    ("st.plotly_chart(fig, width='stretch')", 
     "st.plotly_chart(fig, use_container_width=True)"),
    
    ("st.plotly_chart(fig_shift, width='stretch')", 
     "st.plotly_chart(fig_shift, use_container_width=True)"),
    
    ("st.dataframe(funder_data.sort_values(\n                    'Medical Aid %', ascending=False), width='stretch')",
     "st.dataframe(funder_data.sort_values(\n                    'Medical Aid %', ascending=False), use_container_width=True)"),
    
    ("st.plotly_chart(fig_risk, width='stretch')", 
     "st.plotly_chart(fig_risk, use_container_width=True)"),
    
    ("st.dataframe(funder_data.head(10), width='stretch')", 
     "st.dataframe(funder_data.head(10), use_container_width=True)"),
]

for old, new in replacements:
    if old in content:
        content = content.replace(old, new)
        print(f"✅ Fixed: {old[:50]}...")

open('dashboard_app.py', 'w', encoding='utf-8').write(content)
print("\n✅ All width parameter fixes applied")
