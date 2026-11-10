# Persistencia y acceso local

Esta unidad usa PostgreSQL de desarrollo con datos ficticios; no crea recursos cloud ni usuarios reales. La [política de altas](producto.md#alta-de-usuarios) permanece separada: solo el propietario y los gestores de cuentas que designe crean cuentas e invitan. Esta unidad solo modela esa capacidad como campo (`accountManager`); todavía no hay flujos que la otorguen ni la usen. El registro público se cierra en Clerk con el modo **Invite-only** (ver [autenticación](autenticacion-api.md#contrato-y-límites)); esta prueba no lo configura.

## Modelo mínimo

- `User`: ID interno y sujeto Clerk único; capacidades globales independientes de iglesia: editor de biblioteca (`libraryEditor`) y gestor de cuentas (`accountManager`). Ninguna da acceso a iglesias; solo el propietario las otorga, aunque esta unidad no implementa esa gestión.
- `Person`: puede existir sin usuario; vínculo de cuenta explícito, nunca por nombre. Existe una sola vez aunque figure en varias iglesias: `ChurchPerson` es el vínculo persona–iglesia y el lugar para los datos propios de cada iglesia, nunca `Person`. Borrar una iglesia elimina solo sus vínculos, no la persona. La ruta de esta prueba no expone el directorio.
- `Church` y `Membership`: pertenencia de un usuario con acceso local ADMIN, EDITOR o MEMBER. No son roles musicales.
- `PlatformOwner`: referencia al único propietario; SQL restringe su fila a ID 1. No se asigna por primer login ni por claims de permisos. La base puede estar inicialmente sin propietario: falla cerrada hasta un alta explícita.
- Todas las tablas de acceso registran `createdAt` y `updatedAt`. Las filas anteriores a la migración `access_timestamps` toman la hora de la migración; Prisma mantiene `updatedAt` en cada cambio.

Si la consulta de acceso falla, la API responde `503` con `{"error":"Access unavailable"}` y registra en stderr una sola línea JSON, por ejemplo `{"event":"church_access_failed","code":"P2010"}`, con el código Prisma/driver o `unknown`. Nunca registra mensajes del driver, cadenas de conexión, sujetos ni IDs. Sin `DATABASE_URL`, la API avisa al arrancar que esas rutas responden `503`.

No hay CRUD de usuarios, invitaciones, servicios, setlists ni generación de turnos en esta unidad. Las identidades `fixture-*` no corresponden a cuentas reales ni habilitan automáticamente la sesión humana.

## Comprobación reproducible

Herramientas requeridas en PATH: Node/pnpm fijados y PostgreSQL (`initdb`, `pg_ctl`, `createdb`). Desde la raíz:

```sh
pnpm --config.verifyDepsBeforeRun=false test:db
```

El comando crea un clúster **nuevo** en `.local/postgres/access-*`, elige un puerto loopback libre, deshabilita sockets Unix y sustituye las variables de conexión heredadas. No usa la base habitual ni lee dotenv. Aplica migraciones, comprueba que coincidan con `schema.prisma` (`db:drift`), genera el cliente, ejecuta tipos/pruebas/builds y pruebas reales de PostgreSQL. Detiene su propio clúster incluso si falla; conserva los datos ficticios y logs locales para diagnóstico, ignorados por Git. No instala dependencias ni elimina datos existentes. La autenticación trust se limita a ese clúster temporal loopback: no usar esta configuración para datos reales o producción.

Comandos Prisma desde el paquete API:

```sh
pnpm --config.verifyDepsBeforeRun=false --filter @plan-lyrics/api db:generate
pnpm --config.verifyDepsBeforeRun=false --filter @plan-lyrics/api db:validate
# Solo sobre una base de desarrollo seleccionada explícitamente:
DATABASE_URL='postgresql://USUARIO@127.0.0.1:PUERTO/BASE_DE_DESARROLLO' pnpm --config.verifyDepsBeforeRun=false --filter @plan-lyrics/api db:migrate
```

`db:migrate` aplica migraciones existentes; no crea una migración nueva ni ejecuta seed al iniciar la API. Generación no necesita una URL. El cliente generado queda ignorado dentro de `src/generated` y se recompila a JS; build/typecheck lo regeneran.

Verificado localmente con PostgreSQL 16.15 y Prisma 7.10.1: migración, generación, tipos, 28 pruebas previas, ambos builds y 3 pruebas de persistencia aprobados. El rechazo del segundo propietario tuvo RED observado antes de añadir la restricción SQL. No se probaron todavía cuentas reales contra este modelo.

Node 26 está fuera del rango LTS documentado por Prisma 7: las comprobaciones locales no equivalen a soporte oficial ni a compatibilidad demostrada de hosting. No se cambia Node ni se actualizan dependencias incidentalmente.
