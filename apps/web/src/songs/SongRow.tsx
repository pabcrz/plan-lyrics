import { Icon } from '../ui'
import { agoText, formatDay } from '../calendar/dates'
import { songLabel, type Song } from '../setlist/setlist-api'

/** Lo que dice una fila de canción: título y autor a la izquierda, y a la derecha hace cuánto la usó esta iglesia (y, al ordenar por uso, cuántas veces). */
export function SongRowBody({ song, count = false, blocked = false }: { song: Song; count?: boolean; blocked?: boolean }) {
  const uses = song.uses ?? 0
  return (
    <>
      <span className="min-w-0 flex-1">
        <b className="block text-[0.9375rem] leading-tight [overflow-wrap:anywhere]">{song.title}</b>
        {song.author && <small className="block text-[0.8125rem] text-text-2">{song.author}</small>}
        {blocked && song.blockedBy && (
          <small className="mt-1 flex items-center gap-1 text-[0.8125rem] font-medium text-text-2"><Icon name="lock" width={14} height={14} />No disponible: usada el {formatDay(song.blockedBy)}</small>
        )}
      </span>
      <span className="flex-none text-right text-[0.8125rem] leading-tight text-text-2 [font-variant-numeric:tabular-nums]">
        <span className="block">{agoText(song.lastUsed)}</span>
        {count && <span className="mt-0.5 block text-text-3">{uses} {uses === 1 ? 'vez' : 'veces'}</span>}
      </span>
    </>
  )
}

/** Nombre accesible de una fila: lo que se lee en voz alta antes de la acción. */
export const rowLabel = (song: Song) => `${songLabel(song)}, ${agoText(song.lastUsed)}`
