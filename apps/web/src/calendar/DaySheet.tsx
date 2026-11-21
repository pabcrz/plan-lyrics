import { useState } from 'react'
import { useNavigate } from 'react-router'
import { Button, Icon, Notice, TextField } from '../ui'
import { ApiError, useClosedDateActions } from './api'
import { formatLongDay } from './dates'
import type { ClosedDate } from './model'

export function ClosedChip() {
  return (
    <span className="inline-flex min-h-7 w-fit items-center gap-1.5 rounded-full border border-dashed border-line-strong bg-surface-2 py-0 pr-3 pl-2 text-[0.8125rem] font-medium text-text">
      <Icon name="ban" width={14} height={14} strokeWidth={2.25} />
      No hay culto
    </span>
  )
}

const markFailure = (error: unknown) => {
  const code = error instanceof ApiError ? error.code : ''
  if (code === 'Date has service') return 'Esa fecha ya tiene un servicio, así que no se puede marcar.'
  if (code === 'Date in the past') return 'No se pueden marcar fechas pasadas.'
  if (error instanceof ApiError && error.status === 403) return 'No tienes permiso para cambiar las fechas sin culto.'
  return 'No se pudo guardar el cambio. Inténtalo de nuevo.'
}

/** Detalle de una fecha sin servicio: marcar o desmarcar «No hay culto» (la API decide los permisos). */
export function DaySheet({ date, item, canEdit, onDone }: { date: string; item: ClosedDate | undefined; canEdit: boolean; onDone: (message: string) => void }) {
  const { mark, unmark } = useClosedDateActions()
  const navigate = useNavigate()
  const [reason, setReason] = useState('')
  const [sending, setSending] = useState(false)
  const [failure, setFailure] = useState('')
  async function run(action: () => Promise<void>, message: string) {
    setSending(true)
    setFailure('')
    try {
      await action()
      onDone(message)
    } catch (caught) {
      setFailure(markFailure(caught))
      setSending(false)
    }
  }
  return (
    <div className="grid gap-4">
      <ClosedChipOrDate date={date} item={item} />
      {failure && <Notice tone="warn" icon="alert" role="alert">{failure}</Notice>}
      {item ? (
        canEdit && <Button variant="secondary" block loading={sending} onClick={() => void run(() => unmark(date), 'Fecha desmarcada')}>Desmarcar fecha</Button>
      ) : (
        <>
          {canEdit && <Button variant="primary" block onClick={() => void navigate(`/servicios/nuevo?fecha=${date}`)}>Crear servicio</Button>}
          <TextField label="Motivo (opcional)" value={reason} onChange={(event) => setReason(event.target.value)} maxLength={120} help="Por ejemplo, un feriado." />
          <Button variant="secondary" block loading={sending} onClick={() => void run(() => mark(date, reason.trim()), 'Fecha marcada como «No hay culto»')}>Marcar «No hay culto»</Button>
        </>
      )}
    </div>
  )
}

function ClosedChipOrDate({ date, item }: { date: string; item: ClosedDate | undefined }) {
  if (!item) return <p className="m-0 text-text-2">Sin servicio. Si ese día no habrá reunión, márcalo para que nadie cree un servicio en esta fecha.</p>
  return (
    <>
      <ClosedChip />
      <p className="m-0 text-text-2">{formatLongDay(date)}</p>
      {item.reason && <p className="m-0 font-semibold">{item.reason}</p>}
    </>
  )
}
