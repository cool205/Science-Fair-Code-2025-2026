import torch
import torch.nn as nn
import torch.optim as optim
from transformers import AutoTokenizer, AutoModelForSequenceClassification
from torch.utils.data import Dataset, DataLoader

# Load teacher model (NicholasKluge's ToxicityModel)
teacher_tokenizer = AutoTokenizer.from_pretrained("nicholasKluge/ToxicityModel")
teacher_model = AutoModelForSequenceClassification.from_pretrained("nicholasKluge/ToxicityModel")
teacher_model.eval()

# Load student model (your own PyTorch classifier)
student_model = torch.load("toxicClassifier.pt")
student_model.train()

# Sample unlabeled comments
texts = [
    "This app is garbage.",
    "I hate how slow this website is.",
    "Customer service was terrible.",
    "The product broke after one day.",
    "I’m disappointed with the experience.",
    "Nothing worked as expected.",
    "The support team was rude.",
    "Worst app I’ve ever used.",
    "This is a scam.",
    "I regret downloading this."
]

# Dataset class
class DistillationDataset(Dataset):
    def __init__(self, texts, tokenizer):
        self.texts = texts
        self.tokenizer = tokenizer

    def __len__(self):
        return len(self.texts)

    def __getitem__(self, idx):
        text = self.texts[idx]
        tokens = self.tokenizer(text, truncation=True, padding="max_length", max_length=128, return_tensors="pt")
        return {
            "text": text,
            "input_ids": tokens["input_ids"].squeeze(),
            "attention_mask": tokens["attention_mask"].squeeze()
        }

# Create dataset and dataloader
dataset = DistillationDataset(texts, teacher_tokenizer)
loader = DataLoader(dataset, batch_size=4, shuffle=True)

# Distillation loss function
def distillation_loss(student_logits, teacher_logits, temperature=2.0):
    student_probs = nn.functional.log_softmax(student_logits / temperature, dim=1)
    teacher_probs = nn.functional.softmax(teacher_logits / temperature, dim=1)
    return nn.functional.kl_div(student_probs, teacher_probs, reduction="batchmean") * (temperature ** 2)

# Optimizer
optimizer = optim.Adam(student_model.parameters(), lr=1e-5)

# Training loop
for epoch in range(3):
    for batch in loader:
        input_ids = batch["input_ids"]
        attention_mask = batch["attention_mask"]

        # Teacher output
        with torch.no_grad():
            teacher_logits = teacher_model(input_ids=input_ids, attention_mask=attention_mask).logits

        # Student output
        student_logits = student_model(input_ids, attention_mask)

        # Compute loss
        loss = distillation_loss(student_logits, teacher_logits)

        # Backpropagation
        optimizer.zero_grad()
        loss.backward()
        optimizer.step()

    print(f"Epoch {epoch+1} completed. Loss: {loss.item():.4f}")

# Save the fine-tuned student model
torch.save(student_model, "student_toxicClassifier_finetuned.pt")
print("Student model saved as student_toxicClassifier_finetuned.pt")
