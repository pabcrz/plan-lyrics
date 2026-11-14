import { useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router'
import { Button, Field, Icon, Notice, Segmented, TextField, inputClass } from '../ui'
import { ChurchGate, PageHeader, TopBar } from '../calendar/ChurchGate'
import { useClosedDates, useServices } from '../calendar/api'
import { formatDay, monthOf, shiftMonth, todayIn } from '../calendar/dates'
import type { Church, Service } from '../calendar/model'
import { Notes } from '../calendar/PreachingSection'
import { useSetlist } from '../setlist/setlist-api'
import { docToPng, downloadBlob, fileName, periodLabel, rotaDoc, setlistDoc, type PaperDoc } from './documents'
import { usePreachingDocument, type PreachingDocument } from './share-api'
import { lastDateOf, monthsBetween } from './share-model'

const SLOT = { SINGLE: '', MORNING: ' · mañana', AFTERNOON: ' · tarde' } as const

/** Los documentos son claros como impresos, sin importar el tema de la app: colores propios, no los del tema. */
function Paper({ children }: { children: ReactNode }) {
  return (
    <section aria-label="Vista previa del documento" className="print-area grid gap-3 rounded-lg border border-[#d4d4d4] bg-[#ffffff] p-5 text-[#111] print:rounded-none print:border-0 print:p-0">
      {children}
    </section>
  )
}

function PaperHead({ title, meta }: { title: string; meta: string }) {
  return (
    <header>
      <h3 className="m-0 font-display text-2xl leading-tight font-bold">{title}</h3>
      <p className="m-0 text-sm text-[#555]">{meta}</p>
    </header>
  )
}

function ListPaper({ doc, empty }: { doc: PaperDoc; empty: string }) {
  return (
    <Paper>
      <PaperHead title={doc.title} meta={doc.meta} />
      {doc.rows.length === 0 ? <p className="m-0 text-[#555]">{empty}</p> : (
        <dl className="m-0 grid grid-cols-[max-content_1fr] gap-x-4 gap-y-2">
          {doc.rows.map((row, index) => (
            <div key={index} className="contents">
              <dt className={`font-semibold ${row.muted ? 'text-[#6b6b6b]' : 'text-[#555]'}`}>{row.lead}</dt>
              <dd className={`m-0 ${row.muted ? 'text-[#6b6b6b]' : ''}`}>{row.text}</dd>
            </div>
          ))}
        </dl>
      )}
      {doc.foot && <p className="m-0 mt-2 text-[#555] italic">{doc.foot}</p>}
    </Paper>
  )
}

/** Abre la impresión del navegador con el nombre del documento como título, para que «Guardar como PDF» lo use. */
function printDocument(title: string) {
  const previous = document.title
  document.title = title
  const restore = () => { document.title = previous; window.removeEventListener('afterprint', restore) }
  window.addEventListener('afterprint', restore)
  window.print()
}

const canShareFiles = (file: File) => typeof navigator !== 'undefined' && typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })

/** Marco común: opciones, vista previa y acciones; lo que no es la hoja no se imprime. */
function Frame({ church, title, intro, options, paper, actions }: { church: Church; title: string; intro: string; options: ReactNode; paper: ReactNode; actions: ReactNode }) {
  return (
    <div className="mx-auto flex min-h-dvh max-w-[480px] flex-col">
      <div className="no-print"><TopBar name={church.name} settings={church.canConfigure} /><PageHeader title={title} back="/compartir" backLabel="Volver a compartir" /></div>
      <main className="grid flex-1 content-start gap-5 p-4">
        <div className="no-print grid gap-5">
          <p className="m-0 text-text-2">{intro}</p>
          {options}
          <h2 className="m-0 text-sm font-semibold">Vista previa</h2>
        </div>
        {paper}
      </main>
      <div className="no-print sticky bottom-0 grid gap-2 border-t border-line bg-bg px-4 py-3">{actions}</div>
    </div>
  )
}

function useDelivery() {
  const [failure, setFailure] = useState('')
  const [busy, setBusy] = useState(false)
  async function run(task: () => Promise<void>, error: string) {
    setBusy(true)
    setFailure('')
    try { await task() } catch (caught) {
      // Cerrar el menú de compartir no es un fallo.
      if (!(caught instanceof DOMException && caught.name === 'AbortError')) setFailure(error)
    } finally { setBusy(false) }
  }
  return { failure, busy, run }
}

/** Descargar la imagen o, si el navegador lo permite, compartirla como archivo. */
function ImageActions({ doc, name, ready }: { doc: PaperDoc; name: string; ready: boolean }) {
  const delivery = useDelivery()
  return (
    <>
      {delivery.failure && <Notice tone="warn" icon="alert" role="alert">{delivery.failure}</Notice>}
      <Button block disabled={!ready} loading={delivery.busy} onClick={() => void delivery.run(async () => downloadBlob(await docToPng(doc), name), 'No se pudo crear la imagen en este navegador.')}>Descargar imagen</Button>
      <Button variant="quiet" block disabled={!ready || delivery.busy}
        onClick={() => void delivery.run(async () => {
          const file = new File([await docToPng(doc)], name, { type: 'image/png' })
          if (!canShareFiles(file)) throw new Error('unsupported')
          await navigator.share({ files: [file], title: doc.title })
        }, 'Este navegador no puede compartir la imagen. Descárgala y compártela desde tus archivos.')}><Icon name="share" />Compartir</Button>
    </>
  )
}

function DateRange({ from, to, onFrom, onTo }: { from: string; to: string; onFrom: (value: string) => void; onTo: (value: string) => void }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <TextField label="Desde" type="date" value={from} onChange={(event) => onFrom(event.target.value)} />
      <TextField label="Hasta" type="date" value={to} onChange={(event) => onTo(event.target.value)} error={from > to ? 'Debe ser posterior a «Desde».' : undefined} />
    </div>
  )
}

function LoadState({ loading, error }: { loading: boolean; error: boolean }) {
  if (error) return <Notice tone="warn" icon="alert" role="alert" title="No se pudieron cargar los datos">Revisa tu conexión e inténtalo de nuevo.</Notice>
  return loading ? <p role="status" className="m-0 text-text-2">Cargando…</p> : null
}

// ---------- Setlist en imagen ----------

function SetlistImage({ church }: { church: Church }) {
  const today = todayIn()
  const base = monthOf(today)
  const { services, loading, error } = useServices([shiftMonth(base, -1), base, shiftMonth(base, 1), shiftMonth(base, 2)])
  const [pick, setPick] = useState('')
  const options = services.filter((service) => service.status !== 'CANCELLED').sort((a, b) => a.date.localeCompare(b.date) || a.slot.localeCompare(b.slot))
  const chosen = options.find((service) => service.id === pick) ?? options.find((service) => service.date >= today) ?? options.at(-1)
  const select = (
    <Field label="Servicio" error={!loading && !error && options.length === 0 ? 'No hay servicios recientes ni próximos.' : undefined}>
      {(control) => (
        <select {...control} className={inputClass} value={chosen?.id ?? ''} onChange={(event) => setPick(event.target.value)} disabled={options.length === 0}>
          {options.map((service) => <option key={service.id} value={service.id}>{formatDay(service.date)}{SLOT[service.slot]} · {service.title}</option>)}
        </select>
      )}
    </Field>
  )
  const intro = 'Una imagen con la fecha y las canciones numeradas, cada una con su autor entre paréntesis.'
  if (!chosen) return <Frame church={church} title="Setlist en imagen" intro={intro} options={<>{select}<LoadState loading={loading} error={Boolean(error)} /></>} paper={null} actions={<Button block disabled>Descargar imagen</Button>} />
  return <SetlistFor key={chosen.id} church={church} service={chosen} select={select} intro={intro} />
}

function SetlistFor({ church, service, select, intro }: { church: Church; service: Service; select: ReactNode; intro: string }) {
  const setlist = useSetlist(service.id)
  const doc = setlistDoc({ church: church.name, date: service.date, entries: setlist.data?.entries ?? [] })
  const name = fileName('setlist', service.date)
  const ready = doc.rows.length > 0
  return (
    <Frame church={church} title="Setlist en imagen" intro={intro}
      options={<>{select}<LoadState loading={setlist.isPending} error={setlist.isError} />
        {setlist.data && !ready && <Notice tone="warn" icon="alert" title="Este servicio aún no tiene canciones">Prepara el setlist para poder compartirlo en imagen.</Notice>}</>}
      paper={setlist.data ? <ListPaper doc={doc} empty="Sin canciones." /> : null}
      actions={<ImageActions doc={doc} name={name} ready={ready} />} />
  )
}

// ---------- Lista mensual de dirección ----------

function Rota({ church }: { church: Church }) {
  const today = todayIn()
  const [format, setFormat] = useState<'img' | 'pdf'>('img')
  const [from, setFrom] = useState(`${monthOf(today)}-01`)
  const [to, setTo] = useState(lastDateOf(monthOf(today)))
  const [message, setMessage] = useState('')
  const months = monthsBetween(from, to)
  const { services, loading, error } = useServices(months)
  const closed = useClosedDates(months)
  const doc = rotaDoc({ from, to, services, closed: closed.closed, message })
  const reversed = from > to
  const name = fileName('rol-alabanza', from.slice(0, 7))
  const ready = !reversed && doc.rows.length > 0 && !loading && !closed.loading
  return (
    <Frame church={church} title="Lista mensual de dirección" intro="Un documento con el título «Rol alabanza», el mes y quién dirige cada fecha."
      options={<>
        <Segmented label="Formato" value={format} onChange={setFormat} options={[{ value: 'img', label: 'Imagen' }, { value: 'pdf', label: 'PDF' }]} />
        <DateRange from={from} to={to} onFrom={setFrom} onTo={setTo} />
        <TextField label="Mensaje o versículo al pie (opcional)" value={message} maxLength={200} onChange={(event) => setMessage(event.target.value)} autoComplete="off" />
        <LoadState loading={loading || closed.loading} error={Boolean(error || closed.error)} />
        {!ready && !loading && !closed.loading && !reversed && !error && <Notice tone="warn" icon="alert" title="No hay fechas en este rango">Elige otro rango.</Notice>}
      </>}
      paper={<ListPaper doc={doc} empty="No hay fechas en este rango." />}
      actions={<>
        {format === 'img' ? <ImageActions doc={doc} name={name} ready={ready} /> : (
          <>
            <Button block disabled={!ready} onClick={() => printDocument(`Rol alabanza ${periodLabel(from, to)}`)}>Descargar PDF</Button>
            <p className="m-0 text-center text-[0.8125rem] text-text-3">Se abre la impresión del navegador: elige «Guardar como PDF».</p>
          </>
        )}
      </>} />
  )
}

// ---------- PDF de predicaciones ----------

function PreachingPdf({ church }: { church: Church }) {
  const today = todayIn()
  const [from, setFrom] = useState(`${monthOf(today)}-01`)
  const [to, setTo] = useState(lastDateOf(monthOf(today)))
  const data = usePreachingDocument(from, to, church.usesPreaching)
  type Row = { kind: 'service'; date: string; order: string; item: PreachingDocument['services'][number] } | { kind: 'closed'; date: string; order: string; closed: PreachingDocument['closedDates'][number] }
  const rows: Row[] = data.data
    ? [...data.data.services.map((item): Row => ({ kind: 'service', date: item.date, order: item.slot, item })), ...data.data.closedDates.map((closed): Row => ({ kind: 'closed', date: closed.date, order: 'SINGLE', closed }))]
      .sort((a, b) => a.date.localeCompare(b.date) || a.order.localeCompare(b.order))
    : []
  const ready = from <= to && rows.length > 0
  return (
    <Frame church={church} title="PDF de predicaciones" intro="Para entregarlo en papel: fechas, a quién le toca, tema, citas y puntos a considerar."
      options={<>
        {!church.usesPreaching ? <Notice tone="warn" icon="alert" title="Tu iglesia no usa la predicación">Actívala en Ajustes para generar este documento.</Notice> : <DateRange from={from} to={to} onFrom={setFrom} onTo={setTo} />}
        <LoadState loading={data.isPending && church.usesPreaching && from <= to} error={data.isError} />
        {data.data && rows.length === 0 && <Notice tone="warn" icon="alert" title="No hay predicaciones en estas fechas">Elige otro rango.</Notice>}
      </>}
      paper={data.data ? (
        <Paper>
          <PaperHead title="Predicaciones" meta={`${data.data.church} · ${periodLabel(from, to)}`} />
          {rows.length > 0 && (
            <table className="w-full border-collapse text-left text-[0.9375rem]">
              <thead><tr className="border-b border-[#bdbdbd] text-[0.8125rem] text-[#555]"><th className="py-1.5 pr-2 font-semibold">Fecha</th><th className="py-1.5 pr-2 font-semibold">Predica</th><th className="py-1.5 font-semibold">Tema y citas</th></tr></thead>
              <tbody>
                {rows.map((row) => row.kind === 'service' ? (
                  <tr key={`${row.date}-${row.order}`} className="break-inside-avoid border-b border-[#e5e5e5] align-top">
                    <td className="py-2 pr-2 font-semibold whitespace-nowrap">{formatDay(row.date)}{SLOT[row.item.slot]}</td>
                    <td className="py-2 pr-2">{row.item.preacher ?? '—'}</td>
                    <td className="py-2">
                      {row.item.topic && <b className="block">{row.item.topic}</b>}
                      {row.item.passages.length > 0 && <span className="block text-[0.8125rem] text-[#555]">{row.item.passages.join(' · ')}</span>}
                      {row.item.notes && <div className="mt-1"><Notes notes={row.item.notes} /></div>}
                    </td>
                  </tr>
                ) : (
                  <tr key={`closed-${row.date}`} className="border-b border-[#e5e5e5] text-[#6b6b6b]">
                    <td className="py-2 pr-2 font-semibold whitespace-nowrap">{formatDay(row.date)}</td>
                    <td className="py-2" colSpan={2}>No hay culto{row.closed.reason ? ` · ${row.closed.reason}` : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Paper>
      ) : null}
      actions={<>
        <Button block disabled={!ready} onClick={() => printDocument(`Predicaciones ${periodLabel(from, to)}`)}>Descargar PDF</Button>
        <p className="m-0 text-center text-[0.8125rem] text-text-3">Se abre la impresión del navegador: elige «Guardar como PDF».</p>
      </>} />
  )
}

const kinds = { imagen: SetlistImage, rol: Rota, predicaciones: PreachingPdf } as const

/** `/compartir/documento/:kind`: imagen del setlist, lista mensual de dirección o PDF de predicaciones. */
export function DocumentPage() {
  const { kind = '' } = useParams()
  const Screen = kind in kinds ? kinds[kind as keyof typeof kinds] : null
  return (
    <ChurchGate>
      {(church) => !church.canEdit ? (
        <main className="mx-auto max-w-[480px]"><TopBar name={church.name} /><PageHeader title="Compartir" back="/compartir" backLabel="Volver a compartir" />
          <div className="p-4"><Notice title="Solo para quien edita">Crear documentos para compartir requiere administrar o editar servicios en tu iglesia.</Notice></div></main>
      ) : Screen ? <Screen church={church} /> : (
        <main className="mx-auto max-w-[480px]"><TopBar name={church.name} /><PageHeader title="Compartir" back="/compartir" backLabel="Volver a compartir" />
          <div className="grid gap-3 p-4"><Notice title="No existe ese documento">Elige uno desde Compartir.</Notice><Link to="/compartir" className="text-accent">Volver a compartir</Link></div></main>
      )}
    </ChurchGate>
  )
}
