# Plan de producto

Plan & Lyrics busca que un equipo prepare un servicio musical con rapidez y que cualquier asistente pueda consultar el setlist y sus letras desde el teléfono. Es un plan de producto, no una declaración de funcionalidades implementadas.

## Enfoque

Prioridad: **lector público del servicio + setlist utilizable**, respaldados por preparación musical interna mínima, permisos correctos y transposición automática. La biblioteca es compartida desde el inicio; iglesia y servicio aportan únicamente adaptaciones opcionales. No se crean copias obligatorias por iglesia o fecha.

## Hitos y aceptación futura

| Hito | Entrega prevista | Criterio de aceptación futuro |
| --- | --- | --- |
| 1. Base musical | Biblioteca compartida autorizada, importación revisable, ChordPro y transposición | Solo colaboradores autorizados editan la base; acorde y letra permanecen alineados al transponer, respetando mayor/menor; texto fuente no se inventa ni corrige. |
| 2. Servicio y lectura | Crear/ordenar setlist, publicar lector responsive sin cuenta | Lector móvil expande repeticiones de letra; vista pública y vista armónica privada concuerdan con un arreglo ordenado, preservando armonía/alineación; no expone acordes, BPM, claves internas, asignaciones ni notas administrativas. Para el ejemplo EN TU LUZ, dos vueltas del bloque producen cuatro apariciones de “Nadie como Tú” y “Jesús” aparece una vez fuera; mostrar “2 vueltas del bloque · 4 apariciones de la frase”. Reutilizar pasajes solo si son musicalmente idénticos, nunca por deduplicación de texto. |
| 3. Herencia | Adaptación opcional de iglesia y override por servicio | Cambios heredados llegan a servicios publicados; overrides explícitos sobreviven; secciones referenciadas no duplican letras; escritura concurrente usa protección optimista. |
| 4. Permisos y rotación | Autorización separada de roles ministeriales, política configurable y uso confirmado | Admin de iglesia no obtiene edición global; uso se cuenta por iglesia+canción, sin reinicio por versión, y solo al confirmar el uso. |
| 5. Expansión posterior | Colaboración simultánea, offline completo, herramientas avanzadas y PDF ampliado | Considerar solo tras validar necesidad; PDF es respaldo opcional y el himnario impreso, caso futuro. |

Los criterios son verificaciones para el futuro, no pruebas ejecutadas. No se ha implementado aplicación alguna. Para el modelo vigente, reglas ChordPro, privacidad y estado observado de importación, ver el [README de producto y arquitectura](../Plan-and-Lyrics-README-2026-10-26.md).

## Decisiones confirmadas

- Contenido musical canónico compartido; origen eclesial no implica propiedad. Edición por colaboradores explícitamente autorizados, distinta de lectura pública.
- Cadena opcional: versión compartida → adaptación de iglesia → ajuste del servicio. Herencia automática también en publicados; excepciones explícitas persisten. Sin historial musical inmutable ni colaboración en tiempo real obligatorios para MVP.
- Transposición automática incluida en preparación inicial. Diferenciar tonalidad original codificada, base preferida de iglesia y contexto del servicio; etiquetas de UI concisas `Base` / `Servicio`.
- Lector público sin login y centrado en el teléfono; PDF secundario. Contenido público derivado de la estructura vigente, con repeticiones expandidas y sin datos internos.
- ChordPro canónico; Holyrics solo indicio de entrada. Líneas semánticas no son cortes de diapositiva; preservación literal de letras. Una estructura autoritativa distingue aparición de letra, pasaje/bloque armonizado y vuelta de arreglo; las repeticiones y variaciones de acordes/alineación se preservan. Mismo texto no implica misma armonía. No se prescribe esquema DB/API ni SongVersion/clon por aparición.
- Política vigente de fuentes: delimitadores coincidentes `/` o `:` a ambos lados, o `xN`, se materializan como N copias físicas totales del fragmento/bloque (N cuenta una pasada final); preservar orden, prefijo/sufijo parcial una vez, duplicados explícitos y variaciones armónicas. No inventar acordes ni reinterpretar globalmente puntuación, metadatos con dos puntos o slash de bajo. Los originales son inmutables; registrar procedencia consumida como no ejecutable para evitar doble aplicación del sidecar. La política no afirma conversión nueva del corpus. En notación manual futura se prefiere `/`, no es repetición automática nativa. `//(E1)` es encabezado y `{chorus: x4}` no cuenta automáticamente. Ver [guía rápida ChordPro](chordpro-glossary.md) para semántica nativa, sintaxis de colección y acciones propuestas del editor.
- Rotación configurable por intervalo temporal/calendario o cantidad de servicios intermedios; cada iglesia decide advertencia o bloqueo. Guardar uso real confirmado por iglesia+canción, no por versión.
- Se prevén exportaciones TXT de solo letras y con acordes encima de las letras, ambas derivadas del único ChordPro canónico y con disposición monoespaciada para conservar la alineación. El arreglo/versión efectivo y la tonalidad no se mantienen en una fuente duplicada. ChordPro nativo es un formato distinto.
- Importar TXT con acordes encima de la letra y convertirlo a ChordPro es una **propuesta por validar**, no una función aprobada del MVP: debe mostrar la alineación detectada, permitir revisar filas dudosas y pedir confirmación antes de crear o actualizar una versión. No inferir acordes ni ritmo, ni tratar palabras en mayúsculas como acordes por una regla simple; preservar texto, orden, acentos y permisos de la biblioteca compartida. Prioridad abierta.

## Importación: evidencia y pendientes

La colección local `odd/artifacts/lyrics-standardization/` contiene 375 archivos `.cho` en 379 archivos de trabajo. Los `.cho` actuales son una biblioteca editorial evolutiva: se puede planificar el producto ahora y mejorar canciones incrementalmente; no son una importación perfecta ni congelada. Los 380 TXT originales son archivo inmutable. Hay tres fuentes vacías y dos alternates excluidos por selección humana. La referencia local `odd/artifacts/lyrics-standardization/REVIEW.md` no se distribuye; separa observaciones del payload actual, historia de fuentes, procedencia interna y alegaciones cerradas; su evidencia es específica de la instantánea y no una lista de 20 defectos actuales. La aprobación musical sigue pendiente, pero no bloquea planificar. Los mapas históricos y guardas no ejecutables no son fallos de letra ni una barrera general de lector/importación. La copia local externa de esta instantánea está sincronizada y verificada: 379 archivos coinciden por nombre y hash. No se implementaron aplicación, parser, exportaciones TXT ni importación.

## Próximo paso de producto

Diseñar e implementar por hitos la biblioteca compartida, preparación interna de servicio y lector público móvil. Hasta que exista un editor operativo, los artefactos actuales son el baseline editable; después, la aplicación mantendrá un ChordPro canónico por versión musical, no dos maestros manuales (archivo y base de datos). No materializar ni reinterpretar el corpus como condición previa. Una vista futura deriva texto de la fuente actual y de secciones/repeticiones conocidas del arreglo; nunca reproduce alcances archivísticos consumidos. Compatibilidad con `{Puente}` y notaciones locales debe advertirse/preservarse y resolverse antes de renderizar esos casos, no mediante una reescritura global. No se afirma generación de PDF ni implementación de app.

## Preguntas abiertas

No bloquean los requisitos confirmados; resolver al diseñar el producto:

1. ¿Qué colaborador(es) pueden editar el catálogo global, cómo se concede/revoca ese permiso y qué flujo resuelve cambios en una adaptación local?
2. ¿Cómo presentar diferencias y conflictos cuando una base cambia mientras una iglesia o servicio tiene overrides explícitos?
3. ¿Qué eventos constituyen uso confirmado y cómo tratar servicios cancelados, zonas horarias y cadencias mensuales? No establecer comportamiento hasta decidirlo.
4. ¿Qué políticas de caducidad/revocación se necesitan para enlaces públicos?
5. ¿Qué revisión editorial y musical gradual conviene ofrecer dentro del flujo de edición, sin convertir la cola histórica ni la aprobación global en condición para planificar o publicar otras canciones?
6. ¿Cuándo revisar necesidad de historial de letras, colaboración simultánea, trabajo offline, PDF extenso y caso de himnario impreso?

## Fuera de alcance actual

Implementación de app, autenticación/proveedores, esquema de base de datos definitivo, editor en tiempo real, offline completo, publicación remota de archivos y PDF completo. La copia local de referencia está sincronizada y verificada (379 archivos); esto no implica publicación remota ni implementación de la app. La app no está implementada.
