import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, expect, test, vi } from 'vitest'
import { App } from './App'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

test('the home page presents the product and shows API connectivity', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
    new Response(JSON.stringify({ status: 'ok', service: 'plan-lyrics-api' })),
  ))
  render(<QueryClientProvider client={new QueryClient()}><App /></QueryClientProvider>)

  await screen.findByText('API disponible')
  expect(screen.getByRole('status')).toHaveProperty('textContent', 'API disponible')
  expect(screen.getByRole('heading', { level: 1 }).textContent).toContain('El servicio del domingo')
  expect(screen.queryByText(/pendiente de configurar/)).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Apariencia' }))
  fireEvent.click(screen.getByRole('button', { name: 'Granate' }))
  expect(document.documentElement.dataset.accent).toBe('granate')
})
