import pandas as pd

df = pd.read_csv('data_reservoir/processed/final_intelligence_master.csv', nrows=5)
print('Columns in final_intelligence_master.csv:')
print(df.columns.tolist())
print('\nChecking for required columns:')
print('Has Shift:', 'Shift' in df.columns)
print('Has Adm_Duration_Mins:', 'Adm_Duration_Mins' in df.columns)
print('Has Adm_Staff_User:', 'Adm_Staff_User' in df.columns)
print('\nShift values sample:')
if 'Shift' in df.columns:
    print(df['Shift'].value_counts())



