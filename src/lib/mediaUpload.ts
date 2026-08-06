import { RELAY_BASE } from './relay'

/**
 * Putting a file from this phone into Sunday's order.
 *
 * The file does NOT pass through the relay. The relay signs a one-off URL and
 * the browser uploads straight to the store, which is what makes a 200 MB clip
 * cost the relay nothing but a signature — and is why progress can be reported
 * honestly here rather than guessed at.
 *
 * All of it is optional. Where no store is configured `mediaConfig` answers
 * `enabled: false` and the app offers a link instead, which needs no storage at
 * all and covers most of what actually goes in a service.
 */

export interface MediaConfig {
  enabled: boolean
  maxBytes: number
}

export async function mediaConfig(): Promise<MediaConfig> {
  try {
    const r = await fetch(`${RELAY_BASE}/media/config`, { cache: 'no-store' })
    if (!r.ok) return { enabled: false, maxBytes: 0 }
    const j = (await r.json()) as Partial<MediaConfig>
    return { enabled: !!j.enabled, maxBytes: Number(j.maxBytes) || 0 }
  } catch {
    // Offline is not "no media store"; it is "we cannot tell". Either way the
    // upload can't happen now, so the answer is the same.
    return { enabled: false, maxBytes: 0 }
  }
}

export type UploadResult =
  | { ok: true; url: string; name: string }
  | { ok: false; message: string }

/**
 * Upload one file and hand back the URL it will be readable at.
 *
 * XHR rather than fetch, for the one thing fetch still cannot do: report how
 * far a request body has got. A church uplink pushing a 200 MB clip needs a bar
 * that moves, or it reads as having hung.
 */
export async function uploadMedia(
  file: File,
  onProgress?: (fraction: number) => void
): Promise<UploadResult> {
  let signed: { uploadUrl: string; publicUrl: string }
  try {
    const r = await fetch(`${RELAY_BASE}/media/upload-url`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: file.name, contentType: file.type, size: file.size })
    })
    const j = (await r.json().catch(() => ({}))) as { message?: string; uploadUrl?: string; publicUrl?: string }
    if (!r.ok || !j.uploadUrl || !j.publicUrl) {
      return { ok: false, message: j.message || 'That file couldn’t be accepted.' }
    }
    signed = { uploadUrl: j.uploadUrl, publicUrl: j.publicUrl }
  } catch {
    return { ok: false, message: 'Could not reach the media store. Check your connection.' }
  }

  return new Promise<UploadResult>((resolve) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', signed.uploadUrl, true)
    if (file.type) xhr.setRequestHeader('Content-Type', file.type)
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(e.loaded / e.total)
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress?.(1)
        resolve({ ok: true, url: signed.publicUrl, name: file.name })
      } else {
        // The commonest cause by far, and the one nobody guesses: the bucket
        // has to allow PUT from this origin, and that is set on the bucket.
        resolve({
          ok: false,
          message:
            xhr.status === 0
              ? 'The upload was blocked by the media store. Its CORS settings need to allow PUT from this site.'
              : `The media store refused the upload (HTTP ${xhr.status}).`
        })
      }
    }
    xhr.onerror = () =>
      resolve({
        ok: false,
        message: 'The upload was blocked by the media store. Its CORS settings need to allow PUT from this site.'
      })
    xhr.onabort = () => resolve({ ok: false, message: 'Upload cancelled.' })
    xhr.send(file)
  })
}
