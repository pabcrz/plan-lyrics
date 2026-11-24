import { Navigate, Route, Routes, useParams } from 'react-router'
import { ChurchesPage } from './ChurchesPage'
import { AccessPage } from '../access/AccessPage'
import { AccountsPage } from '../access/AccountsPage'
import { BatchPage } from './BatchPage'
import { HomePage } from './HomePage'
import { ShellLayout } from './ShellLayout'
import { ParticipationsPage, RoleParticipationPage } from './ParticipationsPage'
import { SettingsPage } from './SettingsPage'
import { PreachingPlanPage } from './PreachingPlanPage'
import { ServiceFormPage } from './ServiceFormPage'
import { NewPersonPage } from '../people/NewPersonPage'
import { PeoplePage } from '../people/PeoplePage'
import { DocumentPage } from '../share/DocumentPage'
import { NewLinkPage } from '../share/NewLinkPage'
import { SharePage } from '../share/SharePage'
import { ServicePage } from '../setlist/ServicePage'
import { PersonPage } from '../people/PersonPage'
import { ChordsEditPage } from '../lyrics/ChordsEditPage'
import { LyricsEditPage } from '../lyrics/LyricsEditPage'
import { LyricsPage } from '../lyrics/LyricsPage'
import { EditSongPage } from '../songs/EditSongPage'
import { NewSongPage } from '../songs/NewSongPage'
import { SongsPage } from '../songs/SongsPage'

/** Enlaces anteriores al setlist: ahora todo vive en la pantalla del servicio. */
function RedirectToService() {
  return <Navigate to={`/servicios/${useParams().serviceId ?? ''}`} replace />
}

export function ProductRoutes() {
  return (
    <Routes>
      <Route element={<ShellLayout />}>
      <Route path="/servicios/nuevo" element={<ServiceFormPage />} />
      <Route path="/servicios/lote" element={<BatchPage />} />
      <Route path="/servicios/:serviceId" element={<ServicePage />} />
      <Route path="/servicios/:serviceId/setlist" element={<RedirectToService />} />
      <Route path="/canciones" element={<SongsPage />}>
        <Route path="nueva" element={<NewSongPage />} />
        <Route path=":songId/editar" element={<EditSongPage />} />
      </Route>
      <Route path="/canciones/:songId/letra" element={<LyricsPage />} />
      <Route path="/canciones/:songId/letra/editar" element={<LyricsEditPage />} />
      <Route path="/predicaciones" element={<PreachingPlanPage />} />
      <Route path="/canciones/:songId/letra/acordes" element={<ChordsEditPage />} />
      <Route path="/iglesias" element={<ChurchesPage />} />
      <Route path="/personas" element={<PeoplePage />} />
      <Route path="/personas/nueva" element={<NewPersonPage />} />
      <Route path="/personas/:personId" element={<PersonPage />} />
      <Route path="/compartir" element={<SharePage />} />
      <Route path="/compartir/enlace" element={<NewLinkPage />} />
      <Route path="/compartir/documento/:kind" element={<DocumentPage />} />
      <Route path="/ajustes" element={<SettingsPage />} />
      <Route path="/accesos" element={<AccessPage />} />
      <Route path="/cuentas" element={<AccountsPage />} />
      <Route path="/participaciones" element={<ParticipationsPage />} />
      <Route path="/participaciones/:roleId" element={<RoleParticipationPage />} />
      <Route path="/calendario" element={<Navigate to="/" replace />} />
      <Route path="/" element={<HomePage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
