import { useNavigate } from 'react-router'
import { Button, Icon } from '../ui'
import { useAccess } from './access-api'

/** Entrada a «Cuentas», solo para el superadministrador y los gestores de cuentas (la API lo vuelve a comprobar). */
export function AccountsLink() {
  const navigate = useNavigate()
  const access = useAccess()
  if (!access.data?.owner && !access.data?.accountManager) return null
  return <Button variant="secondary" block onClick={() => void navigate('/cuentas')}>Gestionar cuentas<Icon name="right" /></Button>
}

/** Entrada a «Accesos» de la iglesia activa; la ofrece solo quien la administra. */
export function AccessLink() {
  const navigate = useNavigate()
  return <Button variant="secondary" block onClick={() => void navigate('/accesos')}>Accesos de la iglesia<Icon name="right" /></Button>
}
