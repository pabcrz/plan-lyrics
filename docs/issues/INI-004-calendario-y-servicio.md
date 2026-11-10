# INI-004 — Conectar calendario y creación de servicio

- Estado documental: borrador local, sin número ni publicación en GitHub.
- Fuentes: [HU-002](../historias-de-usuario/HU-002-programar-servicio.md) y [HU-005](../historias-de-usuario/HU-005-consultar-calendario.md); [orden y trazabilidad](README.md).

## Resultado

Crear y volver a consultar un servicio dentro de la iglesia activa con interfaz y persistencia reales de prueba.

## Dependencias

INI-001, INI-002 e INI-003. Incremento interno: no completa por sí solo HU-002 ni la primera entrega, porque aún faltan participaciones generadas.

## Trabajo propuesto

- Acordar el contrato del recorrido y validar los criterios aplicables de HU-002 y HU-005.
- Conectar identidad con persona interna y autorizar recursos según iglesia y capacidad en backend.
- Implementar calendario, formulario y consulta persistente reutilizando la referencia visual.
- Probar acceso ajeno y escritura por integrante rechazados, sin alterar datos.

## Evidencia necesaria para cerrar

Pruebas de dominio/API y recorrido de navegador con datos aislados; servicio visible tras volver a consultar. Evidencia por criterio, sin marcar historias parcialmente cubiertas como verificadas.

## Límites

No expandir a un panel administrativo genérico. Autenticación y autorización requieren verificación acorde a su riesgo al implementar. La preparación de este borrador no autoriza implementación ni decisiones de producto pendientes.
