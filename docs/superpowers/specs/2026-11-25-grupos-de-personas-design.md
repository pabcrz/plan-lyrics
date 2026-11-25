# Grupos de personas: Alabanza, Dirección y Predicación

Diseño corto. Estado: pendiente de aprobación. Base de trabajo: `develop`.

## Intención

Quien administra una iglesia debe poder dar de alta a una persona y dejar registrado desde ese momento a qué grupos pertenece y, si es del grupo de alabanza, qué roles musicales tiene. Después debe poder gestionar cada grupo sin saltar entre pantallas por rol.

Jerarquía deseada: **Alabanza** (con sus roles: batería, teclado, guitarra, voces…), **Dirección** y **Predicación** son grupos hermanos. Los roles musicales pertenecen solo a Alabanza.

## Lo que ya existe en `develop`

- `ChurchPerson` ya guarda `canPlay`, `canDirect`, `canPreach` y `roleIds`. Los grupos ya son pertenencia explícita, no un cálculo.
- «Persona nueva» ya muestra los tres interruptores (`PersonRoles`).
- «Personas» ya filtra por Alabanza, Dirección y Predicación.

## Lo que falta (alcance)

1. **Alta con roles.** En «Persona nueva», al activar *Grupo de alabanza* aparecen los roles de la iglesia para marcarlos en ese momento. El alta acepta `roleIds` y los guarda junto con la persona. Un rol solo se acepta si `canPlay` es verdadero.
2. **Gestionar cada grupo.** Dentro de Personas, cada filtro (Alabanza, Dirección, Predicación) abre su vista con una acción **Gestionar**: agregar a una persona de la iglesia que aún no está en el grupo, quitarla del grupo y, en Alabanza, editar sus roles. Textos: «Gestionar grupo de alabanza», «Gestionar directores», «Gestionar predicadores».
3. **Coherencia.** Quitar a alguien de Alabanza conserva sus turnos pasados y deja sus `roleIds` vacíos. Predicación solo aparece si la iglesia la usa.

## No alcance

- Vista global de personas para el superadmin y asignación a varias iglesias: es el proyecto 2, aparte.
- Cambiar el modelo de datos o crear una tabla genérica de grupos.
- Tocar la pantalla de Participaciones por rol.

## No objetivos (fracaso aunque funcione)

- Que los grupos vuelvan a sentirse como 20 equipos o que los roles se vean al mismo nivel que Dirección y Predicación.

## Enfoques considerados

- **A. Pertenencia explícita con tres marcas (elegido).** Ya está en el modelo; solo se completa la interfaz y el alta.
- **B. Tabla genérica de grupos con roles hijos.** Descartado: demasiado flexible y es el «20 equipos» que no se quiere.
- **C. Solo cambiar la interfaz sobre filtros calculados.** Descartado: no permite que un director exista fuera de Alabanza.

## Decisiones de quien construye

- Sin migración: el esquema ya tiene todo.
- La interfaz reutiliza `PersonRoles`, `Switch` y los chips de Personas; no se introduce lenguaje visual nuevo.
- Permisos: solo `canConfigure` (administración) cambia roles musicales, como hoy; `canEdit` puede agregar y quitar de Dirección y Predicación.

## Pendiente de confirmar

- ¿«Gestionar» es una pantalla propia por grupo o una hoja inferior sobre la lista? Propuesta: hoja inferior, para no añadir rutas.
