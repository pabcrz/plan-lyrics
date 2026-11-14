import { useState } from 'react'
import { useNavigate } from 'react-router'
import { Button, Icon, Notice, Switch, Toast, type IconName } from '../ui'
import { ChurchGate, PageHeader, TopBar } from '../calendar/ChurchGate'
import { ApiError, useSaveChurch } from '../calendar/api'
import type { Church } from '../calendar/model'
import { LinkSheet } from './LinkSheets'
import { useShareLinks } from './share-api'
import { expiryNote, scopeLabel, versionLabel, type ShareLink } from './share-model'

export function SharePage() {
  return <ChurchGate>{(church) => (church.canEdit ? <Home church={church} /> : <ReadOnly church={church} />)}</ChurchGate>
}

function ReadOnly({ church }: { church: Church }) {
  return (
    <main className="mx-auto max-w-[480px]">
      <TopBar name={church.name} />
      <PageHeader title="Compartir" />
      <div className="p-4"><Notice title="Solo para quien edita">Crear y gestionar lo que se comparte requiere administrar o editar servicios en tu iglesia.</Notice></div>
    </main>
  )
}

function Pill({ active }: { active: boolean }) {
  return active
    ? <span className="inline-flex min-h-7 items-center gap-1 rounded-full border border-pub-bd bg-pub-bg py-0 pr-3 pl-2 text-[0.8125rem] font-medium text-pub-fg"><Icon name="check" width={14} height={14} />Activo</span>
    : <span className="inline-flex min-h-7 items-center gap-1 rounded-full border border-line-strong bg-surface-2 py-0 pr-3 pl-2 text-[0.8125rem] font-medium text-text-2"><Icon name="lock" width={14} height={14} />Desactivado</span>
}

function LinkRow({ link, onOpen }: { link: ShareLink; onOpen: () => void }) {
  return (
    <li>
      <button type="button" onClick={onOpen} className="flex min-h-16 w-full cursor-pointer items-center gap-3 rounded-md border border-line bg-surface px-3 py-2 text-left">
        <span className="flex-1 font-semibold">{versionLabel[link.version]} · {scopeLabel(link.scope)}<small className="block font-normal text-text-3">{expiryNote(link)}</small></span>
        <Pill active={link.status === 'ACTIVE'} />
      </button>
    </li>
  )
}

function CreateRow({ icon, title, hint, to }: { icon: IconName; title: string; hint: string; to: string }) {
  const navigate = useNavigate()
  return (
    <button type="button" onClick={() => void navigate(to)} className="flex min-h-16 w-full cursor-pointer items-center gap-3 rounded-md border border-line bg-surface px-3 py-2 text-left">
      <span className="grid size-10 flex-none place-items-center rounded-md bg-accent-soft text-accent-soft-text"><Icon name={icon} /></span>
      <span className="flex-1 font-semibold">{title}<small className="block font-normal text-text-3">{hint}</small></span>
      <Icon name="right" />
    </button>
  )
}

/** La vista pública del setlist para la congregación; mostrar predicador y tema es un ajuste de la iglesia. */
function Congregation({ church, onDone }: { church: Church; onDone: (message: string) => void }) {
  const save = useSaveChurch()
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState('')
  async function change(on: boolean) {
    setBusy(true)
    setFailure('')
    try {
      await save({ name: church.name, sundayDouble: church.sundayDouble, usesPreaching: church.usesPreaching, days: church.days, congregationShowsPreacher: on })
      onDone(on ? 'Los congregantes verán predicador y tema' : 'Los congregantes ya no ven predicador ni tema')
    } catch (error) {
      setFailure(error instanceof ApiError && error.status === 403 ? 'Solo quien administra la iglesia puede cambiarlo.' : 'No se pudo guardar el cambio. Inténtalo de nuevo.')
    } finally { setBusy(false) }
  }
  return (
    <section aria-labelledby="congregantes" className="grid gap-2">
      <h2 id="congregantes" className="m-0 text-sm font-semibold">Vista de congregantes</h2>
      <CreateRow icon="music" title="Enlace para congregantes" hint="El setlist de la alabanza, sin directores ni equipos." to="/compartir/enlace?para=congregantes" />
      {church.usesPreaching ? (
        <div className="rounded-md border border-line bg-surface p-3">
          <Switch checked={church.congregationShowsPreacher} onCheckedChange={(on) => void change(on)} disabled={busy || !church.canConfigure}
            label="Mostrar predicador y tema" description="Sin notas ni citas. Nunca muestra directores, equipos ni listas de personas." />
          {!church.canConfigure && <p className="m-0 mt-2 text-[0.8125rem] text-text-3">Solo quien administra la iglesia puede cambiarlo.</p>}
        </div>
      ) : (
        <p className="m-0 text-[0.8125rem] text-text-3">Tu iglesia no usa la predicación, así que la vista de congregantes solo muestra el setlist.</p>
      )}
      {failure && <Notice tone="warn" icon="alert" role="alert">{failure}</Notice>}
    </section>
  )
}

function Home({ church }: { church: Church }) {
  const links = useShareLinks(true)
  const [openId, setOpenId] = useState<string | null>(null)
  const [toast, setToast] = useState('')
  // La hoja lee el enlace de la lista viva: tras revocar o reactivar muestra siempre lo que dice el servidor.
  const open = links.data?.find((link) => link.id === openId) ?? null
  return (
    <div className="mx-auto flex min-h-dvh max-w-[480px] flex-col">
      <TopBar name={church.name} settings={church.canConfigure} />
      <PageHeader title="Compartir" backLabel="Cerrar y volver al calendario" />
      <main className="grid flex-1 content-start gap-5 p-4">
        <p className="m-0 text-text-2">Quien lo recibe no necesita una cuenta. Elige qué compartir.</p>
        <section aria-labelledby="crear" className="grid gap-2">
          <h2 id="crear" className="m-0 text-sm font-semibold">Crear</h2>
          <CreateRow icon="link" title="Enlace para el ministerio" hint="Alabanza, predicación o servicio completo. Solo lectura." to="/compartir/enlace" />
          <CreateRow icon="image" title="Setlist en imagen" hint="La fecha y las canciones numeradas, con su autor." to="/compartir/documento/imagen" />
          <CreateRow icon="mic" title="Lista mensual de dirección" hint="«Rol alabanza» del mes, en imagen o PDF." to="/compartir/documento/rol" />
          {church.usesPreaching && <CreateRow icon="doc" title="PDF de predicaciones" hint="Fechas, quién predica, tema, citas y puntos. Para imprimir." to="/compartir/documento/predicaciones" />}
        </section>
        <section aria-labelledby="enlaces" className="grid gap-2">
          <h2 id="enlaces" className="m-0 text-sm font-semibold">Enlaces del ministerio</h2>
          {links.isPending && <p role="status" className="m-0 text-text-2">Cargando enlaces…</p>}
          {links.isError && (
            <>
              <Notice tone="warn" icon="alert" role="alert" title="No se pudieron cargar los enlaces">Revisa tu conexión e inténtalo de nuevo.</Notice>
              <Button variant="secondary" onClick={() => void links.refetch()}>Reintentar</Button>
            </>
          )}
          {links.data?.length === 0 && <p className="m-0 text-text-2">Aún no hay enlaces. Los que crees aparecerán aquí.</p>}
          {links.data && links.data.length > 0 && <ul className="m-0 grid list-none gap-2 p-0">{links.data.map((link) => <LinkRow key={link.id} link={link} onOpen={() => setOpenId(link.id)} />)}</ul>}
          <p className="m-0 text-[0.8125rem] text-text-3">Cada enlace está activo hasta 30 días después del último servicio que incluye. Puedes revocarlo cuando quieras.</p>
        </section>
        <Congregation church={church} onDone={setToast} />
      </main>
      {toast !== '' && <div className="px-4 pb-4"><Toast message={toast} onDismiss={() => setToast('')} /></div>}
      <LinkSheet link={open} onClose={() => setOpenId(null)} onDone={setToast} />
    </div>
  )
}
