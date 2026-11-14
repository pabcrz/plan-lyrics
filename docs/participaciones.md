# Participaciones habituales, rotación y asignaciones (API)

Misma regla de iglesia que [servicios y calendario](servicios-calendario.md#iglesia-activa): la iglesia sale siempre del acceso de la sesión y nunca del cliente (`400` si el cuerpo trae `churchId`). Todos los miembros leen; configuran y cambian asignaciones el administrador y quien edita servicios (`403` para el integrante, `401` sin sesión). Los ids de otra iglesia no existen: `404`, o `400` si van dentro del cuerpo como persona.

## Rutas

| Ruta | Quién | Notas |
| --- | --- | --- |
| `GET /api/role-participations` | Cualquier miembro | Un elemento por rol: `{roleId, name, habitual:[{id,name}], rotation:{enabled, mode, startsOn, sequences:[{weekday, people}]}, preview:[{date, slot, rotation, habitual}]}`. `weekday` es 0–6 o `null` (la secuencia compartida). La vista previa son los próximos seis servicios de los días habituales de la iglesia: no crea nada ni mueve la rotación. |
| `PUT /api/role-participations/:roleId` | Editor | Reemplaza la configuración del rol: `{habitualIds, rotation:{enabled, mode:"BY_DAY"\|"SHARED", startsOn, sequences:[{weekday, personIds}]}}`. Responde como el `GET` de ese rol. `400` si una persona no es de la iglesia o fue dada de baja, si hay repetidos, o si alguien es habitual y rota en el mismo rol. |
| `GET /api/services/:serviceId/assignments` | Cualquier miembro | `{service, assignments:[{id, roleId, roleName, source, pending, person, proposed}]}`. `pending` es `COMBINATION`, `ROLE_REMOVED` o `null`; `proposed` es la persona que propuso el rol cuando quedó pendiente por combinación. |
| `POST /api/services/:serviceId/assignments` | Editor | Agrega una persona a un rol de este servicio: `{roleId, personId}`. `201`. |
| `PUT /api/assignments/:assignmentId` | Editor | **Reemplazar solo en este servicio**: `{personId}`. Sirve también para dar persona a un rol pendiente por combinación. No toca la rotación ni otros servicios. |
| `DELETE /api/assignments/:assignmentId` | Editor | `204`; quita la fila (incluido un marcador de rol eliminado). |
| `POST /api/assignments/swap` | Editor | **Intercambiar turnos**: `{first, second}` son dos asignaciones con persona del mismo rol en servicios distintos. Las dos personas cambian de lugar; nadie más se mueve. |
| `GET /api/role-turns?roleId=…&from=YYYY-MM-DD` | Cualquier miembro | Próximos turnos con persona de un rol (desde hoy por defecto, hasta 40), para elegir con quién intercambiar. |

Errores de cambio por servicio: `400 {"error":"Date in the past"}` (los servicios de fechas pasadas son registro; hoy sí se edita), `409 {"error":"Combination not allowed"}` (usa `combinationAllowed` con las asignaciones de esa persona en ese servicio y su rol de dirigir), `409 {"error":"Already assigned"}`, `409 {"error":"Role removed"}` (un marcador sin rol solo se puede quitar).

## Generación al crear servicios

`POST /api/services` y `POST /api/service-batches` llaman, dentro de su propia transacción y con el mismo bloqueo por iglesia, a `generateForServices` (`participation-generation.ts`). Para cada servicio, en orden de fecha (y franja):

1. Cada rol propone a sus **habituales** (todos) y, si la rotación está activa y la fecha es igual o posterior a `startsOn`, a la persona que **sigue** en su secuencia. La secuencia es la del día de la semana (modalidad `BY_DAY`) o la única compartida (`SHARED`); el cursor (`nextPersonId`) avanza una persona por servicio generado y se guarda, así que continúa entre lotes y meses. Cada servicio cuenta un turno, también cada franja de un domingo doble.
2. Una propuesta que formaría una combinación no permitida con otra propuesta de la misma persona, o con dirigir ese servicio, **no se asigna a nadie**: queda una fila pendiente (`COMBINATION`, sin persona) en ese rol con la persona propuesta anotada. Si dos roles chocan, ambos quedan pendientes: no hay prioridad entre roles (decisión de producto pendiente). El director elegido al crear el servicio nunca se mueve. El turno de rotación se consume aunque quede pendiente.
3. Las personas dadas de baja del directorio no reciben turnos ni habituales.

Guardar la configuración (`PUT`) no cambia servicios ya creados. La rotación **reinicia en su primera persona** al activarse o al cambiar su fecha de inicio; en otro caso cada secuencia conserva su cursor mientras esa persona siga en la lista (si se quita, vuelve a la primera). El efecto de un cambio de orden sobre servicios ya generados sigue pendiente de producto.

## Eliminar un rol con asignaciones

`DELETE /api/roles/:roleId` (solo administrador): si hay asignaciones del rol en servicios de hoy en adelante responde `409 {"error":"Future assignments","services":N}` sin borrar nada. Con `?confirm=future-assignments` procede: esas asignaciones quedan como pendientes `ROLE_REMOVED` (sin rol ni persona, con el nombre del rol como registro) y las de servicios pasados se conservan intactas con el nombre del rol. La base de datos garantiza que una fila nunca tiene a la vez persona y marcador pendiente.

## Modelo

`RolePlan` (por rol: `habitualIds`, `rotationOn`, `mode`, `startsOn`), `RotationSequence` (por rol y día, o `-1` compartida: `memberIds` ordenados y `nextPersonId`) y `Assignment` (servicio, rol o su nombre guardado, persona o marcador pendiente, origen `HABITUAL`/`ROTATION`/`MANUAL`). Los ids de personas de `RolePlan` y `RotationSequence` no son claves foráneas (como `BatchDirectors`): una persona dada de baja se filtra al leer y al generar.

## Decisiones tomadas y pendientes

- Varias personas habituales en cualquier rol (el producto solo lo exige para voces); la interfaz no limita.
- El director del servicio no se reasigna ni se compara por prioridad: ante un choque con dirigir queda pendiente el rol que lo causaría.
- Pendiente de producto: prioridad real entre dos propuestas en conflicto, servicios creados fuera de orden, cancelaciones y qué hacer con servicios ya generados al cambiar el orden.
