import { Route, Routes } from 'react-router'
import { BatchPage } from './BatchPage'
import { CalendarPage } from './CalendarPage'
import { ParticipationsPage, RoleParticipationPage } from './ParticipationsPage'
import { SettingsPage } from './SettingsPage'
import { ServiceFormPage } from './ServiceFormPage'
import { NewPersonPage } from '../people/NewPersonPage'
import { PeoplePage } from '../people/PeoplePage'
import { NewLinkPage } from '../share/NewLinkPage'
import { SharePage } from '../share/SharePage'
import { SetlistPage } from '../setlist/SetlistPage'
import { PersonPage } from '../people/PersonPage'

export function ProductRoutes() {
  return (
    <Routes>
      <Route path="/servicios/nuevo" element={<ServiceFormPage />} />
      <Route path="/servicios/lote" element={<BatchPage />} />
      <Route path="/servicios/:serviceId/setlist" element={<SetlistPage />} />
      <Route path="/personas" element={<PeoplePage />} />
      <Route path="/personas/nueva" element={<NewPersonPage />} />
      <Route path="/personas/:personId" element={<PersonPage />} />
      <Route path="/compartir" element={<SharePage />} />
      <Route path="/compartir/enlace" element={<NewLinkPage />} />
      <Route path="/ajustes" element={<SettingsPage />} />
      <Route path="/participaciones" element={<ParticipationsPage />} />
      <Route path="/participaciones/:roleId" element={<RoleParticipationPage />} />
      <Route path="*" element={<CalendarPage />} />
    </Routes>
  )
}
