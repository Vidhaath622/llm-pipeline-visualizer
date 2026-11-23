import { lazy, Suspense, useMemo, useRef, useState, type RefObject } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { AnimatedBeam } from '@/components/ui/animated-beam'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Stage } from '@/components/Stage'
import { VocabPanel } from '@/components/VocabPanel'
import { IdsStage, SubwordStage, TextStage, TokensStage, VocabCheckStage, DEMOS } from '@/components/TokenStages'
import { VectorsStage } from '@/components/VectorsStage'
import { usePipelineData } from '@/lib/data'

// three.js is large, so the 3D graphs load separately.
const GraphStage = lazy(() => import('@/components/GraphStage').then((m) => ({ default: m.GraphStage })))

const STAGES = [
  { title: 'Vocabulary', color: '--s1', blurb: 'Every token the model knows, each with a fixed integer ID. Built from Wikipedia: common whole words, plus subword pieces learned by BPE.' },
  { title: 'Text', color: '--s2', blurb: 'What you type. It is lowercased and stripped of punctuation before anything else happens.' },
  { title: 'Vocabulary check', color: '--s3', blurb: 'Each word is looked up. A hit is already a token; a miss has to be broken into smaller pieces.' },
  { title: 'Subword tokenization (BPE)', color: '--s4', blurb: 'Unknown words start as letters. The most common neighbouring pair is glued together, again and again, in the order BPE learned them.' },
  { title: 'Tokens', color: '--s5', blurb: 'The final pieces. Outlines group the tokens that came from one word.' },
  { title: 'Token IDs', color: '--s6', blurb: 'Each token is swapped for its ID from the vocabulary. This list of integers is what the model actually receives.' },
  { title: 'Vectors', color: '--s7', blurb: 'Each ID picks one row of the embedding matrix: a list of 384 numbers that places the token in "meaning space".' },
  { title: 'Spelling vs meaning', color: '--s8', blurb: 'The same words, connected two ways. Tokenization only sees letters; embeddings capture what words mean.' },
] as const

export default function App() {
  const { data, error } = usePipelineData()
  const [text, setText] = useState(DEMOS[1])
  const [stepMode, setStepMode] = useState(false)
  const [step, setStep] = useState(1)

  const result = useMemo(() => data?.tokenizer.tokenize(text), [data, text])
  const used = useMemo(() => new Set(result?.tokens ?? []), [result])

  const container = useRef<HTMLDivElement>(null)
  const dots = useRef(STAGES.map(() => ({ current: null as HTMLDivElement | null }))).current

  const visible = (n: number) => !stepMode || n <= step

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 md:px-8 md:py-16">
      <header className="mb-14 flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="mb-2 font-mono text-xs tracking-widest text-muted-foreground uppercase">
            text → tokens → numbers
          </p>
          <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">LLM Pipeline Visualizer</h1>
          <p className="mt-2 max-w-[56ch] text-muted-foreground">
            Follow a sentence from plain text to the vectors a language model works with.
          </p>
        </div>
        <div className="flex items-center gap-3 rounded-lg border bg-card/60 px-3 py-2">
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={stepMode} onCheckedChange={(v) => { setStepMode(v); setStep(1) }} />
            Step through
          </label>
          {stepMode && (
            <div className="flex items-center gap-1 border-l pl-3">
              <Button size="icon-sm" variant="ghost" onClick={() => setStep((s) => Math.max(1, s - 1))} aria-label="Previous stage">
                <ChevronLeft />
              </Button>
              <span className="w-12 text-center font-mono text-xs tabular-nums">
                {step} / {STAGES.length}
              </span>
              <Button size="icon-sm" variant="ghost" onClick={() => setStep((s) => Math.min(STAGES.length, s + 1))} aria-label="Next stage">
                <ChevronRight />
              </Button>
            </div>
          )}
        </div>
      </header>

      {error && <p className="text-destructive">Could not load data: {error}</p>}
      {!data && !error && <p className="font-mono text-sm text-muted-foreground">Loading vocabulary and embeddings…</p>}

      {data && result && (
        <div ref={container} className="relative">
          {STAGES.slice(1).map((_, i) => (
            <AnimatedBeam
              key={i}
              containerRef={container}
              fromRef={dots[i] as RefObject<HTMLElement | null>}
              toRef={dots[i + 1] as RefObject<HTMLElement | null>}
              pathColor="oklch(0.94 0.01 85)"
              pathOpacity={0.1}
              pathWidth={1.5}
              gradientStartColor={`var(${STAGES[i].color})`}
              gradientStopColor={`var(${STAGES[i + 1].color})`}
              duration={3}
              delay={i * 0.35}
              className={visible(i + 2) ? '' : 'opacity-0'}
            />
          ))}

          {STAGES.map((s, i) => {
            const n = i + 1
            return (
              <Stage
                key={s.title}
                ref={(el) => { dots[i].current = el }}
                n={n}
                title={s.title}
                blurb={s.blurb}
                color={s.color}
                visible={visible(n)}
              >
                {n === 1 && <VocabPanel data={data} used={used} />}
                {n === 2 && <TextStage text={text} setText={setText} normalized={result.normalized} />}
                {n === 3 && <VocabCheckStage words={result.words} />}
                {n === 4 && <SubwordStage words={result.words} />}
                {n === 5 && <TokensStage result={result} />}
                {n === 6 && <IdsStage result={result} />}
                {n === 7 && <VectorsStage data={data} result={result} />}
                {n === 8 && (
                  <Suspense fallback={<p className="font-mono text-sm text-muted-foreground">Loading 3D graphs…</p>}>
                    <GraphStage data={data} result={result} />
                  </Suspense>
                )}
              </Stage>
            )
          })}
        </div>
      )}

      <footer className="border-t pt-6 font-mono text-xs text-muted-foreground">
        Toy tokenizer trained on WikiText-103 · embeddings: {data?.embeddings.model ?? '…'}
      </footer>
    </div>
  )
}
