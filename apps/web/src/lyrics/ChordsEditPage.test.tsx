import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { Route, Routes, useLocation } from 'react-router'
import { afterEach, expect, test, vi } from 'vitest'
import { ChordsEditPage } from './ChordsEditPage'
import { chorded, mountAt, stubLyrics, type LyricsOptions } from './lyrics-test-utils'

vi.mock('@clerk/react', () => ({ useAuth: () => ({ getToken: async () => 'token-ficticio' }), UserButton: () => <button>Cuenta</button> }))

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks() })

function ViewRoute() {
  const state = useLocation().state as { title: string; back: string; key: string; saved: boolean }
  return <p>{`Vista: ${state.title}, ${state.back}, ${state.key}, ${String(state.saved)}`}</p>
}

const edit = (options: LyricsOptions = {}) => {
  const server = stubLyrics({ sections: chorded, key: 'G', ...options })
  mountAt(
    <Routes>
      <Route path="/canciones/:songId/letra/acordes" element={<ChordsEditPage />} />
      <Route path="/canciones/:songId/letra" element={<ViewRoute />} />
      <Route path="/canciones/:songId/letra/editar" element={<p>Pantalla de edición</p>} />
    </Routes>, { pathname: '/canciones/c1/letra/acordes', state: { title: 'Canción de ejemplo', back: '/servicios/s1/setlist', key: 'A' } })
  return server
}

const section = async (number: number) => within(await screen.findByRole('group', { name: new RegExp(`^Sección ${number} de 3`) }))
const save = () => fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))
const sheet = () => within(screen.getByRole('dialog', { name: 'Acorde' }))
const right = (times: number) => { for (let i = 0; i < times; i++) fireEvent.click(sheet().getByRole('button', { name: 'Un carácter a la derecha' })) }

const unchanged = [
  { kind: 'INTRO', label: null, repeat: 1, chordPro: '[G]Línea inventada [D]de la introducción' },
  { kind: 'VERSE', label: 'Estrofa 1', repeat: 1, chordPro: '[G]Primera línea [Em]de una estrofa ficticia\nSegunda línea de la misma estrofa' },
  { kind: 'CHORUS', label: null, repeat: 2, text: 'Texto inventado del coro', chordPro: null },
]

test('shows every section with its chords over the text and nothing to save yet', async () => {
  edit()
  const verse = await section(2)
  expect(verse.getByRole('button', { name: 'Editar acorde Em' }).parentElement).toHaveTextContent('Emde una estrofa ficticia')
  expect(verse.getByRole('button', { name: 'Agregar acorde a la línea 2' })).toBeInTheDocument()
  expect((await section(3)).getByText('Texto inventado del coro')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Guardar' })).toBeDisabled()
  expect(screen.queryByRole('button', { name: 'Descartar cambios' })).not.toBeInTheDocument()
})

test('adds a chord at a position of a line and saves explicit chordPro for every section', async () => {
  const server = edit()
  fireEvent.click((await section(2)).getByRole('button', { name: 'Agregar acorde a la línea 2' }))
  fireEvent.change(sheet().getByLabelText('Acorde'), { target: { value: 'Am' } })
  right(8)
  // La vista previa muestra dónde cae antes de aceptar.
  expect(sheet().getByText('Am').parentElement).toHaveTextContent('Amlínea de la misma estrofa')
  expect(sheet().getByText('Posición 8 de 33')).toBeInTheDocument()
  fireEvent.click(sheet().getByRole('button', { name: 'Listo' }))
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  save()
  await waitFor(() => expect(screen.getByText(/^Vista:/)).toBeInTheDocument())
  expect(server.writes()).toHaveLength(1)
  expect(server.writes()[0].body).toEqual({
    version: 3, published: false, key: 'G',
    sections: [unchanged[0], { ...unchanged[1], chordPro: '[G]Primera línea [Em]de una estrofa ficticia\nSegunda [Am]línea de la misma estrofa' }, unchanged[2]],
  })
  // Vuelve a la vista con el tono del servicio y el aviso de guardado.
  expect(screen.getByText('Vista: Canción de ejemplo, /servicios/s1/setlist, A, true')).toBeInTheDocument()
})

test('moves a chord one character at a time', async () => {
  const server = edit()
  fireEvent.click((await section(1)).getByRole('button', { name: 'Editar acorde D' }))
  right(2)
  fireEvent.click(sheet().getByRole('button', { name: 'Listo' }))
  save()
  await waitFor(() => expect(server.writes()).toHaveLength(1))
  expect(server.writes()[0].body?.sections[0].chordPro).toBe('[G]Línea inventada de[D] la introducción')
})

test('does not let a chord leave the line', async () => {
  edit()
  fireEvent.click((await section(1)).getByRole('button', { name: 'Editar acorde D' }))
  right(40)
  expect(sheet().getByText('Posición 34 de 34')).toBeInTheDocument()
  expect(sheet().getByRole('button', { name: 'Un carácter a la derecha' })).toBeDisabled()
})

test('marks on the plain line where the chord lands, apart from the chord padding', async () => {
  edit()
  fireEvent.click((await section(2)).getByRole('button', { name: 'Agregar acorde a la línea 2' }))
  expect(sheet().getByRole('img', { name: 'Cae al inicio, antes de «Segunda línea de la misma estrofa»' })).toBeInTheDocument()
  right(8)
  expect(sheet().getByRole('img', { name: 'Cae entre «Segunda » y «línea de la misma estrofa»' })).toBeInTheDocument()
  right(40)
  expect(sheet().getByRole('img', { name: 'Cae al final, después de «Segunda línea de la misma estrofa»' })).toBeInTheDocument()
})

test('moves the chord by touching a letter of the reference line', async () => {
  edit()
  fireEvent.click((await section(2)).getByRole('button', { name: 'Agregar acorde a la línea 2' }))
  const tap = (at: number) => fireEvent.pointerDown(screen.getByRole('img').querySelector(`[data-at="${at}"]`)!)
  tap(8)
  expect(sheet().getByText('Posición 8 de 33')).toBeInTheDocument()
  tap(0)
  expect(sheet().getByText('Posición 0 de 33')).toBeInTheDocument()
})

test('renames a chord and removes another', async () => {
  const server = edit()
  fireEvent.click((await section(2)).getByRole('button', { name: 'Editar acorde Em' }))
  fireEvent.change(sheet().getByLabelText('Acorde'), { target: { value: 'Am7' } })
  fireEvent.click(sheet().getByRole('button', { name: 'Listo' }))
  fireEvent.click((await section(1)).getByRole('button', { name: 'Editar acorde G' }))
  fireEvent.click(sheet().getByRole('button', { name: 'Quitar acorde' }))
  save()
  await waitFor(() => expect(server.writes()).toHaveLength(1))
  const sections = server.writes()[0].body!.sections
  expect(sections[0].chordPro).toBe('Línea inventada [D]de la introducción')
  expect(sections[1].chordPro).toBe('[G]Primera línea [Am7]de una estrofa ficticia\nSegunda línea de la misma estrofa')
})

test('removing the last chord of a section sends it as plain text, explicitly without chords', async () => {
  const server = edit({ sections: [{ kind: 'VERSE', label: null, text: 'Línea de ejemplo', chordPro: '[C]Línea de ejemplo', repeat: 1 }, chorded[1], chorded[2]] })
  fireEvent.click((await section(1)).getByRole('button', { name: 'Editar acorde C' }))
  fireEvent.click(sheet().getByRole('button', { name: 'Quitar acorde' }))
  save()
  await waitFor(() => expect(server.writes()).toHaveLength(1))
  expect(server.writes()[0].body?.sections[0]).toEqual({ kind: 'VERSE', label: null, repeat: 1, text: 'Línea de ejemplo', chordPro: null })
})

test('refuses an invalid chord with a message that says what is accepted, and keeps the sheet open', async () => {
  const server = edit()
  fireEvent.click((await section(2)).getByRole('button', { name: 'Agregar acorde a la línea 2' }))
  fireEvent.change(sheet().getByLabelText('Acorde'), { target: { value: 'H7' } })
  fireEvent.click(sheet().getByRole('button', { name: 'Listo' }))
  expect(sheet().getByText(/«H7» no es un acorde válido/)).toBeInTheDocument()
  expect(sheet().getByLabelText('Acorde')).toBeInvalid()
  fireEvent.click(sheet().getByRole('button', { name: 'Cancelar' }))
  expect(screen.getByRole('button', { name: 'Guardar' })).toBeDisabled()
  expect(server.writes()).toEqual([])
})

test('a new chord needs a name', async () => {
  edit()
  fireEvent.click((await section(2)).getByRole('button', { name: 'Agregar acorde a la línea 2' }))
  fireEvent.click(sheet().getByRole('button', { name: 'Listo' }))
  expect(sheet().getByText('Escribe el acorde.')).toBeInTheDocument()
})

test('changes the base key of the song by mode and note, and clears it by tapping it again', async () => {
  const server = edit()
  const keys = within(await screen.findByRole('group', { name: 'Tonalidad base de la canción' }))
  expect(keys.getByRole('button', { name: 'G' })).toHaveAttribute('aria-pressed', 'true')
  fireEvent.click(screen.getByRole('button', { name: 'Menor' }))
  fireEvent.click(keys.getByRole('button', { name: 'Am' }))
  save()
  await waitFor(() => expect(server.writes()).toHaveLength(1))
  expect(server.writes()[0].body?.key).toBe('Am')
  expect(server.writes()[0].body?.sections).toEqual(unchanged)
  cleanup()
  const second = edit()
  fireEvent.click(within(await screen.findByRole('group', { name: 'Tonalidad base de la canción' })).getByRole('button', { name: 'G' }))
  save()
  await waitFor(() => expect(second.writes()).toHaveLength(1))
  expect(second.writes()[0].body?.key).toBeNull()
})

test('discarding goes back to what was loaded', async () => {
  edit()
  fireEvent.click((await section(1)).getByRole('button', { name: 'Editar acorde G' }))
  fireEvent.click(sheet().getByRole('button', { name: 'Quitar acorde' }))
  expect((await section(1)).queryByRole('button', { name: 'Editar acorde G' })).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Descartar cambios' }))
  expect((await section(1)).getByRole('button', { name: 'Editar acorde G' })).toBeInTheDocument()
})

test('a stale version keeps what was written until the lyrics are reloaded', async () => {
  const server = edit({ writeStatus: 409 })
  fireEvent.click((await section(1)).getByRole('button', { name: 'Editar acorde G' }))
  fireEvent.click(sheet().getByRole('button', { name: 'Quitar acorde' }))
  save()
  expect(await screen.findByText('La letra cambió mientras la editabas')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Guardar' })).toBeDisabled()
  expect((await section(1)).queryByRole('button', { name: 'Editar acorde G' })).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Recargar la letra' }))
  expect(await screen.findByText('Texto que guardó otra persona')).toBeInTheDocument()
  expect(server.writes()).toHaveLength(1)
})

test('says which sections would lose chords and saves nothing', async () => {
  const server = edit({ writeFailure: { status: 409, body: { error: 'chords_would_be_lost', sections: [{ position: 1, kind: 'VERSE', label: 'Estrofa 1' }, { position: 2, kind: 'CHORUS', label: null }] } } })
  fireEvent.click((await section(1)).getByRole('button', { name: 'Editar acorde G' }))
  fireEvent.click(sheet().getByRole('button', { name: 'Quitar acorde' }))
  save()
  const alert = await screen.findByRole('alert')
  expect(alert).toHaveTextContent('Se perderían acordes')
  const items = within(alert).getAllByRole('listitem').map((item) => item.textContent)
  expect(items).toEqual(['Sección 2 · Estrofa «Estrofa 1»', 'Sección 3 · Coro'])
  expect(within(alert).getByRole('button', { name: 'Recargar la letra' })).toBeInTheDocument()
  expect(server.writes()).toHaveLength(1)
  // Lo escrito sigue en pantalla.
  expect((await section(1)).queryByRole('button', { name: 'Editar acorde G' })).not.toBeInTheDocument()
})

test('says in words that the server found a chord or text it cannot accept', async () => {
  edit({ writeFailure: { status: 400, body: { error: 'Invalid request' } } })
  fireEvent.click((await section(1)).getByRole('button', { name: 'Editar acorde G' }))
  fireEvent.click(sheet().getByRole('button', { name: 'Quitar acorde' }))
  save()
  expect(await screen.findByRole('alert')).toHaveTextContent('algún acorde o el texto no es válido')
})

test('other failures say so without losing what was written', async () => {
  edit({ writeFailure: { status: 500, body: { error: 'x' } } })
  fireEvent.click((await section(1)).getByRole('button', { name: 'Editar acorde G' }))
  fireEvent.click(sheet().getByRole('button', { name: 'Quitar acorde' }))
  save()
  expect(await screen.findByRole('alert')).toHaveTextContent('No se pudieron guardar los acordes')
  expect(screen.getByRole('button', { name: 'Guardar' })).toBeEnabled()
})

test('whoever cannot edit the library reads that, with a way back to the lyrics', async () => {
  edit({ canEdit: false })
  expect(await screen.findByText('Solo quien edita la biblioteca puede editar acordes')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Guardar' })).not.toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Ver la letra' })).toBeInTheDocument()
})

test('a song without lyrics asks for the text first', async () => {
  edit({ sections: [] })
  expect(await screen.findByText('Primero escribe la letra')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Escribir letra' })).toBeInTheDocument()
})

test('leaving with changes asks first', async () => {
  edit()
  fireEvent.click((await section(1)).getByRole('button', { name: 'Editar acorde G' }))
  fireEvent.click(sheet().getByRole('button', { name: 'Quitar acorde' }))
  fireEvent.click(screen.getByRole('button', { name: 'Volver a la letra' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Salir sin guardar' }))
  expect(await screen.findByText(/^Vista:/)).toBeInTheDocument()
})
