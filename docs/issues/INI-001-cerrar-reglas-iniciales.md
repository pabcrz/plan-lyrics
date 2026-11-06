# INI-001 — Cerrar reglas de programación y turnos

- Estado documental: borrador local, sin número ni publicación en GitHub.
- Fuente: [Producto](../producto.md#decisiones-de-producto-abiertas); [orden y trazabilidad](README.md).

## Resultado

Dejar acuerdos verificables para implementar la primera entrega sin inventar reglas.

## Dependencias

Decisiones de la persona usuaria. No iniciar lógica pendiente antes de su resolución.

## Trabajo propuesto

- Resolver límites restantes del lote: hoy, meses pasados, colisiones con servicios existentes, cero/exceso de directores, homónimos, permisos de alta de personas y selección de franjas dominicales.
- Resolver coincidencias entre propuestas de asignación sin duplicar a una persona en dos roles del mismo servicio, fechas fuera de orden, cancelaciones y efecto de cambiar el orden sobre servicios ya generados. Consultar en producto los acuerdos ya registrados sobre inicio manual, continuidad cíclica y reemplazo/intercambio.
- Definir eliminación de roles usados y alta inicial de iglesias, personas y accesos para el piloto.
- Actualizar solo los requisitos e historias afectados, conservando decisiones y ejemplos acordados.

## Evidencia necesaria para cerrar

Las decisiones están en producto y las historias afectadas dejan de tener ambigüedades bloqueantes para su implementación. No inventar respuestas ni dar por aceptado todo el backlog.

Acuerdos incorporados al [producto](../producto.md): configuración general por iglesia con días habituales y eventual domingo matutino/vespertino; zona horaria de Ciudad de México; fecha sugerida y servicios especiales; personas sin cuenta obligatoria y reutilización de vínculos existentes; inicio manual y continuidad de rotaciones; reemplazo de una fecha por defecto e intercambio explícito; un solo rol musical registrado por persona y servicio, sin exigir una segunda asignación a voces a quien canta mientras toca un instrumento. Historias HU-001 a HU-004 actualizadas sin marcarlas implementadas ni verificadas. Este issue sigue abierto por las decisiones restantes.

## Límites

No diseñar esquemas completos ni resolver letras, acordes y publicación para poder empezar. La preparación de este borrador no autoriza implementación ni decisiones de producto pendientes.
