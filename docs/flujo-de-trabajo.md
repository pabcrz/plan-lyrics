# Flujo de trabajo

Recorrido ligero: **alinear → explorar → planificar → implementar → verificar → cerrar**. Adapta el esfuerzo al tamaño y riesgo; una corrección pequeña y clara no necesita ceremonia.

1. **Alinear:** confirma resultado, criterios, límites y decisiones pendientes. El plan de producto es la autoridad sobre alcance.
2. **Explorar:** lee las instrucciones pertinentes, documentación relacionada y estado de trabajo. Identifica fuentes canónicas y preserva cambios existentes.
3. **Planificar:** para trabajo sustancial, registra una secuencia breve de unidades verificables y cómo retomarlo. No conviertas hallazgos incidentales en alcance nuevo.
4. **Implementar:** cambia solo lo necesario. Cuando haya pruebas deterministas aplicables, escribe la prueba de comportamiento y observa su fallo antes de implementar la solución.
5. **Verificar:** comprueba el resultado y las regresiones relevantes. Para documentación pasiva u otros casos sin RED útil, declara la excepción y ejecuta una comprobación estructural proporcional.
6. **Cerrar:** informa rutas, evidencia observada, limitaciones y pendientes. Revisa el diff y conserva cambios ajenos.

## Acuerdos del proyecto

El producto y los acuerdos locales viven en estos documentos; las instrucciones y habilidades de Gentle AI ayudan a ejecutar unidades acotadas, no sustituyen esas fuentes. El trabajo sustancial puede registrarse y retomarse con el contexto de tarea correspondiente; no hace falta imponer ese proceso a cada cambio menor.

La matriz de permisos sigue abierta en el [plan de producto](producto.md): no inventes roles ni capacidades. La [propuesta técnica](propuesta-tecnica.md) incluye una prueba de compatibilidad de despliegue futura; no se ha ejecutado. No dupliques instrucciones generales del agente ni exijas revisión nativa para cambios triviales.

Esta guía adapta la plantilla `work-flow` a Plan & Lyrics. Los acuerdos adoptados viven aquí: no requieren consultar otro repositorio ni se actualizan automáticamente desde su origen.
