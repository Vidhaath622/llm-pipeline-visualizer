import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import ForceGraph3D, { type ForceGraphMethods } from 'react-force-graph-3d'
import SpriteText from 'three-spritetext'
// @ts-expect-error d3-force-3d ships without types
import { forceX, forceY, forceZ } from 'd3-force-3d'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { buildLinks, cosine, spellingSimilarity, type GraphLink } from '@/lib/similarity'
import { wordVector, type PipelineData } from '@/lib/data'
import type { TokenizeResult } from '@/lib/tokenizer'

// Comparison words chosen so the two graphs disagree: "cat" is spelled like
// "cap"/"car" but means something like "dog"/"kitten".
export const COMPARE = [
  'cat', 'cap', 'car', 'can', 'kitten', 'dog', 'puppy', 'bus', 'truck', 'king', 'kind', 'queen',
  'happy', 'glad', 'sad', 'hot', 'cold', 'read', 'red', 'bed', 'chair', 'tea', 'coffee',
]

const SPELL = 'oklch(0.8 0.13 60)'
const MEANING = 'oklch(0.8 0.1 200)'

interface Props {
  data: PipelineData
  result: TokenizeResult
}

/**
 * Stage 8: the same words in two 3D graphs. Left: an edge means "spelled alike"
 * (edit distance). Right: an edge means "vectors point the same way" (cosine).
 */
export function GraphStage({ data, result }: Props) {
  const [withCompare, setWithCompare] = useState(true)
  const [spellT, setSpellT] = useState(0.6)
  const [meanT, setMeanT] = useState(0.5)
  const [hovered, setHovered] = useState<string | null>(null)

  // Words in the graph, each with the token IDs that make it up.
  const words = useMemo(() => {
    const m = new Map<string, number[]>()
    for (const w of result.words) m.set(w.word, w.ids)
    if (withCompare)
      for (const w of COMPARE) if (!m.has(w)) m.set(w, data.tokenizer.tokenize(w).ids)
    return [...m.entries()].slice(0, 40)
  }, [result, withCompare, data])

  const fromSentence = useMemo(() => new Set(result.words.map((w) => w.word)), [result])
  const vecs = useMemo(() => new Map(words.map(([w, ids]) => [w, wordVector(data, ids)])), [words, data])
  const names = words.map(([w]) => w)
  const spellLinks = useMemo(() => buildLinks(names, spellingSimilarity, spellT), [names.join(), spellT])
  const meanLinks = useMemo(
    () => buildLinks(names, (a, b) => cosine(vecs.get(a)!, vecs.get(b)!), meanT),
    [names.join(), meanT, vecs],
  )

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-x-8 gap-y-3 text-sm">
        <label className="flex items-center gap-2">
          <Switch checked={withCompare} onCheckedChange={setWithCompare} />
          <span className="text-muted-foreground">Add comparison words (cat, cap, dog…)</span>
        </label>
        <span className="font-mono text-xs text-muted-foreground">
          {hovered ? `hovering "${hovered}"` : 'Drag to rotate · scroll to zoom · hover a word'}
        </span>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <GraphPanel
          title="Spelling-based"
          subtitle="Edge = similar letters (edit distance)"
          color={SPELL}
          names={names}
          links={spellLinks}
          threshold={spellT}
          setThreshold={setSpellT}
          hovered={hovered}
          setHovered={setHovered}
          fromSentence={fromSentence}
        />
        <GraphPanel
          title="Meaning-based"
          subtitle="Edge = similar embedding vectors (cosine)"
          color={MEANING}
          names={names}
          links={meanLinks}
          threshold={meanT}
          setThreshold={setMeanT}
          hovered={hovered}
          setHovered={setHovered}
          fromSentence={fromSentence}
        />
      </div>
      <p className="max-w-[75ch] text-xs text-muted-foreground">
        Words from your sentence are bright; comparison words are dim. Multi-token words use the average of their
        tokens' vectors. This shows embedding similarity from a small sentence model, not everything an LLM
        understands.
      </p>
    </div>
  )
}

interface PanelProps {
  title: string
  subtitle: string
  color: string
  names: string[]
  links: GraphLink[]
  threshold: number
  setThreshold: (t: number) => void
  hovered: string | null
  setHovered: (w: string | null) => void
  fromSentence: Set<string>
}

function GraphPanel(p: PanelProps) {
  const box = useRef<HTMLDivElement>(null)
  const fg = useRef<ForceGraphMethods | undefined>(undefined)
  const [width, setWidth] = useState(500)
  useEffect(() => {
    if (!box.current) return
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width))
    ro.observe(box.current)
    return () => ro.disconnect()
  }, [])

  // The force layout mutates node/link objects, so each panel gets its own copies.
  const graph = useMemo(
    () => ({
      nodes: p.names.map((id) => ({ id })),
      links: p.links.map((l) => ({ ...l })),
    }),
    [p.names.join(), p.links],
  )

  // More similar = shorter spring, so clusters pull together.
  useEffect(() => {
    const link = fg.current?.d3Force('link')
    if (link) link.distance((l: GraphLink) => 14 + 70 * (1 - l.weight))
    // Gentler repulsion so unconnected words don't drift off-screen.
    fg.current?.d3Force('charge')?.strength(-30).distanceMax(90)
    // Gravity toward the centre keeps lone words in view.
    fg.current?.d3Force('gx', forceX(0).strength(0.045))
    fg.current?.d3Force('gy', forceY(0).strength(0.045))
    fg.current?.d3Force('gz', forceZ(0).strength(0.045))
    fg.current?.d3ReheatSimulation()
  }, [graph])

  const neighbours = useMemo(() => {
    const n = new Set<string>()
    if (!p.hovered) return n
    for (const l of p.links) {
      if (l.source === p.hovered) n.add(l.target)
      if (l.target === p.hovered) n.add(l.source)
    }
    return n
  }, [p.hovered, p.links])

  const colorOf = useCallback(
    (id: string) => {
      if (id === p.hovered) return '#ffffff'
      if (neighbours.has(id)) return p.color
      if (p.hovered) return '#4a4640'
      return p.fromSentence.has(id) ? '#f1ece2' : '#8f897f'
    },
    [p.hovered, neighbours, p.color, p.fromSentence],
  )

  // The sphere is drawn by the library; this adds a text label floating above it.
  const nodeObject = useCallback(
    (node: { id?: string | number }) => {
      const id = String(node.id)
      const s = new SpriteText(id)
      s.fontFace = 'IBM Plex Mono'
      s.fontWeight = '500'
      s.textHeight = id === p.hovered ? 11 : 8
      s.color = colorOf(id)
      s.position.y = 8
      return s
    },
    [colorOf, p.hovered],
  )

  const linkTouches = (l: { source?: unknown; target?: unknown }) => {
    const s = typeof l.source === 'object' ? (l.source as { id: string }).id : l.source
    const t = typeof l.target === 'object' ? (l.target as { id: string }).id : l.target
    return p.hovered !== null && (s === p.hovered || t === p.hovered)
  }

  return (
    <div className="overflow-hidden rounded-lg border bg-card/60">
      <div className="flex items-start justify-between gap-4 border-b px-4 py-3">
        <div>
          <h3 className="text-sm font-semibold" style={{ color: p.color }}>
            {p.title}
          </h3>
          <p className="text-xs text-muted-foreground">{p.subtitle}</p>
        </div>
        <div className="w-48 shrink-0 space-y-1.5">
          <div className="flex justify-between gap-3 font-mono text-[11px] text-muted-foreground">
            <span>threshold</span>
            <span>
              {p.threshold.toFixed(2)} · {p.links.length} edges
            </span>
          </div>
          <Slider
            value={[p.threshold]}
            min={0.2}
            max={0.95}
            step={0.01}
            onValueChange={([v]) => p.setThreshold(v)}
          />
        </div>
      </div>
      <div ref={box} className="h-[420px]">
        <ForceGraph3D
          ref={fg}
          graphData={graph}
          width={width}
          height={420}
          backgroundColor="rgba(0,0,0,0)"
          showNavInfo={false}
          nodeThreeObject={nodeObject}
          nodeThreeObjectExtend
          nodeRelSize={3}
          nodeVal={(n) => (p.fromSentence.has(String(n.id)) ? 1.6 : 1)}
          nodeColor={(n) => colorOf(String(n.id))}
          nodeOpacity={0.95}
          nodeLabel={() => ''}
          onNodeHover={(n) => p.setHovered(n ? String(n.id) : null)}
          linkColor={(l) => (linkTouches(l) ? p.color : 'rgba(241,236,226,0.55)')}
          linkWidth={(l) => (linkTouches(l) ? 1.6 : 0.7)}
          linkOpacity={0.75}
          linkDirectionalParticles={(l) => (linkTouches(l) ? 3 : 0)}
          linkDirectionalParticleWidth={1.6}
          linkDirectionalParticleColor={() => p.color}
          d3VelocityDecay={0.3}
          cooldownTicks={120}
          onEngineStop={() => fg.current?.zoomToFit(500, 10)}
        />
      </div>
    </div>
  )
}
