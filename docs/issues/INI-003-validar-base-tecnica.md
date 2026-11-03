# INI-003 — Validar stack y salida de proveedores

- Estado documental: borrador local, sin número ni publicación en GitHub.
- Fuente: [Selección técnica](../propuesta-tecnica.md#prueba-técnica-acotada-antes-de-elegir-hosting); [orden y trazabilidad](README.md).

## Resultado

Comprobar un recorrido técnico mínimo y registrar límites antes de adoptar plataformas.

## Dependencias

Las comprobaciones locales no autorizan crear cuentas, recursos, gastos ni publicar; obtener ese consentimiento cuando corresponda.

## Trabajo propuesto

- Probar React/Vite → Hono/Node → Prisma/PostgreSQL con identidad Clerk, operación permitida y rechazo de acceso.
- Validar compilación, conexiones de ejecución/migración, CORS, secretos y configuración candidata de Vercel/Cloudflare.
- Registrar respuesta tras inactividad y peticiones simultáneas con condiciones explícitas; no extrapolar un SLA.
- Exportar/restaurar datos ficticios en PostgreSQL independiente y comprobar el resultado.
- Documentar condiciones de planes y consumo relevantes para piloto y operación habitual.

## Evidencia necesaria para cerrar

Comandos, entornos y resultados reales enlazados, límites y decisiones de plataforma registrados. Si falta consentimiento o una comprobación, informarla como pendiente, nunca como aprobada.

## Límites

No construir una API completa, usar corpus privado ni ejecutar migraciones sobre datos reales. La preparación de este borrador no autoriza implementación ni decisiones de producto pendientes.
