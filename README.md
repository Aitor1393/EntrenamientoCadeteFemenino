# Cadete Femenino Preferente · Serie B · 2026/2027

La temporada, consultable desde el móvil: la sesión de hoy con su cronómetro, el
calendario de los cuatro bloques, las 19 familias con sus pizarras y el plan
completo.

Sitio **estático**: HTML, CSS y JavaScript a pelo. Sin dependencias, sin
compilación, sin framework. Se sirve la carpeta y funciona.

---

## Las cinco pantallas

| Ruta | Qué hace |
|---|---|
| **Hoy** | Qué toca hoy. Si hay sesión, el titular es su tema y el botón grande abre la ficha; si no, dice cuál es la siguiente y cuántos días faltan |
| **Calendario** | Las 66 sesiones por bloque, agrupadas por semana, con la jornada del sábado y una barra que enseña el reparto de cada sesión |
| **Rotaciones** | El reparto de minutos del partido: convocatoria, quién juega cada tanda, quién entra y quién sale en cada cambio, y recálculo si una se lesiona o se carga de faltas. Aplica el mínimo que fija el plan para el bloque y las reglas del entrenador: «siempre al menos N de estas en pista», «como mucho N a la vez», y máximos o mínimos de minutos por jugadora. La plantilla se guarda solo en el navegador |
| **Familias** | Las 19 familias con sus niveles, buscador y filtro por grupo. Cada familia enseña cuántos minutos se lleva en la temporada y cómo se reparten entre bloques |
| **El plan** | Las decisiones que ordenan la temporada y los diez documentos completos |

### La ficha de pista

Es la pantalla que se usa de verdad, con el teléfono en la mano:

- **Línea de tiempo proporcional.** La altura de cada bloque es su duración, así
  que la sesión se lee como lo que dura y no como una lista.
- **Cronómetro con playhead.** Una línea naranja recorre la ficha, resalta el
  bloque en curso, atenúa los pasados y dice cuántos minutos quedan para el
  siguiente. Mantiene la pantalla encendida mientras corre.
- **Pizarra y «cómo se monta».** El dibujo en coordenadas FIBA reales y la
  explicación completa: montaje paso a paso, errores frecuentes y ajuste. Con
  eso no hace falta abrir ningún libro en pista.
- **Imprime bien.** En papel se despliega todo y desaparecen cronómetro y
  botones.

---

## Cómo se trabaja

```bash
python3 scripts/generar.py          # fuentes/ -> data/
python3 -m http.server 8777         # y abrir http://localhost:8777
node pruebas/ejecutar.js            # las 29 pruebas, en un Chromium de verdad
```

**`data/` no se edita a mano nunca.** Se genera. El contenido deportivo vive en
`fuentes/` y el generador lo convierte; si tocas un documento, vuelve a generar
o la web servirá la versión vieja sin avisar. La Action lo comprueba.

---

## Estructura

```
index.html                  una sola página; todas las vistas se pintan por JS
assets/css/estilos.css      tema claro y oscuro
assets/js/                  ver orden de carga más abajo
data/                       GENERADO. No se edita
fuentes/                    el contenido deportivo: documentos y datos.json
scripts/generar.py          fuentes/ -> data/
scripts/md.py               markdown a HTML, lo justo para estos documentos
scripts/preparar-sitio.sh   arma _sitio/ con lo único que se publica
pruebas/                    Playwright vive aquí, no en la raíz
```

### Orden de carga de los módulos

No hay imports: cada archivo cuelga su objeto de `window` y los siguientes lo
usan, así que **el orden en `index.html` importa**.

| Archivo | Global | Qué hace |
|---|---|---|
| `util.js` | `U` | fechas, DOM, almacenamiento. Sin dependencias |
| `pizarra.js` | `PZ` | el motor SVG de las pizarras. Sin dependencias |
| `datos.js` | `D` | el modelo: carga, calcula y decide. **Aquí van las reglas** |
| `vistas.js` | `V` | genera HTML. No toca datos |
| `app.js` | `App` | rutas, eventos, cronómetro y arranque |

---

## Las fuentes

El entrenador tiene cinco libros con derechos reservados. **No se publican
aquí**: se citan por obra y página, y cada ficha lleva su propia explicación
para no necesitarlos a pie de pista. Los enlaces navegables a los PDF siguen
estando en `fuentes/herramientas/biblioteca_ejercicios.html` e
`indice_500.html`, que son herramientas para preparar en casa y funcionan solo
en local, con los PDF al lado.

---

## Publicar

Cloudflare Pages, con Access decidiendo quién entra. Los detalles, en
[`DESPLIEGUE.md`](DESPLIEGUE.md).

Lo que hay que saber: `scripts/preparar-sitio.sh` arma `_sitio/` con
`index.html`, `assets/`, `data/` y `_headers`. **`fuentes/`, `scripts/` y
`pruebas/` se quedan fuera** — no hacen falta para que funcione y los
documentos de trabajo no tienen por qué ser descargables.
