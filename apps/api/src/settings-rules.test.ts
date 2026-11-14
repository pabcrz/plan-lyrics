import { describe, expect, test } from 'vitest'
import { checkSettings } from './settings-rules.js'

const valid = {
  name: 'Betel', sundayDouble: false, usesPreaching: false,
  days: [
    { weekday: 5, slot: 'SINGLE', time: '19:30', title: 'Servicio de viernes' },
    { weekday: 0, slot: 'SINGLE', time: '10:00', title: 'Servicio dominical' },
  ],
}
const issues = (input: unknown) => { const result = checkSettings(input); return 'issues' in result ? result.issues : [] }
const withDays = (days: unknown[], extra: object = {}) => ({ ...valid, ...extra, days })

describe('configuración de la iglesia', () => {
  test('acepta una configuración válida y recorta textos', () => {
    const result = checkSettings({ ...valid, name: '  Betel  ' })
    expect(result).toEqual({ data: { ...valid, name: 'Betel' } })
  })

  test('el interruptor de congregantes es opcional y debe ser booleano', () => {
    expect(checkSettings({ ...valid, congregationShowsPreacher: true })).toEqual({ data: { ...valid, congregationShowsPreacher: true } })
    expect(checkSettings({ ...valid, congregationShowsPreacher: false })).toEqual({ data: { ...valid, congregationShowsPreacher: false } })
    expect(checkSettings(valid)).toEqual({ data: valid })
    expect(issues({ ...valid, congregationShowsPreacher: 'sí' })).toEqual(['body'])
  })

  test('exige nombre', () => { expect(issues({ ...valid, name: '   ' })).toEqual(['name']) })
  test('exige al menos un día de servicio', () => { expect(issues(withDays([]))).toEqual(['days']) })
  test('exige título por servicio, indicando cuál', () => {
    expect(issues(withDays([{ weekday: 5, slot: 'SINGLE', time: '19:30', title: ' ' }]))).toEqual(['days.5.SINGLE.title'])
  })
  test('la hora va en múltiplos de 15 minutos', () => {
    expect(issues(withDays([{ weekday: 5, slot: 'SINGLE', time: '19:10', title: 'Viernes' }]))).toEqual(['days.5.SINGLE.time'])
    expect(issues(withDays([{ weekday: 5, slot: 'SINGLE', time: '7:30 pm', title: 'Viernes' }]))).toEqual(['days.5.SINGLE.time'])
  })
  test('rechaza campos desconocidos como churchId', () => { expect(issues({ ...valid, churchId: 'otra' })).toEqual(['body']) })
  test('rechaza un día repetido', () => {
    const day = { weekday: 5, slot: 'SINGLE', time: '19:30', title: 'Viernes' }
    expect(issues(withDays([day, day]))).toEqual(['days'])
  })

  describe('domingo con dos servicios', () => {
    const double = [
      { weekday: 0, slot: 'MORNING', time: '09:00', title: 'Mañana' },
      { weekday: 0, slot: 'AFTERNOON', time: '17:00', title: 'Tarde' },
    ]
    test('acepta mañana antes de las 12:00 y tarde desde las 12:00', () => {
      expect(issues(withDays([...double, { weekday: 5, slot: 'SINGLE', time: '19:30', title: 'Viernes' }], { sundayDouble: true }))).toEqual([])
      expect(issues(withDays([double[0], { ...double[1], time: '12:00' }], { sundayDouble: true }))).toEqual([])
    })
    test('la mañana no puede empezar a las 12:00 ni la tarde antes', () => {
      expect(issues(withDays([{ ...double[0], time: '12:00' }, double[1]], { sundayDouble: true }))).toEqual(['days.0.MORNING.time'])
      expect(issues(withDays([double[0], { ...double[1], time: '11:45' }], { sundayDouble: true }))).toEqual(['days.0.AFTERNOON.time'])
    })
    test('exige las dos franjas y sin franja única', () => {
      expect(issues(withDays([double[0]], { sundayDouble: true }))).toEqual(['days'])
      expect(issues(withDays([{ weekday: 0, slot: 'SINGLE', time: '10:00', title: 'Domingo' }], { sundayDouble: true }))).toEqual(['days'])
    })
    test('sin la opción, el domingo no admite franjas', () => {
      expect(issues(withDays(double, { sundayDouble: false }))).toEqual(['days'])
    })
    test('solo el domingo admite dos servicios', () => {
      expect(issues(withDays([{ weekday: 5, slot: 'MORNING', time: '09:00', title: 'Viernes' }, { weekday: 5, slot: 'AFTERNOON', time: '17:00', title: 'Viernes 2' }]))).toEqual(['days'])
    })
    test('la opción exige que el domingo sea día de servicio', () => {
      expect(issues(withDays([{ weekday: 5, slot: 'SINGLE', time: '19:30', title: 'Viernes' }], { sundayDouble: true }))).toEqual(['sundayDouble'])
    })
  })
})
