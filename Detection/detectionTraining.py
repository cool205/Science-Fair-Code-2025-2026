import torch
from torch.utils.data import DataLoader, Dataset
from transformers import BertTokenizer, BertForSequenceClassification
from torch.optim import AdamW
from sklearn.model_selection import train_test_split
from sklearn.metrics import precision_score, recall_score, f1_score
from tqdm import tqdm
import pandas as pd


epochs = 10

# Load and preprocess data
df = pd.read_csv("data.csv")
df.dropna(inplace=True)
df['text'] = df['text'].astype(str)
df['label'] = df['is_toxic'].map({'Not Toxic': 0, 'Toxic': 1})

# Split data
train_texts, val_texts, train_labels, val_labels = train_test_split(
    df['text'].tolist(), df['label'].tolist(), test_size=0.2, stratify=df['label']
)

# Tokenization
tokenizer = BertTokenizer.from_pretrained("bert-base-uncased")
train_encodings = tokenizer(train_texts, truncation=True, padding=True, max_length=128)
val_encodings = tokenizer(val_texts, truncation=True, padding=True, max_length=128)

# Dataset class
class ToxicDataset(Dataset):
    def __init__(self, encodings, labels):
        self.encodings = encodings
        self.labels = labels
    def __getitem__(self, idx):
        item = {key: torch.tensor(val[idx]) for key, val in self.encodings.items()}
        item['labels'] = torch.tensor(self.labels[idx])
        return item
    def __len__(self):
        return len(self.labels)

train_dataset = ToxicDataset(train_encodings, train_labels)
val_dataset = ToxicDataset(val_encodings, val_labels)

# Model setup
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
model = BertForSequenceClassification.from_pretrained("bert-base-uncased", num_labels=2)
model.to(device)

train_loader = DataLoader(train_dataset, batch_size=16, shuffle=True)
val_loader = DataLoader(val_dataset, batch_size=16)
optimizer = AdamW(model.parameters(), lr=5e-5)

model.train()
for epoch in range(epochs):
    total_loss = 0
    correct = 0
    total = 0
    loop = tqdm(train_loader, desc=f"Epoch {epoch+1}")
    
    for batch in loop:
        optimizer.zero_grad()
        input_ids = batch['input_ids'].to(device)
        attention_mask = batch['attention_mask'].to(device)
        labels = batch['labels'].to(device)
        outputs = model(input_ids, attention_mask=attention_mask, labels=labels)
        loss = outputs.loss
        loss.backward()
        optimizer.step()

        total_loss += loss.item()
        preds = torch.argmax(outputs.logits, dim=1)
        correct += (preds == labels).sum().item()
        total += labels.size(0)
        loop.set_postfix(loss=loss.item(), accuracy=correct/total)

    # Calculate epoch metrics
    epoch_loss = total_loss
    epoch_accuracy = correct / total

    # Evaluate on validation set
    model.eval()
    all_preds = []
    all_labels = []
    with torch.no_grad():
        for batch in val_loader:
            input_ids = batch['input_ids'].to(device)
            attention_mask = batch['attention_mask'].to(device)
            labels = batch['labels'].to(device)
            outputs = model(input_ids, attention_mask=attention_mask)
            preds = torch.argmax(outputs.logits, dim=1)
            all_preds.extend(preds.cpu().numpy())
            all_labels.extend(labels.cpu().numpy())
    model.train()

    precision = precision_score(all_labels, all_preds)
    recall = recall_score(all_labels, all_preds)
    f1 = f1_score(all_labels, all_preds)
    val_accuracy = sum([p == l for p, l in zip(all_preds, all_labels)]) / len(all_labels)

    # Print summary
    print(f"Epoch {epoch+1} Summary — Loss: {epoch_loss:.4f}, Accuracy: {epoch_accuracy:.2%}")
    print(f"Validation Accuracy: {val_accuracy:.2%}, Precision: {precision:.2%}, Recall: {recall:.2%}, F1 Score: {f1:.2%}")

    # Append to storage.txt
    with open("storage.txt", "a") as f:
        f.write(f"Epoch {epoch+1}, Train Loss: {epoch_loss:.4f}, Train Acc: {epoch_accuracy:.4f}, "
                f"Val Acc: {val_accuracy:.4f}, Precision: {precision:.4f}, Recall: {recall:.4f}, F1: {f1:.4f}\n")

# Evaluation loop with tqdm
model.eval()
all_preds = []
all_labels = []
loop = tqdm(val_loader, desc="Evaluating")
with torch.no_grad():
    for batch in loop:
        input_ids = batch['input_ids'].to(device)
        attention_mask = batch['attention_mask'].to(device)
        labels = batch['labels'].to(device)
        outputs = model(input_ids, attention_mask=attention_mask)
        preds = torch.argmax(outputs.logits, dim=1)
        all_preds.extend(preds.cpu().numpy())
        all_labels.extend(labels.cpu().numpy())

precision = precision_score(all_labels, all_preds)
recall = recall_score(all_labels, all_preds)
f1 = f1_score(all_labels, all_preds)
accuracy = sum([p == l for p, l in zip(all_preds, all_labels)]) / len(all_labels)

print(f"Validation Accuracy: {accuracy:.2%}")
print(f"Precision: {precision:.2%}, Recall: {recall:.2%}, F1 Score: {f1:.2%}")

# Save model
torch.save(model.state_dict(), "toxicClassifier.pt")
