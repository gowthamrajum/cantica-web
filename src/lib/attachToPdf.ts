/**
 * Put the service file inside the PDF, so sharing hands over one thing.
 *
 * Two files was two chances to lose one. The sheet reached whoever needed to
 * read from a stand and the .cantica.json reached the projection machine, but
 * they travelled separately and the second is the one that arrived without the
 * first — a service file with no idea what service it is.
 *
 * A PDF can carry files. Every desktop viewer lists them (Preview's sidebar,
 * Acrobat's Attachments pane) and they drag straight out. Phone viewers mostly
 * do not, which is fine: nobody imports a deck into the presenter from a phone.
 *
 * Done as a post-pass rather than at build time because jsPDF cannot attach —
 * no `attach`, no EmbeddedFile, nothing to hook. pdf-lib re-writes the finished
 * document, which costs a parse of a file we just made, and buys not having to
 * hand-write PDF object syntax.
 *
 * Loaded on demand: this runs when somebody taps Share and never otherwise, so
 * it has no business in the bundle everyone downloads to look at a song.
 */
export async function attachToPdf(
  pdf: Blob | ArrayBuffer | Uint8Array,
  file: { name: string; bytes: Uint8Array; mimeType?: string; description?: string }
): Promise<Blob> {
  const { PDFDocument } = await import('pdf-lib')
  const bytes =
    pdf instanceof Blob ? new Uint8Array(await pdf.arrayBuffer()) : pdf instanceof Uint8Array ? pdf : new Uint8Array(pdf)

  const doc = await PDFDocument.load(bytes)
  doc.attach(file.bytes, file.name, {
    mimeType: file.mimeType ?? 'application/json',
    description: file.description ?? 'The service file — import this into Cantica.',
    creationDate: new Date(),
    modificationDate: new Date()
  })
  const out = await doc.save()
  // Copied into a plain ArrayBuffer: the saved bytes may be a view onto a
  // larger buffer, and handing that straight to Blob would carry the whole of
  // it and produce a file that is right but needlessly fat.
  return new Blob([out.slice().buffer as ArrayBuffer], { type: 'application/pdf' })
}
