/**
 * Dirección de una ruta de la API. Sin `VITE_API_URL` (desarrollo local) la ruta queda relativa y el servidor de Vite
 * la reenvía a la API; con ella (despliegue en dos proyectos) apunta al origen de la API. No es un secreto: va en el bundle.
 */
export function buildApiUrl(base: string | undefined, path: string) {
  const origin = base?.trim().replace(/\/+$/, '')
  return origin ? `${origin}${path}` : path
}

export const apiUrl = (path: string) => buildApiUrl(import.meta.env.VITE_API_URL, path)
