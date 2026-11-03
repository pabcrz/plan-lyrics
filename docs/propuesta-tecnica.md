# Propuesta técnica — Plan & Lyrics

**Documento técnico subordinado.** Los requisitos, prioridades, alcance y funciones previstas se definen exclusivamente en el [plan oficial del producto](producto.md). Este documento propone una arquitectura para satisfacerlos; no agrega ni reemplaza requisitos de producto. No se afirma que la aplicación o su infraestructura estén implementadas.

## Arquitectura propuesta

Monolito modular con cliente web y API separados: la web consume la API REST; la API valida identidad, autorización y reglas de negocio en servidor, y accede a PostgreSQL. El cliente nunca se conecta directamente a la base de datos. Mantener el dominio organizado por módulos (identidad/permisos, iglesias y servicios, biblioteca musical); la lógica musical puede encapsularse sin dependencia del DOM.

Un monorepo sencillo podría usar `apps/web`, `apps/api` y paquetes compartidos para contratos y lógica musical. Es una organización posible, no una estructura existente ni una decisión irrevocable.

## Stack provisional

| Capa | Propuesta por validar |
| --- | --- |
| Web | React, Vite y TypeScript |
| API | NestJS y REST |
| Datos | Prisma y PostgreSQL |
| Identidad | Clerk, sujeto a validación de permisos y modelo de membresía |
| Hosting | Cloudflare Pages para web y Vercel para API, sujeto a prueba de compatibilidad |

No se seleccionan nuevos proveedores ni se afirma una configuración desplegada. Compatibilidad, costes, dominios y configuración de producción quedan pendientes.

## Límites de seguridad y dominio

La autenticación identifica a la persona; la autorización se valida en backend para cada recurso y acción. Membresía de iglesia, permiso editorial global, administración de iglesia y rol musical son conceptos separados. No confiar en identificadores u opciones de rol enviados por el cliente. Limitar enlaces públicos a los datos expresamente publicables y permitir su revocación.

La biblioteca compartida y los overrides opcionales de iglesia/servicio deben preservar herencia y evitar clones obligatorios. Los servicios pertenecen a su contexto de iglesia; las asignaciones privadas no se exponen por el lector público. El esquema concreto, las entidades y las políticas de permiso se definen durante el diseño, respetando los [accesos combinables acordados](producto.md#accesos-acordados) y las capacidades aún pendientes en el plan oficial.

## Prueba técnica acotada antes de elegir hosting

Antes de adoptar la combinación propuesta, hacer una prueba pequeña y no productiva de empaquetado y ejecución de NestJS/Prisma en el entorno serverless candidato: arranque, conexión PostgreSQL agrupada, variables de entorno, tiempos y límites de ejecución. Verificar que la web puede llamar a la API con CORS restringido y que secretos no llegan al cliente. Registrar resultado y límites; no ejecutar migraciones automáticamente en arranque ni en previews. Esta prueba está propuesta, no ejecutada; el resultado puede cambiar la elección de hosting.

## Estrategia de validación futura

Probar reglas de dominio y validación en módulos; probar autorización y aislamiento entre iglesias en API; comprobar que la vista pública excluye datos privados. Para funciones musicales posteriores, probar preservación literal, estructura de repeticiones, alineación y transposición. No anticipar lógica musical como bloqueador de la primera etapa organizativa.
