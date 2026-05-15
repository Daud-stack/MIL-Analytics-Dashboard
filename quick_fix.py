# Quick fix for Episode Number column issue
content = open('dashboard_app.py').read()

# Simple replacement: replace the line that tries to count Episode Number
content = content.replace(
    "'Episode Number': 'count'",
    ""
).replace(
    "}).rename(columns={'Episode Number': 'Episode_Count'})",
    "})\n        ward_analysis['Episode_Count'] = df.groupby('Ward').size().values"
)

open('dashboard_app.py', 'w').write(content)
print("✅ Fixed Episode Number column reference")
