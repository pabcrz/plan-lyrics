# HU-002 — Programar un servicio en la iglesia activa

- Estado: propuesta
- Producto: [Plan oficial](../producto.md#etapa-1--servicios-y-organización)

Como editor de servicios, quiero crear un servicio dentro de la iglesia en la que estoy trabajando, para organizar una fecha sin volver a seleccionar la iglesia.

## Criterios de aceptación
- Dado mi acceso de editor y una iglesia activa, cuando creo un servicio con su fecha y datos, entonces pertenece automáticamente a esa iglesia, sin solicitar un selector de iglesia.
- Dados los días habituales de la iglesia activa, cuando inicio la creación, entonces se sugiere la fecha de reunión más cercana según la zona horaria de Ciudad de México; la inclusión de hoy se resolverá antes de verificar este criterio.
- Dada una fecha no habitual, cuando necesito un servicio especial, entonces puedo elegirla sin cambiar los días habituales de la iglesia.
- Dada una persona existente en el directorio de la iglesia, cuando la selecciono como directora, entonces se reutiliza su registro y su vínculo de cuenta si existe, sin exigirle iniciar sesión ni crear otro registro solo por escribir su nombre.
- Dadas participaciones configuradas, cuando creo el servicio, entonces carga las habituales y calcula los turnos según la modalidad configurada para cada rotación: por día o entre todos los servicios.
- Dado un integrante sin acceso de edición, cuando intenta crear un servicio, entonces la operación se rechaza.

## Exclusiones y decisiones abiertas

La generación depende de las reglas pendientes del plan de producto. La configuración general incluye nombre y días habituales y contempla habilitar domingo matutino/vespertino si la iglesia adopta esa costumbre; no se impone actualmente. Precisar colisiones con servicios existentes, selección de franja dominical, homónimos y permisos para guardar personas nuevas o usar un nombre de una sola ocasión. Las personas no requieren cuenta de acceso. No incluye creación de iglesias, recurrencia ni confirmación de asistencia. Las reglas pendientes se mantienen en el plan oficial; estos criterios no autorizan inferirlas.

## Evidencia

Pendiente de implementación y verificación. Esta historia documenta comportamiento propuesto, no funciones existentes.
