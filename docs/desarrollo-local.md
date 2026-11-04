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
- No se instala Clerk en esta unidad; las claves y su integración se preparan después. No hay autenticación ficticia ni acceso a datos de negocio.
- Prisma está instalado, pero no hay esquema de negocio, cliente generado, conexión, migraciones ni base creada. Una respuesta de salud correcta solo acredita que la API responde, no persistencia ni permisos.
- Los componentes shadcn/ui se incorporarán al implementar las pantallas acordadas, sobre Tailwind; no se genera ahora otra interfaz ni un catálogo de componentes.
- El almacén de pnpm queda en `.pnpm-store/`, ignorado por Git. Dependencias, compilados y archivos `.env` tampoco se versionan; sí `pnpm-lock.yaml`.

No desplegar, crear recursos externos ni aplicar migraciones sobre bases existentes como parte de estos comandos.

## Evidencia de esta preparación

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

Siguen pendientes la integración real de Clerk, generación/conexión/migraciones de Prisma, compatibilidad funcional de PostgreSQL, exportación/restauración y despliegue. Esta preparación no cierra INI-003.
