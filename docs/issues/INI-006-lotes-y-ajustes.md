# INI-006 — Crear lotes, corregir turnos y cerrar primera entrega

- Estado documental: borrador local, sin número ni publicación en GitHub.
- Fuentes: [HU-003](../historias-de-usuario/HU-003-crear-servicios-en-lote.md) y [HU-004](../historias-de-usuario/HU-004-ajustar-turnos.md); [orden y trazabilidad](README.md).

## Resultado

Programar el mes total o parcialmente y corregir participaciones generadas en un recorrido conectado.

## Dependencias

INI-002 e INI-005; contrato de fechas ocupadas, confirmación, persistencia y sustituciones acordado.

## Trabajo propuesto

- Conectar selección mensual/día, directores ordenados y revisión/confirmación con generación y persistencia.
- Probar cuatro fechas/tres nombres: confirmar tres primeras fechas, sin servicio ni participaciones para la cuarta.
- Permitir reemplazos y comprobar su efecto acordado sobre secuencias futuras.
- Verificar también lote completo, ambas modalidades de rotación, errores y permisos.
- Revisar cobertura de HU-001 a HU-005 antes de declarar la entrega completa.

## Evidencia necesaria para cerrar

Recorrido móvil/escritorio, datos persistidos y pruebas deterministas con evidencia por criterio. Registrar pendientes sin presentar una entrega parcial como finalizada.

## Límites

No incluir setlist HU-006, enlaces públicos ni editor musical en este cierre de programación. No superar el alcance por fallos incidentales. La preparación de este borrador no autoriza implementación ni decisiones de producto pendientes.
