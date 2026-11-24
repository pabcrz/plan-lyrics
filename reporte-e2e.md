# Reporte de investigación E2E — Plan & Lyrics

**Fecha:** 2026-11-24  
**Alcance:** investigación solamente. No se modificó código, ni se hicieron commits/pushes. Este es el único archivo creado y no se agregó a Git.

## Resumen

Confirmé dos fallas que explican los síntomas:

1. **Crítica:** no existe `DELETE /api/services/:id`, ni un cliente/interfaz que lo llame. Un servicio no puede eliminarse aunque tenga setlist, participaciones o predicación.
2. **Alta:** el frontend muestra «Revisa tu conexión» para cualquier respuesta no-2xx, incluidos 400/401/403/404/409. Oculta permisos, sesión vencida, conflictos y validaciones como si fueran una caída de red.

No encontré una desalineación estática entre `?role=direct|preach`, `canDirect`/`canPreach`, participaciones o `PATCH /api/services/:id`. `setDirector` es estado local de React, no una ruta HTTP obsoleta.

## Fallas

### F-01 — Eliminación de servicios ausente

- **Severidad:** crítica.
- **Pasos:** crear/elegir un servicio, incluso con setlist, asignaciones y `ServicePreaching`; intentar borrarlo o enviar `DELETE /api/services/<id>`.
- **Esperado:** un editor/administrador puede borrarlo de manera transaccional y explícita, respetando el aislamiento de iglesia y sus dependencias.
- **Real:** no existe `DELETE /api/services/:id`. `apps/api/src/services.ts` termina sus rutas en `DELETE /api/closed-dates/:date` (líneas 358–365). La única ruta DELETE que comienza por servicios es para una **entrada de setlist**: `apps/api/src/setlist.ts:112`. Tampoco existe una llamada DELETE de servicio en `apps/web/src`.
- **Causa probable:** flujo incompleto: faltan ruta, tratamiento transaccional de dependencias, hook/UI y pruebas.
- **Evidencia:** `apps/api/src/services.ts:268–365`, `apps/api/src/setlist.ts:112`.

### F-02 — Errores API presentados falsamente como conexión

- **Severidad:** alta.
- **Pasos:** provocar un `401`, `403`, `400`, `404`, `409` o `503` en una consulta de pantalla.
- **Esperado:** distinguir sesión/permisos, recurso inexistente, validación/conflicto y disponibilidad/red.
- **Real:** `useApiFetch` convierte todo `!response.ok` a `ApiError` (`apps/web/src/calendar/api.ts:33–43`). Varias pantallas reaccionan solo a `isError` y muestran «Revisa tu conexión»: iglesia activa (`ChurchGate.tsx:85–88`), calendario (`HomePage.tsx:99–102`), directorio (`PeoplePage.tsx:37–40`) y detalle (`ServicePage.tsx:54–57`).
- **Causa probable:** traducción de errores genérica sin clasificar `status`/`code`.
- **Impacto:** explica que varias pantallas muestren ese texto aun cuando la API responde correctamente un rechazo de negocio o autorización.

## Sospechosos revisados

### Migración `20261124120000_roles_y_director_opcional`

- **Lectura estática:** agrega `canDirect` y `canPreach` con `DEFAULT false`, hace opcional `Service.directorId`, activa dirección para personas existentes y predicación para quienes ya predicaron (`apps/api/prisma/migrations/20261124120000_roles_y_director_opcional/migration.sql:2–11`). No encontré pérdida obvia de datos en el SQL.
- **Contrato:** la API acepta exactamente `direct|preach` (`apps/api/src/people-rules.ts:20`) y el cliente envía esos mismos valores en `usePeople` (`apps/web/src/calendar/api.ts`).
- **Límite:** no se pudo certificar contra PostgreSQL real. El comando solicitado abortó antes de iniciar la base: `listen EPERM: operation not permitted 127.0.0.1`. Por ello no se ejecutaron migración limpia ni migración sobre datos previos.

### Personas, PATCH y participaciones

- `POST /api/services` y `PATCH /api/services/:id` comprueban que el director siga activo y tenga `canDirect`; PATCH requiere sesión y `canEdit` (`apps/api/src/services.ts:268–302`). Es coherente con el modelo nuevo, pero una persona con ambos flags falsos no aparecerá como directora.
- La migración marca `canDirect=true` a personas existentes, por lo que no hay una ruptura estática directa para registros previos.
- Las rutas de asignaciones (listar/agregar/reemplazar/quitar) y su cliente coinciden en lectura estática: `apps/api/src/participations.ts:120–300` y `apps/web/src/calendar/participations-api.ts`.

## Verificación observada

| Comprobación | Resultado |
| --- | --- |
| `env -u DIRECT_URL -u DATABASE_URL -u TEST_DATABASE_URL LC_ALL=en_US.UTF-8 pnpm --config.verifyDepsBeforeRun=false test:db` | **Bloqueada:** el sandbox denegó reservar `127.0.0.1` (`EPERM`). No inició PostgreSQL ni corrieron migraciones/integración/smoke. |
| `env -u DIRECT_URL -u DATABASE_URL -u TEST_DATABASE_URL LC_ALL=en_US.UTF-8 pnpm --config.verifyDepsBeforeRun=false test` | **OK:** API: 22 archivos, 332 pruebas; Web: 39 archivos, 454 pruebas. |
| Recorrido E2E real solicitado y migración sobre fixture previo | **No ejecutable** sin PostgreSQL local; no se inventan resultados. |

Se eliminó el directorio temporal vacío creado por el intento de base. No se tocaron los temporales preexistentes.

## Cobertura faltante y recomendación (no aplicadas)

Las pruebas verdes no cubren `DELETE /api/services/:id` porque la ruta y el cliente no existen, ni cubren mensajes específicos para 401/403/400/409 en las pantallas genéricas.

1. Implementar y probar borrado transaccional de servicio, incluyendo setlist, asignaciones, predicación y enlaces.
2. Añadir hook/UI con confirmación e invalidación de caché.
3. Centralizar el mapeo de `ApiError` para separar autorización, validación, conflicto, inexistencia y disponibilidad/red.
4. Repetir el recorrido pedido en un entorno que permita PostgreSQL local, aplicando todas las migraciones tanto desde cero como sobre datos pre-migración.

Risk: none (solo investigación y reporte; sin cambios al código de la aplicación).
