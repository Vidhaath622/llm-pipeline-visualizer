import { forwardRef, type ReactNode } from 'react'
import { motion } from 'motion/react'
import { cn } from '@/lib/utils'

interface StageProps {
  n: number
  title: string
  blurb: string
  color: string // css var name, e.g. "--s3"
  visible: boolean
  children: ReactNode
  aside?: ReactNode
}

/**
 * One row of the pipeline. The numbered dot on the left is what the animated
 * beams connect, so it's exposed through `ref`.
 */
export const Stage = forwardRef<HTMLDivElement, StageProps>(function Stage(
  { n, title, blurb, color, visible, children, aside },
  dotRef,
) {
  return (
    <section
      className="relative grid grid-cols-[2.5rem_1fr] gap-x-5 md:grid-cols-[3rem_1fr] md:gap-x-8"
      style={{ ['--stage' as string]: `var(${color})` }}
    >
      <div className="flex justify-center pt-1">
        <div
          ref={dotRef}
          className={cn(
            'z-10 flex size-9 items-center justify-center rounded-full border font-mono text-sm transition-colors duration-500',
            visible
              ? 'border-[var(--stage)] bg-background text-[var(--stage)]'
              : 'border-border bg-background text-muted-foreground',
          )}
        >
          {n}
        </div>
      </div>
      <motion.div
        initial={false}
        animate={{ opacity: visible ? 1 : 0.18, filter: visible ? 'blur(0px)' : 'blur(2px)' }}
        transition={{ duration: 0.45 }}
        className={cn('min-w-0 pb-14', !visible && 'pointer-events-none select-none')}
      >
        <header className="mb-4 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">
              <span className="text-[var(--stage)]">{title}</span>
            </h2>
            <p className="max-w-[60ch] text-sm text-muted-foreground">{blurb}</p>
          </div>
          {aside}
        </header>
        {children}
      </motion.div>
    </section>
  )
})
