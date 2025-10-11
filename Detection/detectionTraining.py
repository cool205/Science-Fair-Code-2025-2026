import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import Dataset, DataLoader
import wandb #Weights and Biases
import pandas as pd
from nltk.tokenize import word_tokenize
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder
from collections import Counter

wandb.init(project="sentiment-classifier", name="lstm-run")

df = pd.read_csv("sentiment_dataset.csv")
df.dropna(inplace=True)
label_encoder = LabelEncoder()
df['label'] = label_encoder.fit_transform(df['label'])

tokenized = df['text'].apply(word_tokenize)
vocab = Counter([word for sentence in tokenized for word in sentence])
word2idx = {word: idx + 2 for idx, (word, _) in enumerate(vocab.items())}
word2idx["<PAD>"] = 0
word2idx["<UNK>"] = 1

def encode_sentence(sentence, max_len=50):
    tokens = word_tokenize(sentence)
    ids = [word2idx.get(token, word2idx["<UNK>"]) for token in tokens]
    return ids[:max_len] + [word2idx["<PAD>"]] * (max_len - len(ids))

class SentimentDataset(Dataset):
    def __init__(self, texts, labels):
        self.texts = [encode_sentence(text) for text in texts]
        self.labels = labels

    def __len__(self):
        return len(self.labels)

    def __getitem__(self, idx):
        return torch.tensor(self.texts[idx]), torch.tensor(self.labels[idx])

X_train, X_val, y_train, y_val = train_test_split(df['text'], df['label'], test_size=0.2)
train_dataset = SentimentDataset(X_train, y_train.values)
val_dataset = SentimentDataset(X_val, y_val.values)
train_loader = DataLoader(train_dataset, batch_size=32, shuffle=True)
val_loader = DataLoader(val_dataset, batch_size=32)

class SentimentClassifier(nn.Module):
    def __init__(self, vocab_size, embed_dim, hidden_dim, output_dim):
        super().__init__()
        self.embedding = nn.Embedding(vocab_size, embed_dim, padding_idx=word2idx["<PAD>"])
        self.lstm = nn.LSTM(embed_dim, hidden_dim, batch_first=True)
        self.fc = nn.Linear(hidden_dim, output_dim)

    def forward(self, x):
        embedded = self.embedding(x)
        _, (hidden, _) = self.lstm(embedded)
        return self.fc(hidden[-1])

model = SentimentClassifier(vocab_size=len(word2idx), embed_dim=128, hidden_dim=64, output_dim=3)
criterion = nn.CrossEntropyLoss()
optimizer = optim.Adam(model.parameters(), lr=0.001)

for epoch in range(5):
    model.train()
    total_loss = 0
    correct = 0
    total = 0

    for inputs, labels in train_loader:
        optimizer.zero_grad()
        outputs = model(inputs)
        loss = criterion(outputs, labels)
        loss.backward()
        optimizer.step()

        total_loss += loss.item()
        preds = torch.argmax(outputs, dim=1)
        correct += (preds == labels).sum().item()
        total += labels.size(0)

    accuracy = correct / total
    print(f"Epoch {epoch+1}, Loss: {total_loss:.4f}, Accuracy: {accuracy:.2%}")

    wandb.log({"epoch": epoch + 1, "loss": total_loss, "accuracy": accuracy})

model.eval()
correct = 0
total = 0
with torch.no_grad():
    for inputs, labels in val_loader:
        outputs = model(inputs)
        preds = torch.argmax(outputs, dim=1)
        correct += (preds == labels).sum().item()
        total += labels.size(0)
print(f"Validation Accuracy: {correct / total:.2%}")

torch.save(model.state_dict(), "sentiment_model.pt")
