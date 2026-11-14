import { useState } from 'react'
import { Button, Icon, Notice, Sheet } from '../ui'
import { ApiError } from '../calendar/api'
import { useShareLinkActions } from './share-api'
import { absoluteUrl, expiryNote, scopeLabel, versionLabel, type ShareLink } from './share-model'

const canShare = () => typeof navigator !== 'undefined' && typeof navigator.share === 'function'

/** Dirección completa de un enlace que funciona; con el origen de esta página, nunca el de la API. */
export const linkUrl = (path: string) => absoluteUrl(window.location.origin, path)

/** Copia o comparte la dirección; el resultado se avisa con `onDone` y un fallo nunca se oculta. */
function useDeliver(url: string, onDone: (message: string) => void) {
  const [failure, setFailure] = useState('')
  return {
    failure,
    copy: async () => {
      setFailure('')
      try {
        await navigator.clipboard.writeText(url)
        onDone('Enlace copiado')
      } catch { setFailure('No se pudo copiar. Selecciona la dirección y cópiala a mano.') }
    },
    share: async () => {
      setFailure('')
      try {
        await navigator.share({ title: 'Plan & Lyrics', url })
      } catch (error) {
        // Cerrar el menú de compartir no es un fallo.
        if (!(error instanceof DOMException && error.name === 'AbortError')) setFailure('No se pudo abrir el menú de compartir.')
      }
    },
  }
}

function Address({ url }: { url: string }) {
  return <p className="m-0 mb-3 rounded-md bg-surface-2 p-3 font-mono text-[0.8125rem] break-all select-all">{url}</p>
}

const failureText = (error: unknown) => {
  const code = error instanceof ApiError ? error.code : ''
  if (error instanceof ApiError && error.status === 403) return 'No tienes permiso para cambiar enlaces.'
  if (code === 'Link inactive') return 'Ese enlace ya estaba desactivado.'
  if (code === 'Link active') return 'Ese enlace sigue activo.'
  if (code === 'Reactivation used') return 'Este enlace ya se reactivó una vez y no puede reactivarse de nuevo. Crea uno nuevo.'
  return 'No se pudo aplicar el cambio. Inténtalo de nuevo.'
}

/** Un enlace existente: copiarlo o compartirlo, revocarlo (con confirmación) o reactivarlo. */
export function LinkSheet({ link, onClose, onDone }: { link: ShareLink | null; onClose: () => void; onDone: (message: string) => void }) {
  return (
    <Sheet open={link !== null} onClose={onClose} title={link ? `${versionLabel[link.version]} · ${scopeLabel(link.scope)}` : 'Enlace'}>
      {link && <LinkBody key={link.id} link={link} onClose={onClose} onDone={onDone} />}
    </Sheet>
  )
}

function LinkBody({ link, onClose, onDone }: { link: ShareLink; onClose: () => void; onDone: (message: string) => void }) {
  const { revoke, reactivate } = useShareLinkActions()
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState('')
  const url = link.path ? linkUrl(link.path) : ''
  const deliver = useDeliver(url, (message) => { onDone(message); onClose() })

  async function change(action: () => Promise<unknown>, message: string) {
    setBusy(true)
    setFailure('')
    try {
      await action()
      onDone(message)
      onClose()
    } catch (error) { setFailure(failureText(error)) } finally { setBusy(false) }
  }

  const active = link.status === 'ACTIVE'
  return (
    <div className="grid gap-3">
      <p className="m-0 text-text-2">
        {active
          ? `${expiryNote(link)}. Quien lo tenga ve nombres${link.blocks.notes ? ' y notas' : ''}.`
          : `${expiryNote(link)}. ${link.canReactivate ? 'Puedes reactivarlo por otros 30 días, solo para consulta.' : 'Ya se reactivó una vez: crea un enlace nuevo si hace falta.'}`}
      </p>
      {active && url && <Address url={url} />}
      {(failure || deliver.failure) && <Notice tone="warn" icon="alert" role="alert">{failure || deliver.failure}</Notice>}
      {confirming ? (
        <>
          <p className="m-0 text-[0.8125rem] text-text-3">Quien tenga este enlace dejará de verlo de inmediato.</p>
          <Button variant="danger" block loading={busy} onClick={() => void change(() => revoke(link.id), 'Enlace revocado')}>Revocar enlace</Button>
          <Button variant="quiet" block onClick={() => setConfirming(false)}>No revocar</Button>
        </>
      ) : active ? (
        <>
          <Button block onClick={() => void deliver.copy()} disabled={!url}><Icon name="copy" />Copiar enlace</Button>
          {canShare() && <Button variant="secondary" block onClick={() => void deliver.share()} disabled={!url}><Icon name="share" />Compartir</Button>}
          <Button variant="quiet" block onClick={() => setConfirming(true)}>Revocar enlace</Button>
        </>
      ) : (
        <>
          {link.canReactivate && <Button block loading={busy} onClick={() => void change(() => reactivate(link.id), 'Reactivado por 30 días')}>Reactivar por 30 días</Button>}
          <Button variant="quiet" block onClick={onClose}>Cerrar</Button>
        </>
      )}
    </div>
  )
}

/** Tras crear un enlace: es el momento natural de copiarlo o compartirlo. */
export function CreatedSheet({ link, onDone }: { link: ShareLink | null; onDone: () => void }) {
  return (
    <Sheet open={link !== null} onClose={onDone} title="Enlace creado">
      {link && <CreatedBody link={link} onDone={onDone} />}
    </Sheet>
  )
}

function CreatedBody({ link, onDone }: { link: ShareLink; onDone: () => void }) {
  const url = link.path ? linkUrl(link.path) : ''
  const [copied, setCopied] = useState(false)
  const deliver = useDeliver(url, () => setCopied(true))
  return (
    <div className="grid gap-3">
      <p className="m-0 text-text-2">{versionLabel[link.version]} · {scopeLabel(link.scope)}. {expiryNote(link)}.</p>
      {url && <Address url={url} />}
      {deliver.failure && <Notice tone="warn" icon="alert" role="alert">{deliver.failure}</Notice>}
      {copied && <p role="status" className="m-0 text-[0.8125rem] font-medium text-accent-soft-text">Enlace copiado</p>}
      <Button block onClick={() => void deliver.copy()} disabled={!url}><Icon name="copy" />Copiar enlace</Button>
      {canShare() && <Button variant="secondary" block onClick={() => void deliver.share()} disabled={!url}><Icon name="share" />Compartir</Button>}
      <Button variant="quiet" block onClick={onDone}>Listo</Button>
    </div>
  )
}
