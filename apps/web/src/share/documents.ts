import { formatDay, monthTitle } from '../calendar/dates'
import type { ClosedDate, Service } from '../calendar/model'
import type { Entry } from '../setlist/setlist-api'

/**
 * Compartible documents without a library. Their content is plain data (`PaperDoc`); the screen shows it as HTML
 * (and prints it for the PDF), and `docToPng` draws the same lines on a canvas for the image. Documents are
 * always light, as if printed, whatever theme the app uses.
 */
export type PaperRow = { lead: string; text: string; muted?: boolean }
export type PaperDoc = { title: string; meta: string; rows: PaperRow[]; foot?: string }

const SLOT_TEXT = { SINGLE: '', MORNING: ' · mañana', AFTERNOON: ' · tarde' } as const
const SLOT_ORDER = { SINGLE: 0, MORNING: 1, AFTERNOON: 2 } as const

/** La fecha y las canciones numeradas, cada una con su autor entre paréntesis; los momentos no son canciones. */
export function setlistDoc({ church, date, entries }: { church: string; date: string; entries: ReadonlyArray<Entry> }): PaperDoc {
  const songs = entries.flatMap((entry) => (entry.song ? [entry.song] : []))
  return { title: `Setlist · ${formatDay(date)}`, meta: church, rows: songs.map((song, index) => ({ lead: String(index + 1), text: `${song.title} (${song.author})` })) }
}

/** Un mes se nombra por el mes; un rango que cruza meses, por sus dos fechas. */
export function periodLabel(from: string, to: string) {
  return from.slice(0, 7) === to.slice(0, 7) ? monthTitle(from.slice(0, 7)) : `${formatDay(from)} a ${formatDay(to)}`
}

/** «Rol alabanza»: una línea por fecha con su director, las fechas sin culto como tales y un mensaje opcional al pie. */
export function rotaDoc({ from, to, services, closed, message }: {
  from: string; to: string; services: ReadonlyArray<Service>; closed: ReadonlyArray<ClosedDate>; message: string
}): PaperDoc {
  const inRange = (date: string) => date >= from && date <= to
  const lines = [
    ...services.filter((service) => service.status !== 'CANCELLED' && inRange(service.date))
      .map((service) => ({ date: service.date, order: SLOT_ORDER[service.slot], row: { lead: `${formatDay(service.date)}${SLOT_TEXT[service.slot]}`, text: service.director.name } as PaperRow })),
    ...closed.filter((item) => inRange(item.date))
      .map((item) => ({ date: item.date, order: 0, row: { lead: formatDay(item.date), text: item.reason ? `No hay culto · ${item.reason}` : 'No hay culto', muted: true } as PaperRow })),
  ].sort((a, b) => a.date.localeCompare(b.date) || a.order - b.order)
  const foot = message.trim()
  return { title: 'Rol alabanza', meta: periodLabel(from, to), rows: lines.map((line) => line.row), ...(foot ? { foot } : {}) }
}

export const fileName = (kind: string, stamp: string) => `${kind}-${stamp}.png`

export type Measure = (text: string, font?: string) => number

/** Ajusta el texto al ancho por palabras; una palabra más ancha que la línea se parte, nunca se recorta. */
export function wrapLines(text: string, maxWidth: number, measure: Measure, font?: string): string[] {
  const lines: string[] = []
  let line = ''
  for (const word of text.split(/\s+/).filter(Boolean)) {
    let rest = word
    while (measure(rest, font) > maxWidth && rest.length > 1) {
      if (line) { lines.push(line); line = '' }
      let cut = rest.length - 1
      while (cut > 1 && measure(rest.slice(0, cut), font) > maxWidth) cut -= 1
      lines.push(rest.slice(0, cut))
      rest = rest.slice(cut)
    }
    const candidate = line ? `${line} ${rest}` : rest
    if (line && measure(candidate, font) > maxWidth) { lines.push(line); line = rest } else line = candidate
  }
  if (line || lines.length === 0) lines.push(line)
  return lines
}

const FAMILY = "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
const WIDTH = 1080
const PAD = 72
const LINE = 60
const fonts = { title: `700 64px ${FAMILY}`, meta: `400 36px ${FAMILY}`, row: `400 44px ${FAMILY}`, lead: `600 44px ${FAMILY}`, foot: `italic 400 38px ${FAMILY}` }
const colors = { ink: '#111111', soft: '#555555', muted: '#6b6b6b' }

export type Op = { text: string; x: number; y: number; font: string; color: string }

/** Coloca cada línea del documento; el alto sale del contenido. */
export function layout(doc: PaperDoc, measure: Measure): { width: number; height: number; ops: Op[] } {
  const ops: Op[] = []
  let y = PAD + 56
  ops.push({ text: doc.title, x: PAD, y, font: fonts.title, color: colors.ink })
  y += 58
  ops.push({ text: doc.meta, x: PAD, y, font: fonts.meta, color: colors.soft })
  y += 28
  const leadWidth = doc.rows.length === 0 ? 0 : Math.min(Math.max(...doc.rows.map((row) => measure(row.lead, fonts.lead))) + 36, (WIDTH - 2 * PAD) / 2)
  const textX = PAD + leadWidth
  for (const row of doc.rows) {
    const lines = wrapLines(row.text, WIDTH - PAD - textX, measure, fonts.row)
    y += LINE
    ops.push({ text: row.lead, x: PAD, y, font: fonts.lead, color: row.muted ? colors.muted : colors.soft })
    lines.forEach((text, index) => ops.push({ text, x: textX, y: y + index * LINE, font: fonts.row, color: row.muted ? colors.muted : colors.ink }))
    y += (lines.length - 1) * LINE + 10
  }
  if (doc.foot) {
    y += 36
    wrapLines(doc.foot, WIDTH - 2 * PAD, measure, fonts.foot).forEach((text, index) => ops.push({ text, x: PAD, y: y + LINE * (index + 1) - 14, font: fonts.foot, color: colors.soft }))
    y += LINE * wrapLines(doc.foot, WIDTH - 2 * PAD, measure, fonts.foot).length
  }
  return { width: WIDTH, height: y + PAD, ops }
}

/** Dibuja el documento en un canvas blanco y lo entrega como PNG; sin canvas es un error, nunca una imagen en blanco. */
export function docToPng(doc: PaperDoc): Promise<Blob> {
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')
  if (!context) return Promise.reject(new Error('Canvas no disponible'))
  const placed = layout(doc, (text, font) => { if (font) context.font = font; return context.measureText(text).width })
  canvas.width = placed.width
  canvas.height = placed.height
  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, placed.width, placed.height)
  context.textBaseline = 'alphabetic'
  for (const op of placed.ops) {
    context.font = op.font
    context.fillStyle = op.color
    context.fillText(op.text, op.x, op.y)
  }
  return new Promise((resolve, reject) => canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('No se pudo crear la imagen'))), 'image/png'))
}

/** Descarga un archivo generado en el navegador, sin pasar por el servidor. */
export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = name
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
