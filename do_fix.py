content = open('dashboard_app.py', encoding='utf-8', errors='ignore').read()
old_str = "            'Episode Number': 'count'\n        }).rename(columns={'Episode Number': 'Episode_Count'})"
new_str = "        })\n        ward_analysis['Episode_Count'] = df.groupby('Ward').size().values"
if old_str in content:
    content = content.replace(old_str, new_str)
    open('dashboard_app.py', 'w', encoding='utf-8').write(content)
    print('✅ Fixed Episode Number column reference')
else:
    print('Pattern not found, trying alternative...')
    # Try alternative pattern
    if "'Episode Number': 'count'" in content:
        content = content.replace("'Episode Number': 'count'", "")
        content = content.replace("}).rename(columns={'Episode Number': 'Episode_Count'})", "})\n        ward_analysis['Episode_Count'] = df.groupby('Ward').size().values")
        open('dashboard_app.py', 'w', encoding='utf-8').write(content)
        print('✅ Fixed using alternative pattern')
