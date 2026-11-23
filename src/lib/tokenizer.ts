// The tokenizer core. Pure functions, no React, so it can be tested on its own.
//
// Pipeline:  text -> words -> (in vocab? keep : BPE split) -> tokens -> IDs
//
// The vocabulary can grow: words learned while the app runs get IDs after the
// base vocabulary (baseSize, baseSize + 1, ...), in the order they were learned.

export type Vocab = Record<string, number>
export type Merge = [string, string]

/** One BPE step for one word: the symbols before, and which pair was glued. */
export interface MergeStep {
  symbols: string[]
  merged: Merge | null // null on the first step (plain letters)
}

export interface WordResult {
  word: string
  inVocab: boolean // stage 3: was the whole word already a token?
  learned: boolean // in vocab only because it was added at runtime
  steps: MergeStep[] // stage 4: BPE history (empty for base-vocab words)
  bpeTokens: string[] // what BPE gives (for a learned word: what it replaced)
  tokens: string[] // stage 5
  ids: number[] // stage 6
}

export interface TokenizeResult {
  normalized: string
  words: WordResult[]
  tokens: string[]
  ids: number[]
}

export class Tokenizer {
  vocab: Vocab
  /** Number of tokens in the trained vocabulary; learned IDs start here. */
  baseSize: number
  learned: string[]
  private ranks: Map<string, number>
  private unkId: number

  constructor(baseVocab: Vocab, merges: Merge[], learned: string[] = []) {
    this.baseSize = Math.max(...Object.values(baseVocab)) + 1
    this.learned = learned.filter((w) => !(w in baseVocab))
    this.vocab = { ...baseVocab }
    this.learned.forEach((w, i) => (this.vocab[w] = this.baseSize + i))
    // A merge's rank is its position in the list: lower = learned earlier = applied first.
    this.ranks = new Map(merges.map(([a, b], i) => [`${a} ${b}`, i]))
    this.unkId = baseVocab['[UNK]'] ?? 1
  }

  /** Stage 2: lowercase, keep only letters and spaces. */
  normalize(text: string): string {
    return text.toLowerCase().replace(/[^a-z\s]/g, ' ').replace(/\s+/g, ' ').trim()
  }

  /** Stage 4: Byte Pair Encoding for one word, recording every merge. */
  bpe(word: string): MergeStep[] {
    let symbols = word.split('')
    const steps: MergeStep[] = [{ symbols: [...symbols], merged: null }]
    while (symbols.length > 1) {
      // Find the adjacent pair with the best (lowest) rank.
      let bestRank = Infinity
      let bestIdx = -1
      for (let i = 0; i < symbols.length - 1; i++) {
        const r = this.ranks.get(`${symbols[i]} ${symbols[i + 1]}`)
        if (r !== undefined && r < bestRank) {
          bestRank = r
          bestIdx = i
        }
      }
      if (bestIdx === -1) break // no known pair left
      const pair: Merge = [symbols[bestIdx], symbols[bestIdx + 1]]
      symbols = [...symbols.slice(0, bestIdx), pair[0] + pair[1], ...symbols.slice(bestIdx + 2)]
      steps.push({ symbols: [...symbols], merged: pair })
    }
    return steps
  }

  isLearnedId(id: number): boolean {
    return id >= this.baseSize
  }

  /** Stage 6: token -> integer ID. */
  toId(token: string): number {
    return this.vocab[token] ?? this.unkId
  }

  tokenize(text: string): TokenizeResult {
    const normalized = this.normalize(text)
    const words = normalized ? normalized.split(' ') : []
    const results: WordResult[] = words.map((word) => {
      // Stage 3: the vocabulary check.
      const id = this.vocab[word]
      if (id !== undefined && !this.isLearnedId(id)) {
        return { word, inVocab: true, learned: false, steps: [], bpeTokens: [word], tokens: [word], ids: [id] }
      }
      const steps = this.bpe(word)
      const bpeTokens = steps[steps.length - 1].symbols
      if (id !== undefined) {
        // Learned at runtime: now a single token, but keep what BPE would have done.
        return { word, inVocab: true, learned: true, steps, bpeTokens, tokens: [word], ids: [id] }
      }
      return {
        word,
        inVocab: false,
        learned: false,
        steps,
        bpeTokens,
        tokens: bpeTokens,
        ids: bpeTokens.map((t) => this.toId(t)),
      }
    })
    return {
      normalized,
      words: results,
      tokens: results.flatMap((r) => r.tokens),
      ids: results.flatMap((r) => r.ids),
    }
  }
}
