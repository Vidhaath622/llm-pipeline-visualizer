# LLM Pipeline Visualizer

Follow a sentence from plain text to the vectors a language model works with:

Vocabulary → Text → Vocabulary check → Subword tokenization (BPE) → Tokens → Token IDs → Vectors → Spelling vs meaning (3D graphs)

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # static site in dist/
```

## Project map

| Path | What it is |
|---|---|
| `scripts/build_data.py` | Builds the vocabulary, BPE merges and embeddings from WikiText-103 |
| `public/data/` | The built data: `vocab.json`, `merges.json`, `embeddings.b64.txt`, `embeddings.meta.json` |
| `src/lib/tokenizer.ts` | Stages 2–6: normalize, vocab check, BPE with recorded steps, token IDs |
| `src/lib/similarity.ts` | Stage 8 maths: edit-distance similarity, cosine similarity, edges |
| `src/lib/data.ts` | Loads the data files; embedding-row lookup (stage 7) |
| `src/components/Stage.tsx` | Frame for each stage: number, colour, title, explanation |
| `src/components/VocabPanel.tsx` | Stage 1: searchable vocabulary grid |
| `src/components/TokenStages.tsx` | Stages 2–6 UI, including the animated BPE merges |
| `src/components/VectorsStage.tsx` | Stage 7: embedding heatmap strips |
| `src/components/GraphStage.tsx` | Stage 8: two 3D force graphs with shared hover |
| `src/components/ui/` | shadcn/ui and Magic UI components (owned copies) |

## Rebuilding the data

```bash
python -m venv venv && source venv/bin/activate
pip install torch --index-url https://download.pytorch.org/whl/cpu
pip install sentence-transformers datasets numpy
python scripts/build_data.py   # about 5 minutes; BPE training is pure Python
```

Change `N_WORDS`, `N_MERGES` or the `EVERYDAY` list at the top of the script to change the vocabulary.

## Stack

React + Vite + TypeScript, Tailwind, shadcn/ui, Magic UI (animated beam, number ticker), Motion, react-force-graph-3d (three.js). Embeddings: `sentence-transformers/all-MiniLM-L6-v2`.

## Notes

- The tokenizer is a teaching tokenizer: whole words first, BPE for the rest. Real GPT-style tokenizers run byte-level BPE on everything.
- Meaning-graph vectors come from a small sentence model, not from an LLM's own input embeddings.
