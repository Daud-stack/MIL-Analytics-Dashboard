#!/usr/bin/env python3
# Global replace all width='stretch' and width="stretch"

content = open('dashboard_app.py', 'r', encoding='utf-8', errors='ignore').read()

# Global replacement using regex
import re
content = re.sub(r"width\s*=\s*['\"]stretch['\"]", "use_container_width=True", content)

open('dashboard_app.py', 'w', encoding='utf-8').write(content)
print("✅ Global width parameter fix applied")
