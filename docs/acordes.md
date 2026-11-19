# Acordes de la biblioteca (API y reglas)

Primera rebanada de la [etapa 3 del producto](producto.md#etapa-3--acordes): **conservar la relación entre letra y acordes y transponer respetando modo mayor/menor**. Es solo API y reglas puras; las pantallas van en otra PR. No hay letras ni canciones reales: las pruebas usan textos y acordes inventados. Complementa [letras](letras.md).

## Representación

Los acordes viajan **en línea dentro del texto de cada sección**, con marcas ChordPro: `[Am]Luz de la [C]mañana`. Se eligió esta forma frente a una lista `{offset, acorde}` por una razón: **un acorde que es parte del texto no se desalinea al editar la letra**; con posiciones numéricas, insertar una palabra antes obligaría a recalcular cada offset. También es la sintaxis nativa de ChordPro (la [guía](guia-chordpro.md) prevé un único ChordPro como fuente), así que una exportación futura no necesita traducción.

- `LyricsSection.chordPro` (nullable) guarda la sección con sus marcas; `text` sigue siendo el texto limpio y es lo único que usan la vista pública y los clientes que no conocen los acordes.
- **Una sola fuente en la práctica:** el servidor deriva `text` de `chordPro` y, si el cliente envía ambos, exige que coincidan exactamente (`400` si no). Los dos nunca pueden discrepar.
- Un `chordPro` sin ninguna marca se guarda como texto simple (`null`).
- `SongLyrics.key` (nullable) es la tonalidad del texto con acordes (`G`, `F#m`…; una nota y `m` opcional). Es dato interno.
- Las reglas viven en `apps/api/src/chord-rules.ts` (puras, sin base de datos) y se enlazan al cuerpo en `lyrics-rules.ts`.

### Acordes admitidos

Raíz `A`–`G` con `#` o `b` opcional, calidad de una **lista cerrada** (`m`, `5`, `6`, `m6`, `7`, `m7`, `maj7`, `maj9`, `maj13`, `9`, `m9`, `11`, `m11`, `13`, `m13`, `sus2`, `sus4`, `7sus4`, `add9`, `madd9`, `dim`, `dim7`, `m7b5`, `aug`, `aug7`, `7b5`, `7b9`, `7#9`, `7#5`) y bajo opcional (`C/G`, `Am7/G`). Cualquier otra cosa se rechaza en lugar de adivinarse. Límites: 200 acordes por sección, 8000 caracteres de `chordPro` (el texto sigue en 4000), sin caracteres de control; los saltos de línea y los bordes se normalizan igual que el texto.

## Transposición

- **Solo cálculo:** `GET /api/songs/:songId/lyrics?semitones=n` o `?toKey=D` devuelve la letra con los acordes y la tonalidad movidos, más `semitones`. No guarda nada ni cambia la versión. Un `#` en `toKey` debe ir codificado (`F%23m`).
- `semitones` va de -11 a 11; `toKey` exige tonalidad guardada **del mismo modo** (mayor con mayor, menor con menor). Sin tonalidad guardada solo funciona `semitones`. Ambos a la vez, valores inválidos o una petición imposible son `400`. Otros parámetros se siguen ignorando.
- Solo se mueven la raíz y el bajo; la calidad y las extensiones se conservan tal cual (`Em7b5` → `Am7b5`).
- **Enarmonía:** la tonalidad destino decide sostenidos o bemoles. Si se escribe con alteración (`Bb`, `F#`) manda ella; si no, la armadura (mayores `F` y menores `Dm`, `Gm`, `Cm`, `Fm` con bemoles; el resto con sostenidos). Al transponer por semitonos se usa la tonalidad resultante con su nombre habitual (`Bb`, `Eb`, `Ab`, `Db`, `F#`; `C#m`, `Ebm`, `F#m`, `G#m`, `Bbm`). Sin tonalidad guardada, si los acordes de origen solo tienen bemoles se conservan bemoles; en cualquier otro caso, sostenidos. Un acorde enarmónico (`A#`) se reescribe con la grafía destino.

## API

| Ruta | Cambio |
| --- | --- |
| `GET /api/songs/:songId/lyrics` | Respuesta ampliada: `key` y, por sección, `chordPro` (ambos `null` si no hay). Con `semitones` o `toKey` calcula la transposición. Permisos sin cambios (miembros y editores leen). |
| `PUT /api/songs/:songId/lyrics` | Secciones aceptan `chordPro` (y `text` opcional si hay `chordPro`); el cuerpo acepta `key` (ausente la conserva, `null` la borra). Mismo control de versión, mismo `409`, mismos permisos: solo superadministrador y editores de biblioteca; el `403` sigue antes de validar. |

**Compatibilidad:** los campos nuevos son aditivos. Un cliente que no conoce los acordes y reenvía el mismo texto **no pierde los acordes**: si una sección omite `chordPro` y su texto no cambió, conserva los suyos; si el texto cambió, esos acordes ya no lo describen y se descartan; `chordPro: null` los borra de forma explícita.

### Base de datos

La migración `20261122120000_lyrics_chords` es **aditiva**: dos columnas nulas (`SongLyrics.key`, `LyricsSection.chordPro`) con sus `CHECK`; no hay sentencias destructivas ni toca filas existentes.

## Vista pública

Sin cambios de contrato: la vista pública y la consulta de letras publicadas **seleccionan campo por campo** y nunca leen `chordPro` ni `key`; aunque la letra esté publicada, solo sale el texto limpio. Las pruebas de integración comprueban, en las versiones `CONGREGATION`, `PRAISE` y `FULL` de un enlace sobre una letra publicada con acordes y tonalidad, que no aparece ninguna marca, nombre de acorde, tonalidad ni BPM, y que los parámetros de transposición no afectan la ruta pública. El BPM no existe en la biblioteca.

## Decisiones tomadas con criterio restrictivo

1. Quién escribe acordes y tonalidad: los mismos que escriben letras. Quién lee: los mismos que leen letras.
2. Los acordes y la tonalidad **nunca** son públicos, publicada o no la letra.
3. Texto con acordes: los corchetes literales no se admiten en una sección con acordes (toda marca debe ser un acorde válido).
4. Lista cerrada de calidades; los acordes de otra forma se rechazan.
5. Transponer a una tonalidad exige mismo modo; cambiar de modo (relativo) no se hace en silencio.
6. La transposición es solo de lectura; nada se persiste.

## Pendientes y decisiones abiertas

- **Pantallas:** lectura con acordes sobre la letra, selector de tonalidad y edición (otra PR). La pantalla actual de edición aún no envía `chordPro` (los acordes se conservan por la regla de compatibilidad).
- **Editor avanzado** de acordes: no es prioridad de la primera etapa.
- **Importación de TXT** con acordes encima y exportaciones TXT/ChordPro: sin decidir.
- **Tonalidad por servicio u override de iglesia:** el producto prevé adaptaciones que heredan de la base; hoy la tonalidad contextual del setlist es independiente y no transpone la letra.
- **Texto plano con marcas:** una sección sin `chordPro` cuyo `text` contenga literalmente `[Am]` se publica tal cual (es texto). ¿Se debe rechazar o limpiar?
- **Calidades de acorde** fuera de la lista (`C6/9`, `m(maj7)`, `sus`) y acordes sin texto asociado (solo instrumental) en una sección.
- **Matiz de notación:** alteraciones enarmónicas raras (`E#`, `Cb`) se aceptan como acorde y se reescriben al transponer; como tonalidad se rechazan.
- **Límites definitivos** de tamaño y número de acordes.
- **BPM:** no existe en la biblioteca; cuando exista deberá seguir fuera de la vista pública.

## Verificación

Reglas puras: `chord-rules.test.ts` (acordes, tonalidades, enarmonía, bajo, extensiones, transposición, marcas en línea y límites) y `lyrics-rules.test.ts` (cuerpo, `key`, parámetros y letra pública). Integración sobre PostgreSQL aislado: `test/chords.integration.ts` y `test/lyrics.integration.ts` con `pnpm test:db` (permisos, versión, compatibilidad, transposición sin persistir, restricciones de base y ausencia de acordes, tonalidad y BPM en las respuestas públicas).
