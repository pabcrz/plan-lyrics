# Gestión de accesos (API e interfaz)

Implementa los [accesos acordados](producto.md#accesos-acordados) y el [alta de usuarios](producto.md#alta-de-usuarios). La autorización se decide siempre en servidor, leyendo la base de datos en cada petición (no los claims del token): un cambio o una baja surten efecto de inmediato, aunque el token ya esté emitido. Respuestas `Cache-Control: no-store`.

## Qué se implementó

### Cuentas (superadministrador y gestor de cuentas)

| Ruta | Quién | Qué hace |
| --- | --- | --- |
| `GET /api/access` | cualquier sesión | Tus propias capacidades `{ owner, accountManager }`. Solo sirve para decidir qué ofrecer. |
| `GET /api/accounts` | superadmin, gestor | Cuentas (`id`, `email`, capacidades, persona vinculada) y personas sin cuenta, **solo por nombre** (sin teléfono ni iglesias). |
| `POST /api/accounts` `{ email }` | superadmin, gestor | Crea la cuenta en el proveedor, envía la invitación y crea el usuario local **sin iglesia, rol ni capacidad**. Repetir el correo reenvía la invitación sin duplicar (`200`). |
| `PUT /api/accounts/:userId/person` `{ personId }` | superadmin, gestor | Vincula la cuenta a una persona. `409` si la persona o la cuenta ya están vinculadas. No crea membresías. |
| `DELETE /api/accounts/:userId/person` | superadmin, gestor | Desvincula. Solo quita el vínculo: membresías y capacidades no cambian. |
| `PUT /api/users/:userId/account-manager` `{ enabled }` | solo superadmin | Otorga o retira la capacidad de gestor (ruta previa). |
| `PUT /api/accounts/:userId/library-editor` `{ enabled }` | solo superadmin | Otorga o retira el acceso de editor de biblioteca. |

Quien no tiene la capacidad recibe `404` genérico (no se revela que la ruta existe). Un gestor nunca ve ni toca la cuenta del superadministrador (`404`). `POST /api/users` (registro interno por `clerkSubject`) se mantiene sin cambios.

### Puerto `IdentityProvider`

`apps/api/src/identity-provider.ts` define `inviteByEmail(email) → { subject }`. La implementación de Clerk usa la Backend API con `CLERK_SECRET_KEY`: busca el usuario por correo (o lo crea sin contraseña) y crea la invitación con `notify`. Es idempotente ante reintentos. Los tests inyectan un doble; la clave nunca se lee ni se registra y los errores del proveedor no se reenvían (`502 Identity provider unavailable`). Sin `CLERK_SECRET_KEY` las rutas de invitación responden `503` y la API avisa al arrancar. No hay registro público: el modo **Invite-only** de Clerk sigue siendo un paso manual (ver [autenticación](autenticacion-api.md)).

### Membresías de la iglesia (administrador)

| Ruta | Qué hace |
| --- | --- |
| `GET /api/members` | Miembros de **la iglesia de la sesión** (rol, persona si pertenece a su directorio) y personas de su directorio con cuenta y sin membresía (candidatas). |
| `POST /api/members` `{ personId, role }` | Da acceso a una persona de su directorio que ya tiene cuenta vinculada. |
| `PATCH /api/members/:userId` `{ role }` | Cambia el rol (`ADMIN`, `EDITOR`, `MEMBER`). |
| `DELETE /api/members/:userId` | Quita la membresía. La cuenta y la persona no se borran. |

Reglas: la iglesia sale de la sesión (el cuerpo con `churchId` da `400`; los ids de otra iglesia no existen: `404`); solo el administrador de esa iglesia, o el superadministrador con iglesia activa, gestiona (`403` para editor de servicios e integrante; `404` si no tiene iglesia); estas rutas **no** crean cuentas, no invitan, no vinculan y no otorgan biblioteca; una iglesia nunca queda sin administrador (`409 Last administrator`, comprobado bajo bloqueo de la iglesia, también ante cambios simultáneos); la membresía del superadministrador no se cambia desde una iglesia (`409 Protected account`); y nada de esto modifica datos de la persona, de modo que una persona compartida con otra iglesia no abre acceso a ella.

### Interfaz (390 px, español)

- **Accesos** (`/accesos`, desde Ajustes, para administradores): miembros, cambio de rol, quitar con confirmación y agregar entre las candidatas.
- **Cuentas** (`/cuentas`, desde Ajustes o, sin iglesia, desde la pantalla «Sin iglesia asignada»): invitar por correo, vincular o desvincular persona y, solo para el superadministrador, gestor de cuentas y editor de biblioteca.

## Decisiones con criterio restrictivo

- **Editor de biblioteca: solo lo otorga el superadministrador.** El producto deja abierta la decisión; se eligió la lectura más restrictiva. El administrador de iglesia no lo otorga ni lo ve en su pantalla. Cambiarlo es ampliar `PUT /api/accounts/:userId/library-editor` y su prueba.
- **Una cuenta, una iglesia.** Hoy la iglesia activa se deduce de la única membresía (`409 Active church required` con varias). Por eso `POST /api/members` rechaza una cuenta que ya pertenece a otra iglesia (`409 Account unavailable`): de lo contrario dejaría de poder entrar a ambas. Se levanta cuando exista el selector de iglesia activa.
- **El administrador solo elige entre personas con cuenta ya vinculada.** No puede crear, invitar ni vincular.
- **El gestor ve personas sin cuenta solo por nombre**, necesarias para vincular; no ve iglesias, teléfonos ni membresías.
- **Desvincular no revoca accesos**: quien desvincula no decide por la iglesia. Un administrador ve la membresía como «Cuenta sin persona vinculada».
- **Iniciar sesión no concede nada**: una cuenta invitada no ve iglesias, miembros ni cuentas hasta que un administrador le dé acceso.
- Las capacidades del superadministrador no se pueden quitar por ninguna ruta; no hay ruta para borrar usuarios.

## Pendientes y no verificado

- **Clerk real no se ha probado.** Los tests de integración usan un doble del puerto y las pruebas unitarias del adaptador usan un doble del cliente. No se ha comprobado con la Backend API real: que `createUser` sin contraseña más `createInvitation` con `ignoreExisting` envíe el correo en modo Invite-only, ni que la persona invitada pueda completar el alta cuando su usuario ya existe. Si ese flujo no funciona, el siguiente paso es invitar sin crear el usuario y crear el usuario local al aceptar (webhook `user.created`).
- Sin selector de iglesia activa (ver arriba), sin límite de ritmo en las invitaciones y sin registro de auditoría de cambios de acceso.
- Decisión de producto abierta: quién otorga el editor de biblioteca y qué capacidades faltan por especificar.
- La interfaz se probó con pruebas de componentes y un doble de `fetch`; no se revisó visualmente a 390 px ni contra la API real.
