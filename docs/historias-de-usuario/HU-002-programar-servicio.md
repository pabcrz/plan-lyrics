# HU-002 — Programar un servicio en la iglesia activa

- Estado: propuesta
- Producto: [Plan oficial](../producto.md#etapa-1--servicios-y-organización)

Como editor de servicios, quiero crear un servicio dentro de la iglesia en la que estoy trabajando, para organizar una fecha sin volver a seleccionar la iglesia.

## Criterios de aceptación
- Dado mi acceso de editor y una iglesia activa, cuando creo un servicio con su fecha y datos, entonces pertenece automáticamente a esa iglesia, sin solicitar un selector de iglesia.
- Dadas participaciones configuradas, cuando creo el servicio, entonces carga las habituales y calcula los turnos según la modalidad configurada para cada rotación: por día o entre todos los servicios.
- Dado un integrante sin acceso de edición, cuando intenta crear un servicio, entonces la operación se rechaza.

## Exclusiones y decisiones abiertas

La generación depende de las reglas pendientes del plan de producto. No incluye creación de iglesias, recurrencia ni confirmación de asistencia. Las reglas pendientes se mantienen en el plan oficial; estos criterios no autorizan inferirlas.

## Evidencia

Pendiente de implementación y verificación. Esta historia documenta comportamiento propuesto, no funciones existentes.
