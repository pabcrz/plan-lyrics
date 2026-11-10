# HU-004 — Ajustar participaciones generadas

- Estado: propuesta
- Producto: [Plan oficial](../producto.md#participaciones-habituales-y-turnos)

Como editor de servicios, quiero cambiar las participaciones de un servicio después de generarlas, para resolver ausencias o compromisos sin rehacer toda la programación.

## Criterios de aceptación
- Dado un servicio con asignaciones generadas, cuando reemplazo una participación, entonces el servicio muestra la asignación corregida.
- Dado un servicio con una participación generada, cuando uso la opción predeterminada de reemplazar solo en ese servicio, entonces cambia esa asignación y los turnos siguientes conservan su orden.
- Dados Luis el viernes 6, Pedro el 13 y Juan el 20 en el mismo rol, cuando elijo explícitamente intercambiar los turnos de Luis y Pedro, entonces se muestran ambas fechas y personas antes de confirmar; solo tras confirmar quedan Pedro el 6, Luis el 13 y Juan el 20.
- Dado un reemplazo o intercambio, cuando se confirma, entonces cada persona sigue teniendo como máximo un rol musical registrado en cada servicio afectado; cantar junto a un instrumento no exige agregarla a voces.
- Dado un integrante sin acceso de edición, cuando intenta reemplazar una participación, entonces la operación se rechaza.

## Exclusiones y decisiones abiertas

Incluida en la primera entrega. El reemplazo predeterminado afecta solo al servicio; el intercambio de dos turnos requiere una acción explícita y confirmación. Una persona puede alternar roles entre servicios, pero ocupa como máximo uno registrado en cada servicio. Falta precisar la resolución de coincidencias al proponer o cambiar asignaciones. No se registra aparte el canto habitual junto al instrumento ni se presume indisponibilidad en otras iglesias. Las reglas pendientes se mantienen en el plan oficial; estos criterios no autorizan inferirlas.

## Evidencia

Pendiente de implementación y verificación. Esta historia documenta comportamiento propuesto, no funciones existentes.
