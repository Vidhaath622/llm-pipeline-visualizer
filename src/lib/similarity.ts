// Stage 7 and 8 maths: vectors, and the two ways of saying "these words are alike".

/** Spelling similarity: 1 - (Levenshtein edit distance / longer length). 1 = identical. */
export function spellingSimilarity(a: string, b: string): number {
  const m = a.length
  const n = b.length
  if (!m || !n) return 0
  // dp[j] = edits to turn a[0..i] into b[0..j]
  let prev = Array.from({ length: n + 1 }, (_, j) => j)
  for (let i = 1; i <= m; i++) {
    const cur = [i]
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost)
    }
    prev = cur
  }
  return 1 - prev[n] / Math.max(m, n)
}

/** Meaning similarity: cosine of the angle between two embedding vectors. */
export function cosine(a: number[], b: number[]): number {
  let dot = 0
  let na = 0
  let nb = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    na += a[i] * a[i]
    nb += b[i] * b[i]
  }
  return na && nb ? dot / Math.sqrt(na * nb) : 0
}

export interface GraphLink {
  source: string
  target: string
  weight: number
}

/** Every pair whose similarity clears the threshold becomes an edge. */
export function buildLinks(
  words: string[],
  sim: (a: string, b: string) => number,
  threshold: number,
): GraphLink[] {
  const links: GraphLink[] = []
  for (let i = 0; i < words.length; i++) {
    for (let j = i + 1; j < words.length; j++) {
      const w = sim(words[i], words[j])
      if (w >= threshold) links.push({ source: words[i], target: words[j], weight: w })
    }
  }
  return links
}
