# Despliegue en Vercel, Neon y Clerk

Guía para publicar el piloto: **web y API como dos proyectos Vercel del mismo repositorio**, base PostgreSQL en **Neon** e identidad en **Clerk**. Decisión de la persona usuaria; reemplaza el candidato Cloudflare Pages de la [propuesta técnica](propuesta-tecnica.md#plataformas-piloto-y-operación-habitual).

> **Estado:** los archivos del repositorio están preparados y se comprobaron en local (pruebas, compilación y un smoke de la API empaquetada). **Nada se ha desplegado** ni se ha probado contra Vercel, Neon o Clerk reales. Los pasos de esta guía son la primera prueba real; lo no verificado está marcado y resumido en [Riesgos](#riesgos-y-lo-no-verificado).

Se asume que ya conocés Vercel. No pegues valores secretos en el chat, en issues ni en commits.

## Qué hay en el repositorio

| Archivo | Para qué |
| --- | --- |
| `apps/api/vercel.json` | Proyecto de la API: `pnpm build` (genera Prisma y compila con `tsc` a `dist/`), una función y un rewrite de todas las rutas a ella. |
| `apps/api/api/index.mjs` | Entrada de la Vercel Function (Node.js): solo adapta `app.fetch` de Hono. Sin APIs exclusivas de Vercel en las reglas; `pnpm dev` y `pnpm start` siguen sirviendo la misma app como servidor Node. |
| `apps/api/src/runtime.ts` | Lee las variables de entorno y construye la app (la usan el servidor local y Vercel). |
| `apps/web/vercel.json` | Proyecto de la web: build de Vite, rewrite SPA para rutas profundas y cabeceras de la vista pública. |
| `apps/api/env.example`, `apps/web/env.example` | Nombres de variables, sin valores. Renombrar a `.env.example` es opcional (la herramienta del entorno bloqueó escribir ese nombre); `.env` y `.env.*` están ignorados por Git. |

### Comportamiento relevante

- **Web → API.** La web llama a `VITE_API_URL` + `/api/...` (vacía en local: Vite reenvía `/api` al servidor Hono). Es una variable de compilación: cambiarla exige un nuevo despliegue de la web.
- **CORS.** La API responde CORS solo a los orígenes de `WEB_ORIGIN` (exactos, separados por comas; sin comodín, ruta ni `http` fuera de loopback). Sin `WEB_ORIGIN` no envía cabeceras CORS. Permite `Authorization` y `Content-Type`, sin credenciales (la web no usa cookies).
- **Vista pública** (`/m/:token` en la web, `GET /api/public/links/:token` en la API). La web añade `X-Robots-Tag: noindex, nofollow, noarchive`, `Referrer-Policy: no-referrer` y `Cache-Control: no-store` a `/m/:token`; la API ya los añade a `/api/public/*`.
- **Límite de tasa de la vista pública.** Con `VERCEL=1` (lo define la plataforma) la IP del cliente sale de `x-vercel-forwarded-for`, `x-real-ip` o, en su defecto, la última entrada de `x-forwarded-for`; solo si es una IP válida. Fuera de Vercel esas cabeceras se **ignoran** (las controla quien llama) y se usa la dirección del socket. El contador vive en memoria **de cada instancia**: en funciones sin servidor es una protección parcial, no un límite global exacto. Las IPv6 se cuentan por dirección completa, no por prefijo.
- **Migraciones.** `prisma.config.ts` usa `DIRECT_URL` si existe y, si no, `DATABASE_URL`. La app en ejecución solo usa `DATABASE_URL`. Las migraciones **nunca se ejecutan en el build ni al arrancar**.

## 1. Neon: qué cadena va dónde

En el proyecto de Neon (ya creado), **Connect** muestra dos cadenas de la misma base y rol:

| Variable | Cadena de Neon | Dónde se usa |
| --- | --- | --- |
| `DATABASE_URL` | **Agrupada** (*Connection pooling* activado): el host contiene `-pooler`. | Proyecto Vercel de la API (tiempo de ejecución). |
| `DIRECT_URL` | **Directa** (*Connection pooling* desactivado): host sin `-pooler`. | Solo en tu terminal al ejecutar migraciones y el alta del superadmin. **No la cargues en Vercel.** |

Ambas deben incluir `sslmode=require`. `pnpm db:migrate:deploy` rechaza un `DIRECT_URL` que parezca agrupado (`-pooler`, puertos 6432/6543, `pgbouncer`).

## 2. Clerk

Hacelo en la instancia que corresponda (desarrollo o producción; son independientes).

1. **Modo solo invitación:** *User & authentication → Access mode → Invite-only* y guardar. Comprobá en una ventana privada que ya no ofrece registrarse. Ver [identidad en API](autenticacion-api.md#contrato-y-límites).
2. Desactivá cualquier método de registro público que quede visible (registro con proveedor social, etc.) si el panel lo permite aparte del modo.
3. **Claves** (*API keys*): copiá la **Publishable key** (`pk_…`, irá a la web), la **Secret key** (`sk_…`, solo a la API), la **clave pública PEM** (*Show JWT public key*) y el **issuer** (URL HTTPS de la Frontend API).
4. **Authorized party:** es el origen exacto de la web desplegada (`https://app.tu-dominio.com`), sin barra final.
5. **Desarrollo vs. producción:** una instancia de producción de Clerk exige un dominio propio verificado y claves `pk_live_`/`sk_live_`; no sirve sobre `*.vercel.app`. Para un primer ensayo en `*.vercel.app` usá la instancia de desarrollo (`pk_test_`) y no la mezcles con datos reales. No reutilices claves de una instancia en la otra. *(No verificado: condiciones actuales del plan de Clerk.)*

## 3. Proyecto Vercel de la API

*Add New → Project* → importá el repositorio.

| Ajuste | Valor |
| --- | --- |
| Root Directory | `apps/api` (dejá activado *Include source files outside of the Root Directory*: el lockfile está en la raíz). |
| Framework Preset | Other. |
| Install / Build / Output | Los toma de `vercel.json`: `pnpm install --frozen-lockfile`, `pnpm build`, `public`. |
| Node.js Version | La que cumpla `engines` (`>=26.8.1 <27`). Si Vercel no la ofrece, ver [riesgos](#riesgos-y-lo-no-verificado). |
| Environment Variable `ENABLE_EXPERIMENTAL_COREPACK` | `1`, si Vercel no respeta `packageManager` (`pnpm@12.3.4`). |

Variables (Production; evitá cargarlas en Preview, ver más abajo):

| Variable | Valor |
| --- | --- |
| `DATABASE_URL` | Cadena **agrupada** de Neon. |
| `CLERK_SECRET_KEY` | Secret key de Clerk. |
| `CLERK_JWT_KEY` | Clave pública PEM completa, con saltos de línea. |
| `CLERK_ISSUER` | Issuer de la instancia. |
| `CLERK_AUTHORIZED_PARTY` | Origen de la web (paso 4 de Clerk). |
| `WEB_ORIGIN` | El mismo origen de la web. |
| `SHARE_LINK_SECRET` | Ver abajo. |

**`SHARE_LINK_SECRET`** (mínimo 32 caracteres). Generalo en tu terminal y pegalo directamente en Vercel (con el portapapeles; no lo pegues en un chat ni lo guardes en un archivo versionado):

```sh
openssl rand -base64 48 | pbcopy   # macOS; en Linux: openssl rand -base64 48 (y copialo a mano)
```

Guardalo también en tu gestor de contraseñas. **Rotarlo invalida todos los enlaces del ministerio ya compartidos** (cada token se deriva de este secreto); hacelo solo ante una filtración y avisá a la gente.

Ahora desplegá. La URL de la API (p. ej. `https://plan-lyrics-api.vercel.app` o un dominio propio) se usa en el siguiente proyecto.

## 4. Proyecto Vercel de la web

| Ajuste | Valor |
| --- | --- |
| Root Directory | `apps/web` (también con *Include source files outside of the Root Directory*). |
| Framework Preset | Vite. Comandos desde `vercel.json`. |
| `VITE_CLERK_PUBLISHABLE_KEY` | Publishable key (`pk_…`). **Nunca** una `sk_…`: las `VITE_` van al navegador. |
| `VITE_API_URL` | Origen de la API sin barra final, p. ej. `https://plan-lyrics-api.vercel.app`. |
| Node.js / pnpm | Igual que la API. |

Después de conocer la URL definitiva de la web, volvé al proyecto de la API y completá `CLERK_AUTHORIZED_PARTY` y `WEB_ORIGIN` con ese origen; **redesplegá la API** para que tome las variables (Vercel no las aplica a despliegues ya hechos).

**Deployment Protection.** La vista pública debe abrirse sin cuenta de Vercel: comprobá en *Settings → Deployment Protection* que la protección no cubre el dominio de producción de la web ni el de la API.

**Previews.** Las ramas generan despliegues de vista previa. No les cargues las variables de producción (base ni claves): dejá las variables solo en *Production* o, si necesitás previews, configuralas con una base y una instancia de Clerk de desarrollo distintas.

## 5. Aplicar las migraciones (desde tu terminal)

No hay migración automática. Con el repositorio instalado (`pnpm install --frozen-lockfile`) y sin escribir la cadena en el historial:

```bash
IFS= read -r -s -p 'DIRECT_URL de Neon (sin pooler): ' DIRECT_URL; printf '\n'
export DIRECT_URL
pnpm db:migrate:deploy
```

El script exige `DIRECT_URL`, rechaza cadenas agrupadas, descarta `DATABASE_URL` del entorno del proceso y ejecuta solo `prisma migrate deploy` (aplica las migraciones pendientes del repositorio). No hay forma de ejecutar `migrate dev` ni `reset` con este comando. Repetirlo es seguro: sin migraciones pendientes no hace nada. Antes de la primera vez, confirmá en Neon que la rama/base elegida es la de producción del piloto.

Para volver a ejecutarlo tras un cambio de esquema, usá el mismo comando antes de desplegar el código que lo necesite. Comprobá que no hay deriva: `pnpm --filter @plan-lyrics/api db:drift` (con `DIRECT_URL` exportada; devuelve código 0 si el esquema coincide).

## 6. Alta del superadministrador

Necesitás el **ID de usuario de Clerk** (`user_…`) de tu cuenta: en el panel de Clerk, *Users →* tu usuario. Primero la cuenta debe existir en Clerk (iniciá sesión una vez en la web, o creala en el panel; en modo solo invitación, creala o invitala desde el panel). El comando solo registra el sujeto en la base: no verifica la identidad ni envía invitaciones.

```bash
IFS= read -r -s -p 'Sujeto Clerk del superadmin (user_...): ' owner_subject; printf '\n'
printf '%s' "$owner_subject" | DATABASE_URL="$DIRECT_URL" pnpm --filter @plan-lyrics/api db:bootstrap-owner
unset owner_subject
```

Usa la conexión directa porque toma un bloqueo de tabla dentro de una transacción. Salidas: `Initial owner created.` (éxito), y los códigos de [persistencia local](persistencia-local.md#propietario-inicial-operación-local-explícita) (3 si ya existe un propietario). No carga archivos `.env` y no registra el sujeto. Al terminar, cerrá la terminal o hacé `unset DIRECT_URL`.

## 7. Verificación posterior

Sustituí `API` y `WEB` por tus orígenes. Ninguna de estas comprobaciones requiere secretos.

1. **API viva:** `curl -s API/api/health` → `{"status":"ok","service":"plan-lyrics-api"}`.
2. **Sesión sin Bearer:** `curl -s -o /dev/null -w '%{http_code}\n' API/api/session` → `401`.
3. **Vista pública, 404 uniforme:** el token inexistente y el malformado responden igual.
   `curl -s -w ' %{http_code}\n' API/api/public/links/mal` y `curl -s -w ' %{http_code}\n' API/api/public/links/$(printf 'A%.0s' {1..43})` → `{"error":"Not found"} 404` ambos (o `503` en el segundo si la base no responde: revisá `DATABASE_URL`).
4. **Cabeceras de la vista pública (web):** `curl -sI WEB/m/cualquier-cosa` → `200`, `x-robots-tag: noindex, nofollow, noarchive`, `referrer-policy: no-referrer`. Una ruta profunda como `WEB/calendario` debe cargar la SPA al recargar (no 404).
5. **CORS:** `curl -si -H 'Origin: WEB' API/api/health` incluye `access-control-allow-origin: WEB`; con `-H 'Origin: https://otro.example'` no incluye esa cabecera.
6. **Límite de tasa:** más de ~120 peticiones por minuto a `/api/public/links/…` desde una IP dan `429` con `Retry-After: 60` (aproximado: el contador es por instancia).
7. **Login:** abrí `WEB`, iniciá sesión con el superadmin y pulsá **Comprobar sesión en API** → «Sesión verificada por la API…». Si da 503: falta `CLERK_JWT_KEY`, `CLERK_ISSUER` o `CLERK_AUTHORIZED_PARTY` (o no es un origen exacto).
8. **Superadmin:** tras el alta, la pantalla de cuentas/ajustes debe ofrecerte invitar y gestionar; sin alta verás «Sin iglesia asignada».
9. **Invitación real de Clerk (nunca probada):** desde **Cuentas**, invitá a un correo de prueba tuyo. Comprobá que llega el correo, que se puede completar el alta en modo solo invitación y que aparece el usuario local. **Plan B** si falla: seguí [Pendientes y no verificado en accesos](accesos.md#pendientes-y-no-verificado): invitar sin crear el usuario y crear el usuario local al aceptar (webhook `user.created`).
10. **Persistencia:** crea una iglesia/servicio de prueba y recargá. En el primer acceso tras inactividad puede haber un `503` puntual (ver siguiente sección): reintentar debe funcionar.

## Riesgos y lo no verificado

- **Nada se ha desplegado.** `vercel.json`, el adaptador y el rewrite a la función están pensados con la documentación de Vercel, pero solo se probó localmente la entrada empaquetada (`pnpm build && pnpm --filter @plan-lyrics/api smoke:vercel`: salud, CORS, preflight, cabeceras públicas, 404 y 401, sin base). No se comprobó: el tamaño y el arranque en frío de la función, que `includeFiles: dist/**` y el rastreo de dependencias (cliente Prisma con Wasm) bastan, que `outputDirectory: public` evita el error de «sin salida» (existe `apps/api/public/.gitkeep` por eso) ni el tamaño real del paquete.
- **Node y pnpm.** El repositorio fija Node `26.8.1` y pnpm `12.3.4`. Si Vercel no ofrece Node 26 o no respeta `packageManager`, el build falla: sería una decisión de versiones (no se bajó `engines` sin acuerdo).
- **Neon suspende el cómputo** tras unos minutos de inactividad en el plan gratuito y tarda en reactivarse. La API espera 3 s al conectar (`connectionTimeoutMillis`): la primera petición tras inactividad puede responder `503 Access unavailable`; reintentar suele funcionar. Si es frecuente, ampliar ese tiempo es un cambio de código aparte.
- **Límites de los planes.** Cuotas de cómputo, almacenamiento y conexiones de Neon, tiempo y memoria de funciones de Vercel y límites de Clerk pueden cambiar; revisalos antes de incorporar al grupo completo. No se prometen SLA.
- **Límite de tasa parcial.** Es por instancia y por IP completa; varias instancias o rotación de IPv6 lo diluyen. Si hace falta un límite global, requiere un almacén compartido (decisión aparte).
- **`SHARE_LINK_SECRET`:** rotarlo invalida todos los enlaces. Perderlo equivale a rotarlo.
- **Clerk:** producción exige dominio propio; modo solo invitación y la invitación real siguen sin probarse. Una `CLERK_JWT_KEY` rotada en Clerk debe actualizarse en Vercel y redesplegar.
- **Migraciones destructivas.** `migrate deploy` aplica lo que haya en el repositorio sin copia previa: activá/verificá la recuperación a un punto en el tiempo de Neon y probá la restauración, como pide la [propuesta técnica](propuesta-tecnica.md#prueba-técnica-acotada-antes-de-elegir-hosting).
