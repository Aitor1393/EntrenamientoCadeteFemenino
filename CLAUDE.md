# Guía del proyecto

Léeme antes de tocar nada. El `README.md` explica **cómo se usa** la web; esto
explica **cómo está hecha** y, sobre todo, las cosas que conviene no
redescubrir.

Todo lo que se escribe aquí —código, comentarios, mensajes de commit y
respuestas al usuario— va **en español**, con terminología de la Federación de
Baloncesto de Madrid. No traducir ni anglizar: se dice «contraataque», no
«fastbreak»; «balance defensivo», no «transition defense».

---

## Qué es

Web de consulta de la temporada 2026/2027 de un equipo **cadete femenino** que
compite en el Campeonato de Madrid Preferente, Serie B. El entrenador es Aitor.

**El contenido deportivo no se inventa ni se modifica.** Los documentos de
`fuentes/` son la única verdad. Si algo no está en ellos, no existe. Antes de
tocar contenido deportivo, preguntar; antes de tocar código, adelante.

Que no haya build ni dependencias es una decisión, no una carencia: cualquiera
puede editar un archivo y ver el resultado recargando. No metas un empaquetador
ni una librería sin que el usuario lo pida.

---

## El contenido no se copia, se genera

```bash
python3 scripts/generar.py
```

Lee `fuentes/` y escribe `data/`. **`data/` no se edita a mano nunca.** Si
tocas un documento y no vuelves a generar, la web sirve la versión vieja sin
avisar; la Action lo comprueba comparando el árbol generado con el commiteado.

De dónde sale cada cosa:

| Fuente | Qué aporta |
|---|---|
| `fuentes/herramientas/datos.json` | diagramas, banco de ejercicios, detalles y las sesiones de los cuatro bloques |
| `fuentes/CLAUDE.md` | las 19 familias con su grupo, y las secciones de plan que se consultan en la web |
| `fuentes/docs/01_banco_ejercicios.md` | los niveles de cada familia, con clave, marcador y referencia a los libros |
| `fuentes/docs/03,04,05` | las jornadas por semana, de las tablas de calendario |
| `fuentes/docs/` y `fuentes/revisiones/` | los diez documentos completos, convertidos a HTML |

**El generador sale en rojo si una fuente cambia de forma.** Es lo que se espera
de él: mejor rojo que publicar media temporada en silencio. Cada comprobación
dice qué esperaba encontrar. Los avisos (familias sin niveles, jornadas que no
aparecen) se imprimen pero no cortan.

---

## Dónde va cada cosa

Una regla de negocio va en `datos.js`, aunque solo la use una vista: así se
puede razonar sin navegador y no se duplica. `vistas.js` pinta y no decide. Si
te ves calculando algo dentro de un `V.` o de un `App.`, casi seguro va en `D.`.

`pizarra.js` es el motor SVG y no depende de nada: se puede probar suelto.

---

## Reglas deportivas que el código respeta

Si añades una vista o un cálculo, míralas:

- **Martes 75 min, viernes 105.** Son las dos únicas duraciones. El martes lleva
  toda la carga física; el viernes es D-1 y lleva táctica a intensidad
  cognitiva, no física.
- **MD-4 el martes, MD-1 el viernes.** `D.md()` lo calcula desde el sábado de
  la jornada. Sin partido esa semana no hay MD, y eso es información, no un
  hueco: son los viernes que sí pueden cargar.
- **«Sin partido» no es lo mismo que «sin jornada».** En pretemporada no hay
  competición todavía; marcar allí «sin partido» insinuaría un descanso que no
  existe. El dato lo distingue: `sesion.sinPartido` solo es cierto cuando un
  documento declara esa semana libre dentro de la liga.
- **Los primeros 30 minutos del viernes van sin canasta.** El flag viaja en cada
  bloque (`sinCanasta`) y se pinta como un chip.
- **Cada desigualdad se entrena por las dos caras.** El campo `defensa` de un
  ejercicio es el segundo objetivo del mismo bloque, y va destacado en naranja
  precisamente para que no se lea como un adorno.

---

## Las pizarras

**1 unidad = 10 cm.** Medidas FIBA reales.

| | viewBox | Notas |
|---|---|---|
| Media pista | `-7 -7 164 154` | 150 × 140. **El ataque va hacia arriba**: la línea de fondo es y = 0 |
| Pista entera | `-7 -7 294 164` | 280 × 150. Aros en x = 15.75 y x = 264.25, medio campo en x = 140 |

Orden de dibujo: `mv` → `ps` → `dr` → `k` → `x` → `o`. Las atacantes al final,
para quedar encima de todo lo demás.

**Cada pizarra genera su propio marcador de flecha.** En las fichas originales
había una por página y bastaba un id fijo; aquí hay varias en la misma pantalla
y un id repetido haría que todas las flechas apuntasen al marcador de la
primera, de modo que al plegarla desaparecerían las puntas del resto. Hay una
prueba que lo vigila.

**El sweep-flag del arco de triple** es 0 en media pista y cambia de signo entre
las dos mitades en pista completa. Si un arco sale hacia el lado equivocado, es
eso.

---

## Trampas conocidas

**Las fechas se construyen a mediodía.** Con `new Date('2027-01-12')` el
navegador interpreta UTC y en España eso puede caer el día anterior. `U.aFecha`
lo hace a las 12:00 locales, donde ningún huso cambia el día.

**El playhead se calcula sobre `offsetTop`/`offsetHeight` reales**, no sobre la
proporción teórica, porque los bloques cortos crecen para acomodar su
contenido. Al desplegar una pizarra hay que volver a llamar a `App.marcar()`.

**El cronómetro vive en `App`, no en la vista.** Las vistas se repintan enteras,
así que si el tiempo viviera en el DOM se reiniciaría al desplegar cualquier
cosa. Cambiar de sesión sí lo reinicia, a propósito: seguir contando el de la
anterior sería peor que no contar nada.

**Los botones de plegar conservan su nombre al abrirse.** Cambiarlos por
«Ocultar» deja dos botones idénticos cuando están abiertas la pizarra y el
montaje, y ya no se sabe cuál cierra cuál.

**Los documentos son texto, no marcado de confianza.** `scripts/md.py` escapa
siempre el HTML del original antes de dar formato, y hay una prueba que
comprueba que no entra ningún `<script>`.

**Las sesiones no duran todas lo mismo.** Cualquier comparación con un número
fijo de minutos es un error: usa `sesion.duracion`.

---

## Qué no se publica

`scripts/preparar-sitio.sh` arma `_sitio/` con `index.html`, `assets/`, `data/`
y `_headers`. **Fuera se quedan `fuentes/`, `scripts/` y `pruebas/`.** La Action
lo comprueba: si algo de `fuentes/` acabara en `_sitio/`, falla.

**Los cinco libros del entrenador no están en el repositorio y no deben
estarlo.** Son obras con derechos. Se citan por obra y página —eso es texto, no
un enlace— y cada ficha lleva su propia explicación para que en pista no haga
falta abrir nada. Si alguien pide «que el botón Libro abra el PDF», la respuesta
es que esa herramienta ya existe en `fuentes/herramientas/` y funciona en local.

**Datos personales de menores: ninguno.** El seguimiento de minutos, asistencia,
RPE y tests de las 12 jugadoras se queda en el Excel, en local. No añadas
funcionalidad que los suba al repositorio sin plantearlo antes: hay
implicaciones de protección de datos y el club tiene un Delegado de Protección
de Menores.

La pantalla de **Rotaciones** es la excepción controlada: la plantilla y el
reparto se guardan en `localStorage` (`cf:rotaciones`) del navegador del
entrenador y no salen de ahí. Ni `data/`, ni el repositorio, ni ningún
servidor. Cualquier cambio que la sincronice o la comparta se plantea antes.

Las reglas del reparto son del entrenador, no del plan, y obligan. Si un
partido no da para todas, `D.repartirMinutos` afloja en un orden fijo —el
mínimo general, luego los mínimos individuales, y lo último quién tiene que
estar en pista— y **lo dice**. Nunca se salta una regla en silencio. Los
minutos van por tandas enteras: «máximo 8» con tandas de 5 es 5, y con tandas
de 10 es no jugar, y también se avisa. Si un máximo del entrenador queda por
debajo del mínimo del plan, **manda el máximo** —lo decidió él— y el reparto
lo dice.

---

## Probar los cambios

Hay **29 pruebas en `pruebas/`** que abren la web en un Chromium de verdad.

```bash
python3 -m http.server 8777          # desde la raíz, en otra terminal
node pruebas/ejecutar.js             # las 29
node pruebas/ejecutar.js ficha       # solo las que contengan «ficha»
```

Sale 0 si pasan todas, 1 si falla alguna y 2 si no encuentra el servidor. Si el
entorno trae el navegador ya instalado y no deja descargarlo, apunta a él con
`CHROMIUM=/ruta/al/chromium`.

Al escribir una nueva, la regla que evita rojos falsos: **no fijes cifras que
dependan del contenido.** «Espera 66 sesiones» caduca en cuanto se toque un
documento. Comprueba propiedades —que los bloques no dejen huecos, que los
grupos sumen el total— y saca los números del propio JSON.

---

## Al terminar algo

1. `python3 scripts/generar.py` y pasa las pruebas.
2. **Míralo en el navegador.** Más de una cosa se ve solo ahí: el cronómetro
   apretado en 400 px o dos botones con el mismo nombre no los pilla ninguna
   prueba.
3. Commit en español, explicando **por qué**, no solo qué.
4. `git fetch origin main` y rebase antes de empujar.
