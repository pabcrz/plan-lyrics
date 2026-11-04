import { useQuery } from '@tanstack/react-query'

async function checkApi() {
  const response = await fetch('/api/health')
  if (!response.ok) throw new Error('La API no respondió correctamente')

  const body = await response.json()
  if (body.status !== 'ok' || body.service !== 'plan-lyrics-api') {
    throw new Error('Respuesta de API inesperada')
  }
  return body
}

export function App() {
  const api = useQuery({ queryKey: ['local-api-health'], queryFn: checkApi, retry: false })

  return (
    <main className="mx-auto max-w-xl space-y-6 px-4 py-10">
      <h1 className="text-2xl font-semibold">Plan &amp; Lyrics</h1>
      <p>Entorno técnico local; las pantallas del producto todavía no están implementadas.</p>
      <p role="status">
        {api.isPending ? 'Comprobando API…' : api.isError ? 'API no disponible' : 'API disponible'}
      </p>
      <p>Base de datos y autenticación: pendientes de configurar.</p>
    </main>
  )
}
