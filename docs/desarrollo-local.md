# Desarrollo local

Base de herramientas; todavía no implementa calendario, personas, turnos ni el diseño 4.

## Requisitos

- Node `26.8.1`, fijado en `.node-version` y usado para comprobar el arranque web/API. Prisma imprimió un aviso de versiones soportadas durante la instalación: su CLI responde, pero todavía no se valida su conexión ni su funcionamiento con este runtime.
- pnpm `12.3.4`, fijado en `package.json`.

Desde la raíz del proyecto:

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Abrí en una pestaña del navegador de Orca:

- Web: <http://127.0.0.1:5173/>
- Comprobación de la API: <http://127.0.0.1:3001/api/health>

El servidor web redirige `/api` al servidor Hono local. Ambos escuchan solo en loopback; no se exponen al teléfono físico ni a la red local. No se abre Safari ni Chrome automáticamente. Al cerrar el proceso de desarrollo se dejan de servir estas URLs. El servidor de wireframes del puerto 4173 es independiente.

## Comprobaciones

```sh
pnpm typecheck
pnpm test
pnpm build
# Ejecutar las tres en secuencia:
pnpm check
```

La API compilada puede ejecutarse con `pnpm --filter @plan-lyrics/api start`. Vitest prueba la respuesta de salud y la pantalla mínima de conexión; Playwright está instalado para próximos recorridos de navegador, pero no se descargan navegadores globalmente durante esta preparación.

## Alcance de las herramientas

- `apps/web`: React, Vite, TypeScript, React Router, TanStack Query y Tailwind; Testing Library y jsdom para componentes.
- `apps/api`: Hono y adaptador Node, Zod, Prisma 7 y adaptador PostgreSQL/pg. Prisma CLI y tsx disponibles para desarrollo.
- `@clerk/react` está instalado en la web: proveedor, acceso modal y menú de cuenta/cierre de sesión oficiales. Sin clave publicable no se inicializa Clerk ni se muestra una sesión ficticia. La validación real de sesión sigue pendiente de la configuración local.
- Prisma está instalado, pero no hay esquema de negocio, cliente generado, conexión, migraciones ni base creada. Una respuesta de salud correcta solo acredita que la API responde, no persistencia ni permisos.
- Los componentes shadcn/ui se incorporarán al implementar las pantallas acordadas, sobre Tailwind; no se genera ahora otra interfaz ni un catálogo de componentes.
- El almacén de pnpm queda en `.pnpm-store/`, ignorado por Git. Dependencias, compilados y archivos `.env` tampoco se versionan; sí `pnpm-lock.yaml`.

No desplegar, crear recursos externos ni aplicar migraciones sobre bases existentes como parte de estos comandos.

## Configurar Clerk en la web

1. En la instancia de desarrollo de Clerk que ya hayas creado, elegí la guía **React**, no TanStack Start, y copiá su **Publishable key** (`pk_test_…`). Si aún no existe una instancia, su creación requiere una decisión separada: estos comandos no crean recursos.
2. Creá manualmente `apps/web/.env.local` en tu editor y agregá `VITE_CLERK_PUBLISHABLE_KEY=` con esa clave después del `=`. No la pegues en el chat. No se incluye una plantilla dotenv porque la herramienta bloqueó su escritura.
3. Reiniciá `pnpm dev` y abrí <http://127.0.0.1:5173/> en Orca. En la configuración local del proveedor usá ese mismo origen; no mezcles `localhost` y `127.0.0.1` al comprobar la sesión.
4. Comprobá que “Iniciar sesión” abre el modal de Clerk. Iniciá sesión vos con la cuenta de prueba y verificá que aparezca el menú de cuenta. Desde ese menú cerrá la sesión y verificá que vuelva el botón de acceso.

Nunca uses una **Secret key** (`sk_…`) en una variable `VITE_`: Vite expone esas variables al navegador. El control de formato de la interfaz ayuda a detectar una configuración equivocada, pero no impide que Vite incluya en el bundle un valor ya configurado. `.env.local` está ignorado por Git; no se leen ni versionan credenciales. La web no necesita la Secret key.

Sin clave se muestra “Clerk pendiente”; durante la carga y ante fallo del SDK hay mensajes explícitos. El proveedor valida el contenido de una clave publicable; el chequeo local de prefijo no acredita identidad.

Esto prepara autenticación **en la web**, no autorización. La API de salud continúa pública, sin datos de negocio; todavía no verifica tokens Clerk ni permite operaciones privadas. Iniciar sesión no crea una iglesia, no vincula personas por nombre y no concede permisos musicales ni administrativos. Antes de añadir datos privados habrá que verificar identidad y autorización en servidor.

Las pruebas unitarias del acceso usan un doble de los componentes Clerk: comprueban nuestro cableado y los estados, no un inicio/cierre real de sesión ni la disponibilidad del proveedor. No se marca esa prueba real como aprobada hasta ejecutarla con una clave válida y la intervención de la persona usuaria.

La instalación fijó `@clerk/react` 6.18.5; pnpm añadió excepciones de antigüedad **solo para esas versiones exactas** de `@clerk/react` 6.18.5 y `@clerk/shared` 4.44.0 en `minimumReleaseAgeExclude`. No se habilitan scripts de instalación adicionales ni excepciones para todas las versiones futuras.

## Evidencia de la preparación original

Comprobado el 4 de noviembre de 2026, sin Clerk ni base conectada:

| Comprobación | Resultado |
| --- | --- |
| Instalación inicial con pnpm 12.3.4 | Completada, lockfile generado. |
| `pnpm check` | Tipos, dos pruebas y compilación de ambos paquetes aprobados. |
| Prisma `--version` | CLI y cliente 7.10.1; salida correcta. No acredita conexión a PostgreSQL. |
| HTTP local | Web 200 y API con `{"status":"ok","service":"plan-lyrics-api"}`. |
| Navegador Orca a 390 px | “API disponible”, aviso de DB/autenticación pendientes y sin desbordamiento horizontal. |
| Verificación independiente | Tipos, dos pruebas, compilación y CLI de Prisma aprobados sobre copia aislada del árbol instalado. No es una instalación desde cero. |

La primera copia aislada falló por excluir por error archivos `dist` de dependencias; no fue un defecto reproducido del código fuente. La copia corregida conservó las dependencias completas. Solo en ese entorno temporal se desactivó `verifyDepsBeforeRun`, cuyo valor predeterminado en pnpm puede ejecutar una instalación antes de `run`/`exec`; la comprobación corregida no ejecutó instalaciones. Ese ajuste no modifica la configuración del proyecto.

Siguen pendientes la comprobación de sesión real y la validación de identidad en API con Clerk, generación/conexión/migraciones de Prisma, compatibilidad funcional de PostgreSQL, exportación/restauración y despliegue. La preparación local no cierra INI-003.
