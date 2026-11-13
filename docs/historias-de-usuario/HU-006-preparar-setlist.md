# HU-006 — Preparar el setlist del servicio

- Estado: propuesta
- Producto: [Plan oficial](../producto.md#etapa-1--servicios-y-organización)

Como editor de servicios, quiero ordenar canciones y otros momentos y registrar tonos y referencias, para dejar preparada la secuencia del servicio.

## Criterios de aceptación
- Dado un servicio de mi iglesia, cuando preparo su setlist, entonces puedo ordenar canciones y otros momentos.
- Dada una canción del setlist, cuando registro su tono contextual y referencias manuales a YouTube o Spotify, entonces quedan disponibles en la preparación interna sin editar la biblioteca compartida.
- Dado un integrante sin acceso de edición, cuando intenta modificar el setlist, entonces la operación se rechaza.

## Exclusiones y decisiones abiertas

Propuesta para la entrega siguiente a programación y turnos. No incluye editor de letras o acordes, transposición implementada, integraciones automáticas ni publicación por enlace. La creación y selección inicial de canciones requiere concretar el flujo de biblioteca. Las reglas pendientes se mantienen en el plan oficial; estos criterios no autorizan inferirlas.

## Evidencia

Implementado en API y pantalla (ver [servicios y calendario](../servicios-calendario.md)): orden, tonalidad contextual y enlace manual a YouTube o Spotify, con edición solo para editores de servicios. Verificado con pruebas unitarias, de integración con PostgreSQL y de componente. Quién da de alta canciones desde el setlist sigue sin definirse en el producto: hoy solo lo hace el editor de biblioteca o el superadministrador.
