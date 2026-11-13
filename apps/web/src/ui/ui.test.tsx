import '@testing-library/jest-dom/vitest'
import { useState } from 'react'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, test, vi } from 'vitest'
import {
  Button, Notice, PersonPicker, Segmented, Sheet, StatusChip, Switch, Tabbar, TextField, TimeWheel, Toast,
  format12h, from24h, to24h, type Person, type Time12,
} from '.'
import Reference from './Reference'

afterEach(cleanup)

describe('Button', () => {
  test('exposes its name and fires on click', () => {
    const onClick = vi.fn()
    render(<Button onClick={onClick}>Guardar</Button>)
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    expect(onClick).toHaveBeenCalledOnce()
  })

  test('loading is announced as busy and blocks further clicks', () => {
    const onClick = vi.fn()
    render(<Button loading onClick={onClick}>Creando…</Button>)
    const button = screen.getByRole('button', { name: 'Creando…' })
    expect(button).toHaveAttribute('aria-busy', 'true')
    fireEvent.click(button)
    expect(onClick).not.toHaveBeenCalled()
  })

  test('disabled and icon-only buttons keep their accessible state and name', () => {
    render(<><Button disabled>Nada</Button><Button icon aria-label="Más acciones" variant="secondary">⋯</Button></>)
    expect(screen.getByRole('button', { name: 'Nada' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Más acciones' })).toBeEnabled()
  })
})

describe('TextField', () => {
  test('links label, help and error to the input', () => {
    render(<TextField label="Hora" help="Ejemplo 19:30" error="Hora inválida" />)
    const input = screen.getByLabelText('Hora')
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(input).toHaveAccessibleDescription('Hora inválida Ejemplo 19:30')
  })

  test('without error it is valid and only described by the help', () => {
    render(<TextField label="Título" help="Visible al publicar" />)
    const input = screen.getByLabelText('Título')
    expect(input).not.toHaveAttribute('aria-invalid')
    expect(input).toHaveAccessibleDescription('Visible al publicar')
  })
})

describe('StatusChip', () => {
  test.each([
    ['draft', 'Borrador'],
    ['published', 'Publicado'],
    ['completed', 'Completado'],
    ['cancelled', 'Cancelado'],
  ] as const)('%s is conveyed by text, not only color', (status, label) => {
    const { container } = render(<StatusChip status={status} />)
    expect(screen.getByText(label)).toBeInTheDocument()
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
  })

  test('draft is dashed and cancelled is struck through', () => {
    render(<><StatusChip status="draft" /><StatusChip status="cancelled" /></>)
    expect(screen.getByText('Borrador').className).toContain('border-dashed')
    expect(screen.getByText('Cancelado').className).toContain('line-through')
  })
})

describe('Notice', () => {
  test('renders title and content, with an optional alert role', () => {
    render(<Notice title="Se crearán 3" role="alert">Vie 6, 13 y 20.</Notice>)
    expect(screen.getByRole('alert')).toHaveTextContent('Se crearán 3Vie 6, 13 y 20.')
  })
})

describe('Switch', () => {
  test('toggles with role switch and is described', () => {
    const onChange = vi.fn()
    render(<Switch checked={false} onCheckedChange={onChange} label="Dos servicios" description="Mañana y tarde" />)
    const sw = screen.getByRole('switch', { name: 'Dos servicios' })
    expect(sw).toHaveAttribute('aria-checked', 'false')
    expect(sw).toHaveAccessibleDescription('Mañana y tarde')
    fireEvent.click(sw)
    expect(onChange).toHaveBeenCalledWith(true)
  })
})

describe('Segmented', () => {
  test('marks the selected option with aria-pressed and reports changes', () => {
    const onChange = vi.fn()
    render(
      <Segmented label="Tipo" value="a" onChange={onChange}
        options={[{ value: 'a', label: 'Por día' }, { value: 'b', label: 'Entre todos' }]} />,
    )
    const group = screen.getByRole('group', { name: 'Tipo' })
    expect(within(group).getByRole('button', { name: 'Por día' })).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(within(group).getByRole('button', { name: 'Entre todos' }))
    expect(onChange).toHaveBeenCalledWith('b')
  })
})

describe('Tabbar', () => {
  const items = [
    { id: 'cal', label: 'Calendario', icon: 'calendar' },
    { id: 'people', label: 'Personas', icon: 'users' },
  ] as const

  test('marks the current destination and selects another', () => {
    const onSelect = vi.fn()
    render(<Tabbar label="Principal" items={items} current="cal" onSelect={onSelect} />)
    const nav = screen.getByRole('navigation', { name: 'Principal' })
    expect(within(nav).getByRole('button', { name: 'Calendario' })).toHaveAttribute('aria-current', 'page')
    expect(within(nav).getByRole('button', { name: 'Personas' })).not.toHaveAttribute('aria-current')
    fireEvent.click(within(nav).getByRole('button', { name: 'Personas' }))
    expect(onSelect).toHaveBeenCalledWith('people')
  })

  test('shows the central action only when provided', () => {
    const onAction = vi.fn()
    const { rerender } = render(<Tabbar label="Principal" items={items} current="cal" onSelect={vi.fn()} />)
    expect(screen.queryByRole('button', { name: 'Nuevo' })).toBeNull()
    rerender(<Tabbar label="Principal" items={items} current="cal" onSelect={vi.fn()} action={{ label: 'Nuevo', icon: 'plus', onAction }} />)
    fireEvent.click(screen.getByRole('button', { name: 'Nuevo' }))
    expect(onAction).toHaveBeenCalledOnce()
  })
})

describe('Sheet', () => {
  function Host({ onClose = () => undefined }: { onClose?: () => void }) {
    const [open, setOpen] = useState(false)
    return (
      <>
        <button onClick={() => setOpen(true)}>Abrir</button>
        <Sheet open={open} onClose={() => { onClose(); setOpen(false) }} title="Nuevo">
          <button>Servicio individual</button>
          <button>Lote mensual</button>
        </Sheet>
      </>
    )
  }

  test('is a labelled modal dialog that renders nothing while closed', () => {
    render(<Host />)
    expect(screen.queryByRole('dialog')).toBeNull()
    fireEvent.click(screen.getByText('Abrir'))
    const dialog = screen.getByRole('dialog', { name: 'Nuevo' })
    expect(dialog).toHaveAttribute('aria-modal', 'true')
  })

  test('moves focus in, traps Tab and Shift+Tab, and Escape closes returning focus', () => {
    const onClose = vi.fn()
    render(<Host onClose={onClose} />)
    const opener = screen.getByText('Abrir')
    opener.focus()
    fireEvent.click(opener)
    const first = screen.getByRole('button', { name: 'Servicio individual' })
    const last = screen.getByRole('button', { name: 'Lote mensual' })
    expect(first).toHaveFocus()
    last.focus()
    fireEvent.keyDown(document, { key: 'Tab' })
    expect(first).toHaveFocus()
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true })
    expect(last).toHaveFocus()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledOnce()
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(opener).toHaveFocus()
  })

  test('clicking the scrim closes, clicking inside does not', () => {
    const onClose = vi.fn()
    render(<Sheet open onClose={onClose} title="Hoja"><button>Dentro</button></Sheet>)
    fireEvent.mouseDown(screen.getByRole('button', { name: 'Dentro' }))
    expect(onClose).not.toHaveBeenCalled()
    fireEvent.mouseDown(screen.getByRole('dialog').parentElement!)
    expect(onClose).toHaveBeenCalledOnce()
  })
})

describe('Toast', () => {
  test('announces politely, undoes and dismisses', () => {
    const onUndo = vi.fn()
    const onDismiss = vi.fn()
    render(<Toast message="Se crearon 3 servicios" onUndo={onUndo} onDismiss={onDismiss} />)
    expect(screen.getByRole('status')).toHaveTextContent('Se crearon 3 servicios')
    fireEvent.click(screen.getByRole('button', { name: 'Deshacer' }))
    expect(onUndo).toHaveBeenCalledOnce()
    expect(onDismiss).toHaveBeenCalledOnce()
  })

  test('dismisses itself after its duration and has no undo without a handler', () => {
    vi.useFakeTimers()
    const onDismiss = vi.fn()
    render(<Toast message="Guardado" onDismiss={onDismiss} duration={1000} />)
    expect(screen.queryByRole('button', { name: 'Deshacer' })).toBeNull()
    act(() => { vi.advanceTimersByTime(1000) })
    expect(onDismiss).toHaveBeenCalledOnce()
    vi.useRealTimers()
  })
})

describe('PersonPicker', () => {
  const people: Person[] = [
    { id: '1', name: 'Ricardo Mena', detail: 'Guitarra' },
    { id: '2', name: 'Ricardo Soto', detail: 'Piano' },
  ]
  function setup(query = 'Ric', withAdd = true) {
    const onSelect = vi.fn()
    const onAddNew = withAdd ? vi.fn() : undefined
    render(<PersonPicker label="Director" query={query} onQueryChange={vi.fn()} people={people} onSelect={onSelect} onAddNew={onAddNew} />)
    const input = screen.getByRole('combobox', { name: 'Director' })
    fireEvent.focus(input)
    return { input, onSelect, onAddNew }
  }

  test('lists options and offers adding a new person', () => {
    const { input } = setup()
    expect(input).toHaveAttribute('aria-expanded', 'true')
    const list = screen.getByRole('listbox')
    expect(within(list).getAllByRole('option')).toHaveLength(3)
    expect(screen.getByRole('option', { name: /Agregar «Ric» como persona nueva/ })).toBeInTheDocument()
  })

  test('does not offer adding when the name already exists or the add handler is absent', () => {
    setup('ricardo mena')
    expect(screen.queryByRole('option', { name: /Agregar/ })).toBeNull()
    cleanup()
    setup('Zoe', false)
    expect(screen.queryByRole('option', { name: /Agregar/ })).toBeNull()
  })

  test('arrow keys move the active option and Enter selects it', () => {
    const { input, onSelect } = setup()
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    const active = screen.getAllByRole('option').find((o) => o.getAttribute('aria-selected') === 'true')!
    expect(input).toHaveAttribute('aria-activedescendant', active.id)
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onSelect).toHaveBeenCalledWith(people[1])
  })

  test('clicking an option selects it, Escape closes the list, adding calls onAddNew', () => {
    const { input, onSelect, onAddNew } = setup()
    fireEvent.click(screen.getByRole('option', { name: /Ricardo Mena/ }))
    expect(onSelect).toHaveBeenCalledWith(people[0])
    fireEvent.focus(input)
    fireEvent.click(screen.getByRole('option', { name: /Agregar/ }))
    expect(onAddNew).toHaveBeenCalledWith('Ric')
    fireEvent.focus(input)
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(screen.queryByRole('listbox')).toBeNull()
  })

  test('shows the error next to the field', () => {
    render(<PersonPicker label="Director" query="" onQueryChange={vi.fn()} people={[]} onSelect={vi.fn()} error="Elige un director" />)
    expect(screen.getByRole('combobox', { name: 'Director' })).toHaveAccessibleDescription('Elige un director')
  })
})

describe('time helpers', () => {
  test('12 a.m. and 12 p.m. convert correctly', () => {
    expect(to24h({ hour: 12, minute: 0, meridiem: 'am' })).toBe('00:00')
    expect(to24h({ hour: 12, minute: 0, meridiem: 'pm' })).toBe('12:00')
    expect(to24h({ hour: 7, minute: 30, meridiem: 'pm' })).toBe('19:30')
    expect(from24h('00:15')).toEqual({ hour: 12, minute: 15, meridiem: 'am' })
    expect(from24h('12:00')).toEqual({ hour: 12, minute: 0, meridiem: 'pm' })
  })
  test('minutes snap to the nearest quarter hour', () => {
    expect(from24h('09:07').minute).toBe(0)
    expect(from24h('09:10').minute).toBe(15)
    expect(from24h('09:58').minute).toBe(45)
  })
  test('formats with a.m./p.m.', () => {
    expect(format12h({ hour: 12, minute: 15, meridiem: 'am' })).toBe('12:15 a.m.')
  })
})

describe('TimeWheel', () => {
  const value: Time12 = { hour: 7, minute: 30, meridiem: 'pm' }

  test('lists 12 before 1, minutes every 15 and a.m./p.m., marking the current value', () => {
    render(<TimeWheel value={value} onChange={vi.fn()} />)
    const hours = within(screen.getByRole('listbox', { name: 'Hora' })).getAllByRole('option').map((o) => o.textContent)
    expect(hours).toEqual(['12', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11'])
    const minutes = within(screen.getByRole('listbox', { name: 'Minutos' })).getAllByRole('option').map((o) => o.textContent)
    expect(minutes).toEqual(['00', '15', '30', '45'])
    expect(screen.getByRole('option', { name: '7' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('option', { name: '30' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('option', { name: 'p.m.' })).toHaveAttribute('aria-selected', 'true')
  })

  test('clicking and arrow keys change one part at a time', () => {
    const onChange = vi.fn()
    render(<TimeWheel value={value} onChange={onChange} />)
    fireEvent.click(screen.getByRole('option', { name: '45' }))
    expect(onChange).toHaveBeenLastCalledWith({ hour: 7, minute: 45, meridiem: 'pm' })
    fireEvent.keyDown(screen.getByRole('listbox', { name: 'Hora' }), { key: 'ArrowDown' })
    expect(onChange).toHaveBeenLastCalledWith({ hour: 8, minute: 30, meridiem: 'pm' })
    fireEvent.keyDown(screen.getByRole('listbox', { name: 'a.m. o p.m.' }), { key: 'ArrowUp' })
    expect(onChange).toHaveBeenLastCalledWith({ hour: 7, minute: 30, meridiem: 'am' })
  })

  test('can be restricted to the morning with hours before 12', () => {
    render(<TimeWheel value={{ hour: 9, minute: 0, meridiem: 'am' }} onChange={vi.fn()} hours={[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]} meridiems={['am']} />)
    expect(within(screen.getByRole('listbox', { name: 'Hora' })).queryByRole('option', { name: '12' })).toBeNull()
    expect(within(screen.getByRole('listbox', { name: 'a.m. o p.m.' })).getAllByRole('option')).toHaveLength(1)
  })
})

describe('Reference page', () => {
  test('renders every base component and switches mode and accent', () => {
    render(<Reference />)
    for (const name of ['Botones', 'Campos', 'Estado del servicio', 'Avisos', 'Selector de persona', 'Hora']) {
      expect(screen.getByRole('heading', { name })).toBeInTheDocument()
    }
    fireEvent.click(screen.getByRole('button', { name: 'Oscuro' }))
    fireEvent.click(screen.getByRole('button', { name: 'Índigo' }))
    expect(document.documentElement.dataset.mode).toBe('dark')
    expect(document.documentElement.dataset.accent).toBe('indigo')
    delete document.documentElement.dataset.mode
    delete document.documentElement.dataset.accent
  })
})
