import { useState } from 'react'
import { useAuth } from '@clerk/react'

const messages = {
  idle: '', loading: 'Verificando sesión en API…',
  verified: 'Sesión verificada por la API. Permisos de iglesia aún pendientes.',
  unauthorized: 'No hay una sesión válida para la API. Volvé a iniciar sesión.',
  unavailable: 'La autenticación de la API no está configurada o no está disponible.',
  error: 'No se pudo comprobar la sesión en la API.',
}

export function SessionCheck() {
  const { getToken } = useAuth()
  const [state, setState] = useState<keyof typeof messages>('idle')
  async function check() {
    setState('loading')
    try {
      const token = await getToken()
      if (!token) return setState('unauthorized')
      const response = await fetch('/api/session', {
        headers: { Authorization: `Bearer ${token}` }, cache: 'no-store', credentials: 'omit',
      })
      if (response.status === 401) return setState('unauthorized')
      if (response.status === 503) return setState('unavailable')
      if (!response.ok || (await response.json()).authenticated !== true) throw new Error()
      setState('verified')
    } catch {
      setState('error')
    }
  }
  const failed = ['unauthorized', 'unavailable', 'error'].includes(state)
  return <section className="space-y-2">
    <button type="button" className="min-h-11 rounded border px-4 py-2"
      disabled={state === 'loading'} onClick={check}>Comprobar sesión en API</button>
    {state !== 'idle' && <p role={failed ? 'alert' : 'status'}>{messages[state]}</p>}
  </section>
}
