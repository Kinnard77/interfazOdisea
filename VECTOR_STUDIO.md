# Trazo Studio — editor vectorial con salida a PDF imprimible

Programa para **crear, organizar y procesar trazos vectoriales** (líneas, curvas
Bézier y figuras) y exportarlos a **SVG** o a un **PDF 100 % vectorial** listo
para imprimir a tamaño real.

Funciona en el navegador, sin dependencias ni instalación: basta abrir
`vector-studio.html` (en el sitio desplegado, la ruta `/vector-studio`).

| Archivo | Contenido |
| --- | --- |
| `vector-studio.html` | Interfaz: barra de herramientas, lienzo y paneles |
| `vector-studio.css` | Estilos del editor |
| `vector-studio.js` | Modelo, geometría, herramientas y operaciones |
| `vector-export.js` | Exportación a SVG, escritor de PDF e impresión |

---

## 1. Cómo se representa un trazo

Todo el documento vive en **milímetros**, con el origen en la esquina superior
izquierda de la página. Esa es la razón de que lo dibujado en pantalla mida
exactamente lo mismo en el papel.

```js
doc      = { name, page:{ w, h, label }, layers:[capa], active }
capa     = { id, name, visible, locked, items:[objeto] }
objeto   = { id, type:'path', subs:[subtrazo], stroke, width, fill, fillRule,
             dash, cap, join, opacity }
         | { id, type:'text', x, y, text, size, fill, align, opacity }
subtrazo = { closed, nodes:[nodo] }
nodo     = { x, y, hi:{x,y}|null, ho:{x,y}|null }
```

- Un **trazo** (`path`) puede contener varios **subtrazos**: eso es un trazo
  compuesto y permite agujeros y resultados de operaciones booleanas dentro de
  un mismo objeto.
- Cada **nodo** guarda su punto y dos manijas absolutas: `hi` (la que controla
  el segmento que llega) y `ho` (la que controla el segmento que sale). Si ambas
  manijas de un segmento son `null`, el segmento es una **recta**; si hay alguna,
  es una **curva Bézier cúbica**.

Ese modelo es el mismo que usan SVG y PDF, así que la exportación no aproxima
nada: cada segmento se escribe tal cual como `l` (recta) o `c` (curva).

## 2. Herramientas

| Tecla | Herramienta | Uso |
| --- | --- | --- |
| `V` | Seleccionar | Clic, marco de selección, arrastrar para mover, tiradores para escalar |
| `A` | Nodos | Mover nodos y manijas, doble clic inserta un nodo, `Supr` borra |
| `P` | Pluma | Clic = vértice; clic y arrastre = curva; clic en el primer nodo cierra |
| `L` | Línea | Encadena rectas; `Shift` restringe a 15° |
| `B` | Lápiz | Mano alzada; al soltar se simplifica (Douglas–Peucker) y se suaviza |
| `R` / `E` | Rectángulo / Elipse | Arrastrar; `Shift` = cuadrado / círculo |
| `T` | Texto | Coloca el texto del panel Estilo (Helvetica) |
| `K` | Cuchilla | Arrastra una línea: corta todos los trazos que cruce |
| `M` | Medir | Distancia y ángulo entre dos puntos |
| `H` / `Espacio` | Encuadre | Desplaza la vista (rueda = zoom) |

## 3. Operaciones sobre los trazos

**Edición**: copiar, pegar, duplicar, eliminar, deshacer/rehacer (120 pasos),
mover con flechas (`Alt` = 0,1 mm, `Shift` = un paso de rejilla), orden
(al frente / al fondo), alinear y distribuir, capas con visibilidad y bloqueo.

**Trazos**:

- **Unir / soldar** — encadena trazos abiertos cuyos extremos estén a menos de la
  tolerancia indicada (0,6 mm por defecto) y cierra el trazo si los dos extremos
  del resultado coinciden.
- **Separar** — cada subtrazo pasa a ser un objeto independiente.
- **Cerrar / abrir / invertir sentido**.
- **Suavizar** — recalcula manijas tipo Catmull-Rom.
- **Simplificar** — reduce nodos con Douglas–Peucker usando la tolerancia.
- **Curvas → rectas** — aplana las Bézier en polilíneas (útil para plóters y CNC).
- **Cortar en el nodo** — parte un trazo por el nodo seleccionado; en un trazo
  cerrado, lo abre por ahí.
- **Cuchilla** — corta por intersección real: cada segmento cruzado se divide en
  su parámetro `t` con el algoritmo de De Casteljau, así que **las curvas siguen
  siendo curvas después del corte**, y cada pieza queda como objeto propio.

**Booleanas** (suma/unión, resta, intersección, exclusión): se calculan sobre el
contorno aplanado de las formas cerradas. Se parten todas las aristas en sus
intersecciones, se clasifica cada arista según esté dentro o fuera de la otra
figura y se vuelven a encadenar los anillos del resultado. El resultado se
devuelve como un solo trazo compuesto con regla de relleno par-impar.

## 4. Salida

- **PDF** (`Ctrl+E`) — el escritor de PDF está en `vector-export.js` y no usa
  ninguna librería. Convierte mm a puntos (`72/25.4`), invierte el eje Y y emite
  los operadores `m`, `l`, `c`, `h`, `S`, `f`, `B` con color, grosor, remates,
  guiones y transparencia (`ExtGState`). El texto sale como Helvetica base-14 con
  codificación WinAnsi, es decir, **texto seleccionable, no imagen**.
  El `MediaBox` coincide con el tamaño de página, así que el PDF se imprime a
  escala 1:1.
- **SVG** — mismo documento con `width`/`height` en mm y `viewBox` en las mismas
  unidades, para llevarlo a Inkscape, Illustrator, un plóter o una cortadora.
- **Imprimir** (`Ctrl+P`) — inserta el SVG a tamaño real y fija
  `@page { size: <ancho>mm <alto>mm; margin: 0 }` antes de llamar al diálogo de
  impresión del navegador.
- **Proyecto** `.trazo` — el documento en JSON, para volver a editarlo.

## 5. Verificación

La salida se comprobó abriendo el PDF generado con PyMuPDF: una página A4 de
595,28 × 841,89 pt (210 × 297 mm exactos), 15 objetos de dibujo vectoriales y el
texto extraíble. Las herramientas y operaciones se ejercitaron en Chromium
headless (dibujo con ratón, booleanas, cuchilla, unión, edición de nodos, capas,
deshacer y exportación).

## 6. Límites conocidos

- Las operaciones booleanas trabajan sobre el contorno aplanado, no sobre las
  Bézier originales: el resultado es una polilínea densa y puede fallar en casos
  degenerados (aristas exactamente superpuestas). Si el resultado sale vacío, el
  editor lo avisa y no modifica el dibujo.
- El texto no admite rotación ni salto de línea, y se exporta con las fuentes
  base-14 del PDF (Helvetica), sin incrustar tipografías propias.
- Un documento = una página.
