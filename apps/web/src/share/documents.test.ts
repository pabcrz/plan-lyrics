import { afterEach, expect, test, vi } from 'vitest'
import { docToPng, fileName, layout, periodLabel, rotaDoc, setlistDoc, wrapLines, type PaperDoc } from './documents'

afterEach(() => { vi.restoreAllMocks() })

// Eight pixels per character: enough to check the layout without a real canvas.
const measure = (text: string) => text.length * 8

const song = (id: string, title: string, author: string) => ({ id, kind: 'SONG' as const, song: { id, title, author }, moment: null, key: 'G', link: 'https://youtu.be/ficticio' })
const moment = (id: string, name: string) => ({ id, kind: 'MOMENT' as const, song: null, moment: name, key: null, link: null })

test('the setlist image has the date and only the songs, numbered, each with its author in parentheses', () => {
  const doc = setlistDoc({ church: 'Betel', date: '2026-11-13', entries: [song('a', 'Canción de ejemplo', 'Autora Uno'), moment('m', 'Ofrenda'), song('b', 'Himno ficticio', 'Autor Dos')] })
  expect(doc).toEqual({
    title: 'Setlist · vie 13 nov', meta: 'Betel',
    rows: [{ lead: '1', text: 'Canción de ejemplo (Autora Uno)' }, { lead: '2', text: 'Himno ficticio (Autor Dos)' }],
  })
  // Neither the key nor the reference link is part of the image.
  expect(JSON.stringify(doc)).not.toMatch(/youtu|"G"/)
})

const service = (date: string, over: Record<string, unknown> = {}) => ({ id: date, title: 'Servicio', date, slot: 'SINGLE' as const, time: '19:30', status: 'PUBLISHED' as const, director: { id: 'p', name: 'Ana Torres' }, ...over })

test('the monthly rota is titled «Rol alabanza» with the month, one line per date and «No hay culto» in its place', () => {
  const doc = rotaDoc({
    from: '2026-12-01', to: '2026-12-31', message: '  El Señor es mi luz  ',
    services: [service('2026-12-11', { director: { id: 'q', name: 'Luis Ramírez' } }), service('2026-12-04'), service('2026-12-18', { status: 'CANCELLED' }), service('2027-01-08')],
    closed: [{ date: '2026-12-25', reason: 'Navidad' }, { date: '2026-12-26', reason: null }, { date: '2027-01-01', reason: 'Fuera' }],
  })
  expect(doc).toEqual({
    title: 'Rol alabanza', meta: 'Diciembre 2026',
    rows: [
      { lead: 'vie 4 dic', text: 'Ana Torres' }, { lead: 'vie 11 dic', text: 'Luis Ramírez' },
      { lead: 'vie 25 dic', text: 'No hay culto · Navidad', muted: true }, { lead: 'sáb 26 dic', text: 'No hay culto', muted: true },
    ],
    foot: 'El Señor es mi luz',
  })
})

test('a double Sunday shows both services and a blank message leaves no footer', () => {
  const doc = rotaDoc({ from: '2026-11-01', to: '2026-11-30', message: '   ', closed: [], services: [
    service('2026-11-22', { slot: 'AFTERNOON', director: { id: 'q', name: 'Luis Ramírez' } }), service('2026-11-22', { slot: 'MORNING' }),
  ] })
  expect(doc.rows).toEqual([{ lead: 'dom 22 nov · mañana', text: 'Ana Torres' }, { lead: 'dom 22 nov · tarde', text: 'Luis Ramírez' }])
  expect(doc).not.toHaveProperty('foot')
})

test('the period reads as the month, or as the two dates when it crosses months', () => {
  expect(periodLabel('2026-12-01', '2026-12-31')).toBe('Diciembre 2026')
  expect(periodLabel('2026-12-10', '2026-12-20')).toBe('Diciembre 2026')
  expect(periodLabel('2026-11-20', '2026-12-31')).toBe('vie 20 nov a jue 31 dic')
})

test('file names carry the document and its date, safe for any system', () => {
  expect(fileName('setlist', '2026-11-13')).toBe('setlist-2026-11-13.png')
  expect(fileName('rol-alabanza', '2026-12')).toBe('rol-alabanza-2026-12.png')
})

test('long words and lines wrap inside the width and nothing is cut', () => {
  expect(wrapLines('uno dos tres cuatro', 8 * 8, measure)).toEqual(['uno dos', 'tres', 'cuatro'])
  expect(wrapLines('abcdefghijkl', 5 * 8, measure)).toEqual(['abcde', 'fghij', 'kl'])
  expect(wrapLines('', 100, measure)).toEqual([''])
})

test('the layout puts the title first, a lead column apart from the text, and grows with the rows', () => {
  const short = layout({ title: 'Rol alabanza', meta: 'Diciembre 2026', rows: [{ lead: 'vie 4 dic', text: 'Ana Torres' }] }, measure)
  const long = layout({ title: 'Rol alabanza', meta: 'Diciembre 2026', rows: Array.from({ length: 20 }, (_, index) => ({ lead: `d${index}`, text: 'Ana Torres' })), foot: 'Pie' }, measure)
  expect(short.ops[0]).toMatchObject({ text: 'Rol alabanza' })
  expect(short.ops.map((op) => op.text)).toEqual(['Rol alabanza', 'Diciembre 2026', 'vie 4 dic', 'Ana Torres'])
  const [lead, text] = short.ops.slice(2)
  expect(text!.x).toBeGreaterThan(lead!.x)
  expect(text!.y).toBe(lead!.y)
  expect(long.height).toBeGreaterThan(short.height)
  expect(long.ops.at(-1)).toMatchObject({ text: 'Pie' })
  for (const op of long.ops) expect(op.x + measure(op.text)).toBeLessThanOrEqual(long.width)
})

test('a long text wraps in the layout without leaving the page', () => {
  const doc: PaperDoc = { title: 'Setlist', meta: 'Betel', rows: [{ lead: '1', text: 'Una canción con un título larguísimo que no cabe en una sola línea de la imagen ficticia (Autora Uno)'.repeat(2) }] }
  const result = layout(doc, measure)
  expect(result.ops.filter((op) => op.x > 100).length).toBeGreaterThan(1)
  for (const op of result.ops) expect(op.x + measure(op.text)).toBeLessThanOrEqual(result.width)
})

test('the image is drawn on a white canvas with the same lines and delivered as a PNG', async () => {
  const drawn: string[] = []
  const context = {
    font: '', fillStyle: '', textBaseline: '', measureText: (text: string) => ({ width: text.length * 8 }),
    fillRect: vi.fn(), fillText: (text: string) => { drawn.push(text) },
  }
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context as never)
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (callback) { callback(new Blob(['png'], { type: 'image/png' })) })
  const blob = await docToPng({ title: 'Rol alabanza', meta: 'Diciembre 2026', rows: [{ lead: 'vie 4 dic', text: 'Ana Torres' }], foot: 'Pie' })
  expect(blob.type).toBe('image/png')
  expect(drawn).toEqual(['Rol alabanza', 'Diciembre 2026', 'vie 4 dic', 'Ana Torres', 'Pie'])
  expect(context.fillRect).toHaveBeenCalledWith(0, 0, expect.any(Number), expect.any(Number))
})

test('without canvas support the failure is raised, never a blank image', async () => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
  await expect(docToPng({ title: 'x', meta: 'y', rows: [] })).rejects.toThrow()
})
