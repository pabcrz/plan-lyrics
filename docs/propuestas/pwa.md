# Propuesta: Plan & Lyrics como PWA

**Estado:** las cuatro fases están implementadas. Falta comprobarlas en dispositivos reales (el navegador integrado de desarrollo no permitió registrar el service worker).

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

## Cómo quedó lo sin conexión

- **Service worker** (`public/sw.js`): guarda `/assets/*` (con hash), tipografías e `index.html`; nunca `/api/*` ni `/m/*`. No se activa solo: la página muestra «Hay una versión nueva · Actualizar».
- **Datos** (`src/offline-cache.ts`): la caché de consultas se guarda en `localStorage` (límite ~2.5 MB; si no cabe se conserva lo anterior) con su iglesia activa y su cuenta. Solo se restaura si es de la misma iglesia; iniciar sesión con otra cuenta la descarta y cerrar sesión la borra.
- **Precarga**: con conexión, el Inicio deja guardados el setlist y las letras de los próximos servicios (hasta 6) de la iglesia activa.
- **Sin Clerk** (camino elegido): si Clerk no carga (por ejemplo, sin red) y hay datos guardados, se abre la aplicación en solo lectura con lo último visto; sin datos, se muestra el error de siempre.
- Límites conocidos: los cambios siempre requieren conexión; la precarga cubre la iglesia activa; si el almacenamiento crece, pasar a IndexedDB.

## Cómo comprobarlo

- Lighthouse (instalable) y Chrome → Application → Manifest.
- Android Chrome: aparece la franja y «Instalar» abre el diálogo del sistema.
- iPhone Safari: aparece la explicación y «Añadir a pantalla de inicio» usa el ícono.
- Instalada, la franja ya no aparece.
