# INI-002 — Diseñar el recorrido de programación mensual

- Estado documental: borrador local, sin número ni publicación en GitHub.
- Fuente: [Propuesta de diseño](../propuestas/diseno.md); [orden y trazabilidad](README.md).

## Resultado

Obtener un recorrido comprensible y una referencia visual mínima que evite componentes inconsistentes.

## Dependencias

Puede empezar con pendientes señalados; requiere INI-001 para cerrar interacciones dependientes de esas reglas.

## Trabajo propuesto

- Mapear calendario, creación individual, lote, detalle y configuración según acceso.
- Bocetar calendario → lote → revisión → confirmación parcial o completa → detalle → cambio de participación.
- Elegir referencia visual principal y registrar tokens y variantes mínimos al validarlos; probar móvil/escritorio y estados relevantes.
- Usar datos ficticios y no confundir mockups con aplicación implementada.

## Evidencia necesaria para cerrar

Recorrido revisado con la persona usuaria, archivos y versión de referencia enlazados, estados y decisiones visuales explícitos. Vincular HU-001 a HU-005 sin duplicar sus criterios.

Primer borrador disponible en [mapa y recorrido](../../design/programacion-mensual/mapa-y-recorrido.md), con cuatro alternativas registradas en [el manifiesto del canvas](../../design/programacion-mensual/design.json). Son wireframes con datos ficticios, no una aplicación productiva. La alternativa 04 fue aceptada como referencia del recorrido; las reglas de INI-001 y los estados dependientes siguen pendientes: este issue no está cerrado.

Iteración solicitada: [pasos guiados + filas por fecha, móvil primero](../../design/programacion-mensual/04-pasos-y-fechas-mobile.html). Conserva las alternativas previas; corrige la referencia del escenario a 4/11/2026 y presenta semanas desde domingo. La persona usuaria confirmó: “y si, acepto la 4”. La elección queda registrada; no autoriza componentes productivos ni resuelve las reglas pendientes.

## Límites

No diseñar todo el producto, crear el editor musical ni implementar componentes productivos en este issue. La preparación de este borrador no autoriza implementación ni decisiones de producto pendientes.
