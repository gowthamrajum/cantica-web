import { useRef, useState } from 'react'
import { Icon } from './Icons'
import { uploadMedia } from '../../lib/mediaUpload'

const mb = (n: number): string => `${Math.round(n / 1048576)} MB`

/**
 * Pick a file off this phone and put it where the projection machine can get it.
 *
 * The bar is real — it follows the request body, not a timer — because the one
 * thing that makes an upload feel broken is a church uplink pushing a hundred
 * megabytes behind a spinner that says nothing.
 */
export function MediaUploadFields({
  maxBytes,
  onUploaded,
  onCancel
}: {
  maxBytes: number
  onUploaded: (url: string, name: string) => void
  onCancel: () => void
}): JSX.Element {
  const input = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [pct, setPct] = useState(0)
  const [error, setError] = useState('')

  const tooBig = !!file && maxBytes > 0 && file.size > maxBytes

  const go = async (): Promise<void> => {
    if (!file || tooBig) return
    setBusy(true)
    setError('')
    setPct(0)
    const res = await uploadMedia(file, (f) => setPct(Math.round(f * 100)))
    setBusy(false)
    if (res.ok) onUploaded(res.url, name.trim() || res.name.replace(/\.[a-z0-9]+$/i, ''))
    else setError(res.message)
  }

  return (
    <div className="px-[var(--gutter)] pb-1">
      <input
        ref={input}
        type="file"
        accept="video/*,image/*,audio/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0] ?? null
          setFile(f)
          setError('')
          if (f && !name) setName(f.name.replace(/\.[a-z0-9]+$/i, ''))
        }}
      />

      <button
        type="button"
        className="app-card pressable mb-3 flex w-full items-center gap-3 p-4 text-left"
        onClick={() => input.current?.click()}
        disabled={busy}
      >
        <span className="grid h-10 w-10 flex-none place-items-center rounded-xl bg-navy-700 text-gold-300">
          <Icon name="watch" size={19} strokeWidth={2.1} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="list-title block truncate">{file ? file.name : 'Choose a file'}</span>
          <span className="list-sub block">
            {file ? mb(file.size) : `A video, photo or audio track${maxBytes ? ` — up to ${mb(maxBytes)}` : ''}`}
          </span>
        </span>
        <Icon name="chevron" size={17} className="list-chev" />
      </button>

      {file && (
        <label className="mb-3 block">
          <span className="list-label">Name it</span>
          <input
            className="search-field mt-1 w-full"
            type="text"
            placeholder="Shown in the order"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={busy}
          />
        </label>
      )}

      {busy && (
        <div className="mb-3">
          <div className="h-2 w-full overflow-hidden rounded-full bg-line">
            <div
              className="h-full rounded-full bg-gold-500 transition-[width] duration-200"
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="mt-1.5 text-[13px] text-ink-muted">Uploading… {pct}%</p>
        </div>
      )}

      {tooBig && (
        <p className="mb-3 text-[13px] leading-relaxed text-amber-700">
          That file is {mb(file.size)} — the limit is {mb(maxBytes)}. A shorter clip, or one exported smaller, will
          go.
        </p>
      )}
      {error && <p className="mb-3 text-[13px] leading-relaxed text-amber-700">{error}</p>}

      <button
        className="btn-app btn-app-primary btn-block"
        disabled={!file || busy || tooBig}
        onClick={() => void go()}
      >
        {busy ? 'Uploading…' : 'Upload and add it'}
      </button>
      <button className="btn-app btn-app-quiet btn-block mt-2 text-[15px]" onClick={onCancel} disabled={busy}>
        Cancel
      </button>
    </div>
  )
}
