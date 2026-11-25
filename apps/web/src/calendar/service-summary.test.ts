import { expect, test } from 'vitest'
import { serviceSummary } from './service-summary'
import { service } from './test-utils'

const full = service({ title: 'Viernes 13', time: '19:30', songCount: 6, director: { id: 'p1', name: 'Jairo León' }, preaching: { topic: 'La gracia', preacher: { id: 'p3', name: 'Fernando Maya' } } })

test('who administers sees everything: topic, who directs, who preaches, the hour and the setlist', () => {
  expect(serviceSummary(full, 'full')).toEqual({ headline: 'La gracia', details: ['Dirige Jairo León · Predica Fernando Maya', '7:30 p.m. · 6 canciones en el setlist'] })
  // No topic yet: the date stands in; no preacher yet: it says so.
  expect(serviceSummary({ ...full, preaching: { topic: '', preacher: null } }, 'full')).toEqual({ headline: 'Viernes 13', details: ['Dirige Jairo León · Sin predicador', '7:30 p.m. · 6 canciones en el setlist'] })
})

test('the worship group only needs to know who directs and when, plus the setlist', () => {
  expect(serviceSummary(full, 'worship')).toEqual({ headline: 'Dirige Jairo León', details: ['7:30 p.m.', '6 canciones en el setlist'] })
  expect(serviceSummary({ ...full, director: null, songCount: 0 }, 'worship')).toEqual({ headline: 'Sin director asignado', details: ['7:30 p.m.', 'Setlist sin preparar'] })
})

test('who only preaches sees the topic and who preaches, and when', () => {
  expect(serviceSummary(full, 'preacher')).toEqual({ headline: 'La gracia', details: ['Predica Fernando Maya', '7:30 p.m.'] })
  expect(serviceSummary({ ...full, preaching: { topic: '', preacher: null } }, 'preacher')).toEqual({ headline: 'Sin tema todavía', details: ['Sin predicador asignado', '7:30 p.m.'] })
})

test('a church that does not use preaching shows no preaching in the full card', () => {
  expect(serviceSummary({ ...full, preaching: null }, 'full')).toEqual({ headline: 'Viernes 13', details: ['Dirige Jairo León', '7:30 p.m. · 6 canciones en el setlist'] })
})
