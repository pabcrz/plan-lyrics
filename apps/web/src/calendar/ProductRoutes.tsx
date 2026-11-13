import { Route, Routes } from 'react-router'
import { CalendarPage } from './CalendarPage'
import { ServiceFormPage } from './ServiceFormPage'

export function ProductRoutes() {
  return (
    <Routes>
      <Route path="/servicios/nuevo" element={<ServiceFormPage />} />
      <Route path="*" element={<CalendarPage />} />
    </Routes>
  )
}
