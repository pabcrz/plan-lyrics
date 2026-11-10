# Comprobar identidad Clerk en la API

Unidad técnica local: sesión del navegador → Bearer token → Hono. No crea datos, iglesias, permisos ni recursos externos. `GET /api/health` sigue pública.

## Configuración local

No es la Publishable key de Vite ni una Secret key. En **la misma instancia de desarrollo de Clerk**:

1. En **API keys → Show JWT public key → PEM Public Key**, copiá la clave pública de verificación.
2. Obtené el **issuer** de esa instancia: la URL HTTPS de su Frontend API, por ejemplo `https://tu-instancia.clerk.accounts.dev`. No es la URL del dashboard ni la del navegador local.
3. Creá manualmente `apps/api/.env.local` con estas dos variables. El valor PEM va completo, entre comillas y con sus saltos de línea reales:

```dotenv
CLERK_ISSUER=https://tu-instancia.clerk.accounts.dev
CLERK_JWT_KEY="-----BEGIN PUBLIC KEY-----
PEGAR_AQUI_LA_CLAVE_PUBLICA_PEM_DE_TU_INSTANCIA
-----END PUBLIC KEY-----"
```

El ejemplo es un formato, no una clave utilizable. No pegues valores en el chat. El archivo está ignorado por Git; el agente no lo crea ni lo lee porque la política del entorno bloquea esas operaciones. La aplicación sí carga su configuración local al arrancar, usando la función integrada de Node. Las variables ya presentes en el entorno prevalecen sobre el archivo.

Reiniciá `pnpm dev` después de configurarlo. El origen permitido por esta unidad local es **`http://127.0.0.1:5173`**; no cambiarlo a `localhost` sin acordar y actualizar la configuración/pruebas. El issuer es distinto del origen de nuestra web.

## Contrato y límites

| Petición a `GET /api/session` | Estado y JSON |
| --- | --- |
| Sin Bearer o con formato incorrecto | `401`, `{"error":"Unauthorized"}` |
| Firma, vigencia, issuer u origen incorrectos; sin identidad de sesión | `401`, mismo error genérico |
| Bearer con formato válido, pero falta configuración del verificador | `503`, `{"error":"Authentication unavailable"}` |
| Token de sesión verificado | `200`, `{"authenticated":true}` |

Las respuestas de esta ruta usan `Cache-Control: no-store`; los rechazos 401 también `WWW-Authenticate: Bearer`. No devuelve tokens, claims, identificadores ni información personal. Los errores del SDK no se imprimen ni se devuelven al cliente. La clave pública y el issuer fijan la instancia; el SDK verifica firma y tiempos, y se requiere el origen permitido y una identidad de sesión.

Con `CLERK_JWT_KEY` la verificación es local, sin llamadas a Clerk. Si falta configuración no hay fallback remoto ni acceso abierto. Al rotar la clave pública de la instancia, actualizar la configuración y reiniciar la API. Un JWT ya emitido puede seguir siendo válido hasta que expire: esta comprobación no promete revocación inmediata ni consulta el estado del proveedor en cada petición.

Esto **no concede permisos sobre una iglesia** ni sustituye membresías/capacidades en servidor. No incorpora PostgreSQL ni protege por anticipado rutas de negocio inexistentes. No se aceptan cookies como alternativa al Bearer en esta ruta.

## Prueba desde Orca

1. Sin sesión, `GET /api/session` debe rechazar con 401; health sigue respondiendo 200.
2. Iniciá sesión en la web y pulsá **Comprobar sesión en API**. React obtiene el token de Clerk al pulsar, lo envía en `Authorization` y muestra el resultado; no lo guarda manualmente en localStorage ni lo imprime. La petición omite cookies y no usa caché.
3. La API debe mostrar “Sesión verificada por la API. Permisos de iglesia aún pendientes.”. Si falta configuración, muestra un error explícito, no una identidad simulada.
4. Al cerrar sesión desaparece el control autenticado. La petición sin Bearer vuelve a dar 401; esto no afirma que un token emitido antes del cierre se haya revocado instantáneamente.

Las pruebas de API generan claves RSA y tokens ficticios en memoria y ejecutan el SDK real para aceptación, rechazo y vigencia. Las pruebas web usan un doble de `getToken` y respuestas HTTP: prueban el cableado, no el proveedor. El recorrido real se comprobó después con la configuración local y la sesión humana, sin extraer el token al chat.

## Evidencia local verificada

- El botón React obtuvo el token desde Clerk y mostró “Sesión verificada por la API. Permisos de iglesia aún pendientes.”; la respuesta observada en el navegador fue **200**.
- En ese mismo navegador autenticado, una petición con cookies omitidas y sin Bearer recibió **401**, `{"error":"Unauthorized"}` y `Cache-Control: no-store`. La sesión del navegador por sí sola no autoriza la API.
- Health continuó pública con **200** y `{"status":"ok","service":"plan-lyrics-api"}`. Sin desbordamiento horizontal a 390 px.
- Tipos, **28 pruebas** y ambos builds aprobados antes de esta comprobación; verificación independiente aislada aprobada. Firma ajena, vencimiento, issuer/origen incorrectos y configuración ausente se comprobaron con fixtures, no manipulando credenciales reales.
- La configuración ausente había producido **503**, sin fallback remoto. Tras configurar y reiniciar, la aceptación con la instancia real quedó comprobada.

No se leyeron archivos dotenv, claves, tokens ni datos personales para registrar el resultado. Esta evidencia no acredita permisos de iglesias, persistencia, despliegue ni toda la validación de INI-003.
