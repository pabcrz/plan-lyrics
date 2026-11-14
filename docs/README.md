# Documentación del proyecto

Lectura recomendada: primero el producto; consulta las demás guías según tu tarea.

| Documento | Responsabilidad | Cuándo leerlo |
|---|---|---|
| [Producto](producto.md) | Única fuente de requisitos, prioridades y alcance. | Para entender o proponer comportamiento del producto. |
| [Propuesta técnica](propuesta-tecnica.md) | Orientación técnica subordinada al producto. | Al explorar arquitectura o decisiones técnicas. |
| [Diseño](propuestas/diseno.md) | Propuesta separada de pantallas, componentes y sistema visual. | Antes de diseñar o implementar interfaces. |
| [Diseño visual](design.md) | Fundamentos, componentes y pantallas HTML de referencia (propuesta v0). | Antes de implementar o ampliar interfaces. |
| [Servicios y calendario (API)](servicios-calendario.md) | Rutas, reglas y decisiones pendientes de la primera rebanada de servicios. | Al tocar servicios, calendario o iglesia activa. |
| [Roles musicales y restricciones (API)](roles-musicales.md) | Catálogo de roles por iglesia, combinaciones no permitidas y `combinationAllowed`. | Al tocar roles, restricciones o participaciones. |
| [Participaciones y rotación (API)](participaciones.md) | Participaciones habituales, rotación, generación de asignaciones, reemplazo e intercambio. | Al tocar asignaciones, rotación o la generación al crear servicios. |
| [Predicación (API)](predicacion.md) | Sección de predicación por servicio, notas internas, asignación, cambio e intercambio, y el interruptor de la iglesia. | Al tocar predicación o sus permisos. |
| [Compartir servicios (API e interfaz)](compartir.md) | Enlaces del ministerio con vigencia, revocación y reactivación, su vista pública y decisiones pendientes. | Al tocar enlaces, documentos compartibles o la vista de congregantes. |
| [Gestión de accesos (API e interfaz)](accesos.md) | Cuentas, invitaciones por el puerto `IdentityProvider`, vínculo persona-cuenta, membresías por iglesia, decisiones restrictivas y lo no verificado. | Al tocar permisos, cuentas, invitaciones o la pantalla de accesos. |
| [Backend](propuestas/backend.md) | Propuesta de casos de uso, dominio y validación incremental. | Antes de construir la API y la persistencia. |
| [Entrega integral](propuestas/entrega-integral.md) | Secuencia que conecta diseño, backend y verificación. | Para avanzar por resultados completos, no por capas aisladas. |
| [Guía ChordPro](guia-chordpro.md) | Convenciones de formato musical. | Al trabajar con ChordPro o sus vistas. |
| [Historias de usuario](#historias-de-usuario) | Guía para proponer y validar historias. | Al expresar un resultado de usuario. |
| [Issues iniciales](issues/README.md) | Borradores de unidades de trabajo y trazabilidad con documentos e historias. | Antes de publicar issues o iniciar una unidad de desarrollo. |
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

### Primeras entregas propuestas

Las historias están en estado **propuesta**: los acuerdos del producto están registrados, pero sus criterios completos aún requieren validación. No hay implementación verificada.

| Entrega | Historia |
| --- | --- |
| 1 — programación y turnos | [HU-001 — Configurar participaciones](historias-de-usuario/HU-001-configurar-participaciones.md) |
| 1 — programación y turnos | [HU-002 — Programar un servicio](historias-de-usuario/HU-002-programar-servicio.md) |
| 1 — programación y turnos | [HU-003 — Crear servicios en lote](historias-de-usuario/HU-003-crear-servicios-en-lote.md) |
| 1 — programación y turnos | [HU-004 — Ajustar participaciones](historias-de-usuario/HU-004-ajustar-turnos.md) |
| 1 — programación y turnos | [HU-005 — Consultar el calendario](historias-de-usuario/HU-005-consultar-calendario.md) |
| 2 — preparación musical | [HU-006 — Preparar el setlist](historias-de-usuario/HU-006-preparar-setlist.md) |

Antes de implementar la primera entrega, cerrar las [reglas pendientes](producto.md#decisiones-de-producto-abiertas) de generación en lote y turnos. Publicación de enlaces y letras se detallarán en historias posteriores.

Relaciona tareas técnicas con la historia o con el issue/documento ODD correspondiente cuando aplique. No dupliques backlog, tareas técnicas ni criterios en varios documentos: enlaza la fuente canónica.
