"""
Builds the static data the visualizer loads in the browser.

  public/data/vocab.json       {token: id}
  public/data/merges.json      [[left, right], ...] in priority order
  public/data/embeddings.b64.txt  int8 matrix (base64), one row per token ID
  public/data/embeddings.meta.json  {model, dims, rows, scale}

How the vocabulary is made (a "hybrid" vocabulary, like the pipeline you drew):
  1. Whole words: the most common words in the corpus get their own token.
  2. Subwords: Byte Pair Encoding (BPE) is trained on the corpus. It starts
     from single letters and repeatedly glues together the most frequent
     adjacent pair, e.g. ("i","n") -> "in", then ("in","g") -> "ing".
     Every merge result becomes a vocabulary entry, so any lowercase word
     can always be broken into known pieces.

Run:  python scripts/build_data.py
"""

import base64
import json
import re
from collections import Counter
from pathlib import Path

N_WORDS = 4000  # whole-word tokens
N_MERGES = 2000  # BPE merges -> subword tokens
OUT = Path(__file__).resolve().parent.parent / "public" / "data"
SPECIAL = ["[PAD]", "[UNK]"]
# Everyday words Wikipedia under-represents; always whole tokens, so the graphs
# have clear clusters to show (animals, vehicles, feelings, food...).
EVERYDAY = """cat dog kitten puppy cow horse lion tiger mouse rat bird fish
car cap can cab bus bike train truck boat plane
happy sad angry glad joy fear love hate calm
apple banana bread rice tea coffee milk cake pizza
king queen prince princess man woman boy girl child
run walk jump swim fly eat drink sleep read write
hot cold warm cool big small tall short fast slow
red blue green yellow black white
house home room door window bed chair table
phone computer laptop code data model token word text""".split()


def load_corpus() -> list[str]:
    from datasets import load_dataset

    ds = load_dataset("Salesforce/wikitext", "wikitext-103-raw-v1", split="train[:6%]")
    words: list[str] = []
    for line in ds["text"]:
        words.extend(re.findall(r"[a-z]+", line.lower()))
    return words


def train_bpe(word_counts: Counter, n_merges: int) -> list[tuple[str, str]]:
    # Each word is a tuple of symbols; "</w>" is not used, to keep pieces readable.
    corpus = {tuple(w): c for w, c in word_counts.items()}
    merges: list[tuple[str, str]] = []
    for _ in range(n_merges):
        pairs: Counter = Counter()
        for symbols, c in corpus.items():
            for a, b in zip(symbols, symbols[1:]):
                pairs[(a, b)] += c
        if not pairs:
            break
        best = max(pairs, key=pairs.get)
        merges.append(best)
        merged = best[0] + best[1]
        new_corpus = {}
        for symbols, c in corpus.items():
            out, i = [], 0
            while i < len(symbols):
                if i < len(symbols) - 1 and (symbols[i], symbols[i + 1]) == best:
                    out.append(merged)
                    i += 2
                else:
                    out.append(symbols[i])
                    i += 1
            t = tuple(out)
            new_corpus[t] = new_corpus.get(t, 0) + c
        corpus = new_corpus
    return merges


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    print("loading corpus…")
    words = load_corpus()
    counts = Counter(words)
    print(f"{len(words):,} words, {len(counts):,} distinct")

    # Train BPE on the rarer words so the subwords are useful for unknown words.
    bpe_counts = Counter({w: c for w, c in counts.items() if len(w) > 1 and c >= 3})
    print("training BPE…")
    merges = train_bpe(bpe_counts, N_MERGES)

    vocab: dict[str, int] = {}
    for t in SPECIAL:
        vocab[t] = len(vocab)
    for ch in "abcdefghijklmnopqrstuvwxyz":
        vocab.setdefault(ch, len(vocab))
    for w in EVERYDAY:
        vocab.setdefault(w, len(vocab))
    for w, _ in counts.most_common(N_WORDS):
        vocab.setdefault(w, len(vocab))
    for a, b in merges:
        vocab.setdefault(a + b, len(vocab))
    print(f"vocab size {len(vocab)}")

    print("embedding tokens…")
    from sentence_transformers import SentenceTransformer

    model = SentenceTransformer("sentence-transformers/all-MiniLM-L6-v2")
    import numpy as np

    # One row per token ID (special tokens get zeros), stored as int8 to keep
    # the download small: value ~= int8 / SCALE.
    tokens = sorted(vocab, key=vocab.get)
    vecs = model.encode(tokens, normalize_embeddings=True, batch_size=256)
    for t in SPECIAL:
        vecs[vocab[t]] = 0
    scale = 127 / float(np.abs(vecs).max())
    q = np.clip(np.round(vecs * scale), -127, 127).astype(np.int8)
    # Base64 text so any static host can serve it.
    (OUT / "embeddings.b64.txt").write_text(base64.b64encode(q.tobytes()).decode())

    (OUT / "vocab.json").write_text(json.dumps(vocab))
    (OUT / "merges.json").write_text(json.dumps(merges))
    (OUT / "embeddings.meta.json").write_text(
        json.dumps({"model": "all-MiniLM-L6-v2", "dims": int(vecs.shape[1]), "rows": len(tokens), "scale": scale})
    )
    print("done ->", OUT)


if __name__ == "__main__":
    main()
