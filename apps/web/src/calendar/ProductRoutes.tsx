import { Route, Routes } from 'react-router'
import { CalendarPage } from './CalendarPage'
import { SettingsPage } from './SettingsPage'
import { ServiceFormPage } from './ServiceFormPage'
import { NewPersonPage } from '../people/NewPersonPage'
import { PeoplePage } from '../people/PeoplePage'
import { PersonPage } from '../people/PersonPage'

export function ProductRoutes() {
  return (
    <Routes>
      <Route path="/servicios/nuevo" element={<ServiceFormPage />} />
      <Route path="/personas" element={<PeoplePage />} />
      <Route path="/personas/nueva" element={<NewPersonPage />} />
      <Route path="/personas/:personId" element={<PersonPage />} />
      <Route path="/ajustes" element={<SettingsPage />} />
      <Route path="*" element={<CalendarPage />} />
    </Routes>
  )
}
