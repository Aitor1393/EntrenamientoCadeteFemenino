/* Pruebas de la web en un Chromium de verdad.

   Uso, con el sitio servido en el puerto 8777:
     python3 -m http.server 8777
     node pruebas/ejecutar.js
     node pruebas/ejecutar.js ficha      (solo las que contengan «ficha»)

   Sale 0 si pasan todas, 1 si falla alguna y 2 si no encuentra el servidor.

   Regla al escribir una nueva: no fijes cifras que dependan del contenido
   («espera 66 sesiones» caduca en cuanto se toque un documento). Comprueba
   propiedades —que los bloques no dejen huecos, que los tres grupos sumen el
   total— y saca los números del propio JSON. */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE || 'http://localhost:8777/';
const filtro = process.argv[2] || '';
const raiz = path.join(__dirname, '..');

const leer = (n) => JSON.parse(fs.readFileSync(path.join(raiz, 'data', n), 'utf8'));
const sesiones = leer('sesiones.json');
const familias = leer('familias.json');
const ejercicios = leer('ejercicios.json');
const temporada = leer('temporada.json');

const pruebas = [];
const prueba = (nombre, fn) => pruebas.push({ nombre, fn });

function afirmar(condicion, mensaje) {
  if (!condicion) throw new Error(mensaje);
}

/* Va a una ruta y espera a que la pantalla esté pintada. Sin esto las pruebas
   se leen el «Cargando la temporada…» y fallan por carreras, no por errores. */
async function ir(page, hash) {
  await page.goto(BASE + '#' + hash, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => window.location.reload());
  await page.waitForFunction(() => window.D && window.D.cargado, null, { timeout: 15000 });
  await page.waitForFunction(() => !document.querySelector('#app .cargando'), null, { timeout: 15000 });
}

/* Navega sin recargar, que es como se usa de verdad: el cronómetro y el estado
   del buscador tienen que sobrevivir a un cambio de hash.

   Cada prueba abre una pestaña nueva, así que si todavía no se ha cargado nada
   hace la primera visita completa. Sin esto, una prueba que empiece por aquí
   trabajaría sobre una página en blanco y fallaría por eso y no por un fallo
   de la web. */
async function irSinRecargar(page, hash) {
  const listo = await page.evaluate(() => !!(window.D && window.D.cargado))
    .catch(() => false);
  if (!listo) return ir(page, hash);
  await page.evaluate((h) => { window.location.hash = h; }, hash);
  await page.waitForFunction(() => !document.querySelector('#app .cargando'));
}

/* ------------------------------------------------------------------ pruebas */

prueba('carga sin errores de consola ni de página', async (page, errores) => {
  await ir(page, '/hoy');
  afirmar(errores.length === 0, 'errores en consola: ' + errores.join(' | '));
});

prueba('hoy acierta con lo que toca hoy según el calendario', async (page) => {
  await ir(page, '/hoy');
  const titulo = await page.textContent('#app h1');
  afirmar(titulo && titulo.trim().length > 0, 'la pantalla de Hoy no tiene titular');

  /* La fecha se saca del propio navegador para que la prueba siga valiendo
     cualquier día del año, dentro y fuera de temporada. */
  const hoy = await page.evaluate(() => window.U.hoyIso());
  const deHoy = sesiones.find((s) => s.fecha === hoy);
  const enlaces = await page.$$eval('a[href^="#/sesion/"]',
    (n) => n.map((x) => x.getAttribute('href')));

  if (deHoy) {
    afirmar(enlaces.includes('#/sesion/' + deHoy.id),
      `hoy hay sesión (${deHoy.id}) y Hoy no enlaza a su ficha`);
    afirmar(titulo.includes(deHoy.tema),
      `el titular de Hoy debería ser «${deHoy.tema}» y es «${titulo}»`);
  } else {
    /* Sin sesión hoy, lo útil es saber cuál es la siguiente. */
    const proxima = sesiones.find((s) => s.fecha > hoy);
    if (proxima) {
      afirmar(enlaces.includes('#/sesion/' + proxima.id),
        'sin sesión hoy, Hoy debería enlazar a la siguiente');
    }
  }
});

prueba('el calendario lista todas las sesiones y enlaza a cada una', async (page) => {
  await ir(page, '/calendario');
  const enlaces = await page.$$eval('.cal__fila', (n) => n.map((x) => x.getAttribute('href')));
  afirmar(enlaces.length === sesiones.length,
    `el calendario pinta ${enlaces.length} sesiones y hay ${sesiones.length}`);
  const esperados = sesiones.map((s) => '#/sesion/' + s.id).sort();
  afirmar(JSON.stringify(enlaces.slice().sort()) === JSON.stringify(esperados),
    'los enlaces del calendario no coinciden con los ids de las sesiones');
});

prueba('el calendario separa los bloques que declara la temporada', async (page) => {
  await ir(page, '/calendario');
  const encabezados = await page.$$eval('#app h2', (n) => n.map((x) => x.textContent.trim()));
  for (const b of temporada.bloques) {
    if (!sesiones.some((s) => s.bloque === b.id)) continue;
    afirmar(encabezados.includes(b.nombre), `falta el encabezado del bloque ${b.nombre}`);
  }
});

prueba('ficha: los bloques cubren la sesión entera sin huecos', async (page) => {
  /* Se comprueba en las cuatro primeras de cada bloque: abrir las 66 son varios
     minutos y la propiedad es la misma. */
  const muestra = [];
  for (const b of temporada.bloques) {
    muestra.push(...sesiones.filter((s) => s.bloque === b.id).slice(0, 4));
  }
  for (const s of muestra) {
    await irSinRecargar(page, '/sesion/' + s.id);
    const tramos = await page.$$eval('.blk', (n) => n.map((x) => [
      +x.getAttribute('data-desde'), +x.getAttribute('data-hasta')]));
    afirmar(tramos.length > 0, `${s.id} no pinta ningún bloque`);
    afirmar(tramos[0][0] === 0, `${s.id} no empieza en el minuto 0`);
    afirmar(tramos[tramos.length - 1][1] === s.duracion,
      `${s.id} acaba en ${tramos[tramos.length - 1][1]} y dura ${s.duracion}`);
    for (let i = 0; i < tramos.length - 1; i++) {
      afirmar(tramos[i][1] === tramos[i + 1][0],
        `${s.id}: hueco en el minuto ${tramos[i][1]}`);
    }
  }
});

prueba('ficha: la altura de cada bloque es proporcional a su duración', async (page) => {
  const larga = sesiones.filter((s) => s.duracion === 105)[0];
  await irSinRecargar(page, '/sesion/' + larga.id);
  const filas = await page.$$eval('.blk', (n) => n.map((x) => ({
    min: +x.getAttribute('data-hasta') - +x.getAttribute('data-desde'),
    alto: x.offsetHeight
  })));
  /* No se fija una escala concreta: basta con que un bloque del doble de
     minutos no sea más bajo que uno corto. Los cortos crecen para acomodar su
     contenido, así que la proporción exacta no se cumple por abajo. */
  const corto = filas.reduce((a, b) => (b.min < a.min ? b : a));
  const largo = filas.reduce((a, b) => (b.min > a.min ? b : a));
  afirmar(largo.alto > corto.alto,
    `el bloque de ${largo.min} min no es más alto que el de ${corto.min} min`);
});

prueba('ficha: el cronómetro arranca, marca el bloque en curso y se reinicia', async (page) => {
  const s = sesiones[0];
  await irSinRecargar(page, '/sesion/' + s.id);
  afirmar(await page.textContent('#crono') === '00:00', 'el cronómetro no empieza en 00:00');

  await page.click('#cronoPlay');
  await page.waitForFunction(() => document.querySelectorAll('.blk.ahora').length === 1,
    null, { timeout: 5000 });
  const visible = await page.$eval('#playhead', (n) => n.style.display);
  afirmar(visible === 'block', 'el playhead no aparece al arrancar');

  await page.click('#cronoReset');
  afirmar(await page.textContent('#crono') === '00:00', 'reiniciar no pone el cronómetro a cero');
  afirmar((await page.$$('.blk.ahora')).length === 0, 'tras reiniciar sigue habiendo bloque en curso');
});

prueba('ficha: cambiar de sesión reinicia el cronómetro', async (page) => {
  await irSinRecargar(page, '/sesion/' + sesiones[0].id);
  await page.click('#cronoPlay');
  await page.waitForFunction(() => document.querySelectorAll('.blk.ahora').length === 1);
  await irSinRecargar(page, '/sesion/' + sesiones[1].id);
  afirmar(await page.textContent('#crono') === '00:00',
    'el cronómetro arrastra el tiempo de la sesión anterior');
  const corriendo = await page.evaluate(() => window.App.crono.corriendo);
  afirmar(corriendo === false, 'el cronómetro sigue corriendo en la sesión nueva');
});

prueba('ficha: las pizarras se despliegan y el SVG sale entero', async (page) => {
  const conPizarra = sesiones.find((s) =>
    s.bloques.some((b) => ejercicios[b.codigo] && ejercicios[b.codigo].diagrama));
  await irSinRecargar(page, '/sesion/' + conPizarra.id);

  const boton = await page.$('.plega[data-abrir="Pizarra"]');
  afirmar(boton, 'esa sesión debería tener botón de pizarra');
  const panel = await page.$('#' + (await boton.getAttribute('aria-controls')));
  afirmar(!(await panel.isVisible()), 'la pizarra empieza desplegada');
  await boton.click();
  afirmar(await panel.isVisible(), 'la pizarra no se despliega al pulsar');
  afirmar(await boton.getAttribute('aria-expanded') === 'true', 'aria-expanded no se actualiza');

  const svg = await panel.innerHTML();
  afirmar(/NaN|undefined/.test(svg) === false, 'el SVG de la pizarra tiene NaN o undefined');
  afirmar(svg.includes('<svg'), 'el panel de pizarra no contiene un SVG');
});

prueba('ficha: cada pizarra usa su propio marcador de flecha', async (page) => {
  /* Con un id repetido todas las flechas apuntarían al marcador de la primera
     pizarra de la página, y al ocultarla desaparecerían las puntas del resto. */
  const conVarias = sesiones.find((s) =>
    s.bloques.filter((b) => ejercicios[b.codigo] && ejercicios[b.codigo].diagrama).length > 1);
  afirmar(conVarias, 'no hay ninguna sesión con dos pizarras, revisa la prueba');
  await irSinRecargar(page, '/sesion/' + conVarias.id);
  const ids = await page.$$eval('#tl marker', (n) => n.map((x) => x.id));
  afirmar(ids.length > 1, 'esperaba varios marcadores');
  afirmar(new Set(ids).size === ids.length, 'hay marcadores con el mismo id: ' + ids.join(', '));
});

prueba('ficha: el panel «cómo se monta» trae montaje y errores', async (page) => {
  const cod = Object.keys(ejercicios).find((c) => {
    const e = ejercicios[c];
    return e.detalle && e.detalle.m && e.detalle.e;
  });
  const sesion = sesiones.find((s) => s.bloques.some((b) => b.codigo === cod));
  await irSinRecargar(page, '/sesion/' + sesion.id);
  const boton = await page.$('.plega[data-abrir="Cómo se monta"]');
  afirmar(boton, 'no hay botón de «cómo se monta»');
  await boton.click();
  const texto = await page.textContent('.detalle');
  afirmar(/Cómo se monta/.test(texto), 'el panel no trae el montaje');
  afirmar(/Errores frecuentes/.test(texto), 'el panel no trae los errores frecuentes');
});

prueba('ficha: la víspera de partido avisa de que no admite carga', async (page) => {
  const vispera = sesiones.find((s) => s.jornada &&
    new Date(s.fecha + 'T12:00:00').getDay() === 5);
  if (!vispera) return;   // si un día deja de haber viernes con partido, no es un fallo
  await irSinRecargar(page, '/sesion/' + vispera.id);
  const texto = await page.textContent('#app');
  afirmar(/víspera/i.test(texto), 'un viernes con partido detrás no avisa de que es víspera');
  afirmar(/MD-1/.test(texto), 'la víspera no está marcada como MD-1');
});

prueba('calendario: «sin partido» solo donde el calendario lo dice', async (page) => {
  /* En pretemporada no hay competición: marcar allí «sin partido» insinuaría un
     descanso que no existe. La etiqueta es solo para las semanas que los
     documentos declaran libres dentro de la liga. */
  await ir(page, '/calendario');
  const libres = sesiones.filter((s) => s.sinPartido).length;
  const badges = await page.$$eval('.cal__semana .eti--bien', (n) => n.length);
  const semanasLibres = new Set(sesiones.filter((s) => s.sinPartido).map((s) => s.lunes)).size;
  afirmar(badges === semanasLibres,
    `hay ${badges} etiquetas «sin partido» y ${semanasLibres} semanas libres`);
  if (libres > 0) afirmar(badges > 0, 'no se marca ninguna semana libre');

  const pretemporada = sesiones.filter((s) => s.bloque === 'M0');
  afirmar(pretemporada.every((s) => !s.sinPartido),
    'alguna sesión de pretemporada está marcada como semana sin partido');
});

prueba('familias: están todas y el filtro por grupo reparte el total', async (page) => {
  await ir(page, '/familias');
  const pintadas = await page.$$eval('a[href^="#/familia/"]', (n) => n.length);
  afirmar(pintadas === familias.length,
    `pinta ${pintadas} familias y el JSON trae ${familias.length}`);

  const grupos = [...new Set(familias.map((f) => f.grupo))];
  let suma = 0;
  for (const g of grupos) {
    await page.click(`.filtro[data-grupo="${g}"]`);
    suma += await page.$$eval('a[href^="#/familia/"]', (n) => n.length);
  }
  afirmar(suma === familias.length,
    `los grupos suman ${suma} familias y hay ${familias.length}`);
});

prueba('familias: el buscador encuentra por código y por texto', async (page) => {
  await ir(page, '/familias');
  const f = familias.find((x) => x.niveles.length > 0);
  await page.fill('#buscarFamilia', f.codigo);
  await page.waitForFunction((cod) => {
    const n = document.querySelectorAll('a[href^="#/familia/"]');
    return n.length >= 1 && [...n].some((a) => a.getAttribute('href') === '#/familia/' + cod);
  }, f.codigo);
  const valor = await page.inputValue('#buscarFamilia');
  afirmar(valor === f.codigo, 'el buscador pierde lo tecleado al repintar');
});

prueba('familia: enseña el reparto por bloque y suma lo mismo que el JSON', async (page) => {
  const conMinutos = familias.find((f) => {
    let t = 0;
    sesiones.forEach((s) => s.bloques.forEach((b) => {
      const e = ejercicios[b.codigo];
      if (e && e.familia === f.codigo) t += b.hasta - b.desde;
    }));
    return t > 0;
  });
  await irSinRecargar(page, '/familia/' + conMinutos.codigo);
  const valores = await page.$$eval('.barras__val', (n) =>
    n.map((x) => parseInt(x.textContent, 10)));
  const total = valores.reduce((a, b) => a + b, 0);

  let esperado = 0;
  sesiones.forEach((s) => s.bloques.forEach((b) => {
    const e = ejercicios[b.codigo];
    if (e && e.familia === conMinutos.codigo) esperado += b.hasta - b.desde;
  }));
  afirmar(total === esperado,
    `el reparto por bloque suma ${total} min y la temporada tiene ${esperado}`);
});

prueba('familia: los niveles conservan sus listas y se avisa de los no descritos', async (page) => {
  /* Varios niveles llevan listas numeradas en el original. Aplastadas en un
     párrafo corrido dejan de leerse, que es justo lo que pasaba. */
  const conLista = familias.find((f) => f.niveles.some((n) => /<[ou]l>/.test(n.html || '')));
  if (conLista) {
    await irSinRecargar(page, '/familia/' + conLista.codigo);
    const items = await page.$$eval('.nivel .prosa li', (n) => n.length);
    afirmar(items > 0, `los niveles de ${conLista.codigo} deberían traer una lista`);
  }

  /* Y si un nivel se entrena sin estar descrito en el banco, hay que decirlo:
     si no, la familia aparenta tener menos niveles de los que se usan. */
  const conExtra = familias.find((f) => {
    if (!f.niveles.length) return false;
    const descritos = f.niveles.map((n) => n.nivel);
    return Object.keys(ejercicios).some((c) =>
      ejercicios[c].familia === f.codigo && descritos.indexOf(ejercicios[c].nivel) < 0);
  });
  if (!conExtra) return;
  await irSinRecargar(page, '/familia/' + conExtra.codigo);
  const texto = await page.textContent('#app');
  afirmar(/que se entrena/i.test(texto),
    `${conExtra.codigo} tiene niveles sin describir y no se avisa`);
});

prueba('ejercicio: pizarra, montaje y dónde aparece', async (page) => {
  const cod = Object.keys(ejercicios).find((c) =>
    ejercicios[c].diagrama && ejercicios[c].detalle && ejercicios[c].familia);
  await irSinRecargar(page, '/ejercicio/' + cod);
  afirmar(await page.$('.pizarra svg'), 'la ficha del ejercicio no trae pizarra');
  afirmar(await page.$('.detalle'), 'la ficha del ejercicio no trae el montaje');

  const usos = sesiones.filter((s) => s.bloques.some((b) => b.codigo === cod)).length;
  const enlaces = await page.$$eval('a[href^="#/sesion/"]', (n) => n.length);
  afirmar(enlaces === usos, `dice aparecer en ${enlaces} sesiones y aparece en ${usos}`);
});

prueba('ejercicio: los que tienen las dos caras enseñan la consigna de defensa', async (page) => {
  const cod = Object.keys(ejercicios).find((c) => ejercicios[c].defensa);
  if (!cod) return;
  await irSinRecargar(page, '/ejercicio/' + cod);
  const texto = await page.textContent('#app');
  afirmar(/otra cara/i.test(texto), 'no aparece la consigna de la otra cara');
});

prueba('plan: lista los documentos y cada uno se abre', async (page) => {
  await ir(page, '/plan');
  const enlaces = await page.$$eval('a[href^="#/doc/"]', (n) => n.map((x) => x.getAttribute('href')));
  afirmar(enlaces.length > 0, 'el plan no lista ningún documento');
  for (const h of enlaces) {
    await irSinRecargar(page, h.replace('#', ''));
    const prosa = await page.$('.prosa');
    afirmar(prosa, `el documento ${h} se abre vacío`);
    const largo = (await page.textContent('.prosa')).trim().length;
    afirmar(largo > 200, `el documento ${h} solo tiene ${largo} caracteres`);
  }
});

prueba('plan: los documentos no traen HTML del original sin escapar', async (page) => {
  await ir(page, '/doc/banco');
  const script = await page.$$eval('.prosa script', (n) => n.length);
  afirmar(script === 0, 'ha entrado un <script> desde el markdown');
});

prueba('rotaciones: cada tanda lleva cinco y nadie baja del mínimo si da', async (page) => {
  await ir(page, '/hoy');
  /* Todas las convocatorias posibles, con los dos ritmos de cambio y con
     prioridades mezcladas. Los números salen del propio formato. */
  const fallos = await page.evaluate(() => {
    const malos = [];
    for (const cambiosPorCuarto of [1, 2]) {
      for (let n = 5; n <= 12; n++) {
        const f = { cuartos: 4, minCuarto: 10, cambiosPorCuarto, minimo: 10 };
        const js = Array.from({ length: n }, (_, i) => ({
          id: 'j' + i, baja: false, prioridad: ['mas', 'normal', 'menos'][i % 3] }));
        const plan = D.repartirMinutos(f, js, null, 0, []).plan;
        const res = D.resumenRotacion(f, js, plan);
        const tandas = D.tandas(f);
        if (plan.length !== tandas.length) malos.push(`${n}: ${plan.length} tandas`);
        if (plan.some((t) => t.length !== D.EN_PISTA)) malos.push(`${n}: una tanda sin cinco`);
        const posible = Math.floor(D.EN_PISTA * tandas.length / n) * tandas[0].minutos;
        if (res.minimo <= posible && res.porDebajo.length) malos.push(`${n}: alguna bajo el mínimo`);
        const suma = Object.values(res.minutos).reduce((a, b) => a + b, 0);
        if (suma !== D.EN_PISTA * f.cuartos * f.minCuarto) malos.push(`${n}: suman ${suma}`);
      }
    }
    return malos;
  });
  afirmar(fallos.length === 0, 'el reparto falla: ' + fallos.join(' | '));
});

prueba('rotaciones: las reglas se cumplen en cada tanda cuando se puede', async (page) => {
  await ir(page, '/hoy');
  /* Reglas de los cuatro tipos sobre grupos que se pisan y que no. Las
     jugadoras de cada regla salen de la convocatoria, no de nombres fijos. */
  const fallos = await page.evaluate(() => {
    const malos = [];
    const js = Array.from({ length: 12 }, (_, i) => ({ id: 'j' + i, prioridad: 'normal', baja: false }));
    const g = (a, b) => js.slice(a, b).map((j) => j.id);
    const juegos = [
      [{ tipo: 'almenos', n: 2, jugadoras: g(0, 3) }, { tipo: 'comomucho', n: 1, jugadoras: g(3, 6) },
       { tipo: 'maximo', n: 10, jugadoras: g(6, 8) }],
      [{ tipo: 'almenos', n: 1, jugadoras: g(0, 4) }, { tipo: 'almenos', n: 1, jugadoras: g(2, 6) },
       { tipo: 'minimo', n: 20, jugadoras: g(10, 12) }],
      [{ tipo: 'comomucho', n: 2, jugadoras: g(0, 6) }, { tipo: 'maximo', n: 15, jugadoras: g(6, 12) }]
    ];
    for (const cambiosPorCuarto of [1, 2]) {
      juegos.forEach((reglas, n) => {
        const f = { cuartos: 4, minCuarto: 10, cambiosPorCuarto, minimo: 10 };
        const r = D.repartirMinutos(f, js, null, 0, reglas);
        const res = D.resumenRotacion(f, js, r.plan, reglas);
        if (r.plan.some((t) => t.length !== D.EN_PISTA)) malos.push(`${n}: tanda sin cinco`);
        /* Si el reparto no avisa de haber aflojado nada, todo tiene que cumplirse. */
        if (!r.avisos.some((a) => /no las tiene en cuenta/.test(a)) && res.malas.length) {
          malos.push(`${n}/${cambiosPorCuarto}: ${res.malas.length} tandas se saltan una regla sin avisar`);
        }
        if (res.porEncima.length) malos.push(`${n}/${cambiosPorCuarto}: alguna pasa de su máximo`);
      });
    }
    return malos;
  });
  afirmar(fallos.length === 0, 'las reglas fallan: ' + fallos.join(' | '));
});

prueba('rotaciones: un máximo del entrenador manda sobre el mínimo del plan, y se avisa', async (page) => {
  await ir(page, '/hoy');
  const r = await page.evaluate(() => {
    const js = Array.from({ length: 12 }, (_, i) => ({ id: 'j' + i, prioridad: 'normal', baja: false }));
    const f = { cuartos: 4, minCuarto: 10, cambiosPorCuarto: 2, minimo: 10 };
    const largo = D.tandas(f)[0].minutos;
    /* Un máximo de una sola tanda, por debajo de un mínimo de dos. */
    const reglas = [{ tipo: 'maximo', n: largo, jugadoras: ['j0'] }];
    const x = D.repartirMinutos(f, js, null, 0, reglas);
    const res = D.resumenRotacion(f, js, x.plan, reglas);
    return { min: res.minutos.j0, largo, aviso: res.avisos.some((a) => /Manda tu regla/.test(a)),
             debajo: res.porDebajo.includes('j0') };
  });
  afirmar(r.min === r.largo, `con un máximo de ${r.largo} ha jugado ${r.min}`);
  afirmar(!r.debajo, 'la marca como por debajo del mínimo cuando manda su regla');
  afirmar(r.aviso, 'no avisa de que la regla baja del mínimo del plan');
});

prueba('rotaciones: una regla se añade desde la pantalla y entra en el reparto', async (page) => {
  await ir(page, '/rotaciones');
  await page.click('[data-accion="rot-doce"]');
  const ids = await page.evaluate(() => App.rot().plantilla.map((j) => j.id));
  await page.click('[data-accion="rot-regla-tipo"][data-valor="comomucho"]');
  await page.fill('#rotReglaN', '1');
  for (const id of ids.slice(0, 3)) {
    await page.click(`[data-accion="rot-regla-jugadora"][data-id="${id}"]`);
  }
  await page.click('[data-accion="rot-regla-anadir"]');
  afirmar(await page.$$eval('.rot__reglas li', (n) => n.length) === 1, 'la regla no aparece en la lista');
  await page.click('[data-accion="rot-repartir"]');
  const juntas = await page.evaluate((grupo) => App.rot().partido.plan
    .filter((t) => t.filter((id) => grupo.includes(id)).length > 1).length, ids.slice(0, 3));
  afirmar(juntas === 0, `${juntas} tandas tienen a dos del grupo de «como mucho una»`);
});

prueba('rotaciones: una baja recalcula el resto sin tocar lo jugado', async (page) => {
  await ir(page, '/rotaciones');
  await page.click('[data-accion="rot-doce"]');
  await page.click('[data-accion="rot-repartir"]');
  const tandas = await page.$$eval('#rotDesde option', (n) => n.length);
  const corte = Math.floor(tandas / 2);
  const antes = await page.evaluate((c) => JSON.stringify(App.rot().partido.plan.slice(0, c)), corte);
  const id = await page.evaluate(() => App.rot().plantilla[0].id);
  await page.click(`[data-accion="rot-baja"][data-id="${id}"]`);
  await page.selectOption('#rotDesde', String(corte));
  await page.click('[data-accion="rot-recalcular"]');
  const despues = await page.evaluate(() => App.rot().partido.plan);
  afirmar(JSON.stringify(despues.slice(0, corte)) === antes, 'recalcular ha cambiado tandas ya jugadas');
  afirmar(!despues.slice(corte).some((t) => t.includes(id)), 'la baja sigue saliendo a pista');
  afirmar(despues.every((t) => t.length === 5), 'tras la baja alguna tanda no tiene cinco');
});

prueba('rotaciones: la plantilla se queda en el navegador y sobrevive a recargar', async (page) => {
  await ir(page, '/rotaciones');
  await page.click('[data-accion="rot-doce"]');
  const id = await page.evaluate(() => App.rot().plantilla[0].id);
  await page.fill('#rotNombre-' + id, 'Prueba');
  /* Escribir un nombre y pulsar Repartir sin cerrar el teclado: si el campo
     repintara al perder el foco, el toque se perdería. */
  await page.click('[data-accion="rot-repartir"]');
  afirmar(await page.$('.rot__tabla'), 'el primer toque en Repartir después de escribir se pierde');
  await ir(page, '/rotaciones');
  const tabla = await page.textContent('.rot__tabla');
  afirmar(tabla.includes('Prueba'), 'el nombre no sobrevive a recargar');
  const casillas = await page.$$eval('.rot__celda[aria-pressed="true"]', (n) => n.length);
  const tandas = await page.$$eval('#rotDesde option', (n) => n.length);
  afirmar(casillas === 5 * tandas, `hay ${casillas} casillas en pista y deberían ser ${5 * tandas}`);
});

prueba('una ruta que no existe no deja la pantalla en blanco', async (page) => {
  await ir(page, '/no-existe');
  const texto = await page.textContent('#app');
  afirmar(/no existe/i.test(texto), 'una ruta inventada no avisa');
});

prueba('la ficha se imprime desplegada y sin cronómetro', async (page) => {
  await ir(page, '/sesion/' + sesiones[0].id);
  await page.emulateMedia({ media: 'print' });
  const cronoVisible = await page.$eval('.crono', (n) => n.offsetParent !== null);
  afirmar(!cronoVisible, 'el cronómetro sale en la impresión');
  const panel = await page.$('.desplegable');
  if (panel) afirmar(await panel.isVisible(), 'las pizarras no se despliegan al imprimir');
  await page.emulateMedia({ media: 'screen' });
});

/* ------------------------------------------------------------------ arranque */

(async () => {
  let servidor = true;
  try {
    const r = await fetch(BASE);
    servidor = r.ok;
  } catch (e) { servidor = false; }
  if (!servidor) {
    console.error(`No encuentro el servidor en ${BASE}.`);
    console.error('Levántalo desde la raíz con:  python3 -m http.server 8777');
    process.exit(2);
  }

  /* CHROMIUM permite apuntar a un navegador ya instalado en lugar del que se
     bajaría Playwright. Hace falta en entornos donde la descarga está cerrada y
     el binario viene con la imagen; en un portátil normal se deja sin poner. */
  const navegador = await chromium.launch(
    process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
  const lista = pruebas.filter((p) => p.nombre.includes(filtro));
  let fallos = 0;

  for (const p of lista) {
    const contexto = await navegador.newContext();
    const page = await contexto.newPage();
    const errores = [];
    page.on('console', (m) => { if (m.type() === 'error') errores.push(m.text()); });
    page.on('pageerror', (e) => errores.push(e.message));

    try {
      await p.fn(page, errores);
      console.log('  ok   ' + p.nombre);
    } catch (e) {
      fallos++;
      console.log('  FALLA ' + p.nombre);
      console.log('        ' + e.message);
    }
    await contexto.close();
  }

  await navegador.close();
  console.log(`\n${lista.length - fallos} de ${lista.length} pruebas pasan.`);
  process.exit(fallos ? 1 : 0);
})();
