import { cx } from './cx'
import { Icon, type IconName } from './Icon'

export type ServiceStatus = 'draft' | 'published' | 'completed' | 'cancelled'

// El estado combina texto, icono y forma (borde punteado / tachado): nunca solo color.
const config: Record<ServiceStatus, { label: string; icon: IconName; classes: string }> = {
  draft: { label: 'Borrador', icon: 'dash', classes: 'border-dashed border-draft-bd bg-draft-bg text-draft-fg' },
  published: { label: 'Publicado', icon: 'dot', classes: 'border-pub-bd bg-pub-bg text-pub-fg' },
  completed: { label: 'Completado', icon: 'check', classes: 'border-done-bd bg-done-bg text-done-fg' },
  cancelled: {
    label: 'Cancelado',
    icon: 'x',
    classes: 'border-cancel-bd bg-cancel-bg text-cancel-fg line-through decoration-1',
  },
}

export function StatusChip({ status, className }: { status: ServiceStatus; className?: string }) {
  const { label, icon, classes } = config[status]
  return (
    <span
      className={cx(
        'inline-flex min-h-7 items-center gap-1.5 rounded-full border py-0 pr-3 pl-2 text-[0.8125rem] font-medium',
        classes,
        className,
      )}
    >
      <Icon name={icon} width={14} height={14} strokeWidth={2.25} />
      {label}
    </span>
  )
}
