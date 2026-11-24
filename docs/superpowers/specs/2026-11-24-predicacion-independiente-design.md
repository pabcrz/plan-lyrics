# Predicación independiente del setlist: diseño

Fecha: 2026-11-24. Estado: pendiente de aprobación.

## Intención

Quien administra servicios planea la alabanza y la predicación por separado y en tiempos distintos. A veces ya tiene tres meses de predicadores y temas y aún no la alabanza; otras veces al revés. Hoy la predicación solo se captura al editar un servicio ya creado, la dirección es obligatoria y todas las personas aparecen como elegibles para todo. El resultado debe ser que ambas planeaciones converjan en el mismo servicio sin que una dependa de la otra.

## Metas

- Crear un servicio con dirección, con predicación o con ambas; ninguna es obligatoria.
- Separar en el directorio quién puede dirigir y quién puede predicar, con asociación guiada cuando una persona ya existe con el otro rol.
- Un lugar propio, «Predicaciones», para planear fechas, predicador y tema sin pasar por el setlist.
- Conservar la edición de predicación dentro del detalle del servicio (decisión explícita de la persona usuaria).
- Corregir el modal «Nuevo», que no se cierra al elegir una opción.

## No metas

- Evitar traslapes entre roles de predicación y de alabanza (punto aparte, se atiende después).
- Cambiar los enlaces para compartir: ya existen las versiones Alabanza, Predicación y Servicio completo y no se tocan en este diseño.
- Roles genéricos configurables (descartado por exceso).

## Anti-metas

- Que una sección bloquee a la otra, o que falte predicador o director impida avanzar.
- Que existan dos copias de la predicación: el lugar propio y el detalle del servicio leen y escriben el mismo registro (`ServicePreaching`).

## Enfoque elegido

1. **Creación de servicio.** Dos secciones opcionales, Dirección y Predicación (predicador y tema). Se cierra el modal «Nuevo» al elegir. `Service.directorId` pasa a ser opcional.
2. **Roles de persona.** Dos indicadores en `ChurchPerson`: `canDirect` y `canPreach`. Los selectores filtran por rol. Al escribir un nombre que ya existe sin ese rol se ofrece «Añadir también como predicador/director».
3. **Pestaña «Predicaciones».** Junto a Calendario y Personas. Lista fechas con predicador y tema; permite crear la predicación de una fecha y, si el servicio no existe, crearlo.

Alternativas descartadas: tabla de roles genérica (más de lo necesario hoy) y solo mejorar el detalle del servicio (no es independiente).

## Orden de entrega

Tres entregas, en este orden: (1) creación y modal, (2) roles, (3) pestaña.

## Restricciones y riesgos

- La entrega 1 hace opcional `Service.directorId`: migración sobre datos existentes y cambio de contrato (setlist, calendario, enlaces y lote asumen director). Es de alto riesgo; requiere revisar a quienes leen `director`.
- La entrega 2 añade columnas con valores iniciales: quien ya dirige queda `canDirect`; quien ya predica queda `canPreach`. Se deriva de los datos actuales.
- Los servicios pasados siguen siendo registro: no se modifican (regla vigente de la API).

## Decisiones propias (corrígelas si no aplican)

- **Corregido por la persona usuaria:** un servicio necesita al menos director o predicador; sin ninguno no se crea. Cada sección sola basta.
- **Requisito de la persona usuaria:** no perder progreso al planear varios servicios (lote mensual). El servicio individual se guarda al instante en el servidor, uno por uno. El lote mensual crea todo en una sola operación atómica (se conserva), así que su borrador (período, personas y revisión) se guarda en el dispositivo mientras se arma y se ofrece retomarlo si se cierra la pestaña o se pierde la conexión.
- Las citas y las notas siguen editándose después de crear, no en el formulario inicial.
- Una persona sin ningún rol marcado no aparece en ningún selector; al agregarla desde un selector queda con ese rol.

## Queda para quien construye

Textos exactos de la interfaz, diseño visual de la pestaña, y cómo muestran el calendario, el lote mensual y los enlaces un servicio sin director.
