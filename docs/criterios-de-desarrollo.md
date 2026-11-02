# Criterios de desarrollo

Estos criterios orientan decisiones; no son cuotas ni requisitos de implementación anticipada.

- Prefiere módulos simples y cohesivos. Evita capas, abstracciones, dependencias y generalizaciones sin beneficio concreto.
- Mantén clara la fuente de verdad. Comparte datos musicales y representa adaptaciones mediante overrides; no mantengas maestros duplicados.
- Cuando exista interfaz, contempla estados observables de carga, vacío, error y éxito según corresponda; no ocultes errores.
- Valida entradas y aplica autorización en servidor, no solo en la interfaz. Aísla datos por contexto de acceso y separa lo público de lo privado.
- No expongas información privada en vistas públicas; sigue los límites del [plan de producto](producto.md).
- Para cambios de comportamiento, aplica test-first cuando haya pruebas deterministas y una expectativa clara. Añade una prueba de comportamiento, observa su fallo, implementa y vuelve a comprobar. Si no existe una prueba útil —por ejemplo, documentación pasiva— explica la excepción y usa verificación estructural proporcional.
- Cuando la aplicación exista, verifica reglas de dominio, aislamiento de acceso y límites de datos con pruebas apropiadas. La propuesta técnica y los criterios del producto describen trabajo futuro; no son evidencia de implementación ni de pruebas ejecutadas.

La [propuesta técnica](propuesta-tecnica.md) orienta arquitectura sin redefinir requisitos. El [producto](producto.md) sigue siendo la fuente oficial de alcance.
