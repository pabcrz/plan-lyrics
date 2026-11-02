# Plan de producto — fuente oficial

Este documento es la única fuente oficial de requisitos, prioridades, alcance y funcionalidades previstas de Plan & Lyrics. Describe intención futura, no infraestructura ni funciones implementadas. La [propuesta técnica](propuesta-tecnica.md) es subordinada y no redefine el producto.

## Prioridad de producto

1. **Organizar servicios y calendario.** Planificar quién participa, quién dirige y qué ocurre, con permisos adecuados.
2. **Letras.** Incorporar letras estructuradas por secciones, variaciones y repeticiones.
3. **Acordes.** Preservar alineación y permitir transposición.

El repertorio de letras permanece local y no se publica en este repositorio por el momento. La calidad de un editor de ChordPro no debe desplazar la organización de servicios.

## Alcance previsto

### Etapa 1 — servicios y organización

- Crear servicios con título, iglesia, fecha, hora de inicio opcional y estado (borrador, publicado, completado o cancelado); organizarlos en una vista tipo calendario.
- Designar dirección y participantes, asignando a cada persona un rol musical para ese servicio. Asignaciones sencillas pendiente/confirmada/declinada pueden formar parte del plan.
- Ordenar canciones y otros momentos del servicio; registrar tonalidad contextual y enlaces de referencia manuales a YouTube o Spotify. No se prevé integración automática con esos servicios.
- Diseñar primero para móvil, con límites de acceso aplicados correctamente en servidor.
- Distinguir **permisos de acceso** de **roles musicales**. Los nombres definitivos de roles y la matriz de capacidades siguen abiertos; no hay una asignación de permisos ya aprobada.

### Etapa 2 — letras

Incluir estructura de intro, estrofa/verso, coro, puente, outro y cierre; permitir variaciones y repeticiones sin perder el orden musical. Mantener una sola fuente ChordPro y derivar de ella distintas vistas.

### Etapa 3 — acordes

Preservar la relación entre letra y acordes, permitir transposición respetando modo mayor/menor y ofrecer herramientas de edición de acordes. El editor avanzado no es prioridad de la primera etapa.

### Requisitos transversales

- Biblioteca musical compartida; no clonar canciones por iglesia o servicio como requisito.
- Adaptaciones opcionales de iglesia y servicio heredan de la base. Los cambios heredados siguen vigentes incluso en contenido publicado; los overrides explícitos se conservan. No se exigen snapshots ni clones obligatorios.
- La edición editorial global es distinta de la administración local de iglesia.
- Un setlist público de servicio y sus letras podrán consultarse sin iniciar sesión. La vista pública no expondrá datos personales, listas de miembros, tonalidades internas, asignaciones privadas, BPM, acordes ni notas internas.
- Rotación futura por iglesia basada en uso confirmado de la canción, no de una versión concreta. Política de confirmación/cancelación, zona horaria y cadencia aún por decidir.
- Exportaciones TXT son futuras. La importación de TXT con acordes encima es opcional y no confirmada.

## Fuera de las primeras etapas

No ampliar la primera entrega con modo offline, colaboración en tiempo real, IA, aplicación nativa, sincronización automática con plataformas musicales ni editor avanzado. Estos no son requisitos de la primera etapa.

## Criterios verificables para el futuro

- Una persona puede crear un servicio fechado, ordenar canciones y otros momentos y asignar participantes con su rol musical, sin que dicho rol conceda permisos de edición.
- Un enlace público permite consultar el setlist sin cuenta y no revela asignaciones privadas, BPM, acordes o notas internas.
- En etapas posteriores, una modificación heredada se refleja donde no exista override y un override explícito permanece intacto.
- En etapas posteriores, la vista de letras y la vista con acordes derivan de una misma fuente; la transposición conserva alineación.

Son criterios futuros; no se ha implementado ni probado la infraestructura.

## Decisiones de producto abiertas

- ¿Qué roles musicales estarán disponibles y quién puede administrar servicios, asignaciones y biblioteca compartida? Definir la matriz de permisos antes de implementación.
- ¿Cómo se confirma el uso real de una canción y cómo afectan cancelaciones, zonas horarias y cadencias a la rotación?
- ¿Qué reglas tendrá la publicación y revocación del enlace público?
- ¿Qué alcance tendrá la importación de TXT con acordes encima?

## Relación con la propuesta técnica

La propuesta de arquitectura, stack y prueba de compatibilidad de despliegue está en el [documento técnico](propuesta-tecnica.md). Las convenciones esenciales de formato están en la [guía ChordPro](guia-chordpro.md).
