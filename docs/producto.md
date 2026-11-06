# Plan de producto — fuente oficial

Este documento es la única fuente oficial de requisitos, prioridades, alcance y funcionalidades previstas de Plan & Lyrics. Describe intención futura, no infraestructura ni funciones implementadas. La [propuesta técnica](propuesta-tecnica.md) es subordinada y no redefine el producto.

## Prioridad de producto

1. **Organizar servicios y calendario.** Planificar quién participa, quién dirige y qué ocurre, con permisos adecuados.
2. **Letras.** Incorporar letras estructuradas por secciones, variaciones y repeticiones.
3. **Acordes.** Preservar alineación y permitir transposición.

El repertorio de letras permanece local y no se publica en este repositorio por el momento. La calidad de un editor de ChordPro no debe desplazar la organización de servicios.

## Alcance previsto

### Etapa 1 — servicios y organización

- Trabajar dentro de la iglesia activa, determinada por el contexto de acceso de la persona. La jerarquía es iglesia → servicio (fecha, director y participaciones) → setlist → canciones (BPM, orden, letra y demás datos según su etapa). Crear un servicio no pide seleccionar ni registrar una iglesia: pertenece automáticamente a la iglesia activa.
- Crear servicios con título, fecha, hora de inicio opcional y estado (borrador, publicado, completado o cancelado); organizarlos en una vista tipo calendario.
- Incluir en la primera entrega creación de servicios en lote y generación automática de turnos. Cada servicio se puede completar después con su setlist manualmente; crear un lote no establece recurrencia automática.
- Designar dirección y participantes, asignando a cada persona un rol musical para ese servicio. No incluir confirmaciones de asistencia ni estados de aceptación o rechazo de asignaciones.
- Ordenar canciones y otros momentos del servicio; registrar tonalidad contextual y enlaces de referencia manuales a YouTube o Spotify. No se prevé integración automática con esos servicios.
- Diseñar primero para móvil, con límites de acceso aplicados correctamente en servidor.
- Presentar los calendarios con semanas de domingo a sábado.
- Distinguir **permisos de acceso** de **roles musicales**. Los accesos acordados se describen a continuación; ser baterista, guitarrista u otro participante no concede permisos de edición.

### Configuración general y fechas de servicio

- Configurar por iglesia su nombre y sus días habituales de reunión desde su panel general. Los días varían por iglesia; ejemplos acordados: martes/miércoles/viernes/domingo, jueves/domingo y viernes/domingo. Esta configuración no crea servicios recurrentes automáticamente.
- Usar la zona horaria de Ciudad de México (`America/Mexico_City`) para el calendario y la sugerencia de fechas. El 4 de noviembre citado durante el diseño es contexto del ejemplo, no una fecha fija del producto.
- Sugerir por defecto la fecha de reunión más cercana según los días configurados de la iglesia activa. Permitir crear un servicio especial en cualquier día de la semana, aunque no sea habitual. La inclusión de hoy cuando coincide con un día de reunión sigue pendiente.
- Actualmente las iglesias no celebran dos cultos el mismo día. Contemplar una opción de configuración general para domingos con servicio matutino y vespertino si una iglesia adopta esa costumbre; no imponer dos servicios por domingo ni crearlos automáticamente. Falta precisar cómo el lote selecciona una franja y cómo participan ambas en las rotaciones.
- Distinguir los días habituales de una fecha con un servicio ya registrado. La resolución de una colisión con un servicio existente sigue pendiente; no se adopta una prohibición global de varios servicios en una fecha.

### Personas y dirección del servicio

- Mantener un directorio de personas de la iglesia reutilizable para dirección y participaciones. Figurar en ese directorio no requiere una cuenta de acceso a la aplicación.
- Buscar y seleccionar personas existentes para evitar duplicados. Si una persona ya tiene una cuenta vinculada, reutilizar esa relación; no vincular cuentas automáticamente solo por coincidencia del nombre.
- Al ingresar una persona nueva, ofrecer guardar el nombre para próximas ocasiones, con esa opción activada por defecto; permitir desactivarla para usar el nombre solo en ese servicio. Los permisos concretos para dar de alta personas desde este recorrido siguen pendientes y no amplían por sí solos las capacidades del editor de servicios.

### Creación mensual en lote

- Dentro de la iglesia activa, seleccionar el mes y año y un día de la semana, por ejemplo viernes.
- Si se elige el mes actual, considerar solo las fechas de ese día que resten del mes; si se elige un mes futuro, considerar todas las fechas de ese día dentro del mes elegido. Esas son las fechas disponibles, no una obligación de crear servicios para todas ellas. El tratamiento de la fecha de hoy y de meses pasados queda pendiente.
- Asignar manualmente un director a cada fecha en orden cronológico. La referencia de interacción aceptada es la alternativa 04: pasos de período, directores por fecha y revisión; en móvil cada fecha aparece sobre su campo. Buscar personas existentes y tratar nombres nuevos según el directorio descrito arriba, sin exigir cuentas de acceso.
- Permitir lotes parciales: si hay cuatro fechas disponibles y se ingresan tres directores, pedir confirmación indicando que se crearán tres de cuatro servicios, en las primeras tres fechas consecutivas y en el orden ingresado. Tras confirmar, crear solo esos tres servicios; no crear un servicio sin director para la cuarta fecha ni generar participaciones para ella. Las fechas restantes quedan sin programar para resolverlas después, por ejemplo ante incertidumbre de Navidad o fin de año.
- Completar las participaciones mediante las asignaciones habituales y la modalidad de rotación configurada; agregar después el setlist manualmente.
- No crear una recurrencia permanente de servicios. La secuencia de personas sí continúa entre lotes y meses según la rotación configurada; no se reinicia al crear otro lote.

### Participaciones habituales y turnos

- Configurar roles musicales por iglesia, inicialmente batería, guitarra, piano y voces, presentados en orden alfabético. Permitir crear o eliminar roles; la política de eliminación cuando existen asignaciones previas queda pendiente.
- Configurar participaciones habituales y personas en rotación por iglesia y rol; no es una propiedad global de la persona. Cualquier rol puede tener asignaciones habituales o en rotación. Puede haber varias voces habituales.
- Al crear un servicio, individualmente o en lote, cargar las participaciones habituales y calcular a quién corresponde cada turno configurado.
- Elegir la modalidad por rotación dentro de cada iglesia: **por día de la semana**, con secuencias independientes, o **entre todos los servicios**, con una secuencia compartida sin importar el día. No imponer una sola modalidad para todos los roles de la iglesia.
- En modalidad por día, un domingo no avanza los turnos de viernes. En modalidad compartida, el orden Luis → Pedro → Juan produce Luis el viernes, Pedro el domingo, Juan el siguiente viernes y Luis el siguiente domingo. La preferencia inicial expresada por la persona usuaria es por día; no es una regla universal.
- Iniciar cada rotación manualmente desde un servicio o fecha de referencia, eligiendo las personas y su orden y, en modalidad por día, el día al que pertenecen. Repetir el orden de manera cíclica entre lotes y meses hasta interrumpirlo manualmente o cambiar el orden. El efecto sobre servicios ya generados de un cambio posterior de orden sigue pendiente.
- Registrar como máximo un rol musical por persona dentro de un mismo servicio. Una persona puede alternar entre roles en otros servicios y participar en distintas iglesias; no es una restricción global de su identidad.
- Cantar mientras se toca piano/teclado o guitarra no requiere una segunda asignación a voces. En esos casos basta la asignación al instrumento: el sistema no necesita configurar ni registrar aparte ese canto habitual.
- Evitar que las participaciones habituales o las rotaciones asignen a la misma persona a dos roles del mismo servicio. Si coinciden dos propuestas, la resolución concreta sigue pendiente; no se inventa una prioridad entre roles.
- Permitir cambiar manualmente las asignaciones generadas ante ausencias o compromisos. La acción predeterminada es **reemplazar solo en este servicio**: cambia esa asignación sin reordenar los turnos siguientes.
- Ofrecer **intercambiar turnos** como alternativa explícita dentro del mismo rol, mostrando las dos fechas y personas afectadas antes de confirmar. Por ejemplo, Luis el viernes 6, Pedro el 13 y Juan el 20 puede quedar Pedro el 6, Luis el 13 y Juan el 20 tras confirmar el intercambio de Luis y Pedro. No ejecutar el intercambio como efecto oculto de un reemplazo.

### Accesos acordados

La administración de una iglesia y la edición de la biblioteca compartida son responsabilidades independientes. Una persona puede combinar accesos; por ejemplo, ser administradora de una iglesia y editora de biblioteca. Ninguno de esos dos accesos implica el otro.

| Acceso | Alcance acordado |
| --- | --- |
| Superadministrador | Existe uno solo: la persona propietaria del proyecto. Tiene acceso total a la plataforma, a todas las iglesias y a la biblioteca musical compartida, y puede modificar todos los roles. Ningún otro nivel equivale a este acceso global. |
| Administrador de iglesia | Gestiona personas, servicios, asignaciones y configuración de su iglesia. No obtiene automáticamente permiso para editar la biblioteca compartida. |
| Editor de biblioteca (editor general) | Crea y modifica canciones compartidas, sus letras y acordes. No administra iglesias ni usuarios salvo que tenga también el acceso correspondiente. |
| Editor de servicios | Crea y edita servicios, fechas, dirección, participantes y setlists, y ajusta tonos dentro de su iglesia. No administra miembros, accesos ni configuración de iglesia, ni obtiene automáticamente edición de la biblioteca compartida. |
| Integrante | Consulta la información interna que le corresponda, sin editar. |

El acceso público mediante enlace no requiere cuenta y se limita al setlist y las letras publicables. Estos accesos no crean bibliotecas separadas por iglesia ni adelantan letras o acordes a la primera etapa. Queda pendiente definir quién otorga el acceso de editor de biblioteca y completar las capacidades no especificadas.

### Etapa 2 — letras

Incluir estructura de intro, estrofa/verso, coro, puente, outro y cierre; permitir variaciones y repeticiones sin perder el orden musical. Mantener una sola fuente ChordPro y derivar de ella distintas vistas.

### Etapa 3 — acordes

Preservar la relación entre letra y acordes, permitir transposición respetando modo mayor/menor y ofrecer herramientas de edición de acordes. El editor avanzado no es prioridad de la primera etapa.

### Requisitos transversales

- Biblioteca musical compartida; no clonar canciones por iglesia o servicio como requisito.
- Adaptaciones opcionales de iglesia y servicio heredan de la base. Los cambios heredados siguen vigentes incluso en contenido publicado; los overrides explícitos se conservan. No se exigen snapshots ni clones obligatorios.
- La edición editorial global es distinta de la administración local de iglesia.
- Un setlist público de servicio y sus letras podrán consultarse sin iniciar sesión. La vista pública no expondrá datos personales, listas de miembros, tonalidades internas, asignaciones privadas, BPM, acordes ni notas internas.
- La rotación futura de canciones por iglesia se basa en uso confirmado de la canción, no de una versión concreta. Es distinta del generador de turnos de personas. Política de registro de uso/cancelación, zona horaria y cadencia aún por decidir.
- Exportaciones TXT son futuras. La importación de TXT con acordes encima es opcional y no confirmada.

## Fuera de las primeras etapas

No ampliar la primera entrega con confirmaciones de asistencia, servicios recurrentes automáticos, modo offline, colaboración en tiempo real, IA, aplicación nativa, sincronización automática con plataformas musicales ni editor avanzado. Estos no son requisitos de la primera etapa.

## Criterios verificables para el futuro

- Un editor de servicios puede crear un servicio fechado dentro de la iglesia activa sin volver a indicar la iglesia; un integrante no puede crearlo.
- Se pueden crear servicios en lote con participaciones generadas y completar sus setlists manualmente después.
- Un lote mensual incluye solo las fechas del día elegido que resten del mes actual, o todas las del mes futuro elegido, y asigna directores en el orden ingresado.
- Los turnos respetan la modalidad configurada por rotación: independiente por día o compartida entre servicios; las participaciones generadas pueden corregirse manualmente.
- Una persona puede ordenar canciones y otros momentos y asignar participantes con su rol musical, sin que dicho rol conceda permisos de edición.
- Existe un único superadministrador, correspondiente a la persona propietaria del proyecto, con acceso total a todas las iglesias y capacidad de modificar todos los roles.
- Un administrador de iglesia sin acceso editorial global no puede modificar la biblioteca compartida.
- Un editor de biblioteca sin acceso administrativo no puede administrar iglesias ni usuarios; una persona con ambos accesos puede ejercer cada uno en su ámbito.
- Un editor de servicios puede preparar setlists y ajustar tonos de su iglesia sin modificar la biblioteca compartida; un integrante no puede editar.
- Un enlace público permite consultar el setlist sin cuenta y no revela asignaciones privadas, BPM, acordes o notas internas.
- En etapas posteriores, una modificación heredada se refleja donde no exista override y un override explícito permanece intacto.
- En etapas posteriores, la vista de letras y la vista con acordes derivan de una misma fuente; la transposición conserva alineación.

Son criterios futuros; no se ha implementado ni probado la infraestructura.

## Decisiones de producto abiertas

- Precisar el lote mensual: inclusión de hoy, meses pasados, colisiones con servicios existentes, más directores que fechas, ausencia de directores y resolución de homónimos. Precisar permisos para guardar personas nuevas desde la asignación de dirección. La zona horaria, el recorrido por fecha y la separación entre personas y cuentas ya están acordados.
- Concretar resolución de coincidencias entre asignaciones habituales o rotaciones que propongan a una persona en dos roles del mismo servicio, sin duplicar su asignación. La regla de un solo rol registrado y el canto junto al instrumento ya están acordados. Precisar elección de las franjas dominicales matutina/vespertina en lotes y rotaciones, servicios creados fuera de orden, cancelaciones y efecto de cambiar el orden sobre servicios ya generados. El inicio manual, la continuidad cíclica y la distinción entre reemplazo de una fecha e intercambio explícito ya están acordados.
- Confirmar la propuesta de varios bloques de alabanza, cada uno con su setlist, dentro de un único servicio para ocasiones como bautizos. No confundir ese caso con dos cultos independientes ni adelantar la entrega de setlists.
- Definir la eliminación de roles con asignaciones existentes y completar capacidades no especificadas. ¿Quién otorga el acceso de editor de biblioteca?
- ¿Cómo se confirma el uso real de una canción y cómo afectan cancelaciones, zonas horarias y cadencias a la rotación?
- ¿Qué reglas tendrá la publicación y revocación del enlace público?
- ¿Qué alcance tendrá la importación de TXT con acordes encima?

## Relación con la propuesta técnica

La propuesta de arquitectura, stack y prueba de compatibilidad de despliegue está en el [documento técnico](propuesta-tecnica.md). Las convenciones esenciales de formato están en la [guía ChordPro](guia-chordpro.md).
