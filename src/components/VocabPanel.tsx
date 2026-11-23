import { useMemo, useState } from 'react'
import { cn } from '@/lib/utils'
import type { PipelineData } from '@/lib/data'

type Filter = 'all' | 'used' | 'words' | 'pieces'
const PAGE = 360

/**
 * Stage 1: the vocabulary. Every token the model knows, with its ID.
 * Tokens used by the current sentence are highlighted.
 */
export function VocabPanel({ data, used }: { data: PipelineData; used: Set<string> }) {
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [limit, setLimit] = useState(PAGE)

  // The vocab is built in order: specials, letters, whole words, then BPE pieces.
  // So the pieces are the trailing run of IDs that BPE merges produced.
  const all = data.idToToken
  const pieceStart = useMemo(() => {
    const products = new Set(data.merges.map(([a, b]) => a + b))
    let i = all.length
    while (i > 0 && products.has(all[i - 1])) i--
    return i
  }, [data, all])

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return all
      .map((t, id) => ({ t, id }))
      .filter(({ t, id }) => {
        if (needle && !t.includes(needle)) return false
        if (filter === 'used') return used.has(t)
        if (filter === 'pieces') return id >= pieceStart
        if (filter === 'words') return id < pieceStart && t.length > 1 && !t.startsWith('[')
        return true
      })
  }, [all, q, filter, used, pieceStart])

  const counts = { all: all.length, used: used.size }

  return (
    <div className="rounded-lg border bg-card/60">
      <div className="flex flex-wrap items-center gap-2 border-b p-3">
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value)
            setLimit(PAGE)
          }}
          placeholder="Search the vocabulary…"
          className="h-8 w-56 rounded-md border bg-background px-2.5 font-mono text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <div className="flex gap-1 text-xs">
          {(
            [
              ['all', `All ${counts.all.toLocaleString()}`],
              ['used', `In your text ${counts.used}`],
              ['words', 'Whole words'],
              ['pieces', 'Subword pieces'],
            ] as [Filter, string][]
          ).map(([f, label]) => (
            <button
              key={f}
              onClick={() => {
                setFilter(f)
                setLimit(PAGE)
              }}
              className={cn(
                'rounded-md px-2.5 py-1 transition-colors',
                filter === f ? 'bg-[var(--s1)] text-background' : 'text-muted-foreground hover:bg-accent',
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <span className="ml-auto font-mono text-xs text-muted-foreground">
          {rows.length.toLocaleString()} shown
        </span>
      </div>
      <div className="grid max-h-72 grid-cols-[repeat(auto-fill,minmax(8.5rem,1fr))] gap-px overflow-y-auto bg-border/40 p-px">
        {rows.slice(0, limit).map(({ t, id }) => (
          <div
            key={id}
            className={cn(
              'flex items-baseline justify-between gap-2 bg-card px-2.5 py-1.5 font-mono text-xs',
              used.has(t) && 'bg-[color-mix(in_oklch,var(--s1)_22%,var(--card))]',
            )}
          >
            <span className={cn('truncate', t.startsWith('[') && 'text-muted-foreground')}>{t}</span>
            <span className="text-muted-foreground tabular-nums">{id}</span>
          </div>
        ))}
      </div>
      {rows.length > limit && (
        <button
          onClick={() => setLimit((l) => l + PAGE * 2)}
          className="w-full border-t py-2 text-xs text-muted-foreground hover:text-foreground"
        >
          Show more ({(rows.length - limit).toLocaleString()} left)
        </button>
      )}
    </div>
  )
}
