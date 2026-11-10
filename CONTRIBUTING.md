# Contribuir

Estas convenciones ayudan a mantener cambios revisables; no inventan aprobaciones, herramientas ni pipelines del proyecto.

## Cambios y commits

- Usa una rama por intención, basada en `main`; confirma antes que ese sea el punto de partida apropiado para tu trabajo.
- Antes y después de editar, revisa `git status` y `git diff`; conserva cambios preexistentes.
- Mantén commits pequeños y coherentes, centrados en resultados e incluyendo las pruebas o documentación pertinentes. Usa asuntos convencionales en español, por ejemplo: `docs: organiza la guía del producto`.
- Una autorización explícita para commits pequeños de una tarea puede cubrir varios commits coherentes de esa misma tarea; no se requiere pedir aprobación nueva por cada uno. No infieras autorización para otras acciones.

## Revisión y entrega

- Prefiere PR independientes; no apiles PR por defecto. Si una cadena resulta necesaria, acuerda el plan explícitamente.
- Unas 400 líneas manuales modificadas por commit son una referencia de revisión, no una puerta ni motivo para dividir cambios que deban permanecer cohesionados.
- Unas 800 líneas manuales por PR son un techo de planificación, no una meta. Reconsidera el alcance al acercarte; no omitas pruebas ni fuerces divisiones artificiales.
- Describe intención, límites y evidencia. Ejecuta verificaciones pertinentes y comunica resultados reales.
- Publicar o hacer `push`, abrir PR, fusionar o desplegar requiere autorización separada y vigente para cada acción; respeta también la confirmación de la herramienta utilizada.
