import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { Route, Routes } from 'react-router'
import { afterEach, expect, test, vi } from 'vitest'
import { LyricsEditPage } from './LyricsEditPage'
import { mountAt, sample, stubLyrics, type LyricsOptions } from './lyrics-test-utils'

vi.mock('@clerk/react', () => ({ useAuth: () => ({ getToken: async () => 'token-ficticio' }), UserButton: () => <button>Cuenta</button> }))

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks() })

function page(options: LyricsOptions = {}) {
  const server = stubLyrics(options)
  mountAt(
    <Routes>
      <Route path="/canciones/:songId/letra/editar" element={<LyricsEditPage />} />
      <Route path="/canciones/:songId/letra" element={<p>Vista de la letra</p>} />
    </Routes>, { pathname: '/canciones/c1/letra/editar', state: { title: 'Canción de ejemplo', back: '/servicios/s1/setlist' } })
  return server
}

const cards = () => screen.getAllByRole('group', { name: /^Sección \d+ de \d+$/ })
const save = () => screen.getByRole('button', { name: 'Guardar' })
const ready = async () => { await screen.findByRole('group', { name: 'Sección 1 de 3' }) }
const typeIn = (label: string | RegExp, value: string, index = 0) => fireEvent.change(screen.getAllByLabelText(label)[index], { target: { value } })

test('loads every section into a card with its kind, label, repetitions and text', async () => {
  page()
  await ready()
  expect(cards()).toHaveLength(3)
  const second = within(cards()[1])
  expect(second.getByLabelText('Tipo')).toHaveValue('VERSE')
  expect(second.getByLabelText(/Etiqueta/)).toHaveValue('Estrofa 1')
  expect(second.getByLabelText('Texto')).toHaveValue(sample[1].text)
  expect(within(cards()[2]).getByText('2 veces')).toBeInTheDocument()
})

test('keeps Guardar disabled until something changes and Descartar restores what was loaded', async () => {
  page()
  await ready()
  expect(save()).toBeDisabled()
  expect(screen.queryByRole('button', { name: 'Descartar cambios' })).not.toBeInTheDocument()
  typeIn('Texto', 'Otro texto inventado', 0)
  expect(save()).toBeEnabled()
  fireEvent.click(screen.getByRole('button', { name: 'Descartar cambios' }))
  expect(screen.getAllByLabelText('Texto')[0]).toHaveValue(sample[0].text)
  expect(save()).toBeDisabled()
})

test('saves the sections in order with the version that was read', async () => {
  const server = page()
  await ready()
  typeIn('Texto', 'Texto nuevo de la intro', 0)
  fireEvent.change(within(cards()[2]).getByLabelText('Tipo'), { target: { value: 'BRIDGE' } })
  fireEvent.click(within(cards()[2]).getByRole('button', { name: 'Una vez más' }))
  fireEvent.click(save())
  await screen.findByText('Vista de la letra')
  expect(server.writes()).toHaveLength(1)
  expect(server.writes()[0].body).toEqual({
    version: 3, published: false,
    sections: [
      { kind: 'INTRO', label: null, text: 'Texto nuevo de la intro', repeat: 1 },
      { kind: 'VERSE', label: 'Estrofa 1', text: sample[1].text, repeat: 1 },
      { kind: 'BRIDGE', label: null, text: 'Texto inventado del coro', repeat: 3 },
    ],
  })
})

test('limits the repetitions from 1 to 8', async () => {
  page({ sections: [{ kind: 'CHORUS', label: null, text: 'Coro ficticio', repeat: 8 }] })
  await screen.findByRole('group', { name: 'Sección 1 de 1' })
  expect(screen.getByRole('button', { name: 'Una vez más' })).toBeDisabled()
  for (let times = 0; times < 7; times += 1) fireEvent.click(screen.getByRole('button', { name: 'Una vez menos' }))
  expect(screen.getByText('1 vez')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Una vez menos' })).toBeDisabled()
})

test('adds a section at the end and writes into it', async () => {
  const server = page()
  await ready()
  fireEvent.click(screen.getByRole('button', { name: 'Agregar sección' }))
  expect(cards()).toHaveLength(4)
  const added = within(cards()[3])
  expect(added.getByLabelText('Tipo')).toHaveValue('VERSE')
  fireEvent.change(added.getByLabelText('Texto'), { target: { value: 'Sección agregada' } })
  fireEvent.click(save())
  await screen.findByText('Vista de la letra')
  expect(server.writes()[0].body?.sections[3]).toEqual({ kind: 'VERSE', label: null, text: 'Sección agregada', repeat: 1 })
})

test('moves a section up and down and tells the new position', async () => {
  const server = page()
  await ready()
  expect(within(cards()[0]).getByRole('button', { name: 'Subir sección 1' })).toBeDisabled()
  expect(within(cards()[2]).getByRole('button', { name: 'Bajar sección 3' })).toBeDisabled()
  fireEvent.click(within(cards()[1]).getByRole('button', { name: 'Subir sección 2' }))
  expect(within(cards()[0]).getByLabelText('Tipo')).toHaveValue('VERSE')
  expect(screen.getByText('Estrofa 1, posición 1 de 3')).toHaveAttribute('role', 'status')
  fireEvent.click(screen.getByRole('button', { name: 'Bajar sección 1' }))
  expect(within(cards()[0]).getByLabelText('Tipo')).toHaveValue('INTRO')
  fireEvent.click(within(cards()[0]).getByRole('button', { name: 'Bajar sección 1' }))
  fireEvent.click(save())
  await screen.findByText('Vista de la letra')
  expect(server.writes()[0].body?.sections.map((section) => section.kind)).toEqual(['VERSE', 'INTRO', 'CHORUS'])
})

test('removes a section and brings it back with Deshacer', async () => {
  const server = page()
  await ready()
  fireEvent.click(screen.getByRole('button', { name: 'Quitar sección 2' }))
  expect(cards()).toHaveLength(2)
  fireEvent.click(screen.getByRole('button', { name: 'Deshacer' }))
  expect(cards()).toHaveLength(3)
  expect(within(cards()[1]).getByLabelText('Tipo')).toHaveValue('VERSE')
  expect(save()).toBeDisabled()
  expect(server.writes()).toHaveLength(0)
})

test('refuses to save a section without text and points at it', async () => {
  const server = page()
  await ready()
  fireEvent.click(screen.getByRole('button', { name: 'Agregar sección' }))
  fireEvent.click(save())
  expect(await screen.findByText('Escribe el texto de la sección o quítala.')).toBeInTheDocument()
  expect(within(cards()[3]).getByLabelText('Texto')).toHaveAttribute('aria-invalid', 'true')
  expect(server.writes()).toHaveLength(0)
  typeIn('Texto', 'Ya hay texto', 3)
  expect(screen.queryByText('Escribe el texto de la sección o quítala.')).not.toBeInTheDocument()
})

test('replaces tabs and other control characters the server would refuse', async () => {
  const server = page()
  await ready()
  typeIn('Texto', 'Con\tuna tabulación\u0001', 0)
  fireEvent.click(save())
  await screen.findByText('Vista de la letra')
  expect(server.writes()[0].body?.sections[0].text).toBe('Con una tabulación ')
})

test('a letter without sections cannot be marked publicable and is saved unpublished', async () => {
  const server = page({ published: true })
  await ready()
  for (let index = 3; index >= 1; index -= 1) fireEvent.click(screen.getByRole('button', { name: `Quitar sección ${index}` }))
  expect(screen.getByRole('switch', { name: 'Publicable' })).toBeDisabled()
  expect(screen.getByRole('switch', { name: 'Publicable' })).toHaveAttribute('aria-checked', 'false')
  fireEvent.click(save())
  await screen.findByText('Vista de la letra')
  expect(server.writes()[0].body).toEqual({ version: 3, published: false, sections: [] })
})

test('marking an unpublished letter as publicable saves without asking again', async () => {
  const server = page({ published: false })
  await ready()
  fireEvent.click(screen.getByRole('switch', { name: 'Publicable' }))
  fireEvent.click(save())
  await screen.findByText('Vista de la letra')
  expect(server.writes()[0].body?.published).toBe(true)
})

test('asks for explicit confirmation before saving a letter that is published and stays published', async () => {
  const server = page({ published: true })
  await ready()
  expect(screen.getByText('Esta letra ya está publicada')).toBeInTheDocument()
  typeIn('Texto', 'Cambio sobre una letra publicada', 0)
  fireEvent.click(save())
  const dialog = await screen.findByRole('dialog', { name: '¿Guardar una letra publicada?' })
  expect(dialog).toHaveTextContent('se verá de inmediato en todos los enlaces compartidos')
  expect(server.writes()).toHaveLength(0)

  fireEvent.click(within(dialog).getByRole('button', { name: 'Seguir editando' }))
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(server.writes()).toHaveLength(0)
  expect(screen.getAllByLabelText('Texto')[0]).toHaveValue('Cambio sobre una letra publicada')

  fireEvent.click(save())
  fireEvent.click(await screen.findByRole('button', { name: 'Guardar y mantener publicada' }))
  await screen.findByText('Vista de la letra')
  expect(server.writes()).toHaveLength(1)
  expect(server.writes()[0].body?.published).toBe(true)
})

test('unpublishing while editing a published letter needs no confirmation', async () => {
  const server = page({ published: true })
  await ready()
  typeIn('Texto', 'Cambio para retocar antes de publicar', 0)
  fireEvent.click(screen.getByRole('switch', { name: 'Publicable' }))
  fireEvent.click(save())
  await screen.findByText('Vista de la letra')
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(server.writes()[0].body?.published).toBe(false)
})

test('a conflict keeps the person\'s edits, says so, and reloads the newer letter only when asked', async () => {
  const server = page({ writeStatus: 409 })
  await ready()
  typeIn('Texto', 'Mi cambio sin guardar', 0)
  fireEvent.click(save())
  const alert = await screen.findByText('La letra cambió mientras la editabas')
  expect(alert.closest('[role="alert"]')).toHaveTextContent('no se guardó')
  expect(screen.getAllByLabelText('Texto')[0]).toHaveValue('Mi cambio sin guardar')
  expect(screen.queryByText('Vista de la letra')).not.toBeInTheDocument()

  fireEvent.click(screen.getByRole('button', { name: 'Recargar la letra' }))
  await waitFor(() => expect(screen.getAllByLabelText('Texto')[0]).toHaveValue('Texto que guardó otra persona'))
  expect(cards()).toHaveLength(1)
  expect(screen.queryByText('La letra cambió mientras la editabas')).not.toBeInTheDocument()

  typeIn('Texto', 'Mi cambio sobre la versión nueva', 0)
  fireEvent.click(save())
  await screen.findByText('Vista de la letra')
  expect(server.writes().at(-1)?.body?.version).toBe(server.state.version - 1)
})

test('explains other failures without losing what was written', async () => {
  page({ writeStatus: 403 })
  await ready()
  typeIn('Texto', 'Texto inventado', 0)
  fireEvent.click(save())
  expect(await screen.findByText('No tienes permiso para editar letras.')).toBeInTheDocument()
  cleanup()
  page({ writeStatus: 500 })
  await ready()
  typeIn('Texto', 'Texto inventado', 0)
  fireEvent.click(save())
  expect(await screen.findByText('No se pudo guardar la letra. Inténtalo de nuevo.')).toBeInTheDocument()
  expect(screen.getAllByLabelText('Texto')[0]).toHaveValue('Texto inventado')
})

test('hides the form from someone who cannot edit the library', async () => {
  page({ canEdit: false })
  expect(await screen.findByText('Solo quien edita la biblioteca puede editar letras')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Guardar' })).not.toBeInTheDocument()
  expect(screen.queryByLabelText('Texto')).not.toBeInTheDocument()
})

test('shows the reasons a letter cannot load', async () => {
  page({ readStatus: 404 })
  expect(await screen.findByText('No encontramos esta canción')).toBeInTheDocument()
})

test('going back leaves at once when nothing changed and asks first when there are unsaved edits', async () => {
  page()
  await ready()
  typeIn('Texto', 'Cambio sin guardar', 0)
  fireEvent.click(screen.getByRole('button', { name: 'Volver a la letra' }))
  const dialog = await screen.findByRole('dialog', { name: '¿Salir sin guardar?' })
  fireEvent.click(within(dialog).getByRole('button', { name: 'Seguir editando' }))
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(screen.getAllByLabelText('Texto')[0]).toHaveValue('Cambio sin guardar')
  fireEvent.click(screen.getByRole('button', { name: 'Volver a la letra' }))
  fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Salir sin guardar' }))
  expect(await screen.findByText('Vista de la letra')).toBeInTheDocument()
  cleanup()
  page()
  await ready()
  fireEvent.click(screen.getByRole('button', { name: 'Volver a la letra' }))
  expect(await screen.findByText('Vista de la letra')).toBeInTheDocument()
})

test('keeps the focus on the move button after moving a section', async () => {
  page()
  await ready()
  fireEvent.click(within(cards()[1]).getByRole('button', { name: 'Subir sección 2' }))
  // La sección quedó primera: «Subir» ya no se puede usar y el foco pasa a «Bajar» de la misma tarjeta.
  await waitFor(() => expect(screen.getByRole('button', { name: 'Bajar sección 1' })).toHaveFocus())
})

test('an empty letter starts with no cards and offers to add the first section', async () => {
  page({ sections: [], published: false })
  await screen.findByRole('button', { name: 'Agregar sección' })
  expect(screen.queryAllByRole('group', { name: /^Sección/ })).toHaveLength(0)
  expect(screen.getByRole('switch', { name: 'Publicable' })).toBeDisabled()
})

test('a text change that would lose chords says which sections and saves nothing', async () => {
  const server = page({ writeFailure: { status: 409, body: { error: 'chords_would_be_lost', sections: [{ position: 1, kind: 'VERSE', label: 'Estrofa 1' }] } } })
  await ready()
  typeIn('Texto', 'Texto corregido de otra manera', 1)
  fireEvent.click(save())
  const alert = await screen.findByRole('alert')
  expect(alert).toHaveTextContent('Se perderían acordes')
  expect(within(alert).getByRole('listitem')).toHaveTextContent('Sección 2 · Estrofa «Estrofa 1»')
  expect(screen.queryByText('La letra cambió mientras la editabas')).not.toBeInTheDocument()
  expect(server.writes()).toHaveLength(1)
})
