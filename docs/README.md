# Documentación del proyecto

Lectura recomendada: primero el producto; consulta las demás guías según tu tarea.

| Documento | Responsabilidad | Cuándo leerlo |
|---|---|---|
| [Producto](producto.md) | Única fuente de requisitos, prioridades y alcance. | Para entender o proponer comportamiento del producto. |
| [Propuesta técnica](propuesta-tecnica.md) | Orientación técnica subordinada al producto. | Al explorar arquitectura o decisiones técnicas. |
| [Guía ChordPro](guia-chordpro.md) | Convenciones de formato musical. | Al trabajar con ChordPro o sus vistas. |
| [Historias de usuario](#historias-de-usuario) | Guía para proponer y validar historias. | Al expresar un resultado de usuario. |
| [Flujo de trabajo](flujo-de-trabajo.md) | Etapas y acuerdos de trabajo del proyecto. | Al planificar una tarea. |
| [Criterios de desarrollo](criterios-de-desarrollo.md) | Criterios de diseño, seguridad y pruebas. | Al implementar comportamiento. |
| [Contribuir](../CONTRIBUTING.md) | Ramas, commits y entrega. | Al preparar cambios para revisión. |

## Historias de usuario

Propón una historia cuando ayude a describir un resultado visible para una persona. Guárdala en `docs/historias-de-usuario/HU-001-programar-servicio.md`, usando el siguiente ID estable disponible y un nombre corto en español. Crea esa carpeta al registrar la primera historia; conserva los IDs aunque cambie el título.

Una historia describe **un resultado de usuario**, no una tarea técnica por endpoint o tabla. Puedes proponerla tú o un agente; la persona usuaria valida alcance y decisiones. Las historias detallan el producto aprobado, pero no añaden requisitos ni sustituyen [el plan oficial](producto.md). Si una idea cambia el alcance, acuerda el cambio y actualiza el plan oficial antes de implementarla.

### Plantilla breve

```markdown
# HU-NNN — <resultado>

- Estado: propuesta | acordada | en curso | verificada
- Producto: [sección pertinente](../producto.md#ancla)

Como <tipo de persona>, quiero <resultado>, para <beneficio>.

## Criterios de aceptación
- Dado <contexto>, cuando <acción>, entonces <resultado observable>.

## Exclusiones y decisiones abiertas
- <solo lo necesario; indicar qué queda fuera o pendiente>

## Evidencia
- <enlace o resultado verificable; completar al verificar>
```

El estado `acordada` requiere validación de alcance. Usa criterios breves y observables; registra decisiones aún abiertas sin inventar respuestas. Marca `verificada` solo cuando se cumplan todos sus criterios de aceptación y enlaza evidencia real, no una afirmación sin comprobación.

### Ejemplo ilustrativo, no aprobado

**HU-001 — Programar un servicio:** Como persona que organiza un servicio, quiero indicar cuándo será, para coordinar su preparación.

- Dado que estoy preparando un servicio, cuando registro una fecha, entonces puedo identificar cuándo está programado.
- **Fuera de alcance del ejemplo:** no decide quién puede acceder o editar; la matriz de permisos sigue abierta en el plan de producto.

Relaciona tareas técnicas con la historia o con el issue/documento ODD correspondiente cuando aplique. No dupliques backlog, tareas técnicas ni criterios en varios documentos: enlaza la fuente canónica.
