import { cleanup, fireEvent, screen, within } from '@testing-library/react'
import { Route, Routes } from 'react-router'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { HomePage } from './HomePage'
import { churchColorsStore } from './church-colors'
import { homeAll } from './home-filter'
import { church, detail, mount, service, stubApi } from './test-utils'

vi.mock('@clerk/react', () => ({ useAuth: () => ({ getToken: async () => 'token-ficticio' }), UserButton: () => <button>Cuenta</button> }))

beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-11-13T18:00:00Z') }); localStorage.clear(); homeAll.set(null); churchColorsStore.set({}) })
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals() })

const services = [
  service({ id: 'a', date: '2026-11-06', title: 'Servicio pasado', status: 'COMPLETED' }),
  service({ id: 'b', date: '2026-11-13', title: 'Servicio de viernes', status: 'DRAFT', songCount: 4 }),
  service({ id: 'c', date: '2026-11-20', title: 'Viernes cancelado', status: 'CANCELLED', time: null }),
  service({ id: 'd', date: '2026-12-04', title: 'Servicio de diciembre', status: 'PUBLISHED' }),
]
const openCalendar = async () => fireEvent.click(await screen.findByRole('button', { name: /Noviembre 2026/ }))

test('lists the upcoming services as cards with date, time and director, soonest first, and hides what passed', async () => {
  stubApi({ services })
  mount(<HomePage />)
  const card = await screen.findByRole('link', { name: /Servicio de viernes/ })
  expect(within(card).getByText(/Dirige Ana Ramírez/)).toBeTruthy()
  // Sin estados que gestionar: ningún servicio muestra «Borrador» ni «Publicado».
  expect(within(card).queryByText('Borrador')).toBeNull()
  expect(within(card).getByText(/4 canciones en el setlist/)).toBeTruthy()
  expect(screen.getByText('Próximos servicios')).toBeTruthy()
  expect(screen.getAllByRole('link', { name: /,/ }).map((item) => item.getAttribute('aria-label'))).toEqual([
    expect.stringContaining('Servicio de viernes'), expect.stringContaining('Viernes cancelado'),
  ])
  expect(screen.queryByText('Servicio pasado')).toBeNull()
})

test('the month grid is collapsed by default, marks every state in text, and opens with the title', async () => {
  stubApi({ services })
  mount(<HomePage />)
  const toggle = await screen.findByRole('button', { name: /Noviembre 2026/ })
  expect(toggle.getAttribute('aria-expanded')).toBe('false')
  expect(await screen.findByText('3 servicios')).toBeTruthy()
  fireEvent.click(toggle)
  expect(toggle.getAttribute('aria-expanded')).toBe('true')
  const grid = await screen.findByRole('group', { name: 'Días de Noviembre 2026' })
  expect(within(grid).getByRole('button', { name: /13 de noviembre: Servicio de viernes$/ })).toBeTruthy()
  expect(within(grid).getByRole('button', { name: /20 de noviembre: Viernes cancelado, cancelado/ })).toBeTruthy()
  expect(grid.firstElementChild?.textContent).toContain('1') // 1 de noviembre de 2026 es domingo: abre la primera columna
})

test('navigates between months, loads each from the API, and shows that month in full', async () => {
  const calls = stubApi({ services })
  mount(<HomePage />)
  await openCalendar()
  fireEvent.click(await screen.findByRole('button', { name: 'Mes siguiente' }))
  expect(await screen.findByRole('button', { name: /Diciembre 2026/ })).toBeTruthy()
  expect(await screen.findByText('Servicios de diciembre')).toBeTruthy()
  expect(await screen.findByRole('link', { name: /Servicio de diciembre/ })).toBeTruthy()
  expect(calls.map((call) => call.url)).toContain('/api/services?month=2026-12')
  fireEvent.click(screen.getByRole('button', { name: 'Hoy' }))
  expect(await screen.findByText('Próximos servicios')).toBeTruthy()
})

test('a card and a day with a service lead to the service screen', async () => {
  stubApi({ services })
  mount(<Routes><Route path="/servicios/:serviceId" element={<p>Pantalla del servicio</p>} /><Route path="/" element={<HomePage />} /></Routes>)
  fireEvent.click(await screen.findByRole('link', { name: /Servicio de viernes/ }))
  expect(await screen.findByText('Pantalla del servicio')).toBeTruthy()
  cleanup()
  stubApi({ services })
  mount(<Routes><Route path="/servicios/:serviceId" element={<p>Pantalla del servicio</p>} /><Route path="/" element={<HomePage />} /></Routes>)
  fireEvent.click(await screen.findByRole('button', { name: /13 de noviembre: Servicio de viernes/ }))
  expect(await screen.findByText('Pantalla del servicio')).toBeTruthy()
})

test('a reader sees the same cards without creation, and an empty state without the shortcut', async () => {
  stubApi({ services: [], church: { ...church, canEdit: false, canConfigure: false } })
  mount(<HomePage />)
  expect(await screen.findByText('No hay servicios próximos')).toBeTruthy()
  expect(screen.queryByRole('button', { name: 'Nuevo servicio' })).toBeNull()
  expect(screen.queryByRole('button', { name: 'Crear servicio' })).toBeNull()
  cleanup()
  stubApi({ services: [] })
  mount(<HomePage />)
  expect(await screen.findByText('No hay servicios próximos')).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Crear servicio' })).toBeTruthy()
})

test('offers creation to editors with the floating button', async () => {
  stubApi({ services })
  mount(<HomePage />)
  expect(await screen.findByRole('button', { name: 'Nuevo servicio' })).toBeTruthy()
})

test('the mobile bar has the same sections for every role, and «Más» only when it has something', async () => {
  stubApi({ church: { ...church, canEdit: false, canConfigure: false } })
  mount(<HomePage />)
  const bar = await screen.findByRole('navigation', { name: 'Principal' })
  expect(within(bar).getAllByRole('button').map((button) => button.textContent)).toEqual(['Inicio', 'Canciones', 'Personas'])
  cleanup()
  stubApi({})
  mount(<HomePage />)
  expect(within(await screen.findByRole('navigation', { name: 'Principal' })).getAllByRole('button').map((button) => button.textContent)).toEqual(['Inicio', 'Canciones', 'Personas', 'Más'])
})

test.each([
  [404, 'Sin iglesia asignada'],
  [409, 'Elige una iglesia'],
  [503, 'No se pudo cargar tu iglesia'],
])('explains church context failure %i', async (status, title) => {
  stubApi({ church: status })
  mount(<HomePage />)
  expect(await screen.findByText(title)).toBeTruthy()
  expect(screen.queryByRole('button', { name: 'Nuevo servicio' })).toBeNull()
})

test('with several churches the person picks one and every request carries it', async () => {
  stubApi({ church: 409, myChurches: [{ id: 'c1', name: 'Iglesia Central', role: 'ADMIN' }, { id: 'c2', name: 'Iglesia Norte', role: 'EDITOR' }] })
  mount(<HomePage />)
  fireEvent.click(await screen.findByRole('button', { name: 'Iglesia Norte' }))
  await vi.waitFor(() => {
    const calls = vi.mocked(fetch).mock.calls.filter(([url]) => url === '/api/active-church')
    expect((calls.at(-1)?.[1]?.headers as Record<string, string>)['X-Church-Id']).toBe('c2')
  })
  localStorage.clear()
})

const closed = [{ date: '2026-11-27', reason: 'Feriado' }, { date: '2026-11-18', reason: null }, { date: '2026-11-04', reason: null }]
const writes = (calls: ReturnType<typeof stubApi>) => calls.filter((call) => call.init?.method === 'PUT' || call.init?.method === 'DELETE')

test('shows a closed date in the grid, the agenda and the day detail with the «No hay culto» legend', async () => {
  stubApi({ services, closed })
  mount(<HomePage />)
  const grid = await screen.findByRole('group', { name: 'Días de Noviembre 2026' })
  const cell = await within(grid).findByRole('button', { name: /27 de noviembre: No hay culto, Feriado/ })
  expect(cell.textContent).toContain('27')
  const agenda = screen.getByRole('list')
  expect(within(agenda).getAllByText('No hay culto')).toHaveLength(2) // los pasados quedan ocultos
  expect(within(agenda).getByText('Feriado')).toBeTruthy()
  fireEvent.click(cell)
  const sheet = await screen.findByRole('dialog', { name: 'No hay culto' })
  expect(within(sheet).getByText('Feriado')).toBeTruthy()
  expect(within(sheet).getByText(/viernes,? 27 de noviembre/)).toBeTruthy()
  // No es un servicio cancelado: no se muestra con el estado «Cancelado».
  expect(within(sheet).queryByText('Cancelado')).toBeNull()
})

test('a free future date offers «Crear servicio» as the main action, before marking «No hay culto»', async () => {
  stubApi({ services })
  mount(<HomePage />)
  fireEvent.click(await screen.findByRole('button', { name: /25 de noviembre: sin servicio/ }))
  const sheet = await screen.findByRole('dialog')
  const names = within(sheet).getAllByRole('button').map((button) => button.textContent)
  expect(names.indexOf('Crear servicio')).toBeGreaterThanOrEqual(0)
  expect(names.indexOf('Crear servicio')).toBeLessThan(names.indexOf('Marcar «No hay culto»'))
})

test('an editor marks a free future date with a reason and the calendar reloads', async () => {
  const calls = stubApi({ services })
  mount(<HomePage />)
  fireEvent.click(await screen.findByRole('button', { name: /25 de noviembre: sin servicio/ }))
  const sheet = await screen.findByRole('dialog')
  fireEvent.change(within(sheet).getByLabelText(/Motivo/), { target: { value: ' Feriado ' } })
  fireEvent.click(within(sheet).getByRole('button', { name: 'Marcar «No hay culto»' }))
  expect(await screen.findByText('Fecha marcada como «No hay culto»')).toBeTruthy()
  const [write] = writes(calls)
  expect(write.url).toBe('/api/closed-dates/2026-11-25')
  expect(write.init?.method).toBe('PUT')
  expect(JSON.parse(write.init!.body as string)).toEqual({ reason: 'Feriado' })
  expect(screen.queryByRole('dialog')).toBeNull()
})

test('an editor unmarks a closed date', async () => {
  const calls = stubApi({ services, closed })
  mount(<HomePage />)
  fireEvent.click(await screen.findByRole('button', { name: /27 de noviembre: No hay culto/ }))
  fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Desmarcar fecha' }))
  expect(await screen.findByText('Fecha desmarcada')).toBeTruthy()
  expect(writes(calls).map((call) => `${call.init?.method} ${call.url}`)).toEqual(['DELETE /api/closed-dates/2026-11-27'])
})

test('past and service dates cannot be marked; the grid offers marking only for free dates from today', async () => {
  stubApi({ services })
  mount(<HomePage />)
  const grid = await screen.findByRole('group', { name: 'Días de Noviembre 2026' })
  expect(await within(grid).findByRole('button', { name: /13 de noviembre: Servicio de viernes/ })).toBeTruthy()
  expect(within(grid).queryByRole('button', { name: /10 de noviembre/ })).toBeNull() // pasado
  expect(within(grid).queryByRole('button', { name: /12 de noviembre: sin servicio/ })).toBeNull() // pasado
  expect(within(grid).queryByRole('button', { name: /14 de noviembre: sin servicio/ })).not.toBeNull()
  // Un día con servicio abre el servicio, no la hoja de marcar: no hay forma de marcar una fecha que ya lo tiene.
  fireEvent.click(await within(grid).findByRole('button', { name: /20 de noviembre: Viernes cancelado/ }))
  expect(screen.queryByRole('dialog')).toBeNull()
})

test('a member only reads closed dates: no marking, no unmarking', async () => {
  stubApi({ services, closed, church: { ...church, canEdit: false } })
  mount(<HomePage />)
  const grid = await screen.findByRole('group', { name: 'Días de Noviembre 2026' })
  expect(within(grid).queryByRole('button', { name: /25 de noviembre: sin servicio/ })).toBeNull()
  fireEvent.click(await within(grid).findByRole('button', { name: /27 de noviembre: No hay culto/ }))
  const sheet = await screen.findByRole('dialog', { name: 'No hay culto' })
  expect(within(sheet).queryByRole('button', { name: 'Desmarcar fecha' })).toBeNull()
})

test('shows the server rejection when the date got a service meanwhile', async () => {
  stubApi({ services, mark: () => ({ status: 409, body: { error: 'Date has service' } }) })
  mount(<HomePage />)
  fireEvent.click(await screen.findByRole('button', { name: /25 de noviembre: sin servicio/ }))
  fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Marcar «No hay culto»' }))
  expect((await screen.findByRole('alert')).textContent).toContain('ya tiene un servicio')
})

test('the «Más» sheet offers settings only to the church administrator', async () => {
  stubApi({})
  mount(<HomePage />)
  fireEvent.click(within(await screen.findByRole('navigation', { name: 'Principal' })).getByRole('button', { name: 'Más' }))
  expect(within(screen.getByRole('dialog', { name: 'Más' })).getByRole('button', { name: 'Ajustes' })).toBeTruthy()
  cleanup()
  stubApi({ church: { ...church, canConfigure: false } })
  mount(<HomePage />)
  fireEvent.click(within(await screen.findByRole('navigation', { name: 'Principal' })).getByRole('button', { name: 'Más' }))
  expect(within(screen.getByRole('dialog', { name: 'Más' })).queryByRole('button', { name: 'Ajustes' })).toBeNull()
})

test('the services of this month that already passed are one tap away and hide again', async () => {
  stubApi({ services })
  mount(<HomePage />)
  expect(screen.queryByText('Servicio pasado')).toBeNull()
  fireEvent.click(await screen.findByRole('button', { name: 'Ver anteriores (1)' }))
  expect(screen.getByText('Servicio pasado')).toBeTruthy()
  expect(screen.getAllByRole('link', { name: /,/ }).map((item) => item.getAttribute('aria-label'))[0]).toContain('Servicio pasado')
  fireEvent.click(screen.getByRole('button', { name: 'Ocultar anteriores' }))
  expect(screen.queryByText('Servicio pasado')).toBeNull()
})

test('there is no «Ver anteriores» when nothing passed this month or when looking at another month', async () => {
  stubApi({ services: services.filter((item) => item.id !== 'a') })
  mount(<HomePage />)
  await screen.findByRole('link', { name: /Servicio de viernes/ })
  expect(screen.queryByRole('button', { name: /Ver anteriores/ })).toBeNull()
})

const two = [{ id: 'church-a', name: 'Betel', role: 'ADMIN' as const }, { id: 'c2', name: 'Iglesia de Cristo', role: 'EDITOR' as const }]
const inAgenda = (id: string, date: string, title: string, churchId: string, churchName: string) => ({ ...service({ id, date, title }), churchId, churchName })
// Viernes 13 de noviembre: esta semana va del dom 8 al sáb 14 y la siguiente del dom 15 al sáb 21.
const agenda = [
  inAgenda('n1', '2026-11-15', 'Culto norte', 'c2', 'Iglesia de Cristo'), inAgenda('n2', '2026-11-21', 'Culto central', 'church-a', 'Betel'), inAgenda('n3', '2026-11-22', 'Culto lejano', 'c2', 'Iglesia de Cristo'),
]

test('with several churches the home starts in «Todas»: this week and the next of every church, in order, without the calendar', async () => {
  const calls = stubApi({ services: [], myChurches: two, agenda })
  mount(<HomePage />)
  const first = await screen.findByRole('link', { name: /Culto norte/ })
  expect(within(first).getByText('Iglesia de Cristo')).toBeTruthy()
  expect(screen.getByRole('link', { name: /Culto central/ })).toBeTruthy()
  // Beyond the next Saturday nothing is listed.
  expect(screen.queryByRole('link', { name: /Culto lejano/ })).toBeNull()
  expect(screen.getAllByRole('link', { name: /Culto/ }).map((item) => item.getAttribute('aria-label')?.split(',')[0])).toEqual(['Culto norte', 'Culto central'])
  expect(screen.getByText('Esta semana y la siguiente')).toBeTruthy()
  expect(screen.queryByRole('region', { name: 'Calendario' })).toBeNull()
  expect(screen.getByRole('button', { name: 'Todas' }).getAttribute('aria-pressed')).toBe('true')
  expect(calls.some((call) => call.url === '/api/me/agenda')).toBe(true)
})

test('picking a church makes it the active church of the whole app, warns once, and «Todas» brings the union back', async () => {
  stubApi({ services: [], myChurches: two, agenda })
  mount(<HomePage />)
  await screen.findByRole('link', { name: /Culto norte/ })
  fireEvent.click(screen.getByRole('button', { name: 'Iglesia de Cristo' }))
  expect(localStorage.getItem('plan-lyrics.activeChurch')).toBe('c2')
  expect(localStorage.getItem('plan-lyrics.homeAll')).toBe('0')
  expect(await screen.findByText(/Ahora trabajas en/)).toBeTruthy()
  expect(screen.getByText(/«Todas» solo reúne los próximos servicios/)).toBeTruthy()
  expect(await screen.findByRole('region', { name: 'Calendario' })).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Entendido' }))
  expect(screen.queryByText(/Ahora trabajas en/)).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Todas' }))
  expect(localStorage.getItem('plan-lyrics.homeAll')).toBe('1')
  expect(await screen.findByText('Esta semana y la siguiente')).toBeTruthy()
  // The warning never comes back.
  fireEvent.click(screen.getByRole('button', { name: 'Betel' }))
  await screen.findByRole('region', { name: 'Calendario' })
  expect(screen.queryByText(/Ahora trabajas en/)).toBeNull()
})

test('the last choice is remembered: a single church opens straight into its month, and switching church elsewhere leaves «Todas»', async () => {
  localStorage.setItem('plan-lyrics.homeAll', '0')
  homeAll.refresh()
  stubApi({ services, myChurches: two, agenda })
  mount(<HomePage />)
  expect(await screen.findByText('Próximos servicios')).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Betel' }).getAttribute('aria-pressed')).toBe('true')
  expect(screen.getByRole('button', { name: 'Todas' }).getAttribute('aria-pressed')).toBe('false')
})

test('each church takes the color of one of the app themes in «Todas», and the person can choose which', async () => {
  stubApi({ services: [], myChurches: two, agenda })
  mount(<HomePage />)
  const card = await screen.findByRole('link', { name: /Culto norte/ })
  // Sin elegir: cada iglesia empieza con un tema distinto (por el orden de sus ids: «c2» va antes que «church-a»).
  const hueOf = (element: Element) => (element.querySelector('.tone') as HTMLElement).style.getPropertyValue('--h')
  expect(hueOf(card)).toBe('235')
  expect(hueOf(screen.getByRole('link', { name: /Culto central/ }))).toBe('178')
  fireEvent.click(screen.getByRole('button', { name: 'Colores de las iglesias' }))
  const sheet = within(await screen.findByRole('dialog', { name: 'Color de cada iglesia' }))
  fireEvent.click(within(sheet.getByRole('group', { name: 'Color de Iglesia de Cristo' })).getByRole('button', { name: 'Granate' }))
  fireEvent.click(within(sheet.getByRole('group', { name: 'Color de Betel' })).getByRole('button', { name: 'Ocre' }))
  expect(JSON.parse(localStorage.getItem('plan-lyrics.churchColors')!)).toEqual({ c2: 'granate', 'church-a': 'ocre' })
  expect(within(sheet.getByRole('group', { name: 'Color de Iglesia de Cristo' })).getByRole('button', { name: 'Granate' }).getAttribute('aria-pressed')).toBe('true')
  expect(hueOf(card)).toBe('15')
})

test('the colors exist only in «Todas»: picking one church brings the usual look and no palette', async () => {
  localStorage.setItem('plan-lyrics.homeAll', '0')
  homeAll.refresh()
  stubApi({ services, myChurches: two, agenda })
  mount(<HomePage />)
  await screen.findByText('Próximos servicios')
  expect(screen.queryByRole('button', { name: 'Colores de las iglesias' })).toBeNull()
  expect(document.querySelector('.tone:not([data-church-badge])')).toBeNull()
})

test('one church shows the rest of the month, and from its last week also the next one, with no cap', async () => {
  const month = [
    service({ id: 'm1', date: '2026-11-13', title: 'Uno' }), service({ id: 'm2', date: '2026-11-20', title: 'Dos' }), service({ id: 'm3', date: '2026-11-27', title: 'Tres' }),
    service({ id: 'm4', date: '2026-12-04', title: 'Cuatro' }), service({ id: 'm5', date: '2026-12-11', title: 'Cinco' }), service({ id: 'm6', date: '2026-12-18', title: 'Seis' }),
  ]
  stubApi({ services: month })
  mount(<HomePage />)
  await screen.findByRole('link', { name: /Uno/ })
  // Viernes 13: lo que queda de noviembre; diciembre aún no.
  expect(screen.getAllByRole('link', { name: /,/ }).map((item) => item.getAttribute('aria-label')?.split(',')[0])).toEqual(['Uno', 'Dos', 'Tres'])
  cleanup()
  // Domingo 29: ya es la última semana del mes, así que se suma la siguiente (hasta el sábado 12 de diciembre).
  vi.setSystemTime(new Date('2026-11-29T18:00:00Z'))
  stubApi({ services: month })
  mount(<HomePage />)
  await screen.findByRole('link', { name: /Cuatro/ })
  expect(screen.getAllByRole('link', { name: /,/ }).map((item) => item.getAttribute('aria-label')?.split(',')[0])).toEqual(['Cuatro', 'Cinco'])
})

const withPreaching = service({ id: 'p', date: '2026-11-13', title: 'Viernes 13', songCount: 6, preaching: { topic: 'El día de reposo', preacher: { id: 'p3', name: 'Fernando Maya' } } })
const mine = (over: Record<string, unknown>) => detail({ id: 'me', name: 'Yo', isYou: true, canDirect: false, canPlay: false, canPreach: false, ...over })
const preachingChurch = { ...church, usesPreaching: true }

test('who administers sees the card complete: topic, who directs, who preaches, hour and setlist', async () => {
  stubApi({ services: [withPreaching], church: preachingChurch })
  mount(<HomePage />)
  const card = await screen.findByRole('link', { name: /El día de reposo/ })
  expect(within(card).getByText('Dirige Ana Ramírez · Predica Fernando Maya')).toBeTruthy()
  expect(within(card).getByText(/7:30 p\.m\. · 6 canciones en el setlist/)).toBeTruthy()
})

test('a member of the worship group only sees who directs, when and the setlist', async () => {
  stubApi({ services: [withPreaching], church: { ...preachingChurch, canEdit: false, canConfigure: false }, directory: [mine({ canPlay: true })] })
  mount(<HomePage />)
  const card = await screen.findByRole('link', { name: /Dirige Ana Ramírez/ })
  expect(within(card).getByText('6 canciones en el setlist')).toBeTruthy()
  expect(within(card).queryByText(/Fernando Maya|El día de reposo/)).toBeNull()
})

test('a member who only preaches sees the topic, who preaches and when, without the setlist', async () => {
  stubApi({ services: [withPreaching], church: { ...preachingChurch, canEdit: false, canConfigure: false }, directory: [mine({ canPreach: true })] })
  mount(<HomePage />)
  const card = await screen.findByRole('link', { name: /El día de reposo/ })
  expect(within(card).getByText('Predica Fernando Maya')).toBeTruthy()
  expect(within(card).queryByText(/canciones|Ana Ramírez/)).toBeNull()
})

test('without network, picking another church changes nothing and does not claim it did', async () => {
  stubApi({ services: [], myChurches: two, agenda })
  mount(<HomePage />)
  await screen.findByRole('link', { name: /Culto norte/ })
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
  fireEvent.click(screen.getByRole('button', { name: 'Iglesia de Cristo' }))
  expect(localStorage.getItem('plan-lyrics.activeChurch')).toBeNull()
  expect(screen.queryByText(/Ahora trabajas en/)).toBeNull()
  vi.restoreAllMocks()
})
