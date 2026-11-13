# Roles musicales y restricciones de combinación (API)

La iglesia siempre sale del acceso de la sesión (misma regla que [servicios y calendario](servicios-calendario.md#iglesia-activa)); nunca se envía en la ruta ni en el cuerpo (`400` si aparece `churchId`). Todos los miembros leen; solo el administrador de la iglesia o el superadministrador con iglesia activa configuran (`403` para editor e integrante, `401` sin sesión).

## Rutas

| Ruta | Quién | Notas |
| --- | --- | --- |
| `GET /api/roles` | Cualquier miembro | Catálogo `[{id, name}]` en orden alfabético. |
| `POST /api/roles` | Administrador | Cuerpo `{name}` (1–40 caracteres, espacios recortados y colapsados). `201` con el rol; `409 {"error":"Name exists"}` si ya existe ese nombre ignorando mayúsculas y acentos, o si es «Dirigir». |
| `DELETE /api/roles/:roleId` | Administrador | `204`, o `404` si no es un rol de la iglesia. También quita las restricciones que lo mencionan. |
| `GET /api/role-restrictions` | Cualquier miembro | `[{id, first, second}]`; cada lado es el id de un rol o `DIRIGIR`. |
| `POST /api/role-restrictions` | Administrador | Cuerpo `{first, second}` sin orden. `201` con el par; `400` si es el mismo rol dos veces o un lado no es `DIRIGIR` ni un rol de la iglesia; `409 {"error":"Restriction exists"}` si el par ya existe (en cualquier orden). |
| `DELETE /api/role-restrictions/:restrictionId` | Administrador | `204`, o `404`. |

## Reglas

- Cada iglesia arranca con Batería, Guitarra, Piano y Voces y la restricción Dirigir + Batería. La migración lo siembra en las iglesias existentes; una iglesia nueva lo recibe la primera vez que se lee o cambia su catálogo (idempotente, bajo el candado de la iglesia). `Church.rolesSeeded` evita que una iglesia que quitó todos sus roles los recupere.
- «Dirigir» es un rol fijo del servicio: no está en el catálogo, no se puede crear con ese nombre, pero participa en las restricciones con la clave `DIRIGIR`.
- Un par se guarda ordenado (`first < second`), por lo que es único sin importar el orden y la base de datos rechaza un rol emparejado consigo mismo.
- `combinationAllowed(restrictions, roles)` (`apps/api/src/role-rules.ts`) es la función pura que usarán las participaciones: recibe los pares y los roles (ids o `DIRIGIR`) que una persona tendría en un servicio, y responde si la combinación es válida.

## Pendiente

- Advertencia al quitar un rol con asignaciones en servicios futuros (y marcarlas como pendientes): llega con las participaciones, porque aún no existen asignaciones. Hoy quitar un rol solo borra el rol y sus restricciones.
- Cambiar el nombre de un rol no está en el alcance.

## Interfaz web

La pantalla de ajustes de la iglesia (`apps/web/src/calendar/SettingsPage.tsx`) muestra «Roles musicales» (lista, quitar con confirmación y hoja para agregar) y «Roles que no se pueden combinar» (lista con quitar y hoja para elegir dos roles, Dirigir incluido). Los cambios de roles y restricciones se aplican al momento; no esperan a «Guardar cambios», que sigue guardando solo nombre, días y los interruptores. Quien no administra ve ambas listas en solo lectura.
