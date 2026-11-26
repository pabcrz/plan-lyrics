import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { blockSwitch } from './pwa'
import { StatusBars } from './StatusBars'

afterEach(() => { cleanup(); vi.restoreAllMocks() })
const mount = (client = new QueryClient()) => render(<QueryClientProvider client={client}><StatusBars /></QueryClientProvider>)

test('says why a church cannot be changed without network', () => {
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
  mount()
  act(() => blockSwitch())
  expect(screen.getByText(/Para cambiar de iglesia necesitas conexión/)).toBeTruthy()
  act(() => { window.dispatchEvent(new Event('online')) })
  expect(screen.queryByText(/Para cambiar de iglesia/)).toBeNull()
})

test('online, saved data that could not be refreshed is announced and can be retried', async () => {
  const client = new QueryClient()
  let fail = true
  const queryFn = vi.fn(async () => { if (fail) throw new Error('500'); return 'nuevo' })
  client.setQueryData(['x'], 'viejo')
  mount(client)
  expect(screen.queryByRole('button', { name: 'Reintentar' })).toBeNull()
  await act(() => client.fetchQuery({ queryKey: ['x'], queryFn, retry: false }).catch(() => ''))
  expect(await screen.findByText('No se pudo actualizar. Ves lo último guardado.')).toBeTruthy()
  fail = false
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Reintentar' })) })
  expect(client.getQueryData(['x'])).toBe('nuevo')
})
