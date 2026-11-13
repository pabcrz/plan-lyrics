import { describe, expect, test } from 'vitest'
import { addEntryBody, entryPatch, isReferenceLink, newSongBody, orderBody, placeAt, sameIds } from './setlist-rules.js'

describe('song body', () => {
  test('trims and collapses spaces; title and author are both required', () => {
    expect(newSongBody.parse({ title: '  Canción   de ejemplo ', author: ' Autor  Ficticio ' })).toEqual({ title: 'Canción de ejemplo', author: 'Autor Ficticio' })
    expect(newSongBody.safeParse({ title: 'Solo título' }).success).toBe(false)
    expect(newSongBody.safeParse({ title: 'Título', author: '   ' }).success).toBe(false)
    expect(newSongBody.safeParse({ title: 'x'.repeat(121), author: 'Autor' }).success).toBe(false)
  })

  test('rejects lyrics, chords and a church', () => {
    for (const extra of [{ lyrics: 'la la' }, { chords: 'G' }, { churchId: 'church-b' }]) {
      expect(newSongBody.safeParse({ title: 'Título', author: 'Autor', ...extra }).success).toBe(false)
    }
  })
})

describe('reference links', () => {
  test.each([
    'https://www.youtube.com/watch?v=ejemplo', 'https://youtu.be/ejemplo', 'https://open.spotify.com/track/ejemplo', 'http://music.youtube.com/watch?v=x',
  ])('accepts %s', url => expect(isReferenceLink(url)).toBe(true))

  test.each([
    'https://youtube.com.evil.example/x', 'https://evil.example/youtube.com', 'ftp://youtube.com/x', 'javascript:alert(1)',
    'https://user:pass@youtube.com/x', 'youtube.com/watch', 'https://notyoutube.com/x', `https://youtube.com/${'a'.repeat(500)}`,
  ])('rejects %s', url => expect(isReferenceLink(url)).toBe(false))
})

describe('entry bodies', () => {
  test('adds a library song or a moment, never both and never an unknown field', () => {
    expect(addEntryBody.safeParse({ songId: 's1', key: 'Bbm', link: 'https://youtu.be/x', position: 0 }).success).toBe(true)
    expect(addEntryBody.safeParse({ moment: ' Ofrenda ' }).data).toEqual({ moment: 'Ofrenda' })
    expect(addEntryBody.safeParse({ songId: 's1', moment: 'Ofrenda' }).success).toBe(false)
    expect(addEntryBody.safeParse({ moment: 'Ofrenda', key: 'G' }).success).toBe(false)
    expect(addEntryBody.safeParse({ songId: 's1', churchId: 'church-b' }).success).toBe(false)
    expect(addEntryBody.safeParse({ songId: 's1', key: 'H' }).success).toBe(false)
    expect(addEntryBody.safeParse({ songId: 's1', key: 'G#' }).success).toBe(false)
    expect(addEntryBody.safeParse({ songId: 's1', link: 'https://evil.example' }).success).toBe(false)
    expect(addEntryBody.safeParse({ songId: 's1', position: -1 }).success).toBe(false)
  })

  test('an empty link means no link, and a patch must change something', () => {
    expect(entryPatch.parse({ link: '  ' })).toEqual({ link: null })
    expect(entryPatch.parse({ key: null })).toEqual({ key: null })
    expect(entryPatch.safeParse({}).success).toBe(false)
  })

  test('an order carries the version and every id once', () => {
    expect(orderBody.safeParse({ version: 3, entryIds: ['a', 'b'] }).success).toBe(true)
    expect(orderBody.safeParse({ version: 3, entryIds: ['a', 'a'] }).success).toBe(false)
    expect(orderBody.safeParse({ entryIds: ['a'] }).success).toBe(false)
    expect(orderBody.safeParse({ version: 1, entryIds: [] }).success).toBe(false)
  })
})

describe('ordering helpers', () => {
  test('placeAt inserts at the position, or at the end when absent or too large', () => {
    expect(placeAt(['a', 'b', 'c'], 'x', 1)).toEqual(['a', 'x', 'b', 'c'])
    expect(placeAt(['a', 'b'], 'x')).toEqual(['a', 'b', 'x'])
    expect(placeAt(['a', 'b'], 'x', 9)).toEqual(['a', 'b', 'x'])
  })

  test('sameIds compares sets', () => {
    expect(sameIds(['a', 'b', 'c'], ['c', 'a', 'b'])).toBe(true)
    expect(sameIds(['a', 'b'], ['a'])).toBe(false)
    expect(sameIds(['a', 'b'], ['a', 'z'])).toBe(false)
    expect(sameIds(['a', 'b'], ['a', 'a'])).toBe(false)
  })
})
