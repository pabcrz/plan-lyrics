# Propuesta: Plan & Lyrics como PWA

**Estado:** las fases 1 y 2 están implementadas; las fases 3 y 4 esperan decisión (ver «Por decidir»).

## Objetivo

Que la aplicación se pueda **instalar** en el celular o la computadora (con aviso para hacerlo), tenga ícono propio y, después, abra y se lea **sin conexión**. Relacionada con [varias iglesias](multi-iglesia.md) (caché sin conexión y setlist público).

## Punto de partida

Antes de esta propuesta no había manifiesto, íconos propios, service worker ni carpeta `public/`. Clerk carga su código desde internet (`ClerkLoaded`/`ClerkFailed` en `ClerkApp.tsx`) y las tipografías vienen de Google Fonts.

## Fases

| Fase | Qué incluye | Riesgo |
| --- | --- | --- |
| 1. Instalable | `manifest.webmanifest` (`es-MX`, `standalone`, colores del tema azul), íconos temporales, `theme-color`, `apple-touch-icon` y metaetiquetas de iOS. | Bajo |
| 2. Aviso de instalación | Franja «Instala Plan & Lyrics» con «Instalar» y «Ahora no» (se pospone 14 días); en iOS explica «Compartir → Añadir a pantalla de inicio». No aparece si ya está instalada ni en las vistas públicas. | Bajo |
| 3. Service worker | Abrir la app sin red tras una primera visita: caché de los archivos con hash (`/assets/*`), tipografías y `index.html` como respaldo de navegación. **Nunca** `/api/*` ni `/m/*`. Aviso «Hay una versión nueva · Actualizar». | Medio: una caché mal hecha deja versiones viejas |
| 4. Datos sin conexión | Caché de consultas guardada en IndexedDB por cuenta e iglesia (se borra al cerrar sesión), solo lectura, con aviso «Sin conexión». | Medio: datos en el dispositivo |

## Íconos (temporales)

`apps/web/public/icons/`: `icon.svg` (fuente), `icon-192.png`, `icon-512.png`, `icon-maskable-512.png` (dibujo dentro del 80 % central) y `apple-touch-icon.png`. Motivo: el pentagrama del diseño con una corchea, sobre el azul primario (`#006c98`). Para cambiarlos por el logo definitivo basta reemplazar los archivos (mismos nombres y tamaños); los PNG se generaron desde el SVG con `qlmanage` + `sips`.

## Decisiones tomadas

- **Service worker escrito a mano**, sin `vite-plugin-pwa`: se evita una dependencia y el comportamiento cabe en unas 60 líneas (caché de `/assets/*` inmutables y navegación con respaldo).
- **La API no pasa por el service worker**: los datos viajan por la caché de consultas (fase 4), para no mezclar respuestas entre cuentas ni iglesias.
- El aviso se captura al arrancar (`watchInstall`), porque el navegador puede lanzar `beforeinstallprompt` antes de que React monte.

## Por decidir

1. **Abrir con sesión sin red.** Clerk descarga su script de un CDN; sin red, `ClerkFailed` sale y la app no entra. Opciones: (a) el service worker guarda también ese script y se comprueba si Clerk arranca con la sesión local (no verificado), o (b) si Clerk no carga y hay datos guardados, mostrar la caché en solo lectura sin verificar la sesión (los datos ya están en el dispositivo de la persona; cerrar sesión los borra).
2. **Letras en la caché** de la fase 4: decidido que sí se guardan.
3. Si las fases 3 y 4 se hacen antes o junto con las letras públicas (la vista `/m/:token` no usa Clerk y es el camino sin red más fiable).

## Cómo comprobarlo

- Lighthouse (instalable) y Chrome → Application → Manifest.
- Android Chrome: aparece la franja y «Instalar» abre el diálogo del sistema.
- iPhone Safari: aparece la explicación y «Añadir a pantalla de inicio» usa el ícono.
- Instalada, la franja ya no aparece.
