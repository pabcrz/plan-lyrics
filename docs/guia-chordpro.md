# Guía esencial de ChordPro

Referencia breve de formato para el producto. La sintaxis nativa no debe confundirse con las funciones de la aplicación, y esta guía no es la fuente de requisitos: consulta el [plan oficial del producto](producto.md).

## Sintaxis nativa

| Forma | Uso |
| --- | --- |
| `[C]letra` | Sitúa un acorde respecto de la letra siguiente. |
| `{title: Título}` / `{key: G}` | Metadatos de título y tonalidad. |
| `{start_of_chorus}` … `{end_of_chorus}` (`{soc}` / `{eoc}`) | Delimita el contenido de un coro. |
| `{chorus}` | Reutiliza el último coro definido; no selecciona una sección por nombre. |
| `{comment: texto}` | Comentario o nota, no una sección repetible. |

ChordPro nativo no define aquí una referencia genérica para repetir cualquier verso. Un entorno vacío no reutiliza el contenido de una sección anterior. Referencias: [entornos de coro](https://www.chordpro.org/chordpro/directives-env_chorus/) y [uso de ChordPro](https://www.chordpro.org/chordpro/using-chordpro/).

## Convención de repetición de la colección

En una fuente que use esta convención, delimitadores coincidentes `/` o `:` a ambos lados, o `xN`, representan **N copias totales** del fragmento delimitado; N incluye la pasada final. Se conserva el orden y cualquier prefijo o sufijo fuera del límite aparece una sola vez. No se deben reinterpretar globalmente puntuación, metadatos, barras o slash de bajo. Esta convención no es sintaxis nativa ni una función automática de ChordPro.

## Aplicación futura

La estructura de la canción distinguirá **secciones de letra** (intro, estrofa, coro, puente, outro/cierre), **pasajes armonizados** y **vueltas del arreglo**. No se deducen acordes ni se fusionan pasajes solo porque coincida el texto. Las referencias de sección de la aplicación deberán ser estables; al exportar a ChordPro, referencias no nativas se expanden a contenido.

La fuente prevista es un único ChordPro con acordes; la vista de letras oculta los acordes desde esa misma fuente. Las exportaciones de texto son futuras. Importar texto con acordes encima sigue sin estar confirmado. Nada de esto se afirma implementado.
