# Propuesta de diseño — pantallas y sistema visual

**Estado: propuesta de ejecución, sin diseños ni componentes implementados.** Mantener el diseño separado del alcance funcional: el [producto](../producto.md) define qué construir y las [historias](../README.md#primeras-entregas-propuestas) describen resultados. La [propuesta integral](entrega-integral.md) coordina diseño y backend.

## Resultado buscado

Diseñar recorridos completos con componentes consistentes antes de implementarlos, sin anticipar un catálogo enorme ni terminar todas las pantallas del producto de una vez.

## Secuencia propuesta

1. **Mapa de pantallas y permisos.** Identificar objetivos, entradas, salidas y acciones por acceso. No decidir todavía que cada responsabilidad requiere una página separada.
2. **Wireframes del primer recorrido.** Calendario → crear lote mensual → revisar fechas y directores → confirmar lote completo o parcial → abrir un servicio → corregir una participación. Usar contenido ficticio realista y marcar las reglas pendientes del producto.
3. **Sistema visual mínimo.** Acordar tipografía, color, espaciado, anchos, adaptación, bordes y estados a partir de esos wireframes.
4. **Mockups con componentes reutilizables.** Aplicar el sistema al recorrido; diseñar solo los componentes que necesita. Mostrar móvil y escritorio, no solo una pantalla estática ideal.
5. **Prototipo y entrega a implementación.** Probar navegación, comprensión y correcciones; entregar reglas y variantes junto con las pantallas elegidas. Ampliar el sistema durante cada entrega completa.

## Responsabilidades de interfaz iniciales

| Área | Resultado que debe permitir |
| --- | --- |
| Calendario de la iglesia | Consultar fechas y abrir servicios dentro de la iglesia activa. |
| Creación individual | Registrar un servicio sin pedir nuevamente la iglesia. |
| Lote mensual | Elegir mes y día semanal, ingresar directores en orden, revisar y confirmar; admitir menos directores que fechas. |
| Detalle del servicio | Consultar dirección y participaciones y corregir lo generado, según permisos. |
| Configuración de participaciones | Definir habituales y rotaciones por iglesia, con sus modalidades. |

La forma concreta —página, sección, diálogo o pasos— se decide probando el recorrido. La preparación del setlist se incorpora en su entrega, sin anticipar el editor musical.

## Reglas para evitar componentes inconsistentes

- Un inventario común con nombre, propósito, variantes y estados; una pantalla no crea un nuevo botón solo para cambiar su apariencia.
- Botones con jerarquía explícita: acción principal, secundaria, discreta y destructiva cuando corresponda. Tamaños limitados y documentados; no colores o alturas arbitrarios por pantalla.
- Campos con etiqueta, ayuda, error y foco consistentes; no usar únicamente color para comunicar estados.
- Compartir patrones de selección de personas, asignación de roles, lista de fechas y resumen del lote. Diferenciar componentes básicos de composiciones propias del dominio.
- Diseñar carga, vacío, error, éxito y ausencia de permisos cuando correspondan, además del estado ideal.
- Verificar contraste, teclado, foco y tamaños táctiles; el acceso restringido debe aplicarse también en servidor, no solo ocultando controles.

## Tamaños y adaptación: punto de partida, no valores aprobados

Probar texto base de 16 px, controles táctiles alrededor de 44–48 px y espaciado basado en 4 y 8 px. Validar legibilidad, zoom, etiquetas largas y densidad antes de adoptarlos. Definir anchos de contenido y cambios de distribución según el contenido, no solo según una captura o marca de teléfono.

Los valores elegidos se registrarán en una referencia visual y se trasladarán a tokens de implementación; estos ejemplos todavía no constituyen tokens oficiales.

## Herramienta y fuente visual

Figma puede servir desde wireframes para componentes y colaboración. Los mockups HTML locales permiten explorar interacción y adaptación en navegador. La herramienta queda por elegir: no hay archivos Figma creados ni se presupone una integración de transferencia automática.

Elegir una referencia visual principal; cualquier representación secundaria debe señalar su versión para no mantener dos diseños contradictorios. Si se trabaja con artboards HTML, guardarlos bajo `design/` y documentar allí el sistema cuando sea aprobado.

## Condición para avanzar

El primer recorrido se puede explicar y probar, sus tamaños y variantes tienen una referencia común y los casos pendientes están señalados. No hace falta terminar todo el sistema visual para conectar la primera parte funcional. No se implementan reglas de negocio aún abiertas bajo una decisión puramente visual.
