#!/usr/bin/env python3
# Fix width parameter in st.dataframe() calls

with open('dashboard_app.py', 'r', encoding='utf-8', errors='ignore') as f:
    content = f.read()

# Replace width='stretch' with use_container_width=True
content = content.replace("width='stretch'", "use_container_width=True")
content = content.replace('width="stretch"', "use_container_width=True")

# Also handle cases where width is a parameter (should use use_container_width instead)
content = content.replace(".dataframe(", ".dataframe(")

with open('dashboard_app.py', 'w', encoding='utf-8') as f:
    f.write(content)

print("✅ Fixed st.dataframe() width parameter issues")
