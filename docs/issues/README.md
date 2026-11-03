# Issues iniciales — borradores locales

**No publicados en GitHub; no son una cola de implementación aprobada.** Los IDs `INI-*` identifican borradores locales, no números de GitHub. No se han consultado issues remotos, duplicados, formularios ni etiquetas; esa revisión requiere autorización del destino y la sesión antes de publicar.

## Fuentes y trazabilidad

- [Producto](../producto.md): alcance y decisiones funcionales; no replicarlos en los issues.
- [Historias](../README.md#primeras-entregas-propuestas): criterios de aceptación, todavía propuestos; validar los afectados antes de implementar.
- [Selección técnica](../propuesta-tecnica.md) y [propuesta integral](../propuestas/entrega-integral.md): arquitectura y orden de avance.
- Issues: resultado de trabajo, dependencias y evidencia. Cuando se publiquen, mantener el estado operativo en GitHub, no en dos tableros manuales.

Al publicar, enlazar cada issue a rutas de documentación con una referencia Git disponible remotamente. El commit local `8a3cedc` contiene las propuestas y el stack, pero aún no se hizo push. Los cuerpos con enlaces relativos de estos borradores necesitan convertirse a enlaces navegables de GitHub; no copiarlos sin revisión. Registrar la correspondencia `INI-* → URL del issue` aquí sin duplicar el seguimiento diario.

En cada rama o PR de implementación, referenciar el issue y las historias afectadas. Un issue cerrado requiere evidencia observada; actualizar la sección Evidencia de la historia cuando se cumplan todos sus criterios, sin marcarla verificada por un incremento parcial. Los cambios de alcance se acuerdan y registran primero en producto.

## Orden inicial propuesto

| Borrador | Resultado | Dependencias para cerrar |
| --- | --- | --- |
| [INI-001](INI-001-cerrar-reglas-iniciales.md) | Resolver reglas que bloquean programación y turnos. | Decisiones de la persona usuaria. |
| [INI-002](INI-002-disenar-recorrido-inicial.md) | Mapa, wireframe y referencia visual mínima. | INI-001 para cerrar estados sujetos a reglas pendientes. |
| [INI-003](INI-003-validar-base-tecnica.md) | Evidencia de compatibilidad y portabilidad del stack. | Consentimiento específico antes de crear recursos o publicar. |
| [INI-004](INI-004-calendario-y-servicio.md) | Calendario y servicio individual conectados. | INI-001, INI-002, INI-003. |
| [INI-005](INI-005-participaciones-y-turnos.md) | Configuración y generación de participaciones. | INI-001, INI-004. |
| [INI-006](INI-006-lotes-y-ajustes.md) | Lote mensual, correcciones y cierre de primera entrega. | INI-002, INI-005. |

Se puede explorar el wireframe y la prueba técnica mientras se resuelven decisiones, sin implementar respuestas inventadas. No crear issues por tabla, endpoint o componente. Si una unidad resulta demasiado amplia, dividirla por resultados revisables antes de implementarla, manteniendo sus dependencias.

HU-006 (setlist), publicación y editor musical quedan para preparación posterior. Estos borradores no reducen la primera entrega acordada a un calendario sin lotes ni turnos.
