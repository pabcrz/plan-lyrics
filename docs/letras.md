# Letras de la biblioteca (API y pantallas)

Primeras rebanadas de la [etapa 2 del producto](producto.md#etapa-2--letras): modelo, reglas y rutas (API) y las [pantallas móviles](#pantallas) para ver y editar la letra. **No hay letras reales** en el repositorio: las pruebas usan solo textos inventados. Los acordes (etapa 3), con su API y sus pantallas, se describen en [acordes](acordes.md); esta guía sigue siendo la del texto.

## Qué hay

- **Una letra por canción** de la biblioteca compartida (no por iglesia): `SongLyrics`, con sus secciones ordenadas en `LyricsSection`. La migración `20261121120000_song_lyrics` es aditiva (dos tablas y un enum nuevos; no toca datos ni columnas existentes).
- **Secciones** con `kind` (`INTRO`, `VERSE`, `CHORUS`, `BRIDGE`, `OUTRO`, `CLOSING`: los tipos que nombra el producto), `label` opcional (por ejemplo «Estrofa 1»), `text` y `repeat` (cuántas veces se canta seguida; 1 a 8, por defecto 1). El orden del arreglo es el orden de la canción. Límites: 60 secciones, 4000 caracteres por sección, 60 por etiqueta; sin caracteres de control; saltos de línea normalizados. La base repite los límites con restricciones `CHECK`.
- **Versionado:** cada letra lleva `version` (1 al crearla, +1 por reemplazo). Es un control de concurrencia optimista, no un historial: quien edita envía la versión que leyó (0 si aún no hay letra) y, si cambió, recibe `409 {"error":"Lyrics changed","version":n}` sin pisar nada. Dos creaciones simultáneas terminan con una ganadora y un `409`.
- **Publicable:** `published`, `false` al crear. Es explícito: omitirlo en un reemplazo conserva el valor guardado; no se puede publicar una letra sin secciones.

### Rutas

| Ruta | Quién | Resultado |
| --- | --- | --- |
| `GET /api/songs/:songId/lyrics` | Superadministrador, editores de biblioteca y quien pertenezca a al menos una iglesia (integrantes, editores de servicios, administradores) | `{version, published, canEdit, sections}`; una canción sin letra responde `version: 0`, `published: false`, `sections: []`. Sin ningún acceso: `403`; canción inexistente: `404`. |
| `PUT /api/songs/:songId/lyrics` | Superadministrador, editores de biblioteca, y administradores y editores de servicios de una iglesia (no los integrantes) | Reemplaza la letra completa: `{version, sections:[{kind, label?, text, repeat?}], published?}`. `403` antes de validar o buscar la canción; `400` cuerpo inválido; `404` canción inexistente; `409` versión desactualizada. |

Todas llevan `Cache-Control: no-store`. Administrar una iglesia o editar servicios **no** da permiso de escritura, tal como fija el producto.

### Vista pública

La versión `CONGREGATION` de un enlace ([compartir](compartir.md#vista-de-congregantes)) añade `lyrics: [{kind, label, text, repeat}]` a cada canción **solo si su letra está publicada**. Una letra sin publicar y una canción sin letra son indistinguibles (la clave `lyrics` no aparece). Las letras se leen en una consulta aparte filtrada por `published`, así que un texto privado nunca llega a la función que arma la respuesta. No se expone ningún id, versión ni la marca `published`. El `404` uniforme, la limitación de tasa y las cabeceras (`no-store`, `X-Robots-Tag`, `Referrer-Policy`) no cambian. Las versiones del ministerio (`PRAISE`, `FULL`, `PREACHING`) **no** llevan letras.

## Decisiones tomadas con criterio restrictivo

El producto no las resuelve; cada una se puede relajar con una decisión explícita.

1. **Quién escribe:** superadministrador, editores de biblioteca y quien administre una iglesia o edite servicios (decisión del superadministrador); un integrante, no.
2. **Quién lee:** cualquier persona con membresía en alguna iglesia, sin exigir iglesia activa (la biblioteca no pertenece a ninguna). Una cuenta sin membresías ni acceso de biblioteca (por ejemplo, un gestor de cuentas) no la ve.
3. **Publicar:** nada es público por omisión; publicar y retirar es una decisión explícita de quien edita. Editar el texto de una letra ya publicada la mantiene publicada y el cambio se ve de inmediato en los enlaces existentes (coherente con «los cambios heredados siguen vigentes incluso en contenido publicado»). **En la interfaz**, guardar una letra que ya estaba publicada y sigue publicada exige una confirmación explícita («Guardar y mantener publicada»); quitar la marca «Publicable» antes de guardar la evita. La API no cambia: la confirmación es de la pantalla (criterio restrictivo, relajable con una decisión explícita).
4. **Dónde se muestra:** solo la vista de congregantes, la única que el producto describe «con letras». Las versiones del ministerio no las incluyen.
5. **Versionado:** solo control de concurrencia, sin historial ni restauración.
6. **Repetición:** una sección con `repeat` mantiene el orden musical sin duplicar texto. Es una interpretación mínima de «repeticiones».
7. **Sin borrado:** no hay ruta para eliminar una letra (se deja vacía y sin publicar) y la base impide borrar una canción que tenga letra.

## Decisiones abiertas

- **Variaciones** (por ejemplo, un coro con otra letra en la segunda vuelta, o adaptaciones por iglesia o servicio que heredan de la base): no se modelan; el producto las prevé en etapas posteriores.
- **Historial de versiones:** ¿se necesita ver o restaurar versiones anteriores, o basta el control de concurrencia?
- **Quién publica:** hoy es quien edita. ¿Debe publicar una persona distinta, o requerir revisión?
- **Letras en las versiones del ministerio** y en la imagen/PDF del setlist: hoy no.
- **Derechos de las letras:** el producto no dice si publicar exige alguna constancia de licencia; no se ha añadido ninguna.
- **ChordPro como fuente única:** resuelto en lo esencial para las secciones en [acordes](acordes.md#representación); la exportación e importación de ChordPro completo siguen abiertas.
- **Importación** de texto existente (TXT) y límites definitivos de tamaño.
- **Pantalla de biblioteca:** hoy la letra se abre desde la edición de una canción del setlist; no hay lista ni buscador de canciones con letra. La API de letras tampoco devuelve el título de la canción (las pantallas lo reciben del setlist; sin él muestran «Letra de la canción»).
- **Publicar por primera vez:** activar «Publicable» en una letra sin publicar no pide confirmación (es una decisión explícita de quien edita); ¿debe pedirla también?
- **Vista pública** de la letra (congregantes): sin pantalla propia en esta rebanada.

## Pantallas

Mockup: [letras.html](design/pantallas/letras.html) (ver [diseño](design.md#letra-de-una-canción)). Móvil primero, claro y oscuro, con los componentes de `apps/web/src/ui`.

| Ruta | Quién | Qué hace |
| --- | --- | --- |
| `/canciones/:songId/letra` | Cualquier integrante de una iglesia | Letra por secciones (tipo, etiqueta, `×N` si se repite, texto con sus saltos). Estado «Publicada» o «Sin publicar», estado vacío si no hay letra. «Editar letra» o «Escribir letra» solo si `canEdit`. |
| `/canciones/:songId/letra/editar` | Editor de biblioteca y superadministrador (`canEdit`) | Tarjeta por sección: tipo, «Se canta» (1 a 8), etiqueta, texto; subir, bajar, quitar (con «Deshacer») y agregar (hasta 60); interruptor «Publicable» (deshabilitado sin secciones). Quien no tiene permiso ve un aviso y no el formulario. |

- **Entrada:** «Ver letra» en la edición de una canción del setlist (cualquier integrante). Pasa el título, la ruta de regreso y la tonalidad de la entrada (para los [acordes](acordes.md#pantallas)) por el estado de navegación; solo se acepta una ruta interna como regreso.
- **Guardar:** reemplazo completo con la versión leída (`PUT`), con `published` siempre explícito; sin secciones se guarda sin publicar. Las tabulaciones y otros caracteres de control que la API rechaza se convierten en espacios antes de enviar. «Guardar» se habilita al cambiar algo; «Descartar cambios» vuelve a lo cargado; salir con cambios pide confirmación.
- **Letra ya publicada:** al guardarla sin quitar la marca «Publicable», una hoja avisa de que el cambio se verá de inmediato en los enlaces compartidos y pide «Guardar y mantener publicada».
- **409 (versión desactualizada):** aviso «La letra cambió mientras la editabas»: lo escrito se conserva en pantalla, «Guardar» queda deshabilitado y «Recargar la letra» trae la versión nueva (descarta lo escrito). La pantalla no vuelve a pedir la letra sola mientras se edita para no reemplazar el texto a escondidas.
- **403, 404 y otros fallos:** mensajes propios al leer y al guardar; el texto escrito no se pierde.
- La UI oculta lo no permitido, pero la API sigue siendo la que decide.

La biblioteca (`/canciones`) lista y busca canciones por páginas de 50 («Cargar más»), con filtros «Sin letra» y «Sin acordes» y la marca de lo que falta en cada canción; `GET /api/songs/access` indica si quien consulta puede crear (`/canciones/nueva`). Quien edita la biblioteca cambia el título o el autor (`PATCH /api/songs/:songId`, mismo id, `409` si choca con otra canción) desde `/canciones/:songId/editar` (en escritorio es el panel derecho de la biblioteca, sin cambiar de página), y elimina (`DELETE`) solo una canción creada por error: sin letra y fuera de todo setlist, de lo contrario `409 Song in use`. Mockup: [canciones.html](design/pantallas/canciones.html).

El autor de una canción es opcional: sin autor se guarda vacío y la canción se identifica solo por su título. La migración `20261124120000_song_author_optional` relaja la restricción de la base, que seguía exigiendo de 1 a 120 caracteres y hacía fallar (`503`) crear o renombrar una canción sin autor.

## Verificación

Pantallas: pruebas de componente (`apps/web/src/lyrics/*.test.tsx` y el enlace desde `SetlistPage.test.tsx`) con textos inventados y un servidor ficticio en memoria con versión y 409. API: pruebas puras de reglas (`lyrics-rules.test.ts`) e integración sobre PostgreSQL aislado (`test/lyrics.integration.ts`, con `pnpm test:db`): permisos por tipo de cuenta, concurrencia, restricciones de base, publicación y fuga de datos en la vista pública.
