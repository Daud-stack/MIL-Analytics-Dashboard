#!/usr/bin/env python3
import sys
try:
    with open('dashboard_app.py', 'r', encoding='utf-8') as f:
        code = f.read()
    compile(code, 'dashboard_app.py', 'exec')
    print("✅ Syntax valid - no compilation errors")
except SyntaxError as e:
    print(f"❌ Syntax Error at line {e.lineno}: {e.msg}")
    print(f"   {e.text}")
    sys.exit(1)
except Exception as e:
    print(f"❌ Error: {e}")
    sys.exit(1)
