/** Texto comparable: sin mayúsculas, acentos ni espacios repetidos (búsqueda y coincidencia de nombres). */
export function fold(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()
}
