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
| Pantalla | [pantallas/servicio-nuevo.html](design/pantallas/servicio-nuevo.html) | Servicio individual: fecha, título, hora, estado, dirección y participaciones. |
| Pantalla | [pantallas/ajustes-iglesia.html](design/pantallas/ajustes-iglesia.html) | Ajustes de la iglesia: nombre, días de servicio, horas habituales y domingo con dos servicios. |

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

### Servicio individual

Formulario de una sola vista, sin selector de iglesia: el servicio pertenece a la iglesia activa.

- **Fecha:** las próximas fechas habituales como opciones, con la hora habitual debajo, más «Otra fecha» para un servicio especial. Una fecha que ya alcanzó su máximo de servicios se muestra tachada, con borde punteado y la etiqueta «Ocupado» o «Completo», y no se puede elegir. Si se llega a ella por «Otra fecha», un aviso lo explica y el botón de crear queda deshabilitado.
- **Domingo con dos servicios:** si la iglesia lo habilita, aparece un selector Mañana / Tarde con la hora de cada uno; la franja ya creada queda deshabilitada. Ningún otro día admite dos servicios.
- **Título y hora:** llegan precargados desde la configuración de la iglesia (días habituales y su hora) y se pueden editar. Un día no habitual se trata como servicio especial: sin hora precargada.
- **Selector de hora:** un campo que abre una hoja inferior con una rueda deslizable de tres columnas (hora, minutos cada 15 y a.m./p.m.) en lugar del reloj nativo del dispositivo. Incluye «Listo» y «Sin hora fija». En un domingo con dos servicios, la rueda se limita a la franja: a.m. para la mañana y p.m. para la tarde.
- **Estado:** borrador o publicado al crear; completado y cancelado se cambian después.
- **Dirección:** obligatoria. Usa el mismo selector de personas del lote; sin director no se crea el servicio y el error aparece junto al campo.
- **Participaciones:** vista previa de las habituales y los turnos que se cargarán según el día.

Al crear, enlaza con el calendario igual que el lote.

### Ajustes de la iglesia

Primera sección de configuración general. Lo definido aquí alimenta los formularios de servicio.

- **Nombre** de la iglesia activa.
- **Días de servicio:** siete botones (Dom a Sáb) de selección múltiple. Cada día elegido muestra una tarjeta con el título habitual y la hora de inicio.
- **Hora:** el mismo selector de rueda del servicio individual, cada 15 minutos.
- **Dos servicios los domingos:** interruptor dentro de la tarjeta del domingo. Activado, el domingo tiene franja de mañana (hasta antes de las 12:00 p.m.) y de tarde (desde las 12:00 p.m.), cada una con su título y hora. Solo el domingo ofrece esta opción.
- **Guardar:** el botón se habilita al cambiar algo; «Descartar cambios» vuelve a lo guardado. Se exige un nombre, al menos un día y un título en cada servicio.
- **Supuesto de diseño:** guardar no modifica los servicios ya creados; solo cambia lo que se precarga a partir de ahora.

## Pendientes

- Configuración de participaciones (asignaciones habituales y rotaciones), el resto de los ajustes de la iglesia y directorio de personas. Falta un punto de entrada a los ajustes desde la navegación.
- Unificar tokens en `apps/web` (Tailwind 4) cuando se implemente.
- Probar teclado en pantalla, modo claro de las tarjetas por día y contraste en todos los temas.
- Casos de producto abiertos que afectan estas pantallas: hoy y meses pasados, fechas ocupadas dentro del lote y franja del domingo en el lote, más directores que fechas, lote sin directores y homónimos.
