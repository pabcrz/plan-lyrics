# Propuesta de backend — dominio y casos de uso pequeños

**Estado: propuesta, sin API, esquema ni infraestructura implementados.** El [producto](../producto.md) es la autoridad funcional. La [selección técnica](../propuesta-tecnica.md) registra Hono, TypeScript, Prisma y PostgreSQL como base de partida, con Clerk separado; este documento explica cómo desarrollarlos por etapas, sin dar por validados los proveedores de despliegue.

## Enfoque

Mantener un monolito modular y una API al servicio de recorridos concretos. No construir todos los endpoints, tablas o permisos posibles antes de tener una experiencia usable. Implementar solo los datos y operaciones que necesita cada unidad de la [propuesta integral](entrega-integral.md).

## Límites de responsabilidad propuestos

| Área | Responsabilidad | Evitar |
| --- | --- | --- |
| Identidad y acceso | Resolver persona, membresía, iglesia activa y capacidades por operación. | Confundir autenticación, administración local, edición global y rol musical. |
| Programación | Consultar calendario, crear servicios individuales y lotes mensuales, conservar dirección y participaciones. | Un controlador enorme o una recurrencia automática no solicitada. |
| Participaciones y turnos | Configuración habitual, secuencias por día o compartidas y cálculo de asignaciones. | Inferir disponibilidad o decidir reglas pendientes sin acuerdo. |
| Biblioteca y setlists | En su etapa, seleccionar canciones y guardar orden, tono y referencias del servicio. | Mezclar cambios contextuales con edición de la canción compartida. |

Son límites conceptuales: no obligan a crear microservicios, paquetes ni capas adicionales. La persistencia inicial necesita únicamente las entidades del recorrido en curso, no un esquema musical completo.

## Implementación con Hono

Agrupar rutas por funcionalidad. El handler valida la petición, obtiene la identidad verificada y llama al caso de uso; no contiene todo el generador de turnos ni decide permisos a partir de datos sin verificar. Mantener reglas y acceso a datos separados de HTTP con funciones y dependencias explícitas, sin reproducir un contenedor de inyección de dependencias ni un repositorio genérico por cada tabla.

Usar validación de entradas con Zod y un formato de error consistente. Probar los contratos mediante peticiones a la aplicación Hono y pruebas con PostgreSQL cuando haya persistencia. Para poder cambiar de hosting, mantener la aplicación separada del arranque del servidor Node y del adaptador de despliegue.

## Recorrido de una operación

1. Validar identidad y acceso a la iglesia y a la acción. Que la interfaz ya tenga iglesia activa no permite confiar en una iglesia enviada por el cliente sin autorización.
2. Validar entradas y reglas de dominio en servidor.
3. Calcular el resultado con lógica determinista, independiente de la interfaz y, cuando sea útil, de la base de datos.
4. Guardar los cambios y devolver solo los datos que la pantalla necesita, con errores comprensibles y consistentes.

El contrato de cada caso de uso se acuerda con la interfaz antes de implementarlo: entrada, respuesta, errores y ejemplos. No se fija aquí una lista definitiva de rutas ni se introduce una API genérica de administración de todas las tablas.

## Lotes mensuales y turnos

Separar conceptualmente **calcular una propuesta** de **confirmar su creación**. El resumen debe mostrar fechas, directores y participaciones; si hay tres nombres para cuatro fechas, explicar que solo se crearán las tres primeras. Esta separación es una propuesta técnica para soportar la confirmación acordada, no exige dos pantallas ni dos rutas específicas.

El generador debería recibir datos explícitos —fechas ordenadas, configuración y estado de turnos— y producir asignaciones comprobables. La fecha de referencia y zona horaria no deberían depender de valores ocultos de la máquina; su regla funcional aún debe acordarse.

Antes de guardar, volver a comprobar permisos y vigencia de los datos. Proponer protección contra reenvíos y cambios entre revisión y confirmación para no duplicar servicios ni consumir turnos dos veces. La política ante fechas ocupadas, fallos parciales y conflictos debe acordarse antes de cerrar el contrato; no se presenta aquí como comportamiento ya aprobado.

No asumir que el orden de creación equivale al orden cronológico. Resolver continuidad entre meses, creación fuera de orden, cancelaciones, sustituciones y coordinación batería/voces antes de implementar esos casos.

## Verificación por caso de uso

- Pruebas deterministas del calendario mensual, correspondencia de nombres y fechas, lotes parciales y ambas modalidades de rotación, con las reglas previamente acordadas.
- Pruebas de integración por la API para permisos y aislamiento entre iglesias, validación y persistencia.
- Verificar que una operación rechazada no modifica servicios, asignaciones ni estado de turnos.
- Probar el recorrido conectado desde navegador, incluyendo errores y cambios manuales. Un cálculo correcto por sí solo no acredita una entrega usable.

## Base técnica y límites

Hacer la prueba de compatibilidad de ejecución y datos descrita en la [propuesta técnica](../propuesta-tecnica.md#prueba-técnica-acotada-antes-de-elegir-hosting) antes de adoptar el hosting. Mantenerla acotada, no productiva y sin corpus privado. No convertirla en un backend completo.

No agregar por anticipado microservicios, colas, motor genérico de planificación, detección de disponibilidad, integraciones musicales ni editor ChordPro avanzado. Incorporar complejidad solo ante un caso de uso real y validado.
