# Compartir servicios (API e interfaz)

Parte de la etapa 1 (ver [Compartir servicios](producto.md#compartir-servicios) en el plan de producto). Quien recibe lo compartido no necesita cuenta. Misma regla de iglesia que [servicios y calendario](servicios-calendario.md#iglesia-activa): en las rutas autenticadas la iglesia sale siempre del acceso de la sesión y nunca del cliente (`400` si el cuerpo trae `churchId`; los ids de otra iglesia no existen: `404`).

## Enlaces del ministerio

Un enlace de solo lectura, sin iniciar sesión, por **un servicio** o por un **rango de fechas** (hasta 366 días), con tres versiones: `PRAISE` (alabanza: fechas, quién dirige y setlists), `PREACHING` (predicación: fechas, predicador, tema, citas y, si se pide, notas) y `FULL` (ambas, con horario y orden de los cantos).

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

## Decisiones tomadas y pendientes

Producto no define lo siguiente; se aplicó el criterio más restrictivo y queda pendiente de decisión:

- **Reactivaciones:** un enlace se reactiva **una sola vez**. Producto deja abierto si uno reactivado puede reactivarse de nuevo.
- **Quién ve los enlaces:** quien administra o edita servicios (el listado trae enlaces que funcionan); los integrantes no.
- **Servicios en borrador** se incluyen (el lote los crea así y aún no hay cómo publicarlos); los cancelados no. Revisar cuando exista la edición de estado.
- **Contenido vivo:** el enlace muestra lo que hay en ese momento en su rango; solo su vigencia queda fija.
- **Alcance máximo** de un rango: 366 días.
- **Sin edición de la biblioteca** por quien comparte: la vista pública solo lee.
