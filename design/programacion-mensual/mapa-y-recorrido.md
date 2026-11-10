# Programación mensual — mapa y wireframes iniciales

**Propuesta para revisar, no diseño aprobado ni aplicación implementada.** Vinculado a [INI-002](../../docs/issues/INI-002-disenar-recorrido-inicial.md), [HU-001](../../docs/historias-de-usuario/HU-001-configurar-participaciones.md), [HU-002](../../docs/historias-de-usuario/HU-002-programar-servicio.md), [HU-003](../../docs/historias-de-usuario/HU-003-crear-servicios-en-lote.md), [HU-004](../../docs/historias-de-usuario/HU-004-ajustar-turnos.md) y [HU-005](../../docs/historias-de-usuario/HU-005-consultar-calendario.md). El [producto](../../docs/producto.md) conserva la autoridad funcional.

## Pregunta principal

¿Qué fechas voy a programar, quién dirige cada una y qué queda pendiente?

El elemento propio del producto es la correspondencia **fecha → director → participaciones**, con la cuarta fecha explícitamente sin crear cuando se confirman tres nombres. No hay métricas decorativas, repertorio privado ni elección repetida de iglesia.

## Mapa propuesto

| Vista | Objetivo y contenido | Acciones según acceso | Salida |
| --- | --- | --- | --- |
| Calendario de Betel | Mes, servicios y fechas aún no programadas; en móvil se prioriza una agenda por fecha. | Administrador/editor: crear lote o servicio individual. Integrante: abrir detalle. | Lote, creación individual o detalle. |
| Lote: período | Mes/año y día semanal, con iglesia activa visible pero no editable. | Administrador/editor: elegir período y revisar fechas disponibles. | Ingresar directores o cancelar. |
| Lote: directores | Correspondencia cronológica de nombres y fechas, sin inventar identidades existentes. | Administrador/editor: completar primeras fechas, editar el orden y revisar. | Resumen de lote completo o parcial. |
| Confirmación | Cantidad a crear, fechas/directores, última fecha sin crear y aviso de participaciones de ejemplo. | Administrador/editor: volver para corregir o confirmar. | Resultado y servicios en calendario. |
| Detalle del servicio | Fecha, dirección y roles ordenados batería, guitarra, piano y voces. Setlist solo como pendiente de su entrega. | Administrador/editor: reemplazar participación. Integrante: consultar sin controles de escritura. | Volver al calendario o guardar cambio simulado. |
| Creación individual | Fecha y director dentro de Betel; mismas composiciones de campos. | Administrador/editor: crear. | Detalle/calendario. Alcance mostrado como boceto, no formulario implementado en estas alternativas. |
| Configuración de participaciones | Habituales, personas en rotación y modalidad de cada rotación. | Administrador: gestionar; editor/integrante no administran configuración general. | Regresar a programación. En este prototipo es un resumen de referencia, no un editor implementado. |

El superadministrador puede administrar la plataforma; no se amplía aquí su interfaz global. El editor de biblioteca sin membresía/capacidad local no obtiene edición de servicios por su permiso editorial. La experiencia pública y la configuración completa se diseñarán aparte.

## Tres alternativas del mismo recorrido

| Archivo | Organización | Ventaja y costo |
| --- | --- | --- |
| `01-pasos-guiados.html` | Agenda de entrada y creación dividida en período, directores y revisión. | Recomendada para primera vez y móvil; requiere más avances entre pasos. |
| `02-tabla-por-fechas.html` | Fechas y campos de director en una misma hoja editable, con confirmación separada. | Correspondencia directa y carga rápida; exige explicar huecos y se apila en móvil. |
| `03-agenda-con-panel.html` | Agenda junto al formulario y revisión, en dos columnas; una columna en móvil. | Conserva el contexto mensual; menos espacio para formularios en escritorio estrecho. |

Las alternativas 01–03 se conservan como historial de comparación. La persona usuaria prefirió combinar pasos guiados con tabla por fechas y autorizó la alternativa 04 descrita a continuación; luego confirmó: “y si, acepto la 4”. Queda aceptada como referencia del recorrido, con prioridad móvil, no como implementación productiva ni aprobación de reglas pendientes. Son wireframes, no implementaciones productivas.

## Cuarta alternativa: pasos + fechas, móvil primero

[04-pasos-y-fechas-mobile.html](04-pasos-y-fechas-mobile.html) combina período → directores por fecha → revisión. La pantalla de directores muestra una fila con etiqueta de fecha y campo de nombre; en móvil se apilan, sin tabla horizontal. Acciones de ancho completo y controles de al menos 44 px; el calendario queda como contexto desplegable, no delante del formulario. En escritorio se amplía la composición sin cambiar el recorrido.

Corrección reportada: “hoy es 4 de noviembre, pero solo puedo registrar del 16 en adelante”. El corte venía de la referencia ficticia 15/11 de los primeros ejemplos, no de una regla del producto. La alternativa 04 usa **4/11/2026** y abre noviembre por defecto: viernes **6, 13, 20 y 27**; jueves **5, 12, 19 y 26**; domingos **8, 15, 22 y 29**. Diciembre conserva todas las fechas del día seleccionado. No se añade una anticipación mínima de doce días ni se resuelve la inclusión de hoy o la zona horaria.

Sus calendarios empiezan por **domingo**, con fechas alineadas a sus columnas. La referencia y el carácter ficticio están visibles. Las alternativas anteriores no se reescriben: conservan su referencia del 15 y su disposición inicial, por lo que no son la especificación vigente de calendario.

La prioridad móvil ya figuraba en el producto y se reafirma para el proyecto, no solo para esta pantalla. La semana de domingo a sábado queda registrada en el producto.

## Datos y límites de la simulación original (01–03)

- Fecha de referencia fija: 15 de noviembre de 2026, visible en herramientas de revisión. No se consulta el reloj real ni se decide la zona horaria del producto.
- Escenario inicial: viernes de diciembre de 2026, días 4, 11, 18 y 25. Ana, Luis y Marta dirigen las primeras tres fechas; el 25 queda sin crear. Son nombres ficticios de demostración, no miembros importados.
- Noviembre muestra solo fechas posteriores a la referencia; es un ejemplo ilustrativo del mes actual, no resolución de la inclusión de hoy. Elegir jueves, viernes o domingo recalcula las fechas de ejemplo.
- Participaciones estáticas por servicio: muestras de Pedro/Luis en batería, Elena en guitarra, Ana en piano y Marta/Sofía en voces. Se etiquetan como ejemplo; no se ejecuta un algoritmo de turnos ni se resuelve coordinación batería/voces.
- Los cambios viven solo en memoria, se pierden al recargar y no llaman a una API. Reemplazar una participación cambia solo la muestra visible; la consecuencia sobre turnos futuros permanece pendiente.
- El selector de acceso es una herramienta de revisión, no login ni autorización real. Permite ver editor, administrador, integrante y sin acceso sin simular seguridad de servidor.
- Cero nombres, exceso de nombres o huecos internos muestran “regla pendiente” y no realizan la simulación. No constituyen políticas de rechazo aprobadas. El formato de entrada se compara entre alternativas, no se fija todavía.
- No se modelan servicios existentes, reenvíos ni conflictos de fechas: son decisiones del producto, no ausencia demostrada de errores.

## Inventario mínimo propuesto

| Componente o composición | Regla inicial |
| --- | --- |
| Encabezado de contexto | Nombre del producto, iglesia activa y navegación con etiquetas. Sin selector de iglesia en el lote. |
| Botones | Principal oscuro, secundario con borde y acción textual. Altura mínima propuesta 44 px; una acción principal por estado. |
| Campo/select/textarea | Etiqueta visible, ayuda y error asociado. Misma altura de controles y foco visible. |
| Fila fecha/director | Una fuente de datos para lista, resumen y calendario; fechas siempre en orden. |
| Aviso de lote parcial | Texto explícito “3 de 4”, fechas incluidas y fecha sin crear; no comunicarlo solo con color. |
| Participación | Rol, personas, origen de ejemplo y reemplazo; varias voces sin reducirlas a una sola persona. |
| Estado de bloque | Vacío, carga, error con volver a intentar y éxito de simulación; sin sustituir datos reales por mensajes de éxito ficticios. |

Referencias dimensionales provisionales: texto 16 px, ayudas 14 px, título 24–28 px, controles 44 px, margen móvil 16 px y contenido máximo 1152 px. Espaciado base 4/8 px. Grises, tipografía del sistema, sin fuentes remotas. Estas decisiones sirven al wireframe, no constituyen tokens aprobados del proyecto.

## Estados revisables

Las herramientas de revisión permiten mostrar carga, error y falta de acceso; el calendario inicia vacío y se completa solo tras confirmar. Es posible volver desde revisión sin crear nada, probar tres o cuatro nombres y comprobar que recargar elimina los datos simulados. La configuración permanece deliberadamente de solo referencia para no inventar reglas.

## Pendientes antes de implementar

La combinación de la alternativa 04 fue aceptada por la persona usuaria. Resolver en [INI-001](../../docs/issues/INI-001-cerrar-reglas-iniciales.md) identificación de directores, hoy/zona horaria, fechas ocupadas, inicio/continuidad y coordinación de turnos, y consecuencias de los reemplazos. La elección del recorrido está resuelta; no cerrar INI-002 ni verificar las historias hasta resolver las reglas y los estados afectados que siguen pendientes.

## Verificación

### Iteración 04 — móvil primero

- Antes de corregir se reprodujo el reporte mediante la interfaz de 01: noviembre solo ofrecía viernes 20/27 y el encabezado empezaba por lunes. La sesión automatizada estaba cerrada y se abrió para poder ejecutar esta comprobación.
- El recorrido de 04 aprobó a **375, 390, 768 y 1440 px**. Se comprobaron las fechas exactas de noviembre para jueves/viernes/domingo, diciembre completo y alineación del 1 de noviembre con domingo y del 1 de diciembre con martes.
- En móvil se comprobaron etiquetas sobre campos, controles de al menos 44 px y ausencia de desbordamiento horizontal. Período y directores están en pasos separados; la entrada de nombres es por fecha, no un textarea.
- También aprobaron volver al período sin perder el nombre editado, revisión sin crear servicios, lote parcial de tres de cuatro con cuarta fecha ausente, lote completo, reemplazo, varias voces, integrante de solo lectura y pérdida de los datos al recargar. Sin errores JavaScript `pageerror` en el recorrido.
- Se leyeron las capturas de período/directores/revisión a 390 y 1440 px, y directores a 768 px. Los campos móviles mantienen una columna; las fechas y campos se alinean en dos columnas cuando hay espacio. La carga requiere desplazamiento vertical, sin controles fijados que tapen campos.
- Sintaxis del JavaScript, HTML sin recursos remotos, cuatro entradas del manifiesto y enlaces locales: aprobados. `git diff --check`: aprobado. Evidencia local: `.taste-skill/servicios/check-guided-table.cjs` y `hybrid-*.png`.
- Evaluación nativa no disponible por archivos sin seguimiento que requieren declaración; no se atribuye revisión nativa aprobada. No se ejecutaron pruebas de backend ni de autorización real: sigue siendo una muestra aislada.

### Resultado observado en 01–03

- Inspección de las tres alternativas a 1440, 768 y 390 px, con lectura visual de capturas de primer pliegue y página. Sin fallos de medición ni desbordamiento horizontal en las vistas iniciales.
- El inspector emitió un aviso `no-data-hue` para pasos guiados y tabla, a 1440 y 768 px: interpreta la cuadrícula del calendario como gráfico sin color de datos. Se conserva el gris deliberadamente: es un wireframe, no un gráfico estadístico; contornos y texto identifican las fechas sin depender del color. Agenda con panel no produjo avisos.
- Playwright: recorrido aprobado en las tres alternativas a 390 px. Se comprobaron revisión y confirmación de tres servicios para cuatro fechas, 25 de diciembre sin crear, regreso desde revisión sin crear datos, lote completo de cuatro servicios, detalle, dos voces y reemplazo de batería con mensaje explícito sobre sus límites.
- También se comprobaron las vistas de integrante de solo lectura, administrador y sin acceso; carga, error y reintento; cantidades de fechas restantes de noviembre y de diciembre al cambiar día; aviso de regla pendiente para cero nombres sin crear datos; y pérdida de la simulación al recargar. Sin errores JavaScript `pageerror` en el recorrido aprobado.
- El primer recorrido falló por tiempo de espera: el sandbox del canvas bloqueaba el envío nativo del formulario. Se corrigieron los botones para ejecutar la simulación sin envío nativo ni cambios en el aislamiento; el recorrido posterior aprobó. Se corrigió además el valor de jueves a `4`, según `getUTCDay()`.
- Comprobación estructural aprobada: sintaxis del JavaScript de los tres HTML, ausencia de recursos remotos, archivos del manifiesto y destinos de enlaces locales del mapa y de INI-002.
- La evaluación nativa de riesgo quedó no disponible: exige declarar archivos sin seguimiento. No se inició ni se atribuye una revisión nativa aprobada a este borrador.

Evidencia local de trabajo, no parte del entregable: `.taste-skill/servicios/inspect-*/`, capturas `*-mobile-detail.png` y guion `check-wireframes.cjs`; registros del navegador en `.playwright-cli/`. No son dependencias del prototipo.

### Lectura visual y límites de la comparación original

Pasos guiados deja una decisión principal por pantalla y resulta la referencia recomendada para empezar. La tabla hace más visible la relación fecha/director, pero en móvil requiere más desplazamiento. Agenda con panel mantiene fechas a la izquierda en escritorio; a 768 y 390 px el contexto baja debajo del formulario y deja de ser simultáneo. Los títulos, etiquetas y controles se mantienen legibles; el detalle móvil requiere desplazamiento por los cuatro roles y dos voces. Esta comparación no equivale a una prueba con personas usuarias ni aprueba todavía un sistema visual.

Las comprobaciones del prototipo no validan permisos reales, persistencia, generación de turnos ni compatibilidad del stack productivo. No se ejecutaron pruebas de backend, de proveedor de identidad ni una auditoría integral de accesibilidad. La revisión humana de alternativas y las reglas de INI-001 siguen pendientes.
