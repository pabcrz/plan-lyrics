# Gestionar grupos de personas: plan de implementación

> **Para quien ejecute:** usa superpowers:executing-plans (o subagent-driven-development) tarea por tarea. Los pasos usan casillas `- [ ]`.

**Meta:** que el alta de una persona registre sus roles de alabanza al momento, y que cada grupo (Alabanza, Dirección, Predicación) tenga su vista **Gestionar** dentro de Personas.

**Arquitectura:** solo cambia la web. El API ya tiene `canPlay`/`canDirect`/`canPreach` y `PUT /api/people/:id/roles`. Se extrae un componente de chips de roles que reutilizan la ficha, el alta y la hoja «Gestionar».

**Stack:** React 19 + react-router, TanStack Query, Vitest + Testing Library (`pnpm --filter web test`), el sistema visual existente (`Sheet`, `Switch`, `Button`).

**Spec:** `docs/superpowers/specs/2026-11-25-grupos-de-personas-design.md`

## Restricciones globales

- Textos formales y de interfaz en español de México, con tú, sin voseo.
- Solo `church.canConfigure` cambia roles musicales; `church.canEdit` agrega y quita de grupos.
- «Predicación» solo aparece si `church.usesPreaching`.
- Sin migraciones ni cambios en `apps/api`.
- Sin lenguaje visual nuevo: reutilizar `Sheet`, `Switch`, `PersonRoles`, chips de `PersonPage`.
- Base: `develop`. La PR va a `develop`.

## Enfoque que se desvía del spec

El spec decía que el alta acepta `roleIds`. Para no tocar el API, el cliente hace el alta con `canPlay` y después `PUT /roles` con los roles marcados (como ya hace el flujo de invitación). Si el segundo paso falla, la persona queda creada y se avisa con un enlace a su ficha.

## Puntos de revisión

- Quitar a alguien de Alabanza mientras es habitual o está en una rotación: el API responde 409 `In use`; la hoja debe revertir el interruptor y explicarlo.
- Iglesia sin roles musicales: no mostrar chips vacíos; indicar dónde crearlos.
- Quien solo edita (no administra) no ve chips de roles en el alta ni los edita en la hoja.
- Dos toques seguidos en un interruptor mientras la petición va en vuelo no deben dejarlo desincronizado.
- Lista de grupo vacía: mostrar cómo agregar, no solo «Nadie está…».

---

### Tarea 1: `RoleChips` compartido y alta con roles

**Archivos:**
- Crear: `apps/web/src/people/RoleChips.tsx`
- Modificar: `apps/web/src/people/PersonPage.tsx` (la sección de roles usa `RoleChips`), `apps/web/src/people/NewPersonPage.tsx`, `apps/web/src/calendar/api.ts` (tipos de `create`/`update` aceptan `canPlay`)
- Prueba: `apps/web/src/people/People.test.tsx`

**Interfaces:**
- Produce: `RoleChips({ roles, chosen, onToggle, label }: { roles: MusicalRole[]; chosen: string[]; onToggle: (id: string) => void; label: string })`. Renderiza `<div role="group" aria-label={label}>` con un botón `aria-pressed` por rol, con las clases de chip que hoy usa `RolesSection`.
- Produce: `toggled(chosen: string[], id: string): string[]` (agrega o quita), exportada desde el mismo archivo.
- Produce: `usePersonActions().create` y `.update` aceptan `canPlay?: boolean`.

- [ ] **Paso 1: prueba que falla.** En `People.test.tsx`: `test('creating a person in the worship group sends the chosen roles', …)`. Iglesia `{ ...church, canEdit: true, canConfigure: true }`. Abrir `/personas/nueva`, escribir el nombre, activar «Grupo de alabanza», marcar el rol «Batería» (por `getByRole('button', { name: 'Batería', pressed: false })`) y enviar. Afirmar que `sent(calls, 'POST')` lleva `canPlay: true` y que `sent(calls, 'PUT')` tiene una llamada a `/api/people/new/roles` con `{ roleIds: ['<id de Batería en defaultRoles>'] }`.
- [ ] **Paso 2: prueba de permisos.** `test('an editor who cannot configure sees no role chips when adding', …)` con `editor`: tras activar «Grupo de alabanza», `queryByRole('group', { name: 'Roles de la persona' })` es `null`.
- [ ] **Paso 3: ejecutar y ver que fallan.** `pnpm --filter web test -- People` → FAIL (no existen los chips en el alta).
- [ ] **Paso 4: implementar `RoleChips.tsx`** moviendo los botones de `RolesSection` tal cual; `PersonPage` pasa a usarlo con `label="Roles de la persona"`.
- [ ] **Paso 5: implementar el alta.** En `NewPersonPage`, estado `roleIds: string[]`. Cuando `jobs.canPlay && church.canConfigure`, mostrar `RoleChips` con `useRoles()` bajo `PersonRoles`; si el catálogo está vacío, texto «Crea los roles en Ajustes para poder asignarlos.». Al apagar `canPlay`, vaciar `roleIds`. Tras `create`, si `roleIds.length > 0`, llamar `setRoles(person.id, roleIds)`; si falla, mostrar «La persona ya quedó registrada, pero no se pudieron guardar sus roles. Asígnalos desde su ficha.» con el enlace «Abrir su ficha» ya existente, sin navegar.
- [ ] **Paso 6: ejecutar y ver que pasan.** `pnpm --filter web test -- People` → PASS (incluye las pruebas previas de la ficha).
- [ ] **Paso 7: confirmar.** `git add apps/web && git commit -m "feat(web): marcar los roles de alabanza al agregar a una persona"`.

---

### Tarea 2: «Gestionar» cada grupo

**Archivos:**
- Crear: `apps/web/src/people/ManageGroup.tsx`
- Modificar: `apps/web/src/people/PeoplePage.tsx`
- Prueba: `apps/web/src/people/People.test.tsx`

**Interfaces:**
- Consume: `RoleChips`, `toggled` (tarea 1), `usePersonActions()`, `usePeople(true)`, `useRoles()`.
- Produce: `ManageGroup({ church, group, people, onClose }: { church: Church; group: 'play' | 'direct' | 'preach'; people: Person[]; onClose: () => void })`. Envuelve todo en `Sheet` con el título «Gestionar grupo de alabanza» / «Gestionar directores» / «Gestionar predicadores».
- Contenido: una fila por persona con `Switch` (etiqueta = nombre) marcado si pertenece al grupo; al cambiarlo llama `update(id, { canPlay | canDirect | canPreach: next })` y, si falla, revierte. En `play`, bajo cada miembro, si `church.canConfigure`, `RoleChips` que guarda al instante con `setRoles(id, toggled(...))`.
- Textos: 409 `In use` → «Sigue como habitual o en una rotación de un rol: quítala primero de ahí, en Participaciones, y luego sácala del grupo de alabanza.»; otro error → «No se pudo cambiar el grupo. Inténtalo de nuevo.»; roles → «No se pudieron guardar los roles. Inténtalo de nuevo.».
- En `PeoplePage`: con el filtro `play`/`direct`/`preach` activo y `church.canEdit`, un botón secundario «Gestionar grupo de alabanza» / «Gestionar directores» / «Gestionar predicadores» abre la hoja. Con el filtro «Todas» no se muestra.

- [ ] **Paso 1: prueba que falla (agregar a un grupo).** `test('manage directors adds a person to the group', …)`: directorio con `p2` sin `canDirect`; en `/personas` elegir el chip «Dirección», pulsar «Gestionar directores», activar el interruptor de «Álvaro Núñez». Afirmar un `PATCH` a `/api/people/p2` con cuerpo `{ canDirect: true }`.
- [ ] **Paso 2: prueba de quitar con revés.** `patchPerson` devuelve `{ status: 409, body: { error: 'In use' } }` al quitar de alabanza: el interruptor vuelve a estar marcado y aparece el texto de «Sigue como habitual…».
- [ ] **Paso 3: prueba de roles en la hoja.** Como administrador, en Alabanza pulsar un chip de rol de un miembro llama `PUT /api/people/<id>/roles` con el arreglo actualizado; como editor sin `canConfigure` no hay chips.
- [ ] **Paso 4: prueba del botón.** No existe «Gestionar…» con el filtro «Todas» ni para quien solo puede leer (`member`).
- [ ] **Paso 5: ejecutar y ver que fallan.** `pnpm --filter web test -- People` → FAIL.
- [ ] **Paso 6: implementar `ManageGroup.tsx` y el botón en `PeoplePage`.** Deshabilitar el interruptor de la fila mientras su petición está en vuelo (cubre el doble toque). El título de la hoja y el nombre del botón salen de un mismo mapa `group → { sheet, button, empty }` para que no diverjan.
- [ ] **Paso 7: ejecutar y ver que pasan.** `pnpm --filter web test` y `pnpm typecheck` y `pnpm lint` → todo en verde.
- [ ] **Paso 8: confirmar.** `git add apps/web && git commit -m "feat(web): gestionar los grupos de alabanza, dirección y predicación"`.

---

### Cierre

- [ ] Ejecutar `pnpm test`, `pnpm typecheck` y `pnpm lint` en la raíz.
- [ ] Verificar a mano en el navegador (`preview_start`) el alta con roles y la hoja «Gestionar» en 390 px y en escritorio.
- [ ] Actualizar `docs/` si algún documento describe el alta o el directorio de personas (buscar «Personas» en `docs/*.md` y `docs/design/pantallas/personas.html`).
- [ ] No hacer push ni abrir PR sin autorización.
