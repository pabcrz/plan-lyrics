import { expect, test } from 'vitest'
import { clampDelta, moveItem, shiftFor, targetIndex, type Rect } from './reorder'

// Cuatro filas de 60 px, una debajo de otra.
const rows: Rect[] = [0, 60, 120, 180].map((top) => ({ top, height: 60 }))

test('the target is the number of other rows whose center is above the dragged center', () => {
  expect(targetIndex(rows, 0, 0)).toBe(0)
  expect(targetIndex(rows, 0, 59)).toBe(0) // el centro (89) aún no pasa el de la fila 1 (90)
  expect(targetIndex(rows, 0, 61)).toBe(1)
  expect(targetIndex(rows, 0, 70)).toBe(1)
  expect(targetIndex(rows, 0, 130)).toBe(2)
  expect(targetIndex(rows, 3, -70)).toBe(2)
  expect(targetIndex(rows, 3, -200)).toBe(0)
  // En los extremos de la lista los centros coinciden: la primera y la última posición deben ser alcanzables.
  expect(targetIndex(rows, 0, 500)).toBe(3)
  expect(targetIndex(rows, 3, -500)).toBe(0)
  expect(targetIndex(rows, 1, 500)).toBe(3)
  expect(targetIndex(rows, 2, -500)).toBe(0)
})

test('the dragged row cannot leave the list', () => {
  expect(clampDelta(rows, 1, -500)).toBe(-60)
  expect(clampDelta(rows, 1, 500)).toBe(120)
  expect(clampDelta(rows, 1, 15)).toBe(15)
})

test('the rows between the origin and the target step aside by the dragged height', () => {
  // Arrastrar la fila 0 hasta el índice 2: las filas 1 y 2 suben.
  expect([1, 2, 3].map((index) => shiftFor(0, 2, index, 60))).toEqual([-60, -60, 0])
  // Arrastrar la fila 3 hasta el índice 1: las filas 1 y 2 bajan.
  expect([0, 1, 2].map((index) => shiftFor(3, 1, index, 60))).toEqual([0, 60, 60])
  expect(shiftFor(2, 2, 1, 60)).toBe(0)
})

test('moveItem returns a new list with the item at the new index and leaves the original alone', () => {
  const list = ['a', 'b', 'c', 'd']
  expect(moveItem(list, 0, 2)).toEqual(['b', 'c', 'a', 'd'])
  expect(moveItem(list, 3, 1)).toEqual(['a', 'd', 'b', 'c'])
  expect(list).toEqual(['a', 'b', 'c', 'd'])
})
