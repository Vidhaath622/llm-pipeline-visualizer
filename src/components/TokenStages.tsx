import { useEffect, useState } from 'react'
import { AnimatePresence, LayoutGroup, motion } from 'motion/react'
import { Check, Play, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { NumberTicker } from '@/components/ui/number-ticker'
import type { TokenizeResult, WordResult } from '@/lib/tokenizer'

export const DEMOS = [
  'The unhappiness of tokenization',
  'My cat chased the dog into the car',
  'Transformers are surprisingly helpful',
  'I lovv chatbots',
]

const chip = 'inline-flex items-center rounded-md border px-2 py-1 font-mono text-sm leading-none'

/* ---------- Stage 2: text ---------- */

export function TextStage({
  text,
  setText,
  normalized,
}: {
  text: string
  setText: (t: string) => void
  normalized: string
}) {
  return (
    <div className="space-y-3">
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        spellCheck={false}
        className="h-12 w-full rounded-lg border bg-card px-4 text-lg outline-none focus-visible:ring-2 focus-visible:ring-[var(--s2)]"
        placeholder="Type a sentence…"
      />
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="text-muted-foreground">Try:</span>
        {DEMOS.map((d) => (
          <button
            key={d}
            onClick={() => setText(d)}
            className="rounded-full border px-2.5 py-1 text-muted-foreground transition-colors hover:border-[var(--s2)] hover:text-foreground"
          >
            {d}
          </button>
        ))}
      </div>
      <p className="font-mono text-sm text-muted-foreground">
        normalized → <span className="text-foreground">"{normalized}"</span>
      </p>
    </div>
  )
}

/* ---------- Stage 3: vocabulary check ---------- */

export function VocabCheckStage({ words }: { words: WordResult[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      <AnimatePresence mode="popLayout">
        {words.map((w, i) => (
          <motion.span
            key={`${i}-${w.word}`}
            layout
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ delay: i * 0.04 }}
            className={cn(
              chip,
              'gap-1.5',
              w.inVocab
                ? 'border-[var(--ok)]/50 bg-[var(--ok)]/10 text-[var(--ok)]'
                : 'border-[var(--miss)]/50 bg-[var(--miss)]/10 text-[var(--miss)]',
            )}
          >
            {w.inVocab ? <Check className="size-3.5" /> : <X className="size-3.5" />}
            {w.word}
          </motion.span>
        ))}
      </AnimatePresence>
      {words.length > 0 && (
        <p className="w-full pt-1 text-xs text-muted-foreground">
          {words.filter((w) => w.inVocab).length} of {words.length} words are already tokens. The{' '}
          <span className="text-[var(--miss)]">red</span> ones go to subword tokenization.
        </p>
      )}
    </div>
  )
}

/* ---------- Stage 4: subword tokenization (BPE) ---------- */

export function SubwordStage({ words }: { words: WordResult[] }) {
  const unknown = words.filter((w) => !w.inVocab)
  const maxSteps = Math.max(0, ...unknown.map((w) => w.steps.length - 1))
  const key = unknown.map((w) => w.word).join(' ')
  const [step, setStep] = useState(0)
  const [playing, setPlaying] = useState(true)

  // Replay from letters whenever the set of unknown words changes.
  useEffect(() => {
    setStep(0)
    setPlaying(true)
  }, [key])

  useEffect(() => {
    if (!playing) return
    if (step >= maxSteps) {
      setPlaying(false)
      return
    }
    const t = setTimeout(() => setStep((s) => s + 1), 550)
    return () => clearTimeout(t)
  }, [playing, step, maxSteps])

  if (!unknown.length)
    return <p className="text-sm text-muted-foreground">Every word was in the vocabulary, so nothing to split.</p>

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 font-mono text-xs text-muted-foreground">
        <button
          onClick={() => {
            setStep(0)
            setPlaying(true)
          }}
          className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 hover:text-foreground"
        >
          <Play className="size-3" /> Replay
        </button>
        <input
          type="range"
          min={0}
          max={maxSteps}
          value={step}
          onChange={(e) => {
            setPlaying(false)
            setStep(+e.target.value)
          }}
          className="w-40 accent-[var(--s4)]"
          aria-label="Merge step"
        />
        <span>
          merge {step} / {maxSteps}
        </span>
      </div>
      <LayoutGroup>
        <div className="space-y-3">
          {unknown.map((w, wi) => {
            const s = w.steps[Math.min(step, w.steps.length - 1)]
            const lastMerged = s.merged ? s.merged[0] + s.merged[1] : null
            const done = step >= w.steps.length - 1
            return (
              <div key={`${wi}-${w.word}`} className="flex flex-wrap items-center gap-3">
                <span className="w-32 shrink-0 truncate font-mono text-sm text-[var(--miss)]">{w.word}</span>
                <div className="flex flex-wrap gap-1">
                  {s.symbols.map((sym, i) => (
                    <motion.span
                      layout
                      key={`${w.word}-${sym}-${i}-${s.symbols.length}`}
                      initial={{ scale: 0.85, opacity: 0.4 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                      className={cn(
                        chip,
                        'border-[var(--s4)]/40',
                        sym === lastMerged && !done
                          ? 'bg-[var(--s4)] text-background'
                          : 'bg-[var(--s4)]/10 text-[var(--s4)]',
                      )}
                    >
                      {sym}
                    </motion.span>
                  ))}
                </div>
                {s.merged && !done && (
                  <span className="font-mono text-xs text-muted-foreground">
                    {s.merged[0]} + {s.merged[1]} → {s.merged[0] + s.merged[1]}
                  </span>
                )}
                {done && <span className="font-mono text-xs text-[var(--ok)]">no more merges</span>}
              </div>
            )
          })}
        </div>
      </LayoutGroup>
    </div>
  )
}

/* ---------- Stage 5: tokens ---------- */

export function TokensStage({ result }: { result: TokenizeResult }) {
  let k = 0
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {result.words.map((w, wi) => (
        <span key={`${wi}-${w.word}`} className="inline-flex gap-px rounded-lg p-0.5 ring-1 ring-border">
          {w.tokens.map((t) => {
            const idx = k++
            return (
              <motion.span
                key={`${idx}-${t}`}
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.03 }}
                className={cn(chip, 'border-transparent bg-[var(--s5)]/12 text-[var(--s5)]')}
              >
                {t}
              </motion.span>
            )
          })}
        </span>
      ))}
      <span className="ml-2 font-mono text-xs text-muted-foreground">
        {result.words.length} words → {result.tokens.length} tokens
      </span>
    </div>
  )
}

/* ---------- Stage 6: token IDs ---------- */

export function IdsStage({ result }: { result: TokenizeResult }) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {result.tokens.map((t, i) => (
          <div
            key={`${i}-${t}-${result.ids[i]}`}
            className="flex min-w-14 flex-col items-center rounded-md border border-[var(--s6)]/40 bg-[var(--s6)]/8 px-2 py-1.5"
          >
            <span className="font-mono text-[11px] text-muted-foreground">{t}</span>
            <NumberTicker
              value={result.ids[i]}
              delay={0.05 * i}
              className="font-mono text-base font-medium tabular-nums text-[var(--s6)]"
            />
          </div>
        ))}
      </div>
      <p className="font-mono text-xs break-all text-muted-foreground">[{result.ids.join(', ')}]</p>
    </div>
  )
}
