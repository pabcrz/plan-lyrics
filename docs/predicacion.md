# Predicación (API e interfaz)

Parte de la etapa 1, opcional por iglesia (ver [Predicación](producto.md#predicación) en el plan de producto). Misma regla de iglesia que [servicios y calendario](servicios-calendario.md#iglesia-activa): la iglesia sale siempre del acceso de la sesión y nunca del cliente (`400` si el cuerpo trae `churchId`; los ids de otra iglesia no existen: `404`, o `400` si van como persona).

## Interruptor «Usa predicación»

`Church.usesPreaching` (ajustes de la iglesia). Apagado, **toda** ruta de esta página responde `409 {"error":"Preaching disabled"}` (lecturas y escrituras; quien no edita recibe antes `403` al escribir) y el lote rechaza entradas con `preacherId` con el mismo `409`. Apagarlo no borra nada: los datos se conservan para cuando se vuelva a encender.

## Rutas

| Ruta | Quién | Notas |
| --- | --- | --- |
| `GET /api/services/:serviceId/preaching` | Cualquier miembro | `{serviceId, preacher:{id,name}\|null, topic, passages:[…], canSeeNotes, notes?}`. Un servicio sin sección responde la sección vacía. `notes` **solo aparece** si `canSeeNotes` es `true`. |
| `PUT /api/services/:serviceId/preaching` | Administrador o editor | Reemplaza la sección entera: `{preacherId:string\|null, topic, passages:string[], notes}` (los cuatro campos). Responde como el `GET`. Es también el **cambio por fecha** del predicador. Una sección vacía (sin predicador, tema, citas ni notas) no se guarda. |
| `POST /api/preaching/swap` | Administrador o editor | **Intercambio entre dos fechas**: `{first, second}` son dos servicios (ids) con predicador distinto. Solo se intercambian los predicadores: cada fecha conserva tema, citas y notas. `{swapped:[first, second]}`. |
| `GET /api/preaching-turns?from=YYYY-MM-DD` | Administrador o editor | Próximas fechas con predicador (desde hoy por defecto, hasta 40) `[{serviceId, date, slot, title, person}]`, para elegir con quién intercambiar. Nunca incluye notas. |
| `POST /api/service-batches` | Administrador o editor | Cada entrada admite `preacherId` opcional: el lote crea la sección de esa fecha en la misma transacción (todo o nada). Ver [lote mensual](servicios-calendario.md#reglas-aplicadas-en-servidor). |

Errores: `400 {"error":"Date in the past"}` (los servicios de fechas pasadas son registro; hoy sí se edita), `400 Invalid request` (predicador que no es del directorio activo de la iglesia, sin predicador o el mismo en las dos fechas al intercambiar, cuerpo con campos de más), `403` para quien no edita (también la persona predicadora: ser predicador no concede permisos), `401` sin sesión.

## Reglas

- **Predicador:** una persona del directorio de la iglesia (clave compuesta a `ChurchPerson`), con o sin cuenta. Quien dirige también puede predicar el mismo servicio y puede predicar varias fechas seguidas: la regla de combinaciones de roles musicales no aplica a la predicación y no hay rotación estricta. Una persona dada de baja del directorio se conserva en la fecha donde ya estaba (se puede seguir editando el resto de la sección), pero no se puede elegir de nuevo ni participar en un intercambio.
- **Notas internas:** las lee quien administra o edita servicios y la persona asignada como predicadora **de ese servicio** que tenga cuenta (y siga en el directorio). Ninguna otra respuesta de la API incluye notas: ni los listados de servicios ni las asignaciones ni la lista de turnos. Todavía no existe la vista pública de congregantes; cuando exista no podrá incluirlas.
- **Formato de las notas:** texto plano; una línea que empieza con `- ` es una viñeta, `**texto**` es negrita y `__texto__` es subrayado. El servidor no convierte nada a marcado: solo conserva los marcadores tal cual, y la interfaz los lee.
- **Saneamiento:** se eliminan caracteres de control, marcas invisibles y anulaciones de dirección del texto; el tema es una sola línea (espacios colapsados); las citas son una por línea (las vacías se descartan, se conserva el orden y se guardan sin interpretar); las notas recortan cada línea y reducen las líneas vacías seguidas a una. Límites, **sin truncar en silencio** (excederlos es `400`): tema 160 caracteres, 20 citas de hasta 80, notas 4 000 caracteres y 100 líneas. La base de datos repite esos límites con restricciones `CHECK`.
- **Integridad:** `ServicePreaching` (una fila por servicio) apunta al servicio junto con su iglesia y al predicador junto con la iglesia, así que una fila no puede cruzar iglesias aunque el código falle. Se borra con el servicio.

## Interfaz web

Todo depende de `usesPreaching`: apagado, la interfaz no muestra la sección ni pide nada a la API.

- **Detalle del servicio** (hoja del calendario, tras «Participaciones»): predicador, tema, citas como etiquetas de texto y, solo si la API entrega `notes`, «Notas internas» con viñetas, negritas y subrayado. Las notas se dibujan como texto (nunca como HTML: `<b>` se ve literal) y un marcador sin pareja se muestra tal cual.
- **Quien edita** (y solo en fechas de hoy en adelante): «Agregar predicación»/«Editar predicación» abre una hoja con predicador (lista del directorio o «Dejar sin predicador»), tema, citas (una por línea) y notas, con los límites avisados junto al campo antes de enviar. «Intercambiar predicador con otra fecha» lista las próximas fechas con otro predicador y muestra ambas fechas y personas antes de «Confirmar intercambio».
- **Lote mensual:** con predicación, un paso opcional «Predicadores» entre directores y revisión (`1/4`…`4/4`; sin ella el lote conserva sus tres pasos). Es la misma lógica de reparto que los directores (`assignmentFor`, `swapDirectors` y `changeDirector` de `batch.ts`): lista ordenada, «Repetir la lista hasta cubrir todas las fechas», y en la revisión cambio por fecha, intercambio entre dos fechas (mostrando ambas) y quitar o asignar predicador. A diferencia de los directores, la lista admite a la misma persona varias veces, también seguidas. Quitar una fecha del lote descarta también su predicador. «Revisar sin predicadores» omite todo el paso.
- La lista de predicadores del lote no se guarda ni se continúa en el lote siguiente (ver decisiones).

## Decisiones tomadas y pendientes

Producto no define lo siguiente; se aplicó el criterio más restrictivo y queda pendiente de decisión:

- Sintaxis de negrita y subrayado (`**…**` y `__…__`) y los límites de longitud.
- «Personas con asignación de predicador que tengan cuenta»: se entiende como la persona asignada a **ese** servicio, no a cualquier servicio.
- Con la predicación apagada, ni siquiera las lecturas responden (la interfaz oculta la sección).
- Tema, citas y predicador los leen todos los miembros (como la dirección); solo las notas son internas.
- La lista de predicadores de un lote **no se guarda** para continuarla en el lote siguiente (la continuidad desde el lote anterior es una regla de la dirección que producto no repite para la predicación).
- Las fechas pasadas no se modifican (mismo criterio que las participaciones).
- Fuera de alcance de este corte: compartir, PDF de predicaciones, vista de congregantes, la predicación en el formulario de «Nuevo servicio» (se agrega después desde el detalle) y avisar de turnos de predicación al dar de baja a una persona del directorio.
