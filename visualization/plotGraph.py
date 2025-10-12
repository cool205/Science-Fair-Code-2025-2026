import argparse
import matplotlib.pyplot as plt

# Argument parser setup
parser = argparse.ArgumentParser(description='Plot training metrics from a txt file.')
parser.add_argument('--metric', type=str, required=True,
                    choices=['train_loss', 'train_acc', 'val_acc', 'precision', 'recall', 'f1'],
                    help='Metric to plot (e.g., train_loss, val_acc, precision, recall, f1)')
parser.add_argument('--file', type=str, default='metrics.txt',
                    help='Path to the storage txt file')
args = parser.parse_args()

# Initialize data containers
epochs = []
metrics = {
    'train_loss': [],
    'train_acc': [],
    'val_acc': [],
    'precision': [],
    'recall': [],
    'f1': []
}

# Read and parse the file
with open(args.file, 'r') as f:
    for line in f:
        parts = line.strip().split(',')
        epochs.append(int(parts[0].split()[1]))
        metrics['train_loss'].append(float(parts[1].split(':')[1]))
        metrics['train_acc'].append(float(parts[2].split(':')[1]))
        metrics['val_acc'].append(float(parts[3].split(':')[1]))
        metrics['precision'].append(float(parts[4].split(':')[1]))
        metrics['recall'].append(float(parts[5].split(':')[1]))
        metrics['f1'].append(float(parts[6].split(':')[1]))

# Plot the selected metric
plt.figure(figsize=(10, 6))
plt.plot(epochs, metrics[args.metric], marker='o', label=args.metric.replace('_', ' ').title())
plt.xlabel('Epoch')
plt.ylabel(args.metric.replace('_', ' ').title())
plt.title(f'{args.metric.replace("_", " ").title()} Over Epochs')
plt.grid(True)
plt.legend()
plt.tight_layout()
plt.show()
