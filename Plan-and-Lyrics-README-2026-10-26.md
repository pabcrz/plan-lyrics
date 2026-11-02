# Plan & Lyrics

**Visión, alcance y arquitectura propuesta · 26 de octubre de 2026**

Aplicación mobile-first para planificar servicios musicales de iglesias, organizar setlists, definir la interpretación de cada canción y compartir información útil con músicos, dirección, proyección y participantes. El flujo principal es preparar un servicio; la biblioteca musical lo hace reutilizable.

> **Estado:** especificación y propuestas, no aplicación implementada. El nombre e identidad visual siguen abiertos. La estandarización de repertorio descrita al final es un entregable de datos provisional, separado del producto.

## 1. Objetivo y principios

Plan & Lyrics debe ayudar a responder: qué canciones y momentos tendrá el próximo servicio y en qué orden; qué versión, tonalidad y BPM se usarán; qué secciones se omiten, mueven o repiten; quién participa con qué rol; y cómo consulta cada participante el plan.

1. **Primero el servicio y el setlist.** Crear, ordenar, ajustar y consultar un servicio es el recorrido central.
2. **Una estructura musical autoritativa, varias perspectivas de conteo.** Distinguir apariciones de letra, pasajes/bloques armonizados y vueltas del arreglo; conservar las repeticiones y variaciones explícitas.
3. **Base con excepciones opcionales.** Heredar valores y guardar solo los ajustes explícitos de iglesia o servicio.
4. **Móvil primero, lectura clara.** Prioridad teléfono, luego tablet y escritorio.
5. **Seguridad en servidor.** Lectura pública y permisos de edición son capacidades diferentes.
6. **Implementación proporcionada.** Monolito modular propuesto; no microservicios ni infraestructura compleja sin necesidad.

## 2. Biblioteca, versiones y herencia

### Biblioteca compartida

El repertorio inicial vive en una base musical compartida, no en bibliotecas privadas por iglesia. El origen de una canción en una iglesia no da propiedad ni permiso editorial. Los cambios a la base corresponden a colaboradores autorizados (por ejemplo, usuario/ayudante designados); el rol de administrador de iglesia no concede automáticamente edición global. Leer letras públicas no concede permiso de edición. La membresía de iglesia y la autorización editorial global son ámbitos distintos.

No se exige clonar canciones/versiones por iglesia o servicio. Capas propuestas y opcionales:

```text
Contenido/versiones de la base musical
  └── adaptación opcional de iglesia
       └── ajustes opcionales de una canción en un servicio
```

Cada capa hereda cuando no tiene override. Los cambios heredados se propagan automáticamente, incluso a servicios publicados; los overrides explícitos de niveles inferiores permanecen. Publicar no crea configuración congelada, snapshot obligatorio ni historia musical inmutable para el MVP. Proteger escrituras concurrentes contra pérdida de actualización mediante control optimista simple; colaboración en tiempo real queda fuera inicialmente.

### Canción y versión musical

Una canción representa la obra; una versión, una interpretación/arreglo de referencia. Campos conceptuales útiles, aún por validar: título y títulos alternos, autor, notas, estado, artista de referencia, tonalidad original, tonalidad base preferida, BPM, compás, duración, enlaces y arreglo. Una misma canción puede tener versiones distintas; no se crea una versión nueva solo para usarla en otra iglesia o fecha.

La tonalidad original es la que codifican los acordes ChordPro. La iglesia puede mantener una tonalidad base preferida distinta; el servicio puede elegir una tonalidad contextual. La UI compacta puede usar **Base** y **Servicio**, sin explicación verbosa en el lector. Los BPM también pueden tener valor de versión/base y override de servicio. Una transposición automática de acordes es requisito de la preparación musical inicial, no un stretch futuro; debe preservar alineación letra-acorde y modo mayor/menor. El corpus actual no tiene acordes inventariados; esta función no se presenta como ya probada.

### Estructura y apariciones

La estructura musical autoritativa distingue tres perspectivas: apariciones de una frase/letra, pasajes o bloques armonizados, y vueltas (passes) del arreglo. Un bloque puede cubrir varias apariciones de letra con acordes alineados; las vueltas repiten el bloque conforme a su progresión real. Igualdad de palabras no implica igualdad de acordes ni de composición. Conservar repeticiones explícitas y variaciones de acordes/alineación; reutilizar solo pasajes musicales verdaderamente idénticos, sin deduplicación basada solo en texto. Coros finales con contenido o armonía diferentes no se aplanan en una misma referencia.

Ejemplo de ensayo EN TU LUZ: **un bloque** contiene dos apariciones de “Nadie como Tú”, cubiertas por una progresión de cuatro acordes; dos vueltas totales de ese bloque producen cuatro apariciones de la frase. Después, “Jesús” aparece una vez fuera del bloque. Conteo: **2 vueltas del bloque · 4 apariciones de la frase**; no se infieren nombres/distribución de acordes, compases, duración ni que cada aparición tenga la misma armonía. Una vista de teclado/guitarra puede enfatizar acordes y una de voz/batería las frases o entradas; ambas reflejan el mismo arreglo ordenado y sus conteos reales, sin cantidades codificadas por rol. Una repetición anidada debe expandirse a cuatro frases conservando la progresión de acordes de cada vuelta.

Al preparar un servicio se puede partir de la estructura heredada y agregar, omitir, repetir o reordenar referencias. La estructura opcional de servicio no altera el arreglo base. La interfaz de edición prevista ofrece vista previa, restablecimiento a la base, controles mover arriba/abajo además de drag & drop, y edición separada del contenido canónico. Estos son requisitos propuestos, no capacidades presentes. No se prescribe esquema de base de datos/API, ni se exige una nueva SongVersion o clonar secciones por cada aparición de letra.

## 3. ChordPro e importación musical

ChordPro es el formato canónico de letras, acordes y metadatos compatibles; Holyrics es solo una pista de formato de entrada, no la salida canónica. Las líneas semánticas de letra no dependen de cortes antiguos de diapositiva 3:4 ni del reflujo del lector. Preservar palabras, ortografía, puntuación, mayúsculas, acentos y orden. No inventar letras/acordes/secciones ni hacer correcciones gramaticales.

La política canónica vigente para fuentes usa delimitadores coincidentes `/` o `:` a ambos lados, o `xN`, para materializar **N copias físicas totales** del fragmento/bloque: N cuenta una pasada final, no N adicionales. Se conserva el orden del bloque; prefijos y sufijos parciales aparecen una sola vez. La duplicación física prepara futuras variaciones de acordes; se preservan duplicados explícitos y variaciones armónicas existentes, sin inventar acordes. Para notación manual futura se prefiere `/`, no como expansión automática de ChordPro. No reinterpretar globalmente puntuación, metadatos con dos puntos ni slash de bajo. `//(E1)` es encabezado, no repetición; `{chorus: x4}` no cuenta automáticamente. Los originales son inmutables y la procedencia de repeticiones consumidas debe marcarse no ejecutable para impedir una segunda aplicación del sidecar. La política está definida, pero no implica conversión nueva del corpus.

Mantener un solo ChordPro canónico con acordes y derivar la vista de letras desde esa misma fuente. La CLI oficial documenta `--lyrics-only`/`-l` para ocultar acordes, diagramas y grillas; la CLI no está disponible localmente, así que cualquier comando de ejemplo es solo referencia, no una ejecución ni una instalación. Esa opción no expande marcas personalizadas `/` o `:`; copias materializadas ya explícitas sí se conservan y una futura marca manual necesitará importador. Una futura vista web puede ocultar acordes del mismo parseo. Ver la [guía rápida ChordPro](docs/chordpro-glossary.md) para directivas nativas, notación de colección y acciones propuestas de editor. El editor futuro podría definir/insertar secciones, repetir bloques, agregar cierres locales o crear variantes; usaría IDs estables de aplicación, no índices de línea. Cierres pueden reutilizar Coro más un cierre local; variantes no reemplazan globalmente la sección. Exportar referencias no nativas expandiéndolas, nunca inventando comandos.

### Exportación de texto e importación futura

Se prevén dos exportaciones TXT derivadas del único ChordPro canónico: solo letras y acordes encima de las letras. La disposición monoespaciada conserva la alineación visual; no se mantienen letras duplicadas por separado. La versión/arreglo efectivo y la tonalidad forman parte de la misma fuente canónica. ChordPro nativo sigue disponible como formato distinto; `--lyrics-only` es una opción documentada de CLI, no evidencia de que la aplicación ya exporte TXT.

**Propuesta por validar, fuera de las funciones confirmadas del MVP:** importar TXT con acordes encima de la letra y convertirlo a ChordPro. Antes de crear o actualizar una versión, mostrar una vista previa de la alineación detectada y permitir corregir filas dudosas. No inferir acordes, ritmo ni armonía, ni clasificar palabras en mayúsculas como acordes mediante una regla simple. Conservar palabras, orden y acentos; respetar los permisos de la biblioteca compartida. La prioridad permanece abierta.

La representación separa contenido editorial de procedencia y reglas de reproducción. El manifiesto conserva historia consumida y guardas no ejecutables; esas cantidades no son repeticiones pendientes ni fallos de letra. La referencia local `odd/artifacts/lyrics-standardization/REVIEW.md` no se distribuye; distingue observaciones de una instantánea, archivo de fuentes, controles internos y alegaciones cerradas; el antiguo titular de 20 casos no representa defectos actuales. Las fuentes originales permanecen intactas. La aprobación musical sigue pendiente, pero no bloquea planificar el sistema. La copia local externa de esta instantánea está sincronizada y verificada: 379 archivos coinciden por nombre y hash. TXT solo letras y acordes encima son salidas futuras; importar TXT con acordes encima es una propuesta pendiente. No hay parser, aplicación ni exportación TXT implementados.

## 4. Servicios, setlists y agenda

Los servicios pueden ser jueves, viernes, domingo, reunión en casa o evento especial, con título libre. Campos conceptuales: iglesia, título, fecha, hora de inicio opcional, estado (borrador/publicado/completado/cancelado), notas y equipo opcional. Un setlist ordena elementos de canción y otros momentos: oración, mensaje, nota u otro; cada elemento puede tener título, posición, notas, duración opcional y, para canciones, versión, tonalidad/BPM/estructura opcionales.

Recorrido de dirección propuesto:

1. Crear servicio y fecha/hora.
2. Añadir canciones y otros momentos; ordenar el setlist completo.
3. Elegir versión y ajustar tonalidad/BPM cuando haga falta.
4. Usar estructura heredada o modificar referencias de sección.
5. Revisar y publicar; compartir la vista correspondiente.

No crear canción, versión ni letra nueva cada domingo. Un elemento de servicio apunta a su versión; solo guarda selección y overrides expresos. Roles ministeriales y asignaciones pueden cambiar por servicio.

### Reutilización de canciones

Cada iglesia decide política mediante tiempo/cadencia temporal o número de servicios intermedios, y elige advertencia o bloqueo. Ejemplo de tres servicios intermedios: canción usada viernes; luego domingo, viernes y domingo sin usarla; elegible el viernes siguiente. El uso se cuenta por iglesia+canción, independientemente de versión e historial musical; cambiar versión no reinicia el contador. Persistir uso real confirmado, no mera planificación. Cuándo se confirma y cómo tratar cancelaciones, zonas horarias o definiciones de periodo mensual permanecen abiertos a diseño; no anticipar reglas no decididas.

## 5. Personas, equipos y roles

Personas pueden tener cuenta o ser participantes sin cuenta. Una cuenta única puede pertenecer a más de una iglesia, pero eso no crea bibliotecas musicales privadas. En cada iglesia, roles de aplicación (por ejemplo owner, admin, editor, viewer) definen permisos organizativos; son distintos de roles ministeriales como batería, bajo, teclado, guitarra, vocalista, líder de alabanza, proyección o sonido. La misma persona puede tener varios roles ministeriales, y desempeñar funciones distintas según equipo/servicio. Un rol ministerial nunca concede automáticamente permiso de edición.

El alcance original de planificación contempla equipos, integrantes y asignaciones por servicio con estado sencillo (pendiente/confirmado/declinado) y notas opcionales; la colaboración avanzada, reemplazos y flujos sofisticados de confirmación pueden esperar. El director puede asignar quién participa y el rol ministerial específico para ese servicio. La administración global de la biblioteca continúa separada de estos roles locales.

## 6. Lectura, publicación y privacidad

### Lector público

Setlist y letras específicos del servicio accesibles sin login mediante enlace/QR publicado. El lector público prioriza teléfono, también refluye en tablet/escritorio, permite ajuste de tamaño/zoom y muestra letras en estructura legible con repeticiones expandidas. La vista pública puede expandir letras; la vista armónica privada conserva los acordes y alineación necesarios. No expone claves internas, BPM, acordes, asignaciones ni notas administrativas. No revela datos personales ni listas de miembros. La lectura pública no concede edición. PDF es una alternativa opcional secundaria para uso sin conexión; no se requiere app offline completa. El himnario impreso es una posibilidad futura, no entrega actual.

La publicación es viva: contenido heredado actualizado se refleja, excepto donde existan overrides explícitos. No se congela la configuración ni se requiere snapshot inmutable de letras. Esta decisión sustituye la propuesta previa de conservar una configuración musical publicada congelada.

### Acceso privado

Músicos/equipo autorizado consultan preparación interna mínima y los datos musicales/roles necesarios para su función. La proyección puede usar una cuenta de consulta cuando se necesite acceso privado; congregación usa enlace público sin cuenta. Los enlaces deben tener identificadores no predecibles, posibilidad de revocación y controles de qué se publica. La UI puede ocultar acciones, pero permisos deben aplicarse y verificarse en backend; nunca confiar en un `userId`, rol o `organizationId` proporcionado por el cliente.

## 7. Alcance del MVP y exclusiones

### Prioridad propuesta

Preparación musical mínima con importación revisable, permisos de colaboración globales y transposición; crear y ordenar servicios/setlists; consulta pública sin login; overrides opcionales con herencia viva; administración esencial de iglesias/personas/roles necesaria para seguridad y asignaciones.

### Fuera del MVP inicial

IA integrada; editor avanzado de notación/diagramas; sincronización de diapositivas en tiempo real, WebSockets persistentes o colaboración simultánea; notificaciones push y reemplazos avanzados; estadísticas avanzadas; aplicación nativa; integración automática Spotify/YouTube; permisos arbitrarios; historial inmutable/revisiones completas de letras; modo offline completo; exportaciones avanzadas o PDF extenso; Nashville Number System. No duplicar biblioteca por iglesia como solución por defecto. Puede reevaluarse por evidencia de necesidad.

## 8. Propuesta técnica (no implementación ni decisión irrevocable)

### Stack que figuraba en la planificación original

| Capa | Propuesta/estado indicado en la especificación | Papel previsto |
| --- | --- | --- |
| Web | React + Vite + TypeScript; React Router; TanStack Query; Tailwind CSS; shadcn/ui | SPA mobile-first, navegación, consultas y componentes accesibles |
| Ordenamiento | dnd-kit, propuesta | Reordenar setlists/secciones, siempre con alternativa accesible |
| Identidad | Clerk, propuesta | Identidad/sesiones; no determina permisos de biblioteca |
| API | NestJS REST | Reglas de negocio y autorización en servidor |
| Persistencia | Prisma + PostgreSQL; Neon preferido pendiente de confirmación | Persistir dominio; React no conecta directamente a SQL |
| Hosting | Cloudflare Pages para frontend; Vercel Functions para NestJS, sujetos a prueba | Dos despliegues desde un repositorio |
| Cliente instalable | PWA propuesta | No implica offline completo |

La configuración de proveedores, precios, planes, dominios y despliegue requiere validación antes de producción. Nada de esta tabla afirma infraestructura creada.

### Modelo conceptual propuesto

```text
Identidad de usuario
  └── membresías de iglesia y permisos locales
Personas / roles ministeriales / equipos
Base musical compartida
  └── canción → versiones → secciones ChordPro únicas → arreglo base por referencias
       └── adaptación opcional de iglesia (overrides)
Servicios por iglesia
  └── elementos ordenados → versión/ref. musical + overrides opcionales
       └── asignaciones ministeriales y uso confirmado
Enlace público revocable → vista derivada limitada
```

El esquema exacto queda por diseñar. Entidades conceptuales previamente consideradas: perfiles, membresías, personas, roles, equipos, canciones/versiones/secciones/enlaces, servicios/elementos/asignaciones y enlaces públicos. No se exige tabla/campo específico ni una nueva organización/tenant para cada iglesia. IDs estables identifican secciones; las referencias de arreglo deben validar pertenencia a versión. Datos compartidos requieren autorización editorial explícita; servicios y asignaciones respetan acceso de su iglesia.

### Seguridad y arquitectura

Arquitectura prevista: monolito modular con frontend/API separados. React llama a NestJS por HTTPS, nunca a PostgreSQL. Clerk verifica identidad/sesión; la aplicación autoriza acciones y recursos con permisos correspondientes. Prisma accede a PostgreSQL desde backend. DTOs/validaciones deben rechazar datos inválidos y validar permisos en cada operación. CORS restringido a orígenes aprobados; secretos solo en backend. Enlaces públicos limitados al contenido autorizado y revocables. Evitar almacenar datos sensibles en URLs. Mantener pruebas de aislamiento y autorización al implementar.

Carpetas tentativas del monorepo: `apps/web`, `apps/api`, `packages/music` (ChordPro y lógica musical) y `packages/contracts` (tipos/validaciones). npm workspaces sin Nx/Turborepo inicialmente; ubicaciones y scripts son guía, no estructura creada. Parser/serializador/transposición deben ser módulos sin dependencia del DOM.

### Despliegue originalmente previsto

GitHub como repositorio; Cloudflare Pages compila la SPA y Vercel ejecuta API NestJS; PostgreSQL gestionado (Neon opción preferida pendiente); Clerk para identidad. API y frontend separados por HTTPS. Revisar compatibilidad real de NestJS/Prisma con funciones serverless, conexión agrupada, tiempos de arranque, empaquetado, variables y versiones antes de adoptar. No ejecutar migraciones en cada arranque ni preview; separar entornos y credenciales; despliegue de migraciones controlado y respaldos antes de datos importantes. Frontend no recibe claves secretas. Dominios, planes de pago y condiciones comerciales de hosting requieren evaluación vigente. Todo lo anterior es propuesta técnica, no infraestructura desplegada.

## 9. Primer recorrido y orden de desarrollo

El MVP recorre una cadena verificable: **biblioteca compartida → preparación interna → lector público móvil**.

1. **Biblioteca:** buscar/seleccionar canción y versión con ID estable (el filename no es identidad); inspeccionar y editar ChordPro con autorización editorial global. Una versión musical tiene una fuente canónica editable. No fusionar automáticamente títulos o letras parecidos.
2. **Preparación interna:** crear iglesia y servicio; añadir/ordenar canciones y otros momentos; elegir versión, tonalidad original, base de iglesia y tonalidad de servicio; transponer preservando calidad y alineación; definir overrides opcionales; asignar personas y roles ministeriales con autorización separada. Mostrar reutilización por iglesia+canción, también entre versiones; configurar intervalo o número de servicios intermedios (ejemplo: tres) y advertencia/bloqueo por iglesia.
3. **Lector público:** enlace/QR revocable sin login; vista móvil del setlist y letras derivadas del arreglo actual. Nunca exponer acordes, BPM, claves internas, asignaciones ni notas privadas.

**Aceptación:** solo colaboradores globales autorizados editan la biblioteca; admin de iglesia no hereda ese permiso. Herencia compartida→iglesia→servicio es opcional; overrides explícitos sobreviven y cambios heredados se propagan incluso a servicios publicados. Sin clones obligatorios ni snapshots inmutables. Confirmación del uso real queda por decidir. Roles rotan por servicio. TXT solo letras y TXT con acordes encima son exportaciones futuras confirmadas; importar TXT con acordes encima sigue siendo propuesta. PDF completo/offline queda para después. No escoger almacenamiento ni stack definitivo prematuramente. Ver hitos y criterios en [docs/plan.md](docs/plan.md).

## 10. Preguntas abiertas

- ¿Quién concede/revoca autorización editorial global y cómo se revisan cambios al repertorio compartido?
- ¿Cómo resolver diferencias entre base compartida y overrides de iglesia/servicio sin perderlos?
- ¿Qué evento confirma uso real de una canción y qué significa un periodo mensual/cadencia temporal? ¿Cómo afectan cancelaciones y zonas horarias?
- ¿Qué vigencia, privacidad y revocación requieren enlaces públicos?
- ¿Qué nivel de historial de contenido musical se justificará después del MVP?
- ¿Cuándo habrá evidencia para colaboración simultánea, offline completo, exportaciones avanzadas o app nativa?
- ¿Qué proveedor PostgreSQL y configuración de despliegue superan las pruebas de coste, compatibilidad y rendimiento?

Las preguntas técnicas pendientes no rebajan ni bloquean decisiones confirmadas descritas arriba.

## 11. Estado del repertorio y sincronización

La carpeta actual contiene 375 `.cho` en 379 archivos. Son una biblioteca editorial evolutiva, no perfecta, congelada ni aprobada musicalmente; pueden mejorarse incrementalmente mientras se planifica. Los 380 TXT originales son archivo inmutable, con tres fuentes vacías y dos alternates excluidos. No son un objetivo de corrección.

La referencia local `odd/artifacts/lyrics-standardization/REVIEW.md` (no distribuida) informa observaciones de una instantánea con filename, línea, cita y hash, separadas de historia de fuentes y procedencia interna. Mapas antiguos de archivos editados son históricos, no actuales; no se reconstruye equivalencia ni se reejecuta procedencia. Guardas legítimas permanecen explícitas/no ejecutables, sin ser barrera universal de lector, importación o planificación. Ni reconciliación completa de fuentes ni aprobación musical global bloquean el plan. La copia local externa de esta instantánea está sincronizada y verificada: 379 archivos coinciden por nombre y hash. El PDF piloto no se modifica. TXT, importación y aplicación siguen sin implementar.
