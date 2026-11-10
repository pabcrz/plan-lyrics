# INI-005 — Configurar y generar participaciones

- Estado documental: borrador local, sin número ni publicación en GitHub.
- Fuentes: [HU-001](../historias-de-usuario/HU-001-configurar-participaciones.md) y [HU-002](../historias-de-usuario/HU-002-programar-servicio.md); [orden y trazabilidad](README.md).

## Resultado

Completar automáticamente las participaciones al crear servicios, respetando la configuración de la iglesia.

## Dependencias

INI-001 e INI-004; contratos y ejemplos de coordinación entre roles ya acordados.

## Trabajo propuesto

- Implementar configuración de roles alfabéticos, participaciones habituales y rotaciones con permisos administrativos.
- Separar el cálculo de turnos de HTTP e interfaz; cubrir modalidades por día y compartida con ejemplos acordados.
- Integrar el cálculo con creación de servicio y consulta de sus asignaciones.
- Probar validación, aislamiento y que los rechazos no alteren servicios, asignaciones ni estado de turnos.

## Evidencia necesaria para cerrar

Evidencia de HU-001 y de los criterios de generación de HU-002 mediante pruebas y navegador. Registrar resultados exactos, no solo presencia de tests.

## Límites

No introducir disponibilidad automática, confirmaciones de asistencia ni recurrencias. La preparación de este borrador no autoriza implementación ni decisiones de producto pendientes.
