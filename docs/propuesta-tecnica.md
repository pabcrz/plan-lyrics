# Selección técnica — Plan & Lyrics

**Base seleccionada para iniciar el desarrollo; compatibilidad de despliegue aún por comprobar.** Los requisitos, prioridades y funciones se definen exclusivamente en el [plan oficial del producto](producto.md). Este documento registra decisiones técnicas, no una aplicación ni infraestructura implementadas. Las propuestas separadas de [diseño](propuestas/diseno.md), [backend](propuestas/backend.md) y [entrega integral](propuestas/entrega-integral.md) explican cómo avanzar.

## Arquitectura seleccionada

Monolito modular con web y API REST separadas. La web consume la API por HTTPS; el backend valida identidad, autorización y reglas y accede a PostgreSQL. El navegador nunca accede directamente a SQL. Organizar el código por funcionalidades, sin microservicios ni capas genéricas innecesarias.

Flujo: React → Hono → Prisma → PostgreSQL. Clerk verifica la identidad; nuestra aplicación decide los permisos. La base de datos y la autenticación son servicios independientes.

## Tecnologías de partida

| Responsabilidad | Selección | Límite de responsabilidad |
| --- | --- | --- |
| Lenguaje | TypeScript | Compartir lenguaje sin acoplar interfaz y dominio. |
| Web | React + Vite | Interfaz cliente; Vite aporta desarrollo y compilación, no el backend. |
| Navegación | React Router | Rutas de la interfaz, incluido acceso por enlace directo. |
| Datos remotos en la web | TanStack Query | Consultar, cachear e invalidar datos de la API; no reemplaza autorización ni todo estado local. |
| Componentes y estilos | Tailwind CSS + shadcn/ui | Base reutilizable sometida al sistema visual que se acuerde; no un diseño aprobado por instalar una biblioteca. |
| API | Hono + REST, inicialmente en runtime Node.js | Rutas y middleware pequeños; reglas fuera de los handlers. Sustituye la propuesta anterior de NestJS. |
| Validación de entradas | Zod | Esquemas explícitos en los límites; validación obligatoria en servidor, no solo tipos TypeScript. |
| Datos | Prisma + PostgreSQL | Esquema y migraciones versionadas; sin lógica central dependiente del proveedor de alojamiento. |
| Autenticación | Clerk | Registro, sesión y recuperación; no determina roles musicales ni permisos del producto. |
| Pruebas de lógica y API | Vitest; peticiones HTTP de prueba a la aplicación Hono | Verificar reglas, respuestas, persistencia y rechazos sin necesidad de desplegar para cada prueba. |
| Pruebas de interfaz | Testing Library y Playwright | Componentes y recorridos reales conectados, según la unidad en curso. |
| Repositorio | GitHub y npm workspaces | Un repositorio con web y API; sin Nx ni Turborepo inicialmente. |

Elegir versiones estables compatibles al preparar el proyecto, fijar una versión soportada de Node y versionar el lockfile. Este documento no afirma versiones instaladas ni compatibilidad comprobada de toda la combinación.

## Por qué esta combinación

**Hono en lugar de NestJS:** reducir configuración y ceremonia sin abandonar módulos, validación, errores consistentes y pruebas. No reproducir el sistema de inyección de dependencias de Nest ni concentrar todo en un archivo. Express sería viable, pero Hono es la elección de partida; no mantener ambos.

**React/Vite en lugar de incorporar Next.js ahora:** el recorrido prioritario es una aplicación interactiva con calendario, formularios y permisos, y conservamos una API independiente. No hay un requisito confirmado de renderizado en servidor o indexación que justifique introducir también su modelo de ejecución. Next.js puede servir a este producto, incluso como SPA; no es incompatible ni incorrecto, pero no ofrece aquí una simplificación suficientemente concreta para cambiar de arquitectura.

**TanStack Query no compite con Next.js o Vue:** gestiona estado remoto; Next.js es un framework sobre React y Vue es otra opción de interfaz. Mantener React evita cambiar la base de componentes elegida sin una ventaja identificada. La existencia de enlaces públicos no obliga por sí sola a usar SSR; revisar carga inicial y requisitos de vistas previas/indexación cuando se diseñe esa experiencia.

No se elige Hono por una promesa de menos costo o ausencia de arranques en frío. Esas propiedades dependen también de despliegue, acceso a datos y carga real.

## Organización inicial

Usar `apps/web` y `apps/api`. Extraer contratos o lógica compartida a `packages/` solo cuando exista un consumidor real; no crear paquetes vacíos de música anticipadamente. Los algoritmos de fechas y turnos no deben depender de React, Hono ni del contexto HTTP.

En la web, separar consultas remotas de formularios y estado local. Las claves de caché deben distinguir iglesia, recurso y contexto de acceso; invalidar las consultas afectadas tras cambios, limpiar datos privados al cerrar sesión y definir vigencia y reintentos. La caché no es una barrera de seguridad.

## Plataformas: piloto y operación habitual

| Parte | Candidato para el piloto | Condición |
| --- | --- | --- |
| Web | Cloudflare Pages | Publicación de los archivos compilados; probar rutas profundas y configuración de API. |
| API | Vercel Functions con Hono y runtime Node.js | Modelo por peticiones, no proceso siempre encendido. Validar arranque, límites y condiciones del plan. |
| Base | Neon Free, como candidato original disponible | Piloto de cinco o seis personas; aceptar solo tras comprobar cuotas y comportamiento al reactivar cómputo. No es una garantía de disponibilidad permanente. |
| Identidad | Clerk | Verificar funciones y condiciones del plan; no asumir que una iglesia debe ser una Organization de Clerk. |

La preferencia es un piloto gratuito, no gratuidad permanente. Antes de incorporar el grupo completo —aproximadamente 20–30 personas registradas y unas cinco editoras, más visitas públicas no acotadas— evaluar consumo y un plan adecuado. No fijar capacidad solo por el número de cuentas. Preferir subir de plan en el mismo proveedor si funciona bien, sin migrar por rutina.

Supabase no se elige para el piloto porque la persona usuaria ya agotó sus proyectos gratuitos disponibles. No crear cuentas adicionales para sortear límites ni compartir base con otro producto. Mantener Clerk separado aunque el proveedor PostgreSQL cambie después. Los planes, precios, dominios y recursos de producción aún no están contratados ni creados.

## Portabilidad y acceso

La autenticación identifica; la API autoriza cada recurso y acción. Mantener personas con identificadores internos y una relación con la identidad externa de Clerk. Iglesias, membresías, capacidades y participaciones viven en nuestras tablas: no en metadatos del proveedor como única autoridad. Mover PostgreSQL conservando esas relaciones no debe obligar a migrar las credenciales; cambiar Clerk sería un trabajo distinto.

Respetar los [accesos acordados](producto.md#accesos-acordados). Un identificador de iglesia enviado por el cliente no acredita acceso. CORS restringido a orígenes aprobados, secretos solo en servidor y enlaces públicos con la proyección de datos autorizada. La biblioteca compartida y adaptaciones opcionales conservan los límites definidos por el producto.

Mantener migraciones del producto en Git y probar exportación y restauración en PostgreSQL independiente con datos de prueba. No prometer que una migración es solo cambiar una URL: conexiones, extensiones y configuración requieren validación. Backups y prueba de recuperación forman parte de la preparación para operación habitual.

Hono debe poder ejecutarse como servidor Node mediante su adaptador además del despliegue candidato. No usar APIs exclusivas de Vercel para las reglas centrales. Ejecutar en Cloudflare Workers sería otra decisión de runtime, no una consecuencia automática de usar Hono.

## Prueba técnica acotada antes de elegir hosting

Antes de adoptar las plataformas, probar un recorrido no productivo pequeño: web → API Hono → Prisma → PostgreSQL, e identidad Clerk verificada en backend con una operación permitida y otra rechazada. No usar corpus privado ni datos de producción.

Comprobar compilación, empaquetado y versiones; ejecución en Node y Vercel; CORS y secretos; conexión agrupada de aplicación y conexión apropiada para migraciones; respuesta tras inactividad y peticiones simultáneas. Registrar condiciones y resultados sin prometer un SLA. No ejecutar migraciones automáticamente en cada arranque o preview.

Probar también que el esquema y los datos de prueba se restauran en PostgreSQL fuera del proveedor. La prueba sigue pendiente: elegir el stack no equivale a aprobar el despliegue ni a autorizar la creación de recursos externos, gastos o publicación.

## Estrategia de validación futura

Test-first para reglas deterministas acordadas. Probar lógica de dominio, API, aislamiento por iglesia y que una operación rechazada no modifica servicios ni turnos. Completar cada incremento con navegador, persistencia y estados de interfaz; no sustituirlo por capturas o pruebas de API solamente. En etapas musicales, verificar estructura, alineación y transposición sin bloquear la primera entrega por el editor avanzado.

## Referencias consultadas

- [React: construir una aplicación y elegir navegación/datos](https://react.dev/learn/build-a-react-app-from-scratch).
- [TanStack Query: estado del servidor](https://tanstack.com/query/latest/docs/framework/react/overview).
- [Next.js: despliegue](https://nextjs.org/docs/app/getting-started/deploying).
- [Hono en Node.js](https://hono.dev/docs/getting-started/nodejs) y [Hono en Vercel](https://vercel.com/docs/frameworks/backend/hono).
- [Neon: suspensión del cómputo](https://neon.com/docs/introduction/scale-to-zero).
- [Clerk: planes y límites](https://clerk.com/pricing).

Estas referencias respaldan capacidades, no prueban el rendimiento de nuestra aplicación ni congelan condiciones comerciales.
