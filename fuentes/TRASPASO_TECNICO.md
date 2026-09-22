# Traspaso técnico

Complementa a `CLAUDE.md`, que tiene el contexto deportivo. Aquí solo **cómo están hechos los tres
artefactos de código** y cómo extenderlos.

---

## 1. Inventario

| Artefacto | Fichero | Tecnología |
|---|---|---|
| Fichas de sesión | `build_fichas.py` + `datos.json` → 4 HTML | **Generadas.** No editar los HTML a mano |
| Biblioteca de fuentes | `herramientas/biblioteca_ejercicios.html` | HTML estático · 92 enlaces `#page=` |
| Hoja de seguimiento | `herramientas/build_seguimiento.py` → `seguimiento_temporada.xlsx` | Python + openpyxl |

---

# PARTE I · Fichas de sesión

## 1 bis. Las fichas se generan, no se editan

```bash
python build_fichas.py
```

Lee `datos.json` (fuente única) y las dos plantillas, y escribe los cuatro HTML. **Cualquier cambio
en un ejercicio se hace en `datos.json` y aparece en los cuatro ficheros a la vez.**

`datos.json` tiene cuatro claves: `D` (67 diagramas), `E` (95 entradas de banco), `DET` (67 detalles)
y `S` (las sesiones de los cuatro bloques). El generador incluye en cada HTML **solo lo que usan sus
propias sesiones**, así que ninguno arrastra datos de los demás.

El script valida antes de escribir y sale con código 1 si encuentra: un código sin entrada en `E`,
una familia sin pizarra o sin detalle, una sesión con huecos o que no cubre de 0 a su duración, o
una fecha que no puede interpretar. **Si imprime «Sin errores», está bien.**

Las plantillas `plantilla_pre.html` y `plantilla_post.html` contienen el motor (estilos, marcado y
funciones SVG) y el código de la app. Solo se tocan para cambiar el comportamiento, no el contenido.

## 2. Qué hace

Una ficha por sesión, para el móvil a pie de pista. Cuatro rasgos:

1. **Línea de tiempo proporcional.** Altura de cada bloque ∝ duración (`--px-min: 10px`).
2. **Cronómetro con playhead.** Línea naranja que recorre la ficha, resalta el bloque actual y
   atenúa los pasados. `navigator.wakeLock` para que no se apague la pantalla.
3. **Pizarras SVG plegables** con la notación estándar de baloncesto.
4. **Botón «Libro»** que abre el PDF de la fuente por la página del ejercicio.

## 3. Restricciones técnicas

- **Un único fichero.** Sin dependencias salvo Google Fonts (Barlow y Barlow Condensed), con
  fallback a `system-ui`.
- **Prohibido `localStorage` y `sessionStorage`.** No funcionan en el entorno de render. Todo el
  estado en variables JS.
- **JS ES5-compatible** (`var`, `function`, `Array.prototype.forEach.call`) por compatibilidad con
  navegadores móviles antiguos.
- **Debe imprimir bien.** `@media print` oculta cronómetro y botones, despliega todas las pizarras
  y fuerza `page-break-inside: avoid`.

## 4. Modelo de datos

Tres objetos globales en el `<script>`, en orden: `D`, `E`, `S`. Más cuatro constantes de ruta:
`P500`, `P40D`, `P75`, `P25C`.

### `D` — Diagramas

```js
"F12-N1": {
  v: "c",                                  // "m" media pista · "c" pista completa
  o: [[28,75,"R",1],[48,24,"1"]],          // atacantes: [x, y, etiqueta, tieneBalón?]
  x: [[192,75,""]],                        // defensoras: [x, y, etiqueta]
  k: [[54,55]],                            // conos: [x, y]
  ps: [[33,72,45,28]],                     // pases (discontinua): [x1,y1,x2,y2, curvatura?]
  mv: [[54,26,186,30,0]],                  // desplazamientos (continua)
  dr: [[75,120,75,93]],                    // botes (ondulada): [x1,y1,x2,y2]
  t: "Texto explicativo bajo el diagrama"
}
```

Curvatura = desplazamiento perpendicular del punto de control de una Bézier cuadrática. `0` u
omitido = recta.

**Orden de dibujo:** `mv` → `ps` → `dr` → `k` → `x` → `o`. Los jugadores al final para quedar encima.

### `E` — Banco de ejercicios

```js
"F13-N1": {
  t: "fis",                    // tipo → color de barra: prev, tec, fis, jue, org
  n: "Superioridad: 2c1 continuo",
  m: "2 grupos de 6 · 1 balón",        // organización
  c: "Clave técnica de ataque",        // línea con borde gris
  d: "Defensa (F11-N1): ...",          // línea con borde naranja — el segundo objetivo
  x: "Carrera a 8. Ataque 1, defensa 2.",  // marcador
  l: P500 + "#page=295"                // cita de la fuente
}
```

`l` **ya no genera un botón**: se renderiza como una línea de texto en cursiva
(*«Ver también: 500 Ejercicios, p. 295»*) mediante la función `cita(l)`. La decisión es del
entrenador: a pie de pista no hay tiempo de cambiar de aplicación, así que la ficha tiene que
bastarse sola. Los enlaces navegables viven solo en `indice_500.html` y `biblioteca_ejercicios.html`,
que son herramientas de preparación en casa.

El campo `d` es el que materializa **«cada desigualdad por las dos caras»**: en el mismo bloque
aparecen la consigna de ataque y la de defensa.

### `DET` — Detalle del ejercicio *(nuevo)*

Alimenta el panel «Cómo se monta», que es lo que permite no abrir el PDF en pista.

```js
"F8-N2": {
  m: ["paso 1 del montaje", "paso 2", "paso 3"],   // Cómo se monta
  e: ["error frecuente 1", "error 2"],             // Errores frecuentes (se pintan en naranja)
  a: ["cómo subir o bajar la dificultad"]          // Ajuste
}
```

Las tres claves son opcionales. `detalle(d)` compone el HTML y el botón solo aparece si
`DET[cod]` existe.

**Estado: completo.** Los 67 ejercicios que aparecen en alguna sesión tienen pizarra y detalle.

### `S` — Sesiones

```js
{ n: 6,
  f: "Viernes 18 de septiembre",
  d: 105,                      // duración: 75 martes, 105 viernes
  c: "alta",                   // "alta" | "media" | "baja"
  tema: "La zona y las calles",
  b: [[0,18,"F16L","sc"], [18,30,"F3-N3","sc"], ... [98,105,"TL"]] }
```

Bloque = `[minutoInicio, minutoFin, códigoEjercicio, flag?]`. El flag `"sc"` marca **sin canasta** y
renderiza un chip gris.

**Invariantes:** el primer bloque empieza en 0, el último termina en `d`, sin huecos ni
solapamientos. `marcar()` usa `S[idx].d` — **nunca 60**, que era el valor fijo de versiones viejas.

## 5. Coordenadas de las pizarras

**1 unidad = 10 cm.** Medidas FIBA reales.

### Media pista — `viewBox="-7 -7 164 154"`

| Elemento | Coordenadas |
|---|---|
| Pista | rect (0,0) 150 × 140 |
| Línea de fondo | y = 0 (arriba) · **el ataque va hacia arriba** |
| Medio campo | y = 140 |
| Centro del aro | (75, 15.75) |
| Tablero | (66,12) a (84,12) |
| Zona | x 50.5-99.5, y 0-58 |
| Círculo de tiro libre | centro (75,58), r = 18 |
| Triple, rectas | x = 9 y x = 141, de y = 0 a y = 29.9 |
| Triple, arco | `A 67.5,67.5 0 0 0 141,29.9` |

### Pista completa — `viewBox="-7 -7 294 164"`

280 × 150 horizontal. Aros en (15.75, 75) y (264.25, 75). Medio campo en x = 140.
`aro(x0, s, sw)` dibuja cada mitad espejada: `s` es el signo de dirección, `sw` el sweep-flag.

## 6. Motor de dibujo

| Función | Qué hace |
|---|---|
| `defsSVG()` | Marcador de punta de flecha |
| `pistaMedia()` / `pistaCompleta()` | Líneas de la pista |
| `ctrl(x1,y1,x2,y2,cv)` | Punto de control de la Bézier |
| `flecha(x1,y1,x2,y2,cv,tipo)` | `tipo="p"` añade `stroke-dasharray` (pase) |
| `bote(x1,y1,x2,y2)` | Polilínea ondulada, amplitud 2.6 |
| `atac(x,y,t,bal)` | Círculo azul con número; `bal` añade el balón |
| `defe(x,y,t)` | Aspa naranja |
| `cono(x,y)` | Triángulo gris |
| `pizarra(d)` | Compone el SVG completo desde una entrada de `D` |

## 7. Cómo extender

**Añadir un ejercicio:** entrada en `E` con su código (`F\d+-N\d+` para que se muestre la etiqueta
naranja), entrada en `D` si lleva diagrama, y referenciarlo desde un bloque de `S`.

**Crear las fichas de M1, M2 o M3:** duplicar el fichero y reemplazar `S` y las entradas nuevas de
`E`/`D`. En M1 y posteriores las sesiones siguen **dos plantillas fijas** (martes carga / viernes
táctica) y lo que cambia es qué familia entra en cada hueco: ver `docs/03_M1_construccion.md` §3.

**Familias sin diagramas todavía:** F7 (defensa sin balón), F14 (transición), F17 (situaciones y
saques), F18 (ataque contra zona). Son las que hay que dibujar para las fichas de M1 y M2.

**Enlaces al libro:** añadir el campo `l` a la entrada de `E`, concatenando la constante de ruta con
`"#page=N"`. Verificar que N está dentro del rango: 500→320 pp, 40D→57, 75DM→30, 25C→30.

## 8. Validación

```bash
# 1 · Motor y pizarras
python3 -c "
s=open('fichas_sesion_M0.html',encoding='utf-8').read()
js=s[s.index('<script>')+8:s.rindex('</script>')]
open('/tmp/eng.js','w').write(js[:js.index('var idx=0')])"
cat >> /tmp/eng.js <<'EOF'
var bad=[]; Object.keys(D).forEach(function(k){var g=pizarra(D[k]);
 if(!g||g.indexOf('<svg')!==0||/NaN|undefined/.test(g)) bad.push(k);});
console.log('pizarras:',Object.keys(D).length,'| problemas:',bad.length?bad:'ninguno');
var sinD=[]; S.forEach(function(x){x.b.forEach(function(b){
 if(/^F\d+-N\d+$/.test(b[2])&&!D[b[2]]) sinD.push(b[2]);});});
console.log('ejercicios de familia sin pizarra:',sinD.length?sinD:'ninguno');
EOF
node /tmp/eng.js
```

```bash
# 2 · Continuidad de las sesiones
python3 - <<'PY'
import re
s=open('fichas_sesion_M0.html',encoding='utf-8').read()
ss=s[s.index('var S = ['):s.index('var idx=0')]
for m in re.finditer(r'\{n:(\d+),.*?d:(\d+),.*?b:\[(.*?)\]\}', ss, re.S):
    n,d=int(m.group(1)),int(m.group(2))
    t=[(int(a),int(b)) for a,b in re.findall(r'\[(\d+),(\d+),', m.group(3))]
    ok = t[0][0]==0 and t[-1][1]==d and all(t[i][1]==t[i+1][0] for i in range(len(t)-1))
    print('S%-2d %3d min  %s' % (n, d, 'ok' if ok else 'MAL '+str(t)))
PY
```

También: códigos usados en `S` que no existen en `E`, y entradas de `D` huérfanas.

---

# PARTE II · Biblioteca de fuentes

Fichero HTML estático con 92 enlaces `<a href="ARCHIVO.pdf#page=N">`. **Rutas relativas**: el
fichero tiene que estar en la misma carpeta que los PDF, con los nombres exactos.

Validación: extraer todos los `href="([^#]+)#page=(\d+)"` y comprobar que N ≤ número de páginas del
archivo correspondiente.

**Bloque `CONFIGURACIÓN`.** Al final de ambos ficheros hay un objeto `PDF` con cuatro líneas
—una por libro— y un script que reescribe todos los `href` al cargar la página. Sirve para cambiar
el nombre del archivo, apuntar a una subcarpeta o usar una ruta absoluta
(`file:///C:/Users/.../500.pdf`) sin tocar los 213 enlaces uno a uno.

**Limitaciones conocidas:**
- El anclaje `#page=` funciona en Chrome, Edge, Firefox y Adobe Reader de escritorio;
  **en móvil es irregular** según el visor.
- Los enlaces son **relativos**: solo funcionan abriendo el HTML desde una carpeta local con los PDF
  al lado. Desde un visor web dan 404 siempre.
- Las dos versiones del libro de Čikić **difieren en una página**: la copia `_sin_cpr` va una menos
  que la original. Los enlaces actuales asumen `_sin_cpr`.

---

# PARTE III · Hoja de seguimiento

## 8 bis. Dependencias

```bash
pip install openpyxl        # obligatorio para build_seguimiento.py
node --version              # opcional, solo para los scripts de validación del motor SVG
```

Para recalcular el Excel hace falta LibreOffice. Si no tienes el script `recalc.py`, vale con:

```bash
soffice --headless --convert-to xlsx --outdir /tmp seguimiento_temporada.xlsx
```

y después abrir el resultado con `openpyxl(..., data_only=True)` para comprobar que no hay `#REF!`
ni `#VALUE!`.

## 9. Estructura

`build_seguimiento.py` genera un `.xlsx` de **8 hojas**: Instrucciones, Partidos, Minutos,
Test físico, Test técnico, Panel, RPE, Asistencia.

## 10. Convenciones de estilo

| Elemento | Estilo |
|---|---|
| Fuente | Arial en todo el libro |
| Celda a rellenar | Relleno `FFF2CC` + fuente azul `0000FF` |
| Celda calculada | Relleno `F2F2F2` + fuente negra |
| Cabecera | Relleno `1F3864` + blanca en negrita |
| Totales | Relleno `D9E2F3` + negrita |
| Verde / rojo | `C6EFCE` / `FFC7CE`, solo por formato condicional |

**Regla:** el usuario solo escribe en celdas amarillas.

## 11. Generador de calendario

```python
festivos    = {2026-12-08, 2026-12-25, 2027-01-01, 2027-03-26}
voluntarias = {2026-12-29, 2027-01-05, 2027-01-08}
DUR = {1: 75, 4: 105}   # weekday → minutos: martes 75, viernes 105
```

Recorre **martes y viernes** del 1 sept 2026 al 28 may 2027, salta festivos, y en el parón navideño
(20 dic – 8 ene) conserva solo las tres voluntarias. Salen **73 sesiones en 38 semanas**:
10 / 21 / 3 / 18 / 3 / 8 / 10 por bloque.

La columna «Min» de la hoja RPE viene **prerrellenada con 75 o 105**. Es crítico: carga = RPE ×
minutos, así que un 7 de martes son 525 UA y uno de viernes 735.

## 12. Fórmulas críticas

```python
=IFERROR(I{r}/(I{r}+J{r}),"")                      # % rebote defensivo
=IF(F{r}="","",E{r}*F{r})                          # carga de sesión
=SUMIF($A$6:$A$112, J{r}, $G$6:$G$112)             # carga semanal
=IFERROR(IF(OR(L{r}="",L{r-1}=""),"",L{r}/L{r-1}-1),"")   # Δ semanal
```

El formato condicional usa `FormulaRule` con `AND(celda<>"", condición)` para no colorear vacías.

## 13. Validación

```bash
python build_seguimiento.py
python /ruta/a/recalc.py seguimiento_temporada.xlsx 120
```

Debe dar `total_errors: 0`. Actualmente ~588 fórmulas.

---

## 14. Tareas concretas

Por orden de utilidad para el entrenador:

1. **Diagramas de saques** de banda y fondo, que no existen en ningún sitio.
3. **Decidir sobre F19, rebote ofensivo.** Está en el modelo de juego pero no tiene familia.
   Fuente: [500] pp. 123-132.
4. **Generador de matriz de sociograma:** 12 jugadoras × 2 ejes (deportivo y social), con hoja de
   resultados que identifique líder deportiva, líder social, ambas y zona de riesgo.
5. **Plantilla de scouting y plan de partido** de tres ideas, alimentada por la hoja Partidos.
6. **Refactor:** extraer `D`, `E` y `S` a JSON y generar el HTML desde un script, para que las fichas
   de los cinco bloques compartan motor en lugar de duplicarlo. Con cinco bloques por delante, esto
   deja de ser opcional.

---

## 15. Trampas conocidas

- **Los códigos de familia cambiaron de significado** en septiembre de 2026. F8 era la zona y ahora
  es el rebote; F3 era el rebote y ahora es el pase. Cualquier documento o fichero anterior a esa
  fecha usa la numeración vieja.
- **Las sesiones no duran todas lo mismo.** Cualquier comparación con `60` en el JS es un bug
  heredado: usar `S[idx].d`.
- **El playhead se calcula sobre `offsetTop`/`offsetHeight` reales**, no sobre la proporción teórica,
  porque los bloques cortos crecen para acomodar contenido. Al desplegar una pizarra hay que volver
  a llamar a `marcar()`.
- **El PDF de las bases federativas no es un PDF:** es un ZIP con extensión `.pdf`. Hay que
  `unzip`, y dentro salen `N.txt` y `N.jpeg` por página.
- **`100_Ejercicios_Extra_de_Baloncesto.pdf` tampoco es un PDF:** es texto plano UTF-8 con CRLF.
- **El sweep-flag del arco de triple** es 0 en media pista y cambia de signo entre las dos mitades en
  pista completa. Si el arco sale hacia el lado equivocado, es eso.
- **Las fuentes no se transcriben.** Son obras con derechos; se referencian por número y página.
