# Persistencia y acceso local

Esta unidad usa PostgreSQL de desarrollo con datos ficticios; no crea recursos cloud ni usuarios reales. La [política de altas](producto.md#alta-de-usuarios) permanece separada: solo el propietario y los gestores de cuentas que designe crean cuentas e invitan. La API permite crear usuarios internos y otorgar o retirar esa capacidad (`accountManager`), sin llamadas a Clerk. El registro público se cierra en Clerk con el modo **Invite-only** (ver [autenticación](autenticacion-api.md#contrato-y-límites)); esta prueba no lo configura.

## Modelo mínimo

- `User`: ID interno y sujeto Clerk único; capacidades globales independientes de iglesia: editor de biblioteca (`libraryEditor`) y gestor de cuentas (`accountManager`). Ninguna da acceso a iglesias; esta unidad implementa solo la gestión de `accountManager` por el propietario.
- `Person`: puede existir sin usuario; vínculo de cuenta explícito, nunca por nombre. Existe una sola vez aunque figure en varias iglesias: `ChurchPerson` es el vínculo persona–iglesia y el lugar para los datos propios de cada iglesia, nunca `Person`. Borrar una iglesia elimina solo sus vínculos, no la persona. La ruta de esta prueba no expone el directorio.
- `Church` y `Membership`: pertenencia de un usuario con acceso local ADMIN, EDITOR o MEMBER. No son roles musicales.
- `PlatformOwner`: referencia al único propietario; SQL restringe su fila a ID 1. No se asigna por primer login ni por claims de permisos. La base puede estar inicialmente sin propietario: falla cerrada hasta un alta explícita.
- Todas las tablas de acceso registran `createdAt` y `updatedAt`. Las filas anteriores a la migración `access_timestamps` toman la hora de la migración; Prisma mantiene `updatedAt` en cada cambio.

Si la consulta de acceso falla, la API responde `503` con `{"error":"Access unavailable"}` y registra en stderr una sola línea JSON, por ejemplo `{"event":"church_access_failed","code":"P2010"}`, con el código Prisma/driver o `unknown`. Nunca registra mensajes del driver, cadenas de conexión, sujetos ni IDs. Sin `DATABASE_URL`, la API avisa al arrancar que esas rutas responden `503`.

No hay envío de invitaciones, CRUD general de usuarios, servicios, setlists ni generación de turnos en esta unidad. Las identidades `fixture-*` no corresponden a cuentas reales ni habilitan automáticamente la sesión humana.

## Alta interna y gestores de cuentas

Ambas rutas requieren Bearer de sesión y consultan las capacidades actuales en PostgreSQL en cada petición, no los claims de permisos del token. Retirar `accountManager` tiene efecto para la siguiente petición incluso con un token ya emitido. Todas las respuestas usan `Cache-Control: no-store`.

| Ruta y cuerpo JSON | Quién puede llamarla | Resultado |
| --- | --- | --- |
| `POST /api/users`, `{"clerkSubject":"user_ejemplo"}` | Propietario (`PlatformOwner`, ID 1) o gestor de cuentas | `201`, `{"id":"<id interno>"}`. Crea solo `User`, sin membresías, con `libraryEditor=false` y `accountManager=false`. |
| `PUT /api/users/:userId/account-manager`, `{"enabled":true}` o `false` | Solo el propietario | `200`, `{"id":"<id interno>","accountManager":true}` (o `false`). No modifica la fila del propietario. |

El sujeto se recorta antes de validar: entre 1 y 128 caracteres, solo letras ASCII, dígitos, `_` y `-`. Ambos cuerpos rechazan campos adicionales; `enabled` debe ser booleano. JSON inválido o cuerpo inválido: `400`, `{"error":"Invalid request"}`. Un sujeto duplicado, también ante altas concurrentes: `409`, `{"error":"Conflict"}`, sin cambios adicionales.

Sin capacidad, usuario destino inexistente o intento de modificar al propietario: `404`, `{"error":"Not found"}`. Sin token válido: `401`, `{"error":"Unauthorized"}`. Sin base o ante fallo de persistencia: `503`, `{"error":"Access unavailable"}`; los fallos de autenticación conservan el contrato de [sesión](autenticacion-api.md#contrato-y-límites). Los logs de fallos de estas operaciones contienen solo el evento y un código seguro, nunca sujetos ni tokens. Crear un usuario o ser gestor no concede lectura de iglesias.

## Propietario inicial (operación local explícita)

`pnpm --filter @plan-lyrics/api db:bootstrap-owner --help` muestra la ayuda sin conectarse a una base. El comando recibe `DATABASE_URL` del entorno y un único sujeto Clerk por stdin; no carga dotenv, no recibe el sujeto como argumento ni lo escribe en logs. Primero aplicá las migraciones a la base elegida y generá el cliente (`db:generate`). La persona operadora debe comprobar por separado que el sujeto corresponde a su cuenta de Clerk: este comando no consulta al proveedor ni verifica la identidad.

Con `DATABASE_URL` ya configurada de forma segura en tu terminal, podés evitar guardar el sujeto en el historial usando Bash:

```bash
IFS= read -r -s -p 'Sujeto Clerk del propietario: ' owner_subject; printf '\n'
printf '%s' "$owner_subject" | pnpm --filter @plan-lyrics/api db:bootstrap-owner
unset owner_subject
```

Se recorta el sujeto y se aplican las mismas reglas ASCII de alta interna, con un límite total de stdin de 256 bytes. Solo inicializa una base sin propietario: reutiliza el usuario coincidente sin modificarlo o crea uno sin membresías ni capacidades adicionales y lo vincula al propietario único. Si ya existe cualquier propietario, incluso el mismo, rechaza la operación sin cambios. Una transacción y un bloqueo de tabla serializan inicializaciones concurrentes; la restricción SQL mantiene el propietario único. No es un mecanismo de transferencia o recuperación del propietario.

Salidas del comando (sin contar los mensajes del lanzador pnpm):

| Código | stdout | stderr |
| --- | --- | --- |
| 0 | `Initial owner created.` (o ayuda con `--help`) | vacío |
| 1 | vacío | `Owner initialization unavailable.` |
| 2 | vacío | `Invalid input or configuration. Use --help.` |
| 3 | vacío | `Owner already exists. No changes made.` |

Cada mensaje termina en salto de línea. No envía invitaciones ni cierra el registro de Clerk. Las pruebas usan únicamente una base ficticia aislada; esta entrega no ejecuta el alta en una base real. Conservá acceso administrativo a la base y ejecutá el comando solo tras verificar explícitamente su destino.

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
