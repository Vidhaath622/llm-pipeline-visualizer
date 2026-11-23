// The tokenizer core. Pure functions, no React, so it can be tested on its own.
//
// Pipeline:  text -> words -> (in vocab? keep : BPE split) -> tokens -> IDs

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
  steps: MergeStep[] // stage 4: BPE history (empty when inVocab)
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
  private ranks: Map<string, number>
  private unkId: number

  constructor(vocab: Vocab, merges: Merge[]) {
    this.vocab = vocab
    // A merge's rank is its position in the list: lower = learned earlier = applied first.
    this.ranks = new Map(merges.map(([a, b], i) => [`${a} ${b}`, i]))
    this.unkId = vocab['[UNK]'] ?? 1
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

  /** Stage 6: token -> integer ID. */
  toId(token: string): number {
    return this.vocab[token] ?? this.unkId
  }

  tokenize(text: string): TokenizeResult {
    const normalized = this.normalize(text)
    const words = normalized ? normalized.split(' ') : []
    const results: WordResult[] = words.map((word) => {
      // Stage 3: the vocabulary check.
      if (word in this.vocab) {
        return { word, inVocab: true, steps: [], tokens: [word], ids: [this.toId(word)] }
      }
      const steps = this.bpe(word)
      const tokens = steps[steps.length - 1].symbols
      return { word, inVocab: false, steps, tokens, ids: tokens.map((t) => this.toId(t)) }
    })
    return {
      normalized,
      words: results,
      tokens: results.flatMap((r) => r.tokens),
      ids: results.flatMap((r) => r.ids),
    }
  }
}
