from transformers import AutoTokenizer, AutoModelForSequenceClassification
import torch

# Load toxicity model
tokenizer = AutoTokenizer.from_pretrained("nicholasKluge/ToxicityModel")
model = AutoModelForSequenceClassification.from_pretrained("nicholasKluge/ToxicityModel")

def get_toxicity_score(text):
    tokens = tokenizer(text, truncation=True, max_length=512, return_tensors="pt")
    with torch.no_grad():
        score = model(**tokens).logits[0].item()
    return score

# Example

while True:
    comment = input("Enter a comment to check for toxicity: ")
    score = get_toxicity_score(comment)
    print(f"Toxicity Score: {score:.3f}")

