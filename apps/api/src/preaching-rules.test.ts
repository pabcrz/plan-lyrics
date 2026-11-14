import { describe, expect, test } from 'vitest'
import { canSeeNotes, cleanNotes, documentRange, cleanPassages, isEmptyPreaching, preachingBody, singleLine, swapPreachingBody } from './preaching-rules.js'

const body = (over: Record<string, unknown> = {}) => ({ preacherId: 'p1', topic: 'La fe', passages: ['Hebreos 11:1'], notes: '- Punto uno', ...over })

describe('text cleaning', () => {
  test('a single line drops control and invisible characters and collapses spaces', () => {
    expect(singleLine('  La​  fe‮ \t y\nla gracia\u0007 ')).toBe('La fe y la gracia')
  })

  test('notes keep bullets, bold and underline markers as typed and trim every line', () => {
    expect(cleanNotes('  - Punto con **negrita**  \r\n-  otro con __subrayado__\r\n\r\n\r\n\r\nCierre  ')).toBe('- Punto con **negrita**\n- otro con __subrayado__\n\nCierre')
  })

  test('notes lose leading and trailing blank lines and hidden characters, and never become markup', () => {
    expect(cleanNotes('\n\n- <b>uno</b>‍\u0000\n\n')).toBe('- <b>uno</b>')
    expect(cleanNotes('   \n \t ')).toBe('')
  })

  test('passages are one per line, plain text, empty lines dropped and order kept', () => {
    expect(cleanPassages(['Juan 3:16\n\nRomanos   8:1', '  ', ' Salmo 23 '])).toEqual(['Juan 3:16', 'Romanos 8:1', 'Salmo 23'])
    expect(cleanPassages(['<script>x</script>'])).toEqual(['<script>x</script>'])
  })
})

describe('preaching body', () => {
  test('accepts a complete section and cleans it', () => {
    expect(preachingBody.parse(body({ topic: '  La   fe ', passages: ['A 1:1\nB 2:2'], notes: ' - uno \n\n\n- dos' }))).toEqual({
      preacherId: 'p1', topic: 'La fe', passages: ['A 1:1', 'B 2:2'], notes: '- uno\n\n- dos',
    })
  })

  test('the preacher may be missing, but the field is required', () => {
    expect(preachingBody.parse(body({ preacherId: null })).preacherId).toBeNull()
    const rest: Record<string, unknown> = body()
    delete rest.preacherId
    expect(preachingBody.safeParse(rest).success).toBe(false)
  })

  test('a church, or any other field, is rejected', () => {
    for (const extra of [{ churchId: 'church-b' }, { serviceId: 's1' }, { outline: 'x' }]) expect(preachingBody.safeParse(body(extra)).success).toBe(false)
  })

  test('lengths are limited: nothing is truncated silently', () => {
    expect(preachingBody.safeParse(body({ topic: 'x'.repeat(160) })).success).toBe(true)
    expect(preachingBody.safeParse(body({ topic: 'x'.repeat(161) })).success).toBe(false)
    expect(preachingBody.safeParse(body({ passages: Array.from({ length: 20 }, (_, index) => `Salmo ${index + 1}`) })).success).toBe(true)
    expect(preachingBody.safeParse(body({ passages: Array.from({ length: 21 }, (_, index) => `Salmo ${index + 1}`) })).success).toBe(false)
    expect(preachingBody.safeParse(body({ passages: ['x'.repeat(81)] })).success).toBe(false)
    expect(preachingBody.safeParse(body({ notes: '-'.repeat(4000) })).success).toBe(true)
    expect(preachingBody.safeParse(body({ notes: '-'.repeat(4001) })).success).toBe(false)
    expect(preachingBody.safeParse(body({ notes: Array.from({ length: 101 }, () => '- a').join('\n') })).success).toBe(false)
  })

  test('only a section with something in it is stored', () => {
    expect(isEmptyPreaching(preachingBody.parse(body({ preacherId: null, topic: ' ', passages: [' '], notes: '\n' })))).toBe(true)
    for (const over of [{ preacherId: 'p1' }, { topic: 'x' }, { passages: ['x'] }, { notes: 'x' }]) {
      expect(isEmptyPreaching(preachingBody.parse(body({ preacherId: null, topic: '', passages: [], notes: '', ...over })))).toBe(false)
    }
  })

  test('swap takes two services and nothing else', () => {
    expect(swapPreachingBody.safeParse({ first: 's1', second: 's2' }).success).toBe(true)
    expect(swapPreachingBody.safeParse({ first: 's1', second: 's2', churchId: 'x' }).success).toBe(false)
  })
})

describe('who reads the notes', () => {
  test('administrators and editors do; so does the assigned preacher with an account', () => {
    expect(canSeeNotes({ canEdit: true, personId: null }, 'p1')).toBe(true)
    expect(canSeeNotes({ canEdit: false, personId: 'p1' }, 'p1')).toBe(true)
  })
  test('nobody else does, and a missing account or preacher never matches', () => {
    expect(canSeeNotes({ canEdit: false, personId: 'p2' }, 'p1')).toBe(false)
    expect(canSeeNotes({ canEdit: false, personId: null }, 'p1')).toBe(false)
    expect(canSeeNotes({ canEdit: false, personId: null }, null)).toBe(false)
    expect(canSeeNotes({ canEdit: false, personId: 'p1' }, null)).toBe(false)
  })
})

describe('document range', () => {
  test('needs real dates in order and at most a year', () => {
    expect(documentRange.safeParse({ from: '2026-12-01', to: '2026-12-31' }).success).toBe(true)
    expect(documentRange.safeParse({ from: '2026-12-01', to: '2026-12-01' }).success).toBe(true)
    for (const range of [
      { from: '2026-12-31', to: '2026-12-01' }, { from: '2026-02-30', to: '2026-03-01' }, { from: '2026-01-01', to: '2027-01-02' },
      { from: undefined, to: '2026-12-01' }, { from: '2026-12-01', to: '2026-12-31', churchId: 'x' },
    ]) expect(documentRange.safeParse(range).success).toBe(false)
  })
})
