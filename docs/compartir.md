# Compartir servicios (API e interfaz)

Parte de la etapa 1 (ver [Compartir servicios](producto.md#compartir-servicios) en el plan de producto). Quien recibe lo compartido no necesita cuenta. Misma regla de iglesia que [servicios y calendario](servicios-calendario.md#iglesia-activa): en las rutas autenticadas la iglesia sale siempre del acceso de la sesión y nunca del cliente (`400` si el cuerpo trae `churchId`; los ids de otra iglesia no existen: `404`).

## Enlaces del ministerio

Un enlace de solo lectura, sin iniciar sesión, por **un servicio** o por un **rango de fechas** (hasta 366 días), con tres versiones del ministerio: `PRAISE` (alabanza: fechas, quién dirige y setlists), `PREACHING` (predicación: fechas, predicador, tema, citas y, si se pide, notas) y `FULL` (ambas, con horario y orden de los cantos). Una cuarta, `CONGREGATION`, es la [vista de congregantes](#vista-de-congregantes).

### Rutas

Las tres de gestión exigen sesión y que quien llama administre o edite servicios (`403` para integrantes, `401` sin sesión). Responden `Cache-Control: no-store`.

| Ruta | Resultado |
| --- | --- |
| `GET /api/share-links` | Los últimos 100 enlaces de la iglesia, del más reciente al más antiguo. |
| `POST /api/share-links` | `201` con el enlace. Cuerpo estricto: `{version, scope, blocks?}`; `scope` es `{kind:"service", serviceId}` o `{kind:"range", from, to}` (`YYYY-MM-DD`); `blocks` es `{keys?, notes?, people?}`. |
| `POST /api/share-links/:id/revoke` | Revoca ahora mismo. `409 {"error":"Link inactive"}` si ya estaba desactivado. |
| `POST /api/share-links/:id/reactivate` | Vuelve a activarlo por 30 días desde hoy. `409 {"error":"Link active"}` si sigue activo y `409 {"error":"Reactivation used"}` si ya se reactivó una vez. |
| `GET /api/public/links/:token` | **Pública.** La vista del enlace (ver abajo). |

Un enlace se presenta como `{id, version, scope, blocks:{keys,notes,people}, status:"ACTIVE"|"EXPIRED"|"REVOKED", activeUntil, reactivated, canReactivate, createdAt, path}`. `path` (`/m/<token>`) solo existe mientras el enlace funciona; la interfaz arma la dirección completa con su propio origen.

Errores al crear: `400 Invalid request` (cuerpo con campos de más, rango invertido o de más de un año, bloque que la versión no puede mostrar), `404` (servicio de otra iglesia o cancelado), `409 {"error":"No services in scope"}` (el rango no tiene servicios), `400 {"error":"Scope in the past"}` (su vigencia ya habría terminado), `409 {"error":"Preaching disabled"}` (predicación o sus notas con la predicación apagada) y `503 {"error":"Sharing unavailable"}` si el servidor no tiene `SHARE_LINK_SECRET`.

### Vigencia

- Activo desde que se crea hasta **30 días después de la fecha del último servicio que incluye** (esa fecha, inclusive, en `America/Mexico_City`). Se calcula al crear y se guarda: un servicio agregado después al rango no la prolonga. Los servicios cancelados no cuentan.
- Se puede revocar en cualquier momento (solo si está activo). Un enlace desactivado, vencido o revocado, se **reactiva por 30 días desde el día de la reactivación**, con la misma dirección, de solo lectura.
- Cambiar de estado es una sola sentencia condicional: dos personas a la vez no pueden ganar ambas.

### Bloques

`keys` (tonos y BPM) y `notes` (notas de predicación) están **apagados por defecto**; `people` (quién dirige y predica) está encendido. Pedir un bloque que la versión no puede mostrar (`notes` en alabanza, `keys` en predicación) es `400`, nunca se ignora en silencio. El BPM todavía no existe en la biblioteca: hoy el bloque de tonos muestra solo la tonalidad contextual del servicio.

### Vista pública

`GET /api/public/links/:token` no necesita sesión y devuelve solo lo que la versión y los bloques incluyen: fechas, franja y, según el caso, horario (solo `FULL`), director, setlist (canciones con título y autor, momentos y, con `keys`, tonalidad), predicador, tema, citas y notas. **Nunca** devuelve ids internos, enlaces de referencia de las canciones, datos de otra iglesia ni, sin el bloque, las notas. Las fechas «No hay culto» del rango salen con su motivo. La respuesta sigue lo que la iglesia tenga hoy: con la predicación apagada no se muestra nada de ella aunque esté guardada.

- Token inexistente, mal formado, vencido o revocado: el mismo `404 {"error":"Not found"}`; no se dice cuál.
- Todas las respuestas llevan `Cache-Control: no-store`, `X-Robots-Tag: noindex, nofollow, noarchive` y `Referrer-Policy: no-referrer`.
- Límite de tasa de 120 peticiones por minuto por dirección (`429` con `Retry-After`), en memoria de cada proceso. Detrás de un proxy, todas las peticiones comparten la dirección del proxy: ajustarlo cuando exista el despliegue.

### Token

256 bits, 43 caracteres URL-safe. La base guarda un `nonce` aleatorio y el **hash SHA-256** del token, nunca el token. El token es el HMAC del `nonce` con el secreto del servidor (`SHARE_LINK_SECRET`, al menos 32 caracteres), de modo que quien gestiona enlaces puede volver a copiar uno existente (el diseño aprobado lo pide) y una copia de la base por sí sola no revela ningún enlace. Rotar el secreto invalida todos los enlaces. Sin el secreto la API sigue sirviendo y revocando enlaces, pero no los crea. En local se define en `apps/api/.env.local` (ignorado por Git) con una cadena aleatoria propia; nunca se versiona.

## Vista de congregantes

La versión `CONGREGATION` de un enlace (se crea con `POST /api/share-links` como las demás, con `{version:"CONGREGATION", scope}`) es la vista pública del setlist para la iglesia:

- **Muestra** por fecha: la fecha, su franja, y el setlist con título y autor de cada canción (y los momentos). **Nunca** muestra directores, equipos ni listas de personas, horario, tonalidades, BPM, enlaces de referencia, citas ni notas. Aún no hay letras: no existen en esta etapa.
- **Sin bloques:** no admite ninguno (`400` si se pide alguno en `true`); la base lo repite con una restricción `CHECK`. Lo único opcional lo decide la iglesia, no el enlace.
- **Interruptor de la iglesia** `Church.congregationShowsPreacher` (apagado por defecto): encendido, y solo con la predicación en uso, cada servicio añade `preaching: {preacher?, topic?}` (o `null` si no tiene) y nada más. Se lee al responder, así que apagarlo lo quita de inmediato de los enlaces ya compartidos. Lo expone `GET /api/active-church` como `congregationShowsPreacher` y lo edita `PUT /api/active-church` (campo **opcional**: si se omite, el valor guardado no cambia, así que la pantalla de ajustes no lo altera). Como todo ajuste de la iglesia, solo lo cambia quien la administra.
- **Reglas del enlace:** las mismas que las del ministerio (vigencia de 30 días tras el último servicio, revocación, una reactivación). Producto dice que la vista de congregantes «sigue sus propias reglas» pero no las define.

## Datos de los documentos

La imagen del setlist y la lista mensual de dirección usan datos que ya entregan las rutas de servicios, setlist y «No hay culto». Para el PDF de predicaciones hay una ruta nueva:

| Ruta | Quién | Resultado |
| --- | --- | --- |
| `GET /api/preaching-document?from=&to=` | Administrador o editor | `{church, from, to, services:[{date, slot, preacher, topic, passages, notes}], closedDates:[{date, reason}]}` con las secciones de predicación del rango (servicios cancelados no) y sus notas. `403` para integrantes (las notas son internas), `409 Preaching disabled` con la predicación apagada, `400` con fechas inválidas, invertidas o de más de un año. Nunca incluye otra iglesia. |

## Documentos compartibles (interfaz)

`/compartir/documento/:kind` con `imagen`, `rol` y `predicaciones`, solo para quien edita. Cada pantalla tiene sus opciones, una **vista previa** y las acciones fijas abajo. Los documentos son **siempre claros**, como impresos, aunque la app esté en modo oscuro.

- **Setlist en imagen:** elige un servicio (del mes anterior al segundo mes siguiente, sin cancelados; por omisión el próximo). La imagen lleva «Setlist · fecha», la iglesia y las canciones numeradas, cada una con su autor entre paréntesis. Los momentos («Ofrenda») no son canciones y no salen; tampoco la tonalidad ni el enlace de referencia. Sin canciones, aviso y descarga deshabilitada.
- **Lista mensual de dirección:** formato imagen o PDF, rango de fechas (por omisión el mes actual), mensaje o versículo opcional al pie (hasta 200 caracteres). Título «Rol alabanza», el mes (o las dos fechas si cruza meses), una línea por fecha con su director (un domingo doble, una por franja) y «No hay culto · motivo» en su lugar.
- **PDF de predicaciones:** tabla con fecha, quién predica, tema y citas, y los puntos a considerar con su formato mínimo; «No hay culto» en su lugar. Solo con la predicación en uso.

### Cómo se generan (y por qué)

- **Imagen: canvas 2D en el cliente.** `documents.ts` coloca cada línea (ajuste de texto por palabras, columna de fechas, alto según el contenido) y dibuja un PNG de 1080 px de ancho con `toBlob`; sin dependencias. Se descartó el SVG a PNG: depende de cómo cada navegador rasteriza texto dentro de un SVG y complica las fuentes; el canvas da el mismo resultado en todos y se prueba con la capa pura de posicionamiento. «Descargar» crea el archivo en el navegador; «Compartir» usa el menú del sistema con el archivo si el navegador lo permite (si no, lo dice y sugiere descargarlo).
- **PDF: la impresión del navegador** con una hoja de estilo dedicada (`@media print` en `styles.css`: página A4 con márgenes, todo lo que no es la hoja lleva `no-print`). Se pone el nombre del documento como título mientras se imprime para que «Guardar como PDF» lo use. Se descartó una librería de PDF: añade decenas de kilobytes para un documento de una tabla, y la impresión ya da texto seleccionable y paginado. Límite: no hay archivo que compartir desde la aplicación; el PDF se guarda desde el cuadro de impresión.

## Decisiones tomadas y pendientes

Producto no define lo siguiente; se aplicó el criterio más restrictivo y queda pendiente de decisión:

- **Congregantes:** su enlace caduca y se revoca como los del ministerio; no muestra horario; la vista previa de la imagen es HTML y el PNG se dibuja aparte con los mismos datos.
- **Quién ve los documentos:** igual que los enlaces, solo quien administra o edita servicios; el PDF de predicaciones incluye notas, por eso no se ofrece a integrantes.

- **Reactivaciones:** un enlace se reactiva **una sola vez**. Producto deja abierto si uno reactivado puede reactivarse de nuevo.
- **Quién ve los enlaces:** quien administra o edita servicios (el listado trae enlaces que funcionan); los integrantes no.
- **Servicios en borrador** se incluyen (el lote los crea así y aún no hay cómo publicarlos); los cancelados no. Revisar cuando exista la edición de estado.
- **Contenido vivo:** el enlace muestra lo que hay en ese momento en su rango; solo su vigencia queda fija.
- **Alcance máximo** de un rango: 366 días.
- **Sin edición de la biblioteca** por quien comparte: la vista pública solo lee.
- **Sin ajuste de «cuántos días»:** los 30 días no se configuran por enlace.

## Interfaz web

- **Entrada:** el botón de compartir del encabezado del calendario (solo para quien administra o edita servicios). Un integrante que abre `/compartir` ve un aviso y la API nunca recibe la petición.
- `/compartir` (diseño `compartir.html`): «Crear → Enlace para el ministerio» y la lista de enlaces con su estado (`Activo hasta …`, `Venció el …`, `Revocado a mano`). Tocar uno abre una hoja: activo, con la dirección completa, «Copiar enlace», «Compartir» (solo si el navegador ofrece el menú de compartir) y «Revocar enlace» con confirmación; desactivado, «Reactivar por 30 días» o, si ya se reactivó, el aviso de que debe crearse uno nuevo.
- `/compartir/enlace`: alcance (un servicio de los próximos, o un rango de fechas; por omisión desde hoy hasta fin de mes), versión, bloques y un aviso con el número de servicios y la fecha hasta la que estaría activo. La predicación y las notas solo se ofrecen si la iglesia usa predicación; los tonos no se ofrecen en la versión de predicación ni las notas en la de alabanza. Al crear se abre la hoja «Enlace creado» para copiarlo o compartirlo. La estimación de vigencia es solo una ayuda: la API la calcula de nuevo.
- `/m/:token` (**pública**, sin Clerk ni sesión): la vista de solo lectura. Muestra por fecha el horario (completo), quién dirige, el setlist numerado con autor (y tonalidad si el enlace la lleva), y la predicación con predicador, tema, citas y notas con su formato mínimo, siempre como texto. Las fechas «No hay culto» salen con la leyenda. Un enlace inexistente, vencido o revocado se ve igual («Este enlace no está disponible»); `429` y los fallos de conexión se distinguen y ofrecen reintentar. La propia página pide no ser indexada (`<meta name="robots">`) ni citar su origen (`referrer`) mientras está abierta, además de las cabeceras de la API.
- La dirección completa se arma con el origen de la página; la API solo entrega la ruta `/m/<token>`.

Verificado a 390 px con un arnés temporal no versionado (doble de Clerk, `fetch` simulado): sin desbordamiento horizontal en la lista, el formulario, las hojas ni la vista pública. 
