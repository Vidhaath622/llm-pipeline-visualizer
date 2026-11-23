import { useCallback, useEffect, useState } from 'react'

const KEY = 'lpv-learned-words'
const MAX = 500

function load(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '[]')
    return Array.isArray(v) ? v.filter((w) => typeof w === 'string' && /^[a-z]+$/.test(w)) : []
  } catch {
    return []
  }
}

/**
 * Words added to the vocabulary while the app runs, in the order they were
 * added (that order decides their IDs). Saved in this browser only.
 */
export function useLearnedWords() {
  const [learned, setLearned] = useState<string[]>(load)
  const [enabled, setEnabled] = useState(true)

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(learned))
    } catch {
      /* storage unavailable: learning still works for this visit */
    }
  }, [learned])

  const add = useCallback((words: string[]) => {
    setLearned((prev) => {
      const next = [...prev]
      for (const w of words) if (!next.includes(w) && next.length < MAX) next.push(w)
      return next.length === prev.length ? prev : next
    })
  }, [])

  // Removing a word renumbers the ones after it, like rebuilding a vocabulary.
  const remove = useCallback((word: string) => setLearned((prev) => prev.filter((w) => w !== word)), [])
  const reset = useCallback(() => setLearned([]), [])

  return { learned, enabled, setEnabled, add, remove, reset }
}
