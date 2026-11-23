import { useEffect, useRef, useState } from 'react'
import type { PipelineData } from '@/lib/data'
import type { TokenizeResult } from '@/lib/tokenizer'

const SHOW = 96 // dimensions drawn per row (of 384)

/**
 * Stage 7: each token ID selects one row of the embedding matrix.
 * Each row is drawn as a strip: cool = positive, warm = negative.
 */
export function VectorsStage({ data, result }: { data: PipelineData; result: TokenizeResult }) {
  const [hover, setHover] = useState<{ row: number; dim: number; v: number } | null>(null)
  const { dims, model } = data.embeddings
  const rows = result.ids.slice(0, 24)

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto rounded-lg border bg-card/60 p-3">
        <div className="min-w-[640px] space-y-1">
          {rows.map((id, r) => (
            <div key={`${r}-${id}`} className="grid grid-cols-[7rem_3.5rem_1fr] items-center gap-3">
              <span className="truncate font-mono text-xs">{result.tokens[r]}</span>
              <span className="font-mono text-[11px] text-muted-foreground tabular-nums">#{id}</span>
              <Strip
                values={data.embeddings.vector(id)}
                onHover={(dim, v) => setHover(dim === null ? null : { row: r, dim, v: v! })}
              />
            </div>
          ))}
        </div>
      </div>
      <p className="font-mono text-xs text-muted-foreground">
        {hover
          ? `"${result.tokens[hover.row]}" · dimension ${hover.dim} = ${hover.v.toFixed(3)}`
          : `Showing ${SHOW} of ${dims} numbers per token · vectors from ${model}. Hover a cell.`}
        {result.ids.length > rows.length && ` · first ${rows.length} tokens`}
      </p>
    </div>
  )
}

function Strip({
  values,
  onHover,
}: {
  values: Float32Array
  onHover: (dim: number | null, v?: number) => void
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const c = ref.current
    if (!c) return
    const ctx = c.getContext('2d')!
    c.width = SHOW
    c.height = 1
    const img = ctx.createImageData(SHOW, 1)
    for (let i = 0; i < SHOW; i++) {
      const [r, g, b] = color(values[i])
      img.data.set([r, g, b, 255], i * 4)
    }
    ctx.putImageData(img, 0, 0)
  }, [values])
  return (
    <canvas
      ref={ref}
      className="h-5 w-full rounded-sm [image-rendering:pixelated]"
      onMouseMove={(e) => {
        const rect = e.currentTarget.getBoundingClientRect()
        const dim = Math.min(SHOW - 1, Math.floor(((e.clientX - rect.left) / rect.width) * SHOW))
        onHover(dim, values[dim])
      }}
      onMouseLeave={() => onHover(null)}
    />
  )
}

// Diverging scale around 0. Unit vectors over 384 dims have entries around ±0.15.
function color(v: number): [number, number, number] {
  const t = Math.max(-1, Math.min(1, v / 0.15))
  const base = [40, 37, 34]
  const pos = [110, 200, 225]
  const neg = [240, 140, 110]
  const to = t >= 0 ? pos : neg
  const a = Math.abs(t)
  return base.map((b, i) => Math.round(b + (to[i] - b) * a)) as [number, number, number]
}
