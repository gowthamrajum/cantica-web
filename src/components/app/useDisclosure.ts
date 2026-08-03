import { useState } from 'react'

/** Tracks which sections are open, by key. */
export function useDisclosure(initial: string[] = []): {
  isOpen: (key: string) => boolean
  toggle: (key: string) => void
  setOpen: (key: string, open: boolean) => void
} {
  const [open, setOpenSet] = useState<Set<string>>(() => new Set(initial))
  return {
    isOpen: (key) => open.has(key),
    toggle: (key) =>
      setOpenSet((s) => {
        const n = new Set(s)
        if (n.has(key)) n.delete(key)
        else n.add(key)
        return n
      }),
    setOpen: (key, next) =>
      setOpenSet((s) => {
        const n = new Set(s)
        if (next) n.add(key)
        else n.delete(key)
        return n
      })
  }
}
