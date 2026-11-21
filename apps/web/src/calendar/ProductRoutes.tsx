import { Route, Routes } from 'react-router'
import { AccessPage } from '../access/AccessPage'
import { AccountsPage } from '../access/AccountsPage'
import { BatchPage } from './BatchPage'
import { CalendarPage } from './CalendarPage'
import { ParticipationsPage, RoleParticipationPage } from './ParticipationsPage'
import { SettingsPage } from './SettingsPage'
import { ServiceFormPage } from './ServiceFormPage'
import { NewPersonPage } from '../people/NewPersonPage'
import { PeoplePage } from '../people/PeoplePage'
import { DocumentPage } from '../share/DocumentPage'
import { NewLinkPage } from '../share/NewLinkPage'
import { SharePage } from '../share/SharePage'
import { SetlistPage } from '../setlist/SetlistPage'
import { PersonPage } from '../people/PersonPage'
import { ChordsEditPage } from '../lyrics/ChordsEditPage'
import { LyricsEditPage } from '../lyrics/LyricsEditPage'
import { LyricsPage } from '../lyrics/LyricsPage'
import { NewSongPage } from '../songs/NewSongPage'
import { SongsPage } from '../songs/SongsPage'

export function ProductRoutes() {
  return (
    <Routes>
      <Route path="/servicios/nuevo" element={<ServiceFormPage />} />
      <Route path="/servicios/lote" element={<BatchPage />} />
      <Route path="/servicios/:serviceId/setlist" element={<SetlistPage />} />
      <Route path="/canciones" element={<SongsPage />} />
      <Route path="/canciones/nueva" element={<NewSongPage />} />
      <Route path="/canciones/:songId/letra" element={<LyricsPage />} />
      <Route path="/canciones/:songId/letra/editar" element={<LyricsEditPage />} />
      <Route path="/canciones/:songId/letra/acordes" element={<ChordsEditPage />} />
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
      <Route path="*" element={<CalendarPage />} />
    </Routes>
  )
}
