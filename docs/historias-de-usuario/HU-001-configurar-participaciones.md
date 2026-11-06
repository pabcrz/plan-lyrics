# HU-001 — Configurar participaciones de la iglesia

- Estado: propuesta
- Producto: [Plan oficial](../producto.md#participaciones-habituales-y-turnos)

Como administrador de iglesia, quiero configurar roles y participaciones habituales o en rotación, para evitar asignar repetidamente al mismo equipo.

## Criterios de aceptación
- Dada la iglesia activa, cuando consulto sus roles iniciales, entonces aparecen batería, guitarra, piano y voces en orden alfabético.
- Dado un rol, cuando configuro personas habituales, entonces quedan disponibles para su carga automática al crear servicios; voces admite varias personas.
- Dada una persona que participa en distintos roles, cuando configuro su participación, entonces la configuración pertenece a esa iglesia y ese rol, no a su identidad global.
- Dada una persona que alterna roles entre servicios, cuando se generan sus participaciones para un servicio concreto, entonces tiene como máximo un rol musical registrado en ese servicio, sin impedir su participación en otras iglesias.
- Dada una persona que canta mientras toca piano/teclado o guitarra, cuando se organiza su participación, entonces basta asignarle el instrumento y no se exige otra asignación a voces.
- Dada una rotación de mi iglesia, cuando configuro su modalidad, entonces puedo elegir secuencia independiente por día o secuencia compartida entre todos los servicios, sin imponerla a las demás rotaciones.
- Dada una rotación, cuando fijo manualmente su inicio en un servicio y elijo las personas y su orden, entonces se repite cíclicamente entre lotes y meses hasta interrumpirla o cambiar su orden, sin reiniciar por cada lote.
- Dado un editor de servicios sin acceso administrativo, cuando intenta modificar esta configuración general, entonces la operación se rechaza.

## Exclusiones y decisiones abiertas

Definir eliminación de roles ya utilizados, resolución de coincidencias cuando dos asignaciones proponen la misma persona para distintos roles del mismo servicio y efecto de cambiar el orden sobre servicios ya generados. No modelar el canto junto al instrumento como una segunda asignación. No incluye administrar el permiso editorial global. Las reglas pendientes se mantienen en el plan oficial; estos criterios no autorizan inferirlas.

## Evidencia

Pendiente de implementación y verificación. Esta historia documenta comportamiento propuesto, no funciones existentes.
