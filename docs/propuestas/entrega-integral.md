# Propuesta integral — avanzar por resultados completos

**Estado: secuencia propuesta, no plan de implementación aprobado ni evidencia de funciones existentes.** El [producto](../producto.md) mantiene alcance y prioridades; las [historias](../README.md#primeras-entregas-propuestas) mantienen sus criterios. Este documento coordina la [propuesta de diseño](diseno.md) y la [de backend](backend.md), sin duplicar requisitos.

## Principio

Avanzar con unidades verticales: un resultado visible con interfaz, contrato, reglas, datos y verificación. No terminar toda la API antes de la web ni diseñar todo el producto antes de probar un recorrido real.

La primera entrega acordada sigue incluyendo creación mensual en lote y generación editable de turnos. Los pasos siguientes son incrementos internos para construirla, no una reducción de esa entrega.

## Secuencia sugerida

| Paso | Diseño e interfaz | Backend y datos | Evidencia para avanzar |
| --- | --- | --- | --- |
| 0 — alinear y reducir incertidumbre | Mapa de pantallas, wireframe del lote y sistema visual mínimo propuesto. | Resolver las reglas pendientes del recorrido y ejecutar la prueba técnica acotada antes de adoptar hosting. | Recorrido entendible, límites explícitos y resultado real de compatibilidad; no una aplicación completa. |
| 1 — iglesia activa, calendario y servicio | Navegación interna y formulario individual con componentes compartidos. | Identidad, acceso a iglesia, lectura de calendario y persistencia de servicio. | Crear y volver a consultar un servicio; rechazar acceso ajeno o edición por integrante. Es una base interna, no la primera entrega terminada. |
| 2 — participaciones y generación | Configuración por administrador y detalle de asignaciones. | Guardar habituales y rotaciones; calcular participaciones según reglas cerradas. | Habituales, modalidades de turnos y coordinación acordada comprobadas desde la interfaz conectada, sin confundir roles musicales con permisos. |
| 3 — lote mensual completo o parcial | Ingreso ordenado de directores, revisión y confirmación usando los mismos componentes. | Calcular fechas, asignar turnos y guardar el lote conforme al contrato acordado. | Generar tres de cuatro fechas con confirmación, volver al calendario y consultar lo persistido; probar también lote completo. |
| 4 — correcciones y cierre de la primera entrega | Cambiar participaciones y revisar el recorrido en móvil y escritorio. | Persistir reemplazos con su efecto sobre turnos futuros previamente acordado. | Verificar las historias HU-001 a HU-005 y registrar resultados reales, pendientes y límites antes de declarar la entrega completa. |
| 5 — preparación del setlist | Añadir orden, tonos y referencias al servicio existente. | Incorporar solo la biblioteca mínima y operaciones contextuales necesarias. | Validar HU-006 sin exigir editor de letras o acordes; concretar antes el flujo de alta/selección de canciones. |

Los accesos combinables requieren pruebas en cada incremento. La forma inicial de dar de alta iglesias, personas y accesos debe acordarse antes de usar el sistema con una iglesia real; no se resuelve confiando en controles del navegador ni creando un panel administrativo completo por anticipado.

## Ciclo de cada incremento

1. Tomar una historia y cerrar únicamente las decisiones que bloquean su resultado.
2. Bocetar su interacción y reutilizar el sistema visual; añadir variantes solo si hay una necesidad distinta.
3. Acordar ejemplos del contrato y los estados de error. Se pueden usar datos simulados durante el diseño, señalados como tales.
4. Escribir pruebas de comportamiento, observar el fallo aplicable e implementar backend e interfaz de esa unidad.
5. Conectar con datos reales de prueba aislados y comprobar el recorrido de extremo a extremo.
6. Revisar consistencia visual, permisos, persistencia y regresiones; registrar la evidencia en la historia cuando cumpla todos sus criterios.

Las pantallas estáticas no sustituyen verificación funcional. Las pruebas de API no sustituyen probar la experiencia de la persona. Los contratos son un punto de encuentro, no una razón para implementar todas las operaciones futuras.

## Decisiones antes de empezar

Las reglas funcionales abiertas permanecen en el [plan oficial](../producto.md#decisiones-de-producto-abiertas): límites del calendario, identificación de directores, conflictos de fechas y continuidad/coordinación de turnos, entre otras. No hay que resolver letras, acordes y rotación de canciones para empezar este recorrido.

Elegir además la referencia visual principal y validar la compatibilidad de la [base técnica seleccionada](../propuesta-tecnica.md): React/Vite con TanStack Query, API Hono, Prisma/PostgreSQL y Clerk separado. Las plataformas del piloto siguen sujetas a prueba y las de operación habitual a consumo, costos y condiciones. Mantener decisiones de producto, decisiones técnicas y evidencia de pruebas separadas.

## Siguiente unidad propuesta

Preparar el mapa de pantallas y el wireframe de creación mensual, acompañado de ejemplos del cálculo de fechas y del contrato propuesto de revisión/confirmación. No implementar todavía reglas abiertas. Una vez validados, comenzar por el calendario y el servicio individual conectados, manteniendo lotes y turnos como requisito del cierre de la primera entrega.
