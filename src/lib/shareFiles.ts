/**
 * Hand files to the platform's share sheet, or fall back to saving them.
 *
 * `navigator.share` with files is the whole point on a phone — it puts the
 * service into WhatsApp or Mail in one step — but it exists in useful form on
 * roughly iOS Safari and Android Chrome only, and even there it can refuse a
 * particular file type. Desktop browsers mostly cannot share files at all. So
 * every path ends in something: share if the platform will take it, otherwise
 * download.
 */
export type ShareOutcome = 'shared' | 'downloaded' | 'cancelled'

function download(file: File): void {
  const url = URL.createObjectURL(file)
  const a = document.createElement('a')
  a.href = url
  a.download = file.name
  a.click()
  // Revoking immediately can cancel the download in some browsers.
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

export async function shareFiles(files: File[], title: string, text?: string): Promise<ShareOutcome> {
  const nav = navigator as Navigator & {
    canShare?: (data: ShareData) => boolean
    share?: (data: ShareData) => Promise<void>
  }

  if (nav.share && nav.canShare?.({ files })) {
    try {
      await nav.share({ files, title, text })
      return 'shared'
    } catch (e) {
      // A user dismissing the sheet is not a failure, and must not then dump
      // files into their downloads folder behind them.
      if (e instanceof DOMException && e.name === 'AbortError') return 'cancelled'
      // Anything else (a platform refusing the type mid-flight) falls through.
    }
  }

  for (const f of files) download(f)
  return 'downloaded'
}
