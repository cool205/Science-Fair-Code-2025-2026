from transformers import Trainer, TrainingArguments, T5Tokenizer, T5ForConditionalGeneration
from datasets import load_dataset

# Load tokenizer and model
tokenizer = T5Tokenizer.from_pretrained("t5-small")
model = T5ForConditionalGeneration.from_pretrained("t5-small")

# Prepare dataset
dataset = load_dataset("csv", data_files={"train": "your_data.csv"}, split="train")
def preprocess(example):
    input_text = f"Rephrase negative: {example['negative']}"
    target_text = example['neutral']
    inputs = tokenizer(input_text, truncation=True, padding="max_length", max_length=64)
    targets = tokenizer(target_text, truncation=True, padding="max_length", max_length=64)
    inputs["labels"] = targets["input_ids"]
    return inputs

tokenized_dataset = dataset.map(preprocess)

# Training setup
training_args = TrainingArguments(
    output_dir="./results",
    per_device_train_batch_size=8,
    num_train_epochs=3,
    logging_dir="./logs",
    save_steps=500,
)

trainer = Trainer(
    model=model,
    args=training_args,
    train_dataset=tokenized_dataset,
)

trainer.train()
model.save_pretrained("./t5_rephraser")
