import { Route, Routes } from 'react-router'
import { CalendarPage } from './CalendarPage'
import { SettingsPage } from './SettingsPage'
import { ServiceFormPage } from './ServiceFormPage'

export function ProductRoutes() {
  return (
    <Routes>
      <Route path="/servicios/nuevo" element={<ServiceFormPage />} />
      <Route path="/ajustes" element={<SettingsPage />} />
      <Route path="*" element={<CalendarPage />} />
    </Routes>
  )
}
