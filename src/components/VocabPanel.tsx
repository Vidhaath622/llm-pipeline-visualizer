import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { RotateCcw, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Switch } from '@/components/ui/switch'
import type { PipelineData } from '@/lib/data'

type Filter = 'all' | 'used' | 'words' | 'pieces' | 'learned'
const PAGE = 360

interface Props {
  data: PipelineData
  used: Set<string>
  justAdded: string[]
  learning: boolean
  setLearning: (on: boolean) => void
  onRemove: (word: string) => void
  onReset: () => void
}

/**
 * Stage 1: the vocabulary. Every token the model knows, with its ID.
 * Tokens used by the current sentence are highlighted; words learned while
 * typing are listed first, since they sit at the very end of the ID range.
 */
export function VocabPanel({ data, used, justAdded, learning, setLearning, onRemove, onReset }: Props) {
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [limit, setLimit] = useState(PAGE)

  const all = data.idToToken
  const { baseSize, learned } = data.tokenizer

  // The trained vocab is in order: specials, letters, whole words, then BPE pieces.
  // So the pieces are the trailing run of trained IDs that BPE merges produced.
  const pieceStart = useMemo(() => {
    const products = new Set(data.merges.map(([a, b]) => a + b))
    let i = baseSize
    while (i > 0 && products.has(all[i - 1])) i--
    return i
  }, [data.merges, all, baseSize])

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return all
      .map((t, id) => ({ t, id }))
      .filter(({ t, id }) => {
        if (needle && !t.includes(needle)) return false
        if (filter === 'used') return used.has(t)
        if (filter === 'learned') return id >= baseSize
        if (filter === 'pieces') return id >= pieceStart && id < baseSize
        if (filter === 'words') return id < pieceStart && t.length > 1 && !t.startsWith('[')
        return true
      })
  }, [all, q, filter, used, pieceStart, baseSize])

  const filters: [Filter, string][] = [
    ['all', `All ${all.length.toLocaleString()}`],
    ['used', `In your text ${used.size}`],
    ['words', 'Whole words'],
    ['pieces', 'Subword pieces'],
    ['learned', `Learned ${learned.length}`],
  ]

  return (
    <div className="rounded-lg border bg-card/60">
      {/* Learning controls + the words added so far */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b px-3 py-2.5">
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={learning} onCheckedChange={setLearning} />
          Learn new words
        </label>
        <span className="text-xs text-muted-foreground">
          {learning ? 'Unknown words you type are added here.' : 'Off: unknown words stay split into pieces.'}
        </span>
        {learned.length > 0 && (
          <button
            onClick={onReset}
            className="ml-auto inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <RotateCcw className="size-3" /> Reset to trained vocabulary
          </button>
        )}
      </div>
      {learned.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 border-b px-3 py-2.5">
          <span className="mr-1 text-xs text-muted-foreground">Learned:</span>
          <AnimatePresence>
            {learned.map((w) => (
              <motion.span
                key={w}
                layout
                initial={{ opacity: 0, scale: 0.6 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.6 }}
                transition={{ type: 'spring', stiffness: 380, damping: 26 }}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-md border border-[var(--s1)]/50 bg-[var(--s1)]/12 py-0.5 pr-0.5 pl-2 font-mono text-xs text-[var(--s1)]',
                  justAdded.includes(w) && 'ring-2 ring-[var(--s1)]/60',
                )}
              >
                {w}
                <span className="opacity-60 tabular-nums">{data.tokenizer.vocab[w]}</span>
                <button
                  onClick={() => onRemove(w)}
                  aria-label={`Remove ${w} from the vocabulary`}
                  className="rounded p-0.5 opacity-60 hover:bg-[var(--s1)]/20 hover:opacity-100"
                >
                  <X className="size-3" />
                </button>
              </motion.span>
            ))}
          </AnimatePresence>
        </div>
      )}

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
        <div className="flex flex-wrap gap-1 text-xs">
          {filters.map(([f, label]) => (
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
        <span className="ml-auto font-mono text-xs text-muted-foreground">{rows.length.toLocaleString()} shown</span>
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
            <span
              className={cn('truncate', t.startsWith('[') && 'text-muted-foreground', id >= baseSize && 'text-[var(--s1)]')}
            >
              {t}
            </span>
            <span className="text-muted-foreground tabular-nums">{id}</span>
          </div>
        ))}
        {rows.length === 0 && (
          <p className="col-span-full bg-card px-3 py-4 text-xs text-muted-foreground">
            {filter === 'learned' ? 'No learned words yet. Type a word the vocabulary doesn’t know.' : 'No matches.'}
          </p>
        )}
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
