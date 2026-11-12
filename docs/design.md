# Diseño visual — Plan & Lyrics

**Estado: propuesta v0, en construcción.** Esta guía registra las decisiones visuales que se van tomando a partir de los mockups HTML. No añade requisitos: el alcance sigue en el [producto](producto.md) y la secuencia de trabajo en la [propuesta de diseño](propuestas/diseno.md). Los valores no son tokens oficiales hasta que se aprueben.

## Referencias visuales

Mockups HTML autocontenidos, sin build, con datos ficticios. Se abren directamente en el navegador; los enlaces entre pantallas son relativos, así que las carpetas deben mantenerse juntas.

| Capa | Archivo | Contenido |
| --- | --- | --- |
| Fundamentos | [fundamentos/index.html](design/fundamentos/index.html) | Color, tipografía, espaciado, forma, estados y temas. |
| Componentes | [componentes/index.html](design/componentes/index.html) | Componentes móviles comunes, construidos solo con los fundamentos. |
| Pantalla | [pantallas/calendario.html](design/pantallas/calendario.html) | Calendario multimes y detalle del servicio. |
| Pantalla | [pantallas/lote-mensual.html](design/pantallas/lote-mensual.html) | Creación mensual en lote: período, directores, revisión y resultado. |

El recorrido de wireframes previo vive en [`design/programacion-mensual`](../design/programacion-mensual/mapa-y-recorrido.md); la alternativa 04 fue la referencia que originó estas pantallas.

## Principios

- **Móvil primero.** Se diseña a 390 px; escritorio se deriva después.
- **Limpio, con personalidad propia.** Base serena (salvia/verde azulado) con un acento musical; el motivo recurrente es el pentagrama.
- **Navegación inferior** con barra de pestañas en móvil.
- **El estado nunca depende solo del color.** Cada estado combina forma, texto o ícono.

## Fundamentos

### Color

Un único par `--h` (tono) y `--c` (intensidad) gobierna el acento y el tinte de los neutros, en OKLCH. Cambiar de tema equivale a cambiar esos dos números.

| Tema | `--h` | `--c` | Situación |
| --- | --- | --- | --- |
| Salvia | 178 | 0.085 | Predeterminado. |
| Índigo | 272 | 0.15 | Opcional. |
| Ocre | 62 | 0.105 | Opcional. |

Los temas intercambiables no son prioridad. Pendiente: verificar contraste de Índigo y Ocre en modo oscuro antes de ofrecerlos.

Tokens semánticos: `--bg`, `--surface`, `--surface-2`, `--line`, `--line-strong`, `--text`, `--text-2`, `--text-3`, `--accent`, `--on-accent`, `--accent-soft`, `--focus`. Modo claro y oscuro por `data-mode`.

### Tipografía

| Uso | Familia |
| --- | --- |
| Títulos | Bricolage Grotesque |
| Texto | Figtree |
| Datos y acordes | Spline Sans Mono |

Pendiente: autoalojar las fuentes en lugar de cargarlas desde Google Fonts.

### Espaciado, forma y táctil

- Espaciado en base 4: 4, 8, 12, 16, 24, 32, 48, 72 px.
- Radios: 6, 10, 16 px y circular.
- Objetivo táctil: 44 px (48 px en acciones principales).
- Movimiento: 140 ms (rápido) y 240 ms (base), con salida suave.

### Estados del servicio

| Estado | Marca | Nota |
| --- | --- | --- |
| Borrador | Punto vacío, borde punteado | Aún no visible para el equipo. |
| Publicado | Punto lleno | |
| Completado | Marca de verificación | |
| Cancelado | Cruz y texto tachado | |

## Componentes

Inventario común: botones con jerarquía (principal, secundaria, discreta, destructiva), campos con etiqueta, ayuda y error, filas por fecha, selector de personas, avisos, hojas inferiores y barra de pestañas. El detalle y los estados de cada uno están en [componentes/index.html](design/componentes/index.html). Una pantalla no crea componentes nuevos solo para cambiar su apariencia.

## Pantallas

### Calendario y detalle del servicio

Cuadrícula mensual con marca por estado, agenda del mes y detalle del servicio con participaciones. Navegación entre meses. Los servicios creados en lote llegan como borrador, con el mes y la fecha seleccionados y un aviso.

### Creación mensual en lote

Cuatro vistas: período, directores, revisión y resultado. Aplica las reglas de [Creación mensual en lote](producto.md): uno a tres días de la semana, directores asignados en orden cronológico y lote parcial permitido. Al terminar, enlaza con el calendario.

## Pendientes

- Servicio individual, configuración de participaciones, ajustes de la iglesia y directorio de personas.
- Unificar tokens en `apps/web` (Tailwind 4) cuando se implemente.
- Probar teclado en pantalla, modo claro de las tarjetas por día y contraste en todos los temas.
- Casos de producto abiertos que afectan estas pantallas: hoy y meses pasados, colisiones con servicios existentes, más directores que fechas, lote sin directores y homónimos.
