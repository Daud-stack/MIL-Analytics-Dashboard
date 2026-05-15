#!/usr/bin/env python3
import re

with open('dashboard_app.py', 'r') as f:
    content = f.read()

# Replace the problematic aggregation
old_code = """    try:
        # Group by Ward
        ward_analysis = df.groupby('Ward', as_index=False).agg({
            'Original Billed': 'sum',
            'Total_Paid_To_Date': 'sum',
            'Collection_Gap': 'sum',
            'Episode Number': 'count'
        }).rename(columns={'Episode Number': 'Episode_Count'})"""

new_code = """    try:
        # Group by Ward and aggregate metrics
        ward_analysis = df.groupby('Ward', as_index=False).agg({
            'Original Billed': 'sum',
            'Total_Paid_To_Date': 'sum',
            'Collection_Gap': 'sum'
        })
        
        # Add episode count by counting rows per ward
        episode_counts = df.groupby('Ward').size().reset_index(name='Episode_Count')
        ward_analysis = ward_analysis.merge(episode_counts, on='Ward')"""

if old_code in content:
    content = content.replace(old_code, new_code)
    with open('dashboard_app.py', 'w') as f:
        f.write(content)
    print("✅ Fixed get_ward_analysis function - replaced problematic Episode Number aggregation")
else:
    print("⚠️ Old code pattern not found - file may already be fixed")
