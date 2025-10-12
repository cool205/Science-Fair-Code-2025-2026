import pandas as pd

# Load your actual files
df1 = pd.read_csv('data.csv')
df2 = pd.read_csv('textdetox.csv')

# Normalize column names
df1.columns = df1.columns.str.strip().str.lower()
df2.columns = df2.columns.str.strip().str.lower()

# Rename if needed
if 'toxic' in df2.columns:
    df2.rename(columns={'toxic': 'is_toxic'}, inplace=True)

# Normalize labels
def normalize_label(label):
    label = str(label).strip().lower()
    return 1 if label in ['toxic', '1'] else 0

df1['is_toxic'] = df1['is_toxic'].apply(normalize_label)
df2['is_toxic'] = df2['is_toxic'].apply(normalize_label)

# Combine and save
combined_df = pd.concat([df1, df2], ignore_index=True)
combined_df.to_csv('normalized_toxicity.csv', index=False)

print(f"Saved {len(combined_df)} rows to 'normalized_toxicity.csv'")
