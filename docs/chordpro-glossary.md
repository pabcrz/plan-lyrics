# Guía rápida: ChordPro y repeticiones

Esta guía separa lo que entiende ChordPro, la notación propia de la colección y las acciones propuestas para un editor futuro. Estado de trabajo: 375 archivos `.cho` en 379 archivos; los 380 TXT originales son archivo inmutable, con tres fuentes vacías y dos alternates excluidos por selección humana. Los `.cho` actuales son una biblioteca editorial evolutiva, no un corpus congelado o aprobado musicalmente. La revisión distingue evidencia actual de historia archivística e interna; el antiguo conteo de 20 no describe defectos actuales. Las guardas históricas no ejecutables se preservan y no son una barrera general para planificar el lector. La copia local externa de esta instantánea está sincronizada y verificada: 379 archivos coinciden por nombre y hash. TXT solo letras y acordes encima son exportaciones futuras; importar TXT con acordes encima sigue siendo propuesta por priorizar, no función implementada.
La referencia local `odd/artifacts/lyrics-standardization/REVIEW.md` no se distribuye; contiene la revisión española de la colección.

## 1. ChordPro nativo

| Forma | Significado práctico |
| --- | --- |
| `[C]letra` | Acorde en línea, asociado a la posición de la letra que sigue. |
| `{title: Título}` | Metadato de título; `title` es la clave del metadato. |
| `{key: G}` | Metadato de tonalidad. |
| `{comment: ...}` | Directiva de comentario/notas, no una sección repetible. |
| `{start_of_chorus}` … `{end_of_chorus}` | Define el contenido de un coro. También se aceptan las formas cortas `{soc}` y `{eoc}`. |
| `{chorus}` | Recuerda el último coro definido anteriormente; no elige un coro por nombre. |
| `{chorus: Etiqueta}` | La etiqueta no selecciona un destino llamado «Etiqueta» ni crea una referencia nombrada. |

Un entorno vacío —por ejemplo, `{start_of_verse}` seguido inmediatamente de `{end_of_verse}`— no recuerda ni repite una sección previa. No hay que inventar un comando nativo general de referencia/repetición de versos.

Referencias oficiales: [directiva de coro](https://www.chordpro.org/chordpro/directives-env_chorus/) y [uso de ChordPro, incluida la salida solo de letras](https://www.chordpro.org/chordpro/using-chordpro/).

## 2. Notación de la colección: materializar, no ejecutar

En las fuentes de esta colección, delimitadores coincidentes `/` o `:` a ambos lados, o `xN`, indican **N copias físicas totales** del fragmento o bloque delimitado. N cuenta la aparición final, no N adicionales. Se conserva el orden del bloque completo; cualquier prefijo o sufijo fuera del límite aparece una sola vez.

La política canónica actual es materializar esas copias en la letra exportada. Es deliberado duplicar físicamente la letra para que cada aparición pueda recibir acordes distintos más adelante. Se conservan duplicados explícitos y variaciones armónicas ya existentes; no se inventan acordes ni se deduplican frases por igualdad de texto. Para anotación manual futura se prefiere `/` frente a `:`; no es una función automática/nativa de ChordPro.

No reemplazar globalmente puntuación ni interpretar cualquier dos puntos, barra o slash de bajo como repetición. Las copias materializadas ya son explícitas: la procedencia consumida debe registrarse como no ejecutable para que un sidecar no vuelva a aplicarla. Los originales de fuente permanecen inmutables. Materializar una ocurrencia delimitada no convierte `{chorus: x4}` en un contador.

**Ejemplo conceptual, sin acordes inventados:** un bloque contiene dos apariciones de «Nadie como Tú» y cuatro posiciones de acorde. Dos pasadas totales del bloque dan cuatro apariciones de la frase; «Jesús» aparece una vez fuera del bloque. No se deduce la asignación de acordes a las frases.

## 3. Acciones propuestas para un editor futuro

Las acciones de interfaz no son comandos ChordPro ni funcionalidades implementadas. Según las secciones definidas, el editor podría ofrecer: **Definir sección**, **Insertar sección**, **Repetir bloque**, **Agregar cierre** y **Crear variante**. Un cierre puede reutilizar «Coro» y añadir un cierre local; un coro con contenido diferente debe ser una variante, no una sustitución global de la definición anterior.

Las referencias de sección futuras deben usar IDs estables de aplicación, nunca índices de línea. Al exportar a ChordPro nativo, las referencias a secciones nombradas que el formato no soporte deben expandirse a contenido físico; no simularlas con comandos inventados.

## 4. Una fuente, dos vistas

Mantener un único archivo canónico con acordes. La vista de letras es derivada del mismo contenido parseado y oculta acordes; no mantener una copia de texto plano por separado. La CLI oficial documenta `--lyrics-only` (o `-l`) para suprimir acordes/diagramas/grillas. Ejemplo de referencia —no ejecutado; la CLI no está disponible localmente y no se instaló—:

```sh
chordpro --lyrics-only --output cancion-letras.cho cancion.cho
```

La salida de CLI no expande una notación personalizada `/` o `:`. Las copias ya materializadas sí son contenido explícito; una futura marca manual requerirá interpretación por un importador. Un lector web futuro puede ocultar acordes desde la misma fuente parseada.

También se prevén dos exportaciones TXT derivadas de ese único ChordPro: solo letras y acordes encima de las letras. La segunda usa disposición monoespaciada para conservar la posición de los acordes respecto de la letra; no es el formato ChordPro nativo ni una copia canónica adicional. La versión/arreglo efectivo y la tonalidad proceden de la misma fuente. `--lyrics-only` es una opción documentada de CLI, no una función TXT ya disponible en la aplicación.

Importar TXT con acordes encima de la letra y convertirlo a ChordPro es una **propuesta por validar**, no una función aprobada o implementada. Requeriría una vista previa de la alineación detectada, revisión de filas dudosas y confirmación antes de crear o actualizar una versión. No debe inferir acordes, ritmo o armonía, ni adivinar acordes a partir de palabras en mayúsculas. Debe conservar palabras, orden y acentos, y respetar los permisos de la biblioteca compartida; la prioridad sigue abierta.
