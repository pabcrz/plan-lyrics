import { cleanup, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, expect, test, vi } from 'vitest'
import { App } from './App'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

test('the bootstrap shows API connectivity without claiming database or authentication', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
    new Response(JSON.stringify({ status: 'ok', service: 'plan-lyrics-api' })),
  ))
  render(<QueryClientProvider client={new QueryClient()}><App /></QueryClientProvider>)

  await screen.findByText('API disponible')
  expect(screen.getByRole('status')).toHaveProperty('textContent', 'API disponible')
  expect(screen.getByText('Base de datos y autenticación: pendientes de configurar.')).toBeTruthy()
})
