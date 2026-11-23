import { useEffect, useState } from 'react'
import { Tokenizer, type Merge, type Vocab } from './tokenizer'

export interface EmbeddingTable {
  model: string
  dims: number
  /** Stage 7: token ID -> its row of the embedding matrix. */
  vector(id: number): Float32Array
}

export interface PipelineData {
  tokenizer: Tokenizer
  idToToken: string[]
  merges: Merge[]
  embeddings: EmbeddingTable
}

const base = `${import.meta.env.BASE_URL}data/`

export async function loadData(): Promise<PipelineData> {
  const [vocab, merges, meta, bin] = await Promise.all([
    fetch(base + 'vocab.json').then((r) => r.json() as Promise<Vocab>),
    fetch(base + 'merges.json').then((r) => r.json() as Promise<Merge[]>),
    fetch(base + 'embeddings.meta.json').then((r) => r.json()),
    fetch(base + 'embeddings.b64.txt').then((r) => r.text()),
  ])
  // int8 matrix stored as base64 text: decode to bytes, read as signed.
  const raw = atob(bin.trim())
  const q = new Int8Array(raw.length)
  for (let i = 0; i < raw.length; i++) q[i] = (raw.charCodeAt(i) << 24) >> 24
  const { dims, scale, model } = meta as { dims: number; scale: number; model: string }
  const idToToken: string[] = []
  for (const [t, id] of Object.entries(vocab)) idToToken[id] = t
  return {
    tokenizer: new Tokenizer(vocab, merges),
    idToToken,
    merges,
    embeddings: {
      model,
      dims,
      vector(id) {
        const out = new Float32Array(dims)
        const off = id * dims
        for (let i = 0; i < dims; i++) out[i] = q[off + i] / scale
        return out
      },
    },
  }
}

export function usePipelineData() {
  const [data, setData] = useState<PipelineData | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    loadData().then(setData, (e) => setError(String(e)))
  }, [])
  return { data, error }
}

/** A word's vector: its own row if it's one token, else the mean of its tokens' rows. */
export function wordVector(data: PipelineData, ids: number[]): number[] {
  const out = new Array(data.embeddings.dims).fill(0)
  for (const id of ids) {
    const v = data.embeddings.vector(id)
    for (let i = 0; i < v.length; i++) out[i] += v[i] / ids.length
  }
  return out
}
