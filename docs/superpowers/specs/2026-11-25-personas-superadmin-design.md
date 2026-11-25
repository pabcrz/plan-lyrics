# Todas las personas (superadmin)

Diseño corto. Estado: pendiente de aprobación. Base: `develop`, después de la PR #96.

## Intención

El superadministrador maneja todo con contexto global. Hoy, para dar de alta a alguien que ya está en otra iglesia, tiene que entrar a esa iglesia y agregarlo ahí. Necesita una pantalla con todas las personas, ver a qué iglesias pertenece cada una, crearlas sin iglesia y asignarlas a una o varias iglesias, con o sin grupos y roles en el momento.

## Alcance

1. **Pantalla «Todas las personas»**, solo para el superadmin, junto a «Cuentas» en *Más*. Lista todas las personas con una marca por cada iglesia a la que pertenecen, con búsqueda por nombre.
2. **Crear persona sin iglesia** (nombre, teléfono y correo opcionales).
3. **Asignar y quitar iglesias** desde la ficha de la persona: un interruptor por iglesia. Al asignar se puede dejar sin grupos o marcar Alabanza (con sus roles), Dirección y Predicación en ese momento.
4. **Editar nombre, teléfono y correo** de cualquier persona desde la misma hoja, sin entrar a una iglesia. El cambio vale para todas sus iglesias (son datos generales).
5. Los administradores de iglesia no ven ni pueden nada de esto: siguen agregando e invitando solo a la suya.

## No alcance

- Fusionar personas duplicadas, invitar o crear cuentas desde esta pantalla (eso sigue en «Cuentas»).
- Cambiar «Personas» de cada iglesia.

## Enfoque

Un solo camino razonable: **endpoints propios del superadmin** bajo `/api/platform/`, no repetir llamadas por iglesia desde el cliente. Es atómico, no depende de qué iglesia esté activa y deja la autorización en un solo lugar (`PlatformOwner`). Descartado: reutilizar el modo soporte (`X-Church-Id`) llamada por llamada, porque obliga al cliente a orquestar varias peticiones y a cambiar de iglesia por cada marca.

## API (todo solo `PlatformOwner`; cualquier otro recibe el 404 genérico, como en las cuentas)

- `GET /api/platform/people` → `[{ id, name, phone, email, hasAccount, churches: [{ id, canPlay, canDirect, canPreach, roleIds }] }]`, ordenado por nombre, sin los enlaces quitados (`removedAt`).
- `GET /api/platform/churches` → `[{ id, name, usesPreaching, roles: [{ id, name }] }]`: lo que la hoja necesita para pintar iglesias y los roles de cada una.
- `POST /api/platform/people` `{ name, phone?, email? }` → crea la persona sin enlaces. Mismas validaciones que el alta de iglesia. `409 Name exists` con `existing` si ya hay una persona con ese nombre en toda la plataforma.
- `PATCH /api/platform/people/:personId` `{ name?, phone?, email? }` → mismas validaciones que la ficha de iglesia; `409 Name exists` con `existing` solo si el nombre cambia y ya lo tiene otra persona de la plataforma; `404` si no existe.
- `PUT /api/platform/people/:personId/churches/:churchId` `{ canPlay, canDirect, canPreach, roleIds }` → crea o reactiva el enlace con esos grupos. `roleIds` solo se acepta si `canPlay` es verdadero y todos son roles de esa iglesia (`400` si no). Si el enlace existe, reemplaza grupos y roles (mismo `409 In use` que el API de iglesia al sacar de alabanza a alguien habitual o en rotación).
- `DELETE /api/platform/people/:personId/churches/:churchId` → marca `removedAt` (igual que quitar desde la iglesia; los servicios pasados se conservan).

## Interfaz

Ruta `/todas-las-personas`. Lista con nombre, «Con cuenta» y las iglesias como etiquetas; botón «Agregar persona» (hoja: nombre, teléfono, correo). Al abrir una persona, una hoja con una fila por iglesia: interruptor «En {iglesia}». Al activarlo aparecen los tres grupos y, con Alabanza activa, los roles de esa iglesia; un botón «Guardar» aplica el `PUT`. Se reutilizan `Sheet`, `Switch`, `PersonRoles` y `RoleChips`. Textos en español de México, con tú.

## Decisiones de quien construye

- El enlace a una iglesia que ya tenía `removedAt` se reactiva, no se duplica.
- Sin migración: `Person` ya admite cero enlaces.
- Un usuario superadmin que no pertenece a ninguna iglesia ve la pantalla sin problema (no depende de la iglesia activa).
- Pruebas de integración del API contra la base (como `apps/api/test/people.integration.ts`) para los permisos y para reactivar un enlace quitado.
