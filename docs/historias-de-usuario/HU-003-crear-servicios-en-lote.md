# HU-003 — Crear servicios en lote

- Estado: propuesta
- Producto: [Plan oficial](../producto.md#etapa-1--servicios-y-organización)

Como editor de servicios, quiero crear varios servicios concretos de un día semanal con sus directores y participaciones, para preparar la programación sin repetir la carga servicio por servicio.

## Criterios de aceptación
- Dada la iglesia activa, cuando selecciono un mes futuro y viernes, entonces las fechas disponibles son todos los viernes de ese mes, sin fechas de otro mes ni de otro día semanal; puedo generar solo las primeras si todavía no tengo definidos todos los directores.
- Dado el mes actual iniciado, cuando selecciono un día semanal, entonces las fechas disponibles son únicamente las restantes de ese día en el mes, sin crear servicios en fechas ya pasadas.
- Dadas cuatro fechas del lote y cuatro directores ingresados manualmente, cuando genero los servicios, entonces el primero se asigna a la primera fecha, el segundo a la siguiente y así consecutivamente, dentro de la iglesia activa.
- Dadas cuatro fechas disponibles y tres directores ingresados, cuando solicito crear el lote, entonces se pide confirmación indicando que se crearán tres de cuatro servicios, en las primeras tres fechas consecutivas y con los directores en el orden ingresado.
- Dada esa confirmación, cuando acepto, entonces se crean solo los tres servicios y sus participaciones; la cuarta fecha queda sin servicio creado ni participaciones generadas, para programarla después.
- Dadas participaciones habituales y rotaciones configuradas, cuando genero el lote, entonces se cargan las habituales y los turnos respetan la modalidad de cada rotación: por día o compartida entre servicios.
- Dada una rotación independiente por día, cuando genero viernes, entonces no avanza la secuencia de domingos.
- Dada una rotación compartida Luis → Pedro → Juan que comienza con Luis y servicios en orden viernes, domingo, viernes y domingo, cuando se calculan sus turnos, entonces corresponden Luis, Pedro, Juan y Luis, respectivamente.
- Dado un lote creado, cuando preparo cada servicio, entonces puedo agregar su setlist manualmente.

## Exclusiones y decisiones abiertas

Incluida en la primera entrega. El período es mensual y los directores se asignan en orden cronológico. Antes de implementarla, definir inclusión de hoy, zona horaria, meses pasados, fechas ya ocupadas, más nombres que fechas, ausencia de nombres e identificación de personas. Menos nombres que fechas sí está definido: lote parcial con confirmación, sin completar las fechas faltantes automáticamente. Los nombres separados por comas son una propuesta de entrada. Definir inicio y continuidad de turnos entre lotes y fechas creadas fuera de orden. No es una regla de recurrencia. Las reglas pendientes se mantienen en el plan oficial; estos criterios no autorizan inferirlas.

## Evidencia

Pendiente de implementación y verificación. Esta historia documenta comportamiento propuesto, no funciones existentes.
