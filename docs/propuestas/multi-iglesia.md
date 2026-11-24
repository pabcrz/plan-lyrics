# Propuesta: varias iglesias por cuenta

**Estado: planeación, sin implementar.** Pendiente de tu aprobación antes de abrir issues o código.

## Qué se pide

- Unas 6 personas necesitan acceso a 2 iglesias. Hoy es imposible: la API deduce la iglesia activa de la **única** membresía (`activeChurch`, `apps/api/src/services.ts:21`) y responde `409` con varias; además `POST /api/members` rechaza a quien ya está en otra iglesia (`docs/accesos.md:44`).
- Inicio con **una sola lista** de próximos servicios de todas sus iglesias (cada uno con su iglesia) y su setlist, disponible **sin conexión**.
- Móvil: el «Nuevo» actual (botón del encabezado, solo en Inicio, que abre una hoja) no es claro. Se reemplaza por un botón principal de crear según la sección.
- Solo el superadministrador crea iglesias, todas las que quiera, y ve a cuáles pertenece (hoy está en 2 de las 3).

## Decisiones tomadas

| Tema | Decisión | Por qué |
| --- | --- | --- |
| Iglesia activa | La web la manda en la cabecera `X-Church-Id`; el servidor la valida contra las membresías. Sin cabecera y con una sola membresía, todo igual que hoy. | Sin estado en el servidor, funciona por dispositivo y offline. La app actual no cambia para quien tiene una iglesia. |
| Inicio | Lista unificada (opción A). Con una sola iglesia no se muestra etiqueta de iglesia. | Tu elección. |
| Sin conexión | Caché de consultas persistida en **IndexedDB** (no `localStorage`, ~5 MB), solo lectura. | Setlists y letras no caben holgadamente en `localStorage`. |
| Crear iglesias | Solo el superadministrador; sin límite de iglesias. | Tu regla. |
| Letras sin conexión | Se guardan también (título, setlist y letras de los próximos servicios). | Tu decisión: las letras no son un riesgo. |
| Superadmin en iglesia ajena | Entra en **modo soporte**, aislado del Inicio, para invitar y administrar. | Tu necesidad: la tercera iglesia no es suya. |
| Letras públicas | Un enlace de servicio puede incluir letras y permite guardar el setlist; además existe un **cancionero** público por URL. | Tu idea. |

## Diseño

Se reutiliza el sistema visual vigente (`docs/design.md`: salvia, Bricolage Grotesque + Figtree, `Tabbar`, `Sheet`). No hay identidad nueva; lo nuevo es estructura. Un solo elemento memorable: **la iglesia como color y marca en cada servicio**, nada más.

### Inicio multi-iglesia (móvil, 390 px)

```
┌──────────────────────────────┐
│ ⛪ Todas ▾            🎨  👤 │  ← chip de iglesia: abre hoja para cambiar la iglesia activa
├──────────────────────────────┤
│ Próximos                     │
│ ┌──────────────────────────┐ │
│ │ Dom 30 nov · 10:00       │ │
│ │ Culto de adoración       │ │
│ │ ▍Iglesia Central         │ │  ← barra lateral de color + nombre (solo si hay 2+)
│ │ Dirige: Ana · 5 canciones│ │
│ └──────────────────────────┘ │
│ ┌──────────────────────────┐ │
│ │ Dom 30 nov · 17:00       │ │
│ │ ▍Iglesia Norte           │ │
│ └──────────────────────────┘ │
│ ⚠ Sin conexión · actualizado │  ← aviso fijo, solo lectura
│   hoy 8:12                   │
├──────────────────────────────┤
│ Inicio  Canciones  Personas  │   [＋]  ← botón principal contextual
└──────────────────────────────┘
```

- Orden por fecha y hora; el mes siguiente se carga al final. Tocar un servicio fija esa iglesia como activa y abre `/servicios/:id`.
- El chip de iglesia es obligatorio aunque la lista sea unificada: Canciones, Personas y Ajustes son por iglesia y hay que poder cambiar la activa. «Todas» solo aplica al Inicio.
- Color por iglesia: derivado del `id` (tono fijo OKLCH con la misma intensidad que el acento), nunca la única señal: siempre va el nombre.

### Botón principal en móvil

Un botón flotante único (`＋`, 56 px, sobre la barra inferior, a la derecha) que cambia con la sección. Solo para quien edita.

| Sección | Acción |
| --- | --- |
| Inicio | Nuevo servicio (abre la hoja actual: individual o lote) |
| Canciones | Nueva canción (`/canciones/nueva`) |
| Personas | Nueva persona (`/personas/nueva`) |
| Predicaciones | Sin botón (no hay alta propia) |

Se elimina `NewServiceButton` del encabezado. En escritorio no cambia (botón «Nuevo servicio» de la barra lateral).

### Superadministrador

Pantalla **Iglesias** (`/iglesias`), desde el chip de iglesia (opción «Administrar iglesias») y desde «Más».

```
Mis iglesias
  Iglesia Central   Administrador   [Abrir]
  Iglesia Norte     Editor          [Abrir]
Otras iglesias
  Iglesia Sur       Sin membresía
[ + Crear iglesia ]
```

Al crear, el formulario ofrece «Agregarme como administrador» (activado por defecto, como hoy).

**Modo soporte.** «Abrir» en una iglesia sin membresía entra con una franja fija «Modo soporte · Iglesia Sur · Salir». Sus servicios **no** aparecen en el Inicio unificado ni en la caché sin conexión; al salir se limpia. Permite lo mismo que un administrador: invitar y administrar accesos, ajustes, servicios, personas y canciones, para resolver problemas. La API ya deja al superadministrador leer cualquier iglesia (`readChurch`); `activeChurch` aceptará `X-Church-Id` de una iglesia sin membresía solo para él, con rol efectivo `ADMIN`.

### Setlist y letras públicas

Se apoya en los enlaces de compartir existentes (`docs/compartir.md`: token de 256 bits, solo lectura, sin sesión), sin inventar otro mecanismo.

```
/m/<token>  (servicio)              /cancionero  (público)
┌──────────────────────┐            ┌──────────────────────┐
│ Dom 30 nov · 10:00   │            │ Cancionero      🔎   │
│ Iglesia Central      │            │ A  Alabanza digna    │
│ 1 Alabanza digna  G  │            │ B  Bendito sea tu…   │
│ 2 Bendito sea…    D  │            │ …                    │
│ [Guardar setlist]    │            │ [Descargar PDF]      │
│ [Ver letras]         │            └──────────────────────┘
└──────────────────────┘
```

- **Servicio:** nuevo bloque `lyrics` (apagado por defecto, como `keys`). Con él, la vista pública incluye cada letra y el botón **Guardar setlist**, que deja el servicio y sus letras en el dispositivo para verlos sin conexión (mismo almacenamiento IndexedDB, sección «Guardados», sin cuenta).
- **Cancionero:** una URL pública, sin vencimiento, con todas las canciones **publicadas** de la biblioteca (compartida entre iglesias; que alguna no se cante en una iglesia no importa, decisión tuya), índice con búsqueda, vista por canción y descarga a PDF (estilos de impresión + `window.print`). Solo el superadministrador lo activa o revoca; con revocar, la URL anterior deja de responder.
- Nunca incluye enlaces de referencia ni datos de personas, igual que hoy.

## Cambios por capa

### API

1. `activeChurch(db, subject, requestedId?)`: con `requestedId` valida la membresía (o `404`); sin él conserva la regla actual. Se lee la cabecera en un solo punto (`guarded` / `active-guard`); hay 5 llamadores directos que revisar.
2. `GET /api/me/churches`: iglesias del usuario con rol y, para el superadministrador, también las demás (marcadas sin membresía).
3. `GET /api/me/agenda`: próximos servicios de **todas** las membresías (id, iglesia, fecha, hora, estado, título, director, número de canciones). Cada iglesia con sus propios permisos.
4. `POST /api/churches`: el superadministrador puede crear varias; opción `addMe`.
5. `POST /api/members`: se quita el rechazo `Account unavailable` por tener otra iglesia.
6. Pruebas de integración (`pnpm test:db`): aislamiento entre iglesias con la cabecera, `404` con iglesia ajena, y que una cuenta de la iglesia A no lea nada de la B.

### Web

1. `useApiFetch` agrega `X-Church-Id` desde la iglesia activa guardada en el dispositivo; **las llaves de caché incluyen el id de la iglesia** (hoy `['church']`, `['services']`… son globales y mezclarían datos al cambiar).
2. Hoja de cambio de iglesia, `/iglesias` y la lista unificada del Inicio.
3. Botón flotante contextual y retiro de `NewServiceButton`.
4. Persistencia: `@tanstack/react-query-persist-client` con almacenamiento en IndexedDB, clave por usuario, se borra al cerrar sesión. Tras cargar la agenda se precargan los setlists de los próximos 8 servicios por iglesia. Sin conexión las acciones de escribir se desactivan con el aviso.
5. Textos en español de México; accesibilidad: foco visible, el botón flotante con `aria-label` por sección, el aviso offline con `role="status"`.

### Documentación

Actualizar `docs/accesos.md` (quitar «Una cuenta, una iglesia»), `docs/servicios-calendario.md`, `docs/design.md` y la pantalla de ejemplo `docs/design/pantallas/inicio.html`.

## Entregas (una PR a `develop` cada una)

1. **Base multi-iglesia**: cabecera, `activeChurch`, `/api/me/churches`, llaves de caché por iglesia, quitar el rechazo de membresías. Riesgo alto (permisos y contrato): pruebas de aislamiento obligatorias.
2. **Superadmin**: crear varias iglesias, pantalla `/iglesias`, cambio de iglesia.
3. **Inicio unificado** con `/api/me/agenda`.
4. **Sin conexión**: persistencia y precarga de setlists.
5. **Botón principal móvil**: independiente, puede ir en paralelo con la 3.
6. **Modo soporte** del superadministrador (depende de la 1 y la 2).
7. **Letras públicas y cancionero**: bloque `lyrics`, «Guardar setlist» y `/cancionero`. Contrato público nuevo: pruebas de que nada privado se filtra.

## Riesgos y por decidir

- **Fuga entre iglesias** si una llave de caché o una ruta olvida la iglesia: es el riesgo principal; se cubre con la entrega 1.
- **Contrato público**: hoy las vistas públicas nunca devuelven letras; `lyrics` y el cancionero cambian eso a propósito y por decisión tuya. Solo salen letras **publicadas**.
- **Vigencia**: un enlace de servicio vence 30 días después del servicio; lo ya guardado en el dispositivo sigue disponible. El cancionero no vence.
- **Modo soporte** da poder de administrador en una iglesia ajena: se limita al superadministrador y la API lo vuelve a comprobar.
- **Alcance oficial**: `docs/producto.md` solo dice que una persona puede estar en varias iglesias; hay que registrar ahí que una cuenta también.
