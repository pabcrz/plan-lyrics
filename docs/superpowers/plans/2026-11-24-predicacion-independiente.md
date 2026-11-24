# Predicación independiente del setlist: plan de implementación

> **Para quien ejecute:** usa superpowers:subagent-driven-development (recomendado) o superpowers:executing-plans. Los pasos usan casillas `- [ ]`.

**Meta:** crear servicios con director, predicador o ambos; separar quién puede dirigir de quién puede predicar; y dar a la predicación un lugar propio.

**Arquitectura:** `Service.directorId` pasa a ser opcional y `ChurchPerson` gana `canDirect` y `canPreach`. La creación de servicio guarda en una sola transacción el servicio y su `ServicePreaching`. Una pestaña «Predicaciones» y el detalle del servicio leen y escriben el mismo registro.

**Stack:** pnpm monorepo. `apps/api`: Hono, Prisma (PostgreSQL), zod, vitest. `apps/web`: React, react-router, @tanstack/react-query, vitest con testing-library.

**Spec:** `docs/superpowers/specs/2026-11-24-predicacion-independiente-design.md`

## Restricciones globales

- Texto de interfaz y documentación en español de México, con tú.
- Un servicio necesita al menos director o predicador; si no hay ninguno, la API responde `400 Invalid request`.
- La iglesia nunca viene en el cuerpo de la petición; sale del acceso de quien llama. Las personas se buscan siempre por el vínculo activo de esa iglesia.
- Los servicios pasados no se modifican (regla vigente de `preaching.ts`).
- Sin cambios en los enlaces para compartir salvo no fallar con `director` nulo.
- Cada tarea cierra con sus pruebas en verde: `cd apps/api && pnpm test` y `cd apps/web && pnpm test`. Los nombres de archivos de prueba siguen el estilo de los vecinos.
- Commits convencionales en español, sin atribución de IA. Tareas 2 y 3 (migración y contrato) van en commits propios.

## Enfoque de revisión

Entradas que la spec implica y ninguna prueba obvia cubriría. Cada línea tiene su prueba en la tarea indicada.

1. Servicio con `preacherId` en una iglesia que no usa predicación: no se crea nada (T3).
2. `directorId` de una persona sin `canDirect`, o `preacherId` sin `canPreach`: `400` (T4).
3. Servicio sin director en participaciones, rotación y listados: no truena y no inventa director (T3).
4. «Rol alabanza» y calendario con un servicio sin director: texto «Sin director», no `undefined` (T5).
5. Nombre repetido al agregar un predicador: ofrece asociar el rol, no crea una persona duplicada (T6).

## Estructura de archivos

- `apps/api/prisma/schema.prisma` y una migración nueva: columnas y backfill.
- `apps/api/src/service-rules.ts`, `services.ts`: contrato de creación.
- `apps/api/src/people-rules.ts`, `services.ts` (rutas `/api/people`): roles.
- `apps/api/src/preaching.ts`: ruta `GET /api/preaching?month=` y validación de `canPreach`.
- `apps/web/src/calendar/ChurchGate.tsx`: modal y pestañas.
- `apps/web/src/calendar/ServiceFormPage.tsx`, `PreachingPlanPage.tsx` (nuevo), `PersonRoles.tsx` (nuevo): pantallas.
- `apps/web/src/calendar/BatchPage.tsx`, `batch-draft.ts` (nuevo): borrador del lote.

---

### Tarea 1: el modal «Nuevo» se cierra al elegir

**Archivos:** Modificar `apps/web/src/calendar/ChurchGate.tsx` (función `option` de `MainTabbar`). Probar en `CalendarPage.test.tsx` junto a las pruebas existentes de «Nuevo».

**Interfaces:** Produce: nada nuevo; cambia solo el comportamiento de `MainTabbar`.

- [ ] **Paso 1: prueba que falla.** `test('elegir una opción de «Nuevo» cierra la hoja')`: abrir «Nuevo», pulsar «Servicio individual», esperar la ruta `/servicios/nuevo` y afirmar que no queda un diálogo «Nuevo» en pantalla (también con «Lote mensual»).
- [ ] **Paso 2:** `cd apps/web && pnpm test CalendarPage` y confirmar el fallo.
- [ ] **Paso 3:** en `option`, el `onClick` llama `setChoosing(false)` antes de `navigate(path)`.
- [ ] **Paso 4:** repetir la prueba y confirmar que pasa.
- [ ] **Paso 5:** `git commit -m "fix(web): cierra la hoja «Nuevo» al elegir una opción"`

---

### Tarea 2: esquema y migración (director opcional, roles de persona)

**Archivos:** Modificar `apps/api/prisma/schema.prisma`. Crear `apps/api/prisma/migrations/20261124120000_roles_y_director_opcional/migration.sql`.

**Interfaces:** Produce: `Service.directorId String?` y `director ChurchPerson?`; `ChurchPerson.canDirect Boolean @default(false)` y `canPreach Boolean @default(false)`.

- [ ] **Paso 1:** en el esquema, `directorId` y la relación `director` pasan a opcionales; `canDirect` y `canPreach` se añaden a `ChurchPerson`.
- [ ] **Paso 2:** escribir la migración a mano. Debe: quitar `NOT NULL` de `Service.directorId`; añadir las dos columnas; `UPDATE "ChurchPerson" SET "canDirect" = true`; `UPDATE ... SET "canPreach" = true WHERE EXISTS` (la persona tiene una fila en `ServicePreaching` como `preacherId`). Así nadie actual pierde acceso.
- [ ] **Paso 3:** `cd apps/api && pnpm db:generate && pnpm db:validate` sin errores. Con base de datos local, `pnpm db:migrate` y `pnpm db:drift` sin diferencias.
- [ ] **Paso 4:** `git commit -m "feat(api): director opcional y roles de persona en el esquema"` (el código aún no compila contra el tipo nulo; la tarea 3 lo cierra, así que no se hace push entre ambas).

---

### Tarea 3: crear servicio con director, predicador o ambos

**Archivos:** Modificar `apps/api/src/service-rules.ts`, `services.ts`, `participations.ts`, `participation-rules.ts`, `participation-generation.ts`, `batches.ts`, `batch-rules.ts`, `share-view.ts`, `apps/web/src/calendar/model.ts` y `api.ts`. Probar en `service-rules.test.ts`, `participation-rules.test.ts` y el test de integración de servicios existente.

**Interfaces:**
- Produce `newServiceBody`: `{ title, date, slot?, time?, status, directorId?: string, preacher?: { personId: string; topic?: string } }` con la regla `directorId || preacher`, o falla.
- Produce la respuesta de servicio con `director: { id: string; name: string } | null`.
- `generateForServices` y `personFits` aceptan `directorId: string | null`.

- [ ] **Paso 1: pruebas de reglas que fallan** en `service-rules.test.ts`: `newServiceBody` acepta solo director, solo predicador y ambos; rechaza ninguno; rechaza `preacher.topic` de más de 200 caracteres (reusar el límite de `TOPIC_MAX` de `preaching-rules.ts`) y claves extra.
- [ ] **Paso 2:** implementar el esquema zod con `.refine` para «al menos uno».
- [ ] **Paso 3: pruebas de integración que fallan:** (a) `POST /api/services` con solo `preacher` crea el servicio con `director: null` y su fila `ServicePreaching`; (b) con `preacher` y `usesPreaching = false` responde `409 Preaching disabled` y no queda servicio (línea 1 de Enfoque de revisión); (c) con ambos, crea los dos en una transacción; (d) una `preacher.personId` inexistente o de otra iglesia responde `400` y no deja servicio.
- [ ] **Paso 4:** en `POST /api/services`, dentro de la transacción existente, validar director solo si viene, y crear `ServicePreaching` con `tx.servicePreaching.create` cuando venga `preacher`. Reusar `activePerson` de `preaching.ts` (exportarlo) para validar al predicador. `generateForServices` solo se llama con director.
- [ ] **Paso 5:** hacer seguros ante `null` todos los lectores de `directorId` y `director` listados en **Archivos**. `participations.ts` y `participation-rules.ts`: sin director, la comparación `=== directorId` es falsa y no se añade `DIRECTOR_KEY`. `batches.ts`: `director: row.director?.person.name ?? null`. Añadir una prueba en `participation-rules.test.ts` con un servicio sin director.
- [ ] **Paso 6:** `pnpm test` y `pnpm exec tsc --noEmit` en `apps/api`; `pnpm exec tsc --noEmit` en `apps/web` para detectar lectores de `director` sin cubrir (se corrigen en la tarea 5).
- [ ] **Paso 7:** actualizar `docs/servicios-calendario.md` (creación con dirección o predicación) y `docs/predicacion.md`.
- [ ] **Paso 8:** `git commit -m "feat(api): crea servicios con director, predicador o ambos"`

---

### Tarea 4: roles de persona en la API

**Archivos:** Modificar `apps/api/src/people-rules.ts`, `services.ts` (rutas `/api/people`), `preaching.ts`, `batches.ts`. Probar en `people-rules.test.ts` y la prueba de integración de personas.

**Interfaces:**
- `newPersonBody` gana `canDirect?: boolean`, `canPreach?: boolean`.
- `personPatch` gana los mismos campos y sigue exigiendo al menos un campo.
- `GET /api/people?role=direct|preach` devuelve solo personas con ese rol; sin `role`, todas. Cada elemento: `{ id, name, hasAccount, canDirect, canPreach }`.
- `PATCH /api/people/:personId` con `canDirect`/`canPreach` actualiza el vínculo `ChurchPerson` de la iglesia activa, nunca `Person`.

- [ ] **Paso 1: pruebas que fallan** (reglas): los cuerpos aceptan los booleanos; un valor no booleano o una clave extra se rechaza.
- [ ] **Paso 2: pruebas de integración que fallan:** (a) `GET /api/people?role=preach` omite a quien solo dirige; (b) `PATCH` con `canPreach: true` lo incluye después; (c) `POST /api/services` con `directorId` sin `canDirect` responde `400`; con `preacher.personId` sin `canPreach` responde `400` (línea 2 de Enfoque de revisión); (d) `PUT /api/services/:id/preaching` conserva a un predicador ya guardado aunque se le quite `canPreach`, pero rechaza elegir uno nuevo sin el rol; (e) `POST /api/people` con nombre repetido sigue respondiendo `409 Name exists` con `existing`.
- [ ] **Paso 3:** implementar. El rol sale del vínculo activo (`activeLink(church.churchId)`). `POST /api/people` guarda los roles recibidos (ninguno, si no se envía). Validar roles en la creación de servicio (tarea 3), en `preaching.ts` (solo al **cambiar** de predicador) y en `batches.ts` (`directorIds` y `preacherId` de cada entrada).
- [ ] **Paso 4:** documentar los roles en `docs/participaciones.md` o el archivo de personas que corresponda.
- [ ] **Paso 5:** `git commit -m "feat(api): roles de dirección y predicación por persona"`

---

### Tarea 5: web, servicios sin director y selectores por rol

**Archivos:** Modificar `apps/web/src/calendar/model.ts`, `api.ts`, `CalendarPage.tsx`, `apps/web/src/share/documents.ts`, `apps/web/src/ui/PersonPicker.tsx`. Probar en `CalendarPage.test.tsx` y la prueba de `documents`.

**Interfaces:**
- `Service.director: { id: string; name: string } | null`; `Person` gana `canDirect: boolean; canPreach: boolean`.
- `usePeople(enabled: boolean, role?: 'direct' | 'preach')`: la clave de caché incluye el rol.

- [ ] **Paso 1: pruebas que fallan:** el detalle y la fila del calendario muestran «Sin director» cuando `director` es `null`; la lista «Rol alabanza» incluye o excluye esas fechas (decisión: se muestran con «Sin director», para que el rol mensual revele huecos) (línea 4 de Enfoque de revisión).
- [ ] **Paso 2:** implementar los cambios de tipo y los textos. Hacer que `tsc --noEmit` de `apps/web` pase.
- [ ] **Paso 3:** `usePeople` recibe el rol y lo envía como `?role=`.
- [ ] **Paso 4:** `pnpm test` en `apps/web` en verde; `git commit -m "feat(web): servicios sin director y personas por rol"`

---

### Tarea 6: formulario de servicio con dirección y predicación opcionales

**Archivos:** Modificar `apps/web/src/calendar/ServiceFormPage.tsx`, `api.ts` (`useServiceActions().create`). Probar en `ServiceFormPage.test.tsx`.

**Interfaces:**
- `create({ title, date, slot?, time?, status, directorId?, preacher?: { personId: string; topic?: string } })`.
- Consume `usePeople(enabled, 'direct' | 'preach')` y `usePersonActions().create(person: { name; phone?; canDirect?; canPreach? })` de la tarea 5.

- [ ] **Paso 1: pruebas que fallan:** (a) con la predicación activada, el formulario muestra las secciones «Dirección» y «Predicación», ambas opcionales; con la predicación desactivada solo «Dirección» (y es obligatoria, como hoy); (b) enviar sin ninguna muestra «Elige quién dirige o quién predica.» y no llama a la API; (c) enviar solo con predicador llama `create` con `preacher` y sin `directorId`; (d) cada selector solo lista a personas con su rol; (e) escribir un nombre que ya existe sin ese rol muestra «Añadir también como predicador» (o «director») y, al pulsarlo, hace `PATCH` del rol y selecciona a la persona, sin crear otra (línea 5 de Enfoque de revisión).
- [ ] **Paso 2:** implementar. Reusar `PersonPicker` y el aviso de duplicado ya existente; su acción hoy dice «usa a {nombre}» y pasa a asociar el rol cuando falta. Tras crear el servicio, navegar como hoy.
- [ ] **Paso 3:** pruebas en verde; `git commit -m "feat(web): crea servicio con dirección, predicación o ambas"`

---

### Tarea 7: roles en el directorio de personas

**Archivos:** Crear `apps/web/src/calendar/PersonRoles.tsx`. Modificar `apps/web/src/people/PersonPage.tsx`, `NewPersonPage.tsx`, `PeoplePage.tsx`. Probar en `People.test.tsx`.

**Interfaces:**
- `PersonRoles({ value: { canDirect: boolean; canPreach: boolean }; onChange: (next: { canDirect: boolean; canPreach: boolean }) => void; showPreach: boolean })`: dos interruptores («Dirige alabanza», «Predica»). `showPreach` es `church.usesPreaching`.

- [ ] **Paso 1: pruebas que fallan:** la ficha de persona muestra los dos interruptores y guardarlos llama a `usePersonActions().update` con los booleanos; el alta de persona los incluye; la lista de personas muestra una etiqueta corta de rol por persona.
- [ ] **Paso 2:** implementar y que `update` acepte `{ canDirect?, canPreach? }`.
- [ ] **Paso 3:** pruebas en verde; `git commit -m "feat(web): roles de dirección y predicación en personas"`

---

### Tarea 8: pestaña «Predicaciones»

**Archivos:** Crear `apps/web/src/calendar/PreachingPlanPage.tsx`. Modificar `apps/web/src/calendar/ChurchGate.tsx` (`MainTabbar`), `ProductRoutes.tsx`, `apps/api/src/preaching.ts`, `apps/web/src/calendar/preaching-api.ts`. Probar en `PreachingPlanPage.test.tsx` y la prueba de integración de predicación.

**Interfaces:**
- API: `GET /api/preaching?month=YYYY-MM` → `Array<{ service: { id; title; date; slot; time; status }, preaching: { preacher: { id; name } | null; topic: string } | null }>`, ordenado por fecha y franja. Responde `409 Preaching disabled` si la iglesia no usa predicación. Reusar `monthQuery` de `service-rules.ts`.
- Web: `usePreachingPlan(month: string)` en `preaching-api.ts`.
- `MainTabbar` pasa a `current: 'calendar' | 'preaching' | 'people'`, y muestra la pestaña solo si `church.usesPreaching`. La ruta es `/predicaciones`.

- [ ] **Paso 1: pruebas de integración que fallan:** el listado devuelve servicios del mes con y sin predicación; solo quien pertenece a la iglesia ve sus datos; `409` con la predicación desactivada.
- [ ] **Paso 2:** implementar la ruta en `preaching.ts`.
- [ ] **Paso 3: pruebas web que fallan:** la pestaña aparece solo con `usesPreaching`; la página lista por mes fecha, predicador y tema, y marca «Sin predicador» y «Sin tema»; tocar una fila abre una hoja con el `PreachingSection` existente (misma edición que el detalle del servicio); el botón «Nueva predicación» navega a `/servicios/nuevo?seccion=predicacion` y el formulario abre con esa sección activa y sin exigir director.
- [ ] **Paso 4:** implementar la página, la pestaña y la ruta. No duplicar la edición: reusar `PreachingSection`.
- [ ] **Paso 5:** actualizar `docs/predicacion.md` con el nuevo lugar. `git commit -m "feat: pestaña de predicaciones independiente del setlist"`

---

### Tarea 9: borrador del lote mensual

**Archivos:** Crear `apps/web/src/calendar/batch-draft.ts`. Modificar `apps/web/src/calendar/BatchPage.tsx`. Probar en `batch-draft.test.ts` y `BatchPage.test.tsx`.

**Interfaces:**
- `saveBatchDraft(churchId: string, draft: BatchDraft): void`, `loadBatchDraft(churchId: string): BatchDraft | null`, `clearBatchDraft(churchId: string): void`. `BatchDraft` guarda lo que `BatchPage` ya mantiene en estado (período, directores, predicadores y revisión), más una fecha de guardado. Usa `localStorage` con una clave por iglesia; un valor corrupto o de otra versión se ignora.

- [ ] **Paso 1: pruebas que fallan:** guardar y cargar devuelve el mismo borrador; un JSON corrupto devuelve `null`; al montar `BatchPage` con un borrador guardado se ofrece «Retomar borrador» y «Empezar de nuevo»; completar el lote con éxito lo borra.
- [ ] **Paso 2:** implementar el módulo y conectarlo a `BatchPage` (guardar al cambiar de paso o de datos; borrar tras crear).
- [ ] **Paso 3:** pruebas en verde; `git commit -m "feat(web): conserva el borrador del lote mensual"`

---

## Autorrevisión

- **Cobertura de la spec:** modal (T1); dirección y predicación opcionales, mínimo una (T3, T6); directorId nullable y migración (T2); roles y asociación guiada (T4, T6, T7); pestaña (T8); detalle del servicio intacto (T8 reusa `PreachingSection`); borrador del lote (T9). Sin tareas para traslapes, enlaces ni roles genéricos, como pide la spec.
- **Ajuste respecto de la spec:** la spec dice que las pantallas con `director` nulo quedan «para quien construye»; este plan decide «Sin director» (T5).
- **Consistencia de tipos:** `canDirect`/`canPreach`, `preacher: { personId, topic? }` y `director: ... | null` son los mismos nombres en T2 a T8.
- **Riesgo:** T2 y T3 son de alto riesgo (migración y cambio de contrato que otros consumen). Se recomienda un verificador independiente al terminar T3 y T4.
