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
| Pantalla | [pantallas/personas.html](design/pantallas/personas.html) | Directorio de personas: lista con búsqueda y filtro por rol, ficha y alta. |
| Pantalla | [pantallas/participaciones.html](design/pantallas/participaciones.html) | Participaciones: roles, habituales y rotación por día o entre todos. |
| Pantalla | [pantallas/setlist.html](design/pantallas/setlist.html) | Setlist del servicio: canciones y momentos ordenados, tonalidad y enlace de referencia. |

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

### Directorio de personas

Destino de la pestaña «Personas». Tres vistas: lista, ficha y alta. Aplica las reglas de [Personas y dirección del servicio](producto.md).

- **Lista:** orden alfabético, búsqueda por nombre sin distinguir acentos y filtro por rol (Todas, Batería, Guitarra, Piano, Voces). Cada fila muestra los roles que la persona tiene configurados en la iglesia y la etiqueta «Con cuenta» cuando está vinculada. Sin resultados, ofrece agregar el nombre buscado.
- **Ficha:** nombre y teléfono editables; guardar y descartar aparecen solo al cambiar algo. Un aviso recuerda que esa información es general; si la persona participa en otra iglesia, lo dice sin nombrarla y aclara que sus roles y turnos no se comparten.
- **En esta iglesia:** habitual, rotación y próxima participación, en solo lectura. Se editan en la configuración de participaciones, no aquí.
- **Cuenta de acceso:** solo muestra el estado. Vincular o desvincular se indica como tarea del superadministrador o del gestor de cuentas.
- **Alta:** nombre obligatorio y teléfono opcional, sin pedir cuenta. Si el nombre ya existe en la iglesia, un aviso lo señala, enlaza con esa ficha y exige confirmar que es otra persona antes de crear.
- **Quitar de la iglesia:** acción destructiva con hoja de confirmación y «Deshacer».
- **Supuestos de diseño** (no están en producto): el teléfono como único dato personal además del nombre; confirmar homónimos con una casilla; quitar a una persona de la iglesia sin borrarla del sistema ni de servicios pasados, avisando si tiene participaciones próximas.

### Participaciones

Configuración por iglesia de los roles musicales, las personas habituales y las rotaciones. Dos vistas: lista de roles y detalle de un rol.

- **Roles:** en orden alfabético (Batería, Guitarra, Piano, Voces), cada uno con su resumen. «Agregar rol» pide un nombre y rechaza duplicados; «Eliminar rol» confirma y ofrece «Deshacer».
- **Habitual:** personas que entran en cada servicio sin turnos. Voces admite varias; los demás roles, una sola.
- **Rotación:** un interruptor la activa. La modalidad se elige con un control de dos opciones: **Por día** (una secuencia por cada día de servicio de la iglesia, independientes entre sí) o **Entre todos** (una sola secuencia). Cada secuencia es una lista numerada que se reordena con subir/bajar y se agrega con el selector de personas; el orden manda, y el primero de la lista es quien toma el primer turno.
- **Próximos servicios:** vista previa calculada con la configuración actual; marca el turno de rotación y las personas habituales. Aclara que no cambia los servicios ya creados.
- **Selector de personas:** no ofrece a quien ya está en el mismo rol como habitual o en rotación.
- **Supuestos de diseño:** un solo habitual salvo en Voces; el primer turno lo toma la primera persona de la lista en la primera fecha de servicio futura. Sin resolver: qué ocurre al eliminar un rol con asignaciones previas, y la coincidencia de una persona en dos roles del mismo servicio (la vista previa no la detecta).

### Setlist del servicio

Se llega desde «Preparar setlist» en el detalle del servicio. Una sola vista con el servicio como contexto.

- **Lista:** canciones y momentos en el orden en que ocurren, numerados; los momentos se distinguen con fondo tenue e ícono, no solo por color. Cada canción muestra su tonalidad y, si lo tiene, el origen del enlace (YouTube o Spotify). Se reordena arrastrando el asa de cada fila (la fila sigue al dedo, las demás se apartan y la lista se desplaza sola cerca de los bordes); con teclado, las flechas arriba y abajo sobre el asa, con aviso de la nueva posición. Tocar una fila abre su edición. Resumen de canciones y momentos arriba.
- **Agregar:** hoja con dos pestañas. *Canción* busca en la biblioteca compartida y marca «Ya está» las ya incluidas; *Momento* ofrece los comunes (Oración, Ofrenda, Anuncios, Lectura bíblica, Predicación, Santa cena) y uno libre.
- **Editar canción:** tonalidad contextual (doce notas, mayor o menor) y enlace manual de referencia, validado como YouTube o Spotify. Muestra el tono habitual y el BPM de la biblioteca solo como información; la canción no se edita aquí.
- **Quitar:** desde la edición, con «Deshacer».
- **Aviso fijo:** tonos, BPM y notas son internos y no aparecen en la vista pública.
- **Supuesto de diseño:** una canción no se repite en el mismo setlist; un momento sí.

## Pendientes

- El resto de los ajustes de la iglesia. Falta un punto de entrada a los ajustes y a las participaciones desde la navegación.
- Unificar tokens en `apps/web` (Tailwind 4) cuando se implemente.
- Probar teclado en pantalla, modo claro de las tarjetas por día y contraste en todos los temas.
- Casos de producto abiertos que afectan estas pantallas: franja del domingo en el lote, lote sin directores y homónimos.
