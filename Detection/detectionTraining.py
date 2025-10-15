import pandas as pd
from datasets import Dataset
from transformers import (
    DistilBertTokenizerFast,
    DistilBertForSequenceClassification,
    Trainer,
    TrainingArguments,
)

# ======================
# 🔹 1. Load & Clean Data
# ======================

# Load your CSV (ensure it has "text" and "is_toxic" columns)
df = pd.read_csv("data.csv")

# Drop empty rows and normalize labels
df.dropna(subset=["text", "is_toxic"], inplace=True)
df["label"] = df["is_toxic"].apply(lambda x: 1 if str(x).strip().lower() in ["1", "toxic", "yes"] else 0)

# Show class distribution
print("Label distribution:\n", df["label"].value_counts())

# Reduce to only necessary columns
df = df[["text", "label"]]

# ===========================
# 🔹 2. Convert to HF Dataset
# ===========================

dataset = Dataset.from_pandas(df)

# ===========================
# 🔹 3. Tokenizer & Tokenizing
# ===========================

tokenizer = DistilBertTokenizerFast.from_pretrained("distilbert-base-uncased")

def tokenize(batch):
    return tokenizer(batch["text"], truncation=True, padding="max_length", max_length=128)

dataset = dataset.map(tokenize, batched=True)
dataset.set_format("torch", columns=["input_ids", "attention_mask", "label"])

# Split into train and validation sets
train_test = dataset.train_test_split(test_size=0.2)
train_dataset = train_test["train"]
val_dataset = train_test["test"]

# ========================
# 🔹 4. Load Model & Config
# ========================

model = DistilBertForSequenceClassification.from_pretrained(
    "distilbert-base-uncased",
    num_labels=2,
)

# Optional: Name your labels for readability
model.config.id2label = {0: "non-toxic", 1: "toxic"}
model.config.label2id = {"non-toxic": 0, "toxic": 1}

# ========================
# 🔹 5. Define Trainer Setup
# ========================

training_args = TrainingArguments(
    output_dir="./light-toxic-model",     # 💾 Output folder
    evaluation_strategy="epoch",
    save_strategy="epoch",
    learning_rate=5e-5,
    per_device_train_batch_size=16,
    per_device_eval_batch_size=16,
    num_train_epochs=4,
    weight_decay=0.01,
    logging_dir="./logs",
    logging_steps=10,
    load_best_model_at_end=True,
    save_total_limit=1,
)

trainer = Trainer(
    model=model,
    args=training_args,
    train_dataset=train_dataset,
    eval_dataset=val_dataset,
)

# ====================
# 🔹 6. Train the Model
# ====================

trainer.train()

# ======================
# 🔹 7. Save Final Model
# ======================

trainer.save_model("./light-toxic-model")
tokenizer.save_pretrained("./light-toxic-model")

print("\n✅ Model and tokenizer saved to ./light-toxic-model")
