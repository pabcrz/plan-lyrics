# Servicios y calendario (API)

Primera rebanada de la Etapa 1. Todas las rutas requieren Bearer de sesión (ver [autenticación](autenticacion-api.md)), consultan permisos en PostgreSQL en cada petición y responden `Cache-Control: no-store`.

## Iglesia activa

La iglesia activa **nunca viene del cliente**: se deriva de la membresía de la sesión. Regla mínima provisional (producto aún no define un selector): una sola membresía = iglesia activa. Sin membresía (incluido el superadministrador y los gestores de cuentas sin membresía): `404`. Varias membresías: `409 {"error":"Active church required"}`.

## Rutas

| Ruta | Quién | Resultado |
| --- | --- | --- |
| `GET /api/active-church` | Cualquier miembro | `{id, name, sundayDouble, canEdit, timeZone:"America/Mexico_City", days:[{weekday (0=domingo), slot, time, title}]}`. Los días solo precargan el formulario. |
| `GET /api/people` | Cualquier miembro | Personas de la iglesia activa `[{id, name}]`, para elegir director. |
| `GET /api/services?month=YYYY-MM` | Cualquier miembro | Servicios del mes `[{id, title, date, slot, time, status, director}]`. |
| `POST /api/services` | Administrador o editor | `201` con el servicio. Cuerpo: `title`, `date` (`YYYY-MM-DD`), `status` (`DRAFT`/`PUBLISHED`), `directorId`, `time` (`HH:mm`, opcional), `slot` (`MORNING`/`AFTERNOON`, solo domingo doble). |

## Reglas aplicadas en servidor

- Director obligatorio y perteneciente a la iglesia activa (clave compuesta a `ChurchPerson`).
- Cuerpo estricto: un campo `churchId` se rechaza (`400`).
- Una fecha admite un servicio; un domingo admite dos (mañana < 12:00 y tarde) solo si `Church.sundayDouble`. En domingo doble la franja es obligatoria y la hora debe caer en ella. Fuera de ahí no se acepta franja.
- Fecha llena o franja repetida: `409 {"error":"Date full"}`. El conteo se serializa por iglesia (`FOR UPDATE`) y el índice único `(iglesia, fecha, franja)` actúa de respaldo.
- Integrante: `403` al crear. Sin sesión: `401`.

## Pendiente de decisión de producto

Selector de iglesia activa con varias membresías; acceso del superadministrador a una iglesia concreta; creación con estado completado/cancelado (aquí solo borrador o publicado, según el diseño); edición y cancelación de servicios; pantalla de ajustes (los días y `sundayDouble` se cargan por seed: `pnpm --filter @plan-lyrics/api db:seed`).

## Interfaz web (apps/web)

- `/` (sesión iniciada): calendario del mes (`?mes=YYYY-MM`), semanas de domingo a sábado, marca por estado con icono y texto, agenda del mes, detalle del servicio con su dirección en una hoja inferior. Zona horaria `America/Mexico_City` para «hoy».
- `/servicios/nuevo`: fechas habituales (las próximas cuatro, **empezando mañana**: incluir hoy sigue pendiente en producto) con la hora habitual debajo, fechas completas deshabilitadas, «Otra fecha» para un servicio especial, selector Mañana/Tarde en domingo doble, hora editable con la rueda y director obligatorio. La API vuelve a validar todo.
- El botón «Nuevo» y el formulario solo se ofrecen a quien puede editar (`canEdit`); el servidor decide de todos modos.
- `SessionCheck` ya no se muestra (la sesión se ejerce al cargar el calendario); su archivo y pruebas siguen en el repositorio.
